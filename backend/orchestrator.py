import os
import json
import time
import asyncio
import httpx
import contextvars
from typing import List, Dict, Any, Callable, AsyncGenerator, Optional
from groq import AsyncGroq, RateLimitError
from dotenv import load_dotenv

from backend.schemas import (
    IntentAnalysis,
    MemoryExchange,
    MemoryContext,
    KnowledgeRetrieval,
    Plan,
    Critique,
)
from backend.rag import query_knowledge_base

load_dotenv()

# Configuration
DEFAULT_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "hybrid")  # groq | ollama | hybrid

MAX_RETRIES = 3
INITIAL_BACKOFF = 2.0  # seconds
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "400"))

# Model mappings for up to 3 educational comparison slots
SLOT_MODELS = {
    0: "llama-3.1-8b-instant",  # Llama 3.1 8B
    1: "gemma2-9b-it",          # Gemma 2 9B
    2: "llama-3.2-3b-preview"   # Llama 3.2 3B
}

SLOT_OLLAMA_MODELS = {
    0: "llama3.2",
    1: "gemma2:2b",
    2: "qwen2.5:1.5b"
}

# Context variables isolated per async task loop
current_model_slot = contextvars.ContextVar("current_model_slot", default=0)
current_api_keys_pool = contextvars.ContextVar("current_api_keys_pool", default={0: [], 1: [], 2: []})

last_system_prompt = contextvars.ContextVar("last_system_prompt", default=None)
last_user_prompt = contextvars.ContextVar("last_user_prompt", default=None)
last_raw_response = contextvars.ContextVar("last_raw_response", default=None)
last_key_used = contextvars.ContextVar("last_key_used", default=None)
last_provider = contextvars.ContextVar("last_provider", default=None)

# In-memory session history store per session and model slot
# Schema: { f"{session_id}_{slot_id}": [MemoryExchange] }
session_histories: Dict[str, List[MemoryExchange]] = {}
groq_client = None
active_key_pointers = {0: 0, 1: 0, 2: 0}

def get_groq_client() -> AsyncGroq:
    global groq_client
    slot = current_model_slot.get()
    pool = current_api_keys_pool.get().get(slot, [])
    
    if pool:
        pointer = active_key_pointers[slot] % len(pool)
        active_key = pool[pointer]
        # Mask the key for logs
        masked = active_key[:6] + "..." + active_key[-4:] if len(active_key) > 10 else "..."
        last_key_used.set(f"User Key #{pointer + 1} ({masked})")
        return AsyncGroq(api_key=active_key)
        
    # Fallback to system key
    last_key_used.set("System Primary Key")
    if not groq_client:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set in environment.")
        groq_client = AsyncGroq(api_key=api_key)
    return groq_client

async def call_groq_with_retry(
    messages: List[Dict[str, str]],
    model: str,
    json_mode: bool = False,
    stream: bool = False
) -> Any:
    """Wrapper around Groq API calls with rate-limit retries and automatic key rotation."""
    client = get_groq_client()
    backoff = INITIAL_BACKOFF

    # Educational trace logging
    system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
    user_msg = next((m["content"] for m in messages if m["role"] == "user"), "")
    last_system_prompt.set(system_msg)
    last_user_prompt.set(user_msg)
    last_provider.set("Groq")

    for attempt in range(MAX_RETRIES):
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": 0.1,
                "max_tokens": MAX_TOKENS,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            
            if stream:
                raw_stream = await client.chat.completions.create(**kwargs, stream=True)
                async def text_stream():
                    tokens = []
                    async for chunk in raw_stream:
                        if chunk.choices and chunk.choices[0].delta.content:
                            tok = chunk.choices[0].delta.content
                            tokens.append(tok)
                            yield tok
                    last_raw_response.set("".join(tokens))
                return text_stream()
            
            response = await client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content.strip()
            last_raw_response.set(content)
            return content
        except RateLimitError as e:
            slot = current_model_slot.get()
            pool = current_api_keys_pool.get().get(slot, [])
            
            # Key rotation fallback
            if pool and len(pool) > 1:
                active_key_pointers[slot] = (active_key_pointers[slot] + 1) % len(pool)
                print(f"Slot {slot} rate limited. Rotating to key index {active_key_pointers[slot]}...")
                # Immediately retry with the next key, bypassing wait
                return await call_groq_with_retry(messages, model, json_mode, stream)
            
            # Fail fast if no rotation keys are configured in hybrid mode to avoid sequential sleep delays
            provider = os.getenv("LLM_PROVIDER", "hybrid").lower()
            if provider == "hybrid":
                print(f"Slot {slot} rate limited on Groq with no rotation options. Failing fast to trigger local Ollama fallback immediately.")
                raise e
                
            if attempt == MAX_RETRIES - 1:
                print(f"Rate limit exceeded on final attempt: {e}")
                raise e
            print(f"Rate limit hit. Retrying in {backoff} seconds... (Attempt {attempt+1}/{MAX_RETRIES})")
            await asyncio.sleep(backoff)
            backoff *= 2.0
        except Exception as e:
            print(f"API Error: {e}")
            raise e

async def call_ollama(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    json_mode: bool = False,
    stream: bool = False
) -> Any:
    """Calls local Ollama instance via its OpenAI-compatible API."""
    url = f"{OLLAMA_HOST}/v1/chat/completions"
    slot = current_model_slot.get()
    
    if not model:
        model = SLOT_OLLAMA_MODELS.get(slot, OLLAMA_MODEL)
        
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": MAX_TOKENS,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
        
    # Trace setup
    system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
    user_msg = next((m["content"] for m in messages if m["role"] == "user"), "")
    last_system_prompt.set(system_msg)
    last_user_prompt.set(user_msg)
    last_provider.set(f"Ollama ({model})")
    last_key_used.set("Local Machine (Ollama)")
        
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            if stream:
                payload["stream"] = True
                async def text_stream():
                    tokens = []
                    async with client.stream("POST", url, json=payload) as response:
                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                line_content = line[6:].strip()
                                if line_content == "[DONE]":
                                    break
                                try:
                                    chunk_data = json.loads(line_content)
                                    token = chunk_data["choices"][0]["delta"].get("content", "")
                                    if token:
                                        tokens.append(token)
                                        yield token
                                except Exception:
                                    pass
                    last_raw_response.set("".join(tokens))
                return text_stream()
            else:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"].strip()
                last_raw_response.set(content)
                return content
    except Exception as e:
        # If slot model fails (e.g. not pulled), fall back to default OLLAMA_MODEL
        if model != OLLAMA_MODEL:
            print(f"Local model {model} failed. Trying default {OLLAMA_MODEL}...")
            return await call_ollama(messages, model=OLLAMA_MODEL, json_mode=json_mode, stream=stream)
        print(f"Ollama call failed: {e}")
        raise e

async def call_llm(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    json_mode: bool = False,
    stream: bool = False
) -> Any:
    """Unified interface to route calls between Groq and local Ollama based on provider configuration."""
    provider = os.getenv("LLM_PROVIDER", "hybrid").lower()
    slot = current_model_slot.get()
    
    if not model:
        model = SLOT_MODELS.get(slot, DEFAULT_MODEL)
    
    if provider == "ollama":
        return await call_ollama(messages, json_mode=json_mode, stream=stream)
        
    try:
        return await call_groq_with_retry(messages, model, json_mode, stream)
    except Exception as e:
        if provider == "hybrid":
            print(f"Groq call failed ({e}). Falling back to local Ollama...")
            return await call_ollama(messages, json_mode=json_mode, stream=stream)
        raise e

# --- 1. Intent Analyzer Stage ---
async def analyze_intent(query: str) -> IntentAnalysis:
    system_prompt = (
        "You are an intent classification module for a transparent multi-agent pipeline.\n"
        "Your task is to analyze the user's query and output ONLY a valid JSON object matching this schema:\n"
        "{\n"
        "  \"intent_category\": \"factual_explanation\" | \"comparison\" | \"creative\" | \"procedural\" | \"analytical\",\n"
        "  \"core_question\": \"<one sentence restatement of the question>\",\n"
        "  \"requires_retrieval\": true|false,\n"
        "  \"requires_memory\": true|false,\n"
        "  \"complexity\": \"simple\" | \"moderate\" | \"complex\",\n"
        "  \"key_entities\": [\"entity1\", \"entity2\"]\n"
        "}\n"
        "Ensure requires_retrieval is true if the query asks about technical, historical, scientific, or biological topics.\n"
        "No conversational text, no markdown code blocks, output only the JSON object."
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"User query: {query}"}
    ]
    
    content = await call_llm(messages, json_mode=True)
    data = json.loads(content)
    return IntentAnalysis(**data)

# --- 2. Memory Stage ---
async def retrieve_memory(query: str, session_id: str, requires_memory: bool) -> MemoryContext:
    slot_id = current_model_slot.get()
    storage_key = f"{session_id}_{slot_id}"
    
    if not requires_memory or storage_key not in session_histories or not session_histories[storage_key]:
        return MemoryContext(relevant_history=[], found_context=False)
    
    history = session_histories[storage_key]
    
    system_prompt = (
        "You are a memory context retriever. Given the user's new query and the conversation history, "
        "select the exchanges that are relevant to understanding or answering the new query.\n"
        "Output ONLY a valid JSON object matching this schema:\n"
        "{\n"
        "  \"relevant_indices\": [integer indices of relevant messages, 0-indexed],\n"
        "  \"found_context\": true|false\n"
        "}\n"
        "Conversation history is provided as a list of role/content pairs."
    )
    
    history_str = "\n".join([f"{i}: [{h.role}] {h.content}" for i, h in enumerate(history)])
    user_content = f"New query: {query}\n\nHistory:\n{history_str}"
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ]
    
    try:
        content = await call_llm(messages, json_mode=True)
        data = json.loads(content)
        
        relevant_exchanges = []
        if data.get("found_context") and data.get("relevant_indices"):
            for idx in data["relevant_indices"]:
                if 0 <= idx < len(history):
                    relevant_exchanges.append(history[idx])
            return MemoryContext(relevant_history=relevant_exchanges, found_context=True)
    except Exception as e:
        print(f"Memory extraction failed: {e}")
        
    return MemoryContext(relevant_history=[], found_context=False)

# --- 3. Knowledge Retrieval Stage ---
async def retrieve_knowledge(query: str, requires_retrieval: bool) -> KnowledgeRetrieval:
    if not requires_retrieval:
        return KnowledgeRetrieval(retrieved_chunks=[], retrieval_used=False)
    
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: query_knowledge_base(query))

# --- 4. Planner Stage ---
async def generate_plan(
    query: str, 
    intent: IntentAnalysis, 
    memory: MemoryContext, 
    kb: KnowledgeRetrieval,
    critique_feedback: str = None
) -> Plan:
    system_prompt = (
        "You are a response planner module.\n"
        "Your task is to create a structured outline of the response before generating it.\n"
        "Output ONLY a valid JSON object matching this schema:\n"
        "{\n"
        "  \"approach\": \"<one sentence strategy summary>\",\n"
        "  \"sections\": [\n"
        "    {\"heading\": \"<section heading>\", \"key_points\": [\"point1\", \"point2\"]}\n"
        "  ],\n"
        "  \"estimated_length\": \"short\" | \"medium\" | \"long\"\n"
        "}\n"
        "No conversational text, no markdown fences, JSON only."
    )
    
    context_str = ""
    if memory.found_context:
        mem_history = "\n".join([f"[{m.role}]: {m.content}" for m in memory.relevant_history])
        context_str += f"\nConversation Memory:\n{mem_history}\n"
    if kb.retrieval_used and kb.retrieved_chunks:
        kb_text = "\n".join([f"- Source: {c.source}\n  Content: {c.text}" for c in kb.retrieved_chunks])
        context_str += f"\nRetrieved Knowledge Chunks:\n{kb_text}\n"

    user_content = f"User query: {query}\n\nIntent Analysis:\n{intent.model_dump_json()}\n{context_str}"
    
    if critique_feedback:
        user_content += f"\n\nCRITICAL FEEDBACK FROM CRITIC. You must revise your plan to address these points:\n{critique_feedback}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ]
    
    content = await call_llm(messages, json_mode=True)
    data = json.loads(content)
    return Plan(**data)

# --- 5. Logic / Critic Stage ---
async def critique_plan(
    query: str,
    intent: IntentAnalysis,
    kb: KnowledgeRetrieval,
    plan: Plan
) -> Critique:
    system_prompt = (
        "You are a logical critic module.\n"
        "Your job is to review the proposed response plan against the user's intent and retrieved knowledge.\n"
        "Check for:\n"
        "1. Factual consistency (does the plan align with the retrieved knowledge?)\n"
        "2. Completeness (does the plan answer all aspects of the core question?)\n"
        "3. Logical flow.\n\n"
        "Output ONLY a valid JSON object matching this schema:\n"
        "{\n"
        "  \"issues_found\": [\"issue1\", \"issue2\" or empty list if perfect],\n"
        "  \"plan_approved\": true|false,\n"
        "  \"confidence_score\": integer (0-100 representing your rating of the final response capability),\n"
        "  \"confidence_rationale\": \"<explanation of your score>\"\n"
        "}\n"
        "No conversational text, no markdown fences, JSON only."
    )
    
    context_str = ""
    if kb.retrieval_used and kb.retrieved_chunks:
        kb_text = "\n".join([f"- Source: {c.source}\n  Content: {c.text}" for c in kb.retrieved_chunks])
        context_str += f"\nRetrieved Knowledge Chunks:\n{kb_text}\n"

    user_content = (
        f"User query: {query}\n"
        f"Intent Analysis:\n{intent.model_dump_json()}\n"
        f"Context:\n{context_str}\n"
        f"Proposed Plan:\n{plan.model_dump_json()}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ]
    
    content = await call_llm(messages, json_mode=True)
    data = json.loads(content)
    return Critique(**data)

# --- 6. Writer Stage (Streaming Output) ---
async def generate_response_stream(
    query: str,
    intent: IntentAnalysis,
    kb: KnowledgeRetrieval,
    plan: Plan
) -> AsyncGenerator[str, None]:
    """Generates the final response by streaming tokens from the LLM based on the approved plan."""
    system_prompt = (
        "You are the Writer module of a multi-agent pipeline.\n"
        "Your task is to generate a comprehensive, clear, and engaging final response to the user's query.\n"
        "You must strictly base your response on the Approved Plan and the retrieved knowledge context.\n"
        "Write naturally in Markdown, adhering to the structure outlined in the plan sections.\n"
        "Do not mention the pipeline, agents, plans, or internal modules in your final output. Speak directly to the user."
    )
    
    context_str = ""
    if kb.retrieval_used and kb.retrieved_chunks:
        kb_text = "\n".join([f"- Content: {c.text}" for c in kb.retrieved_chunks])
        context_str += f"\nRetrieved Knowledge Context:\n{kb_text}\n"

    user_content = (
        f"User query: {query}\n"
        f"Approved Plan:\n{plan.model_dump_json()}\n"
        f"Context:\n{context_str}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ]
    
    stream_response = await call_llm(messages, stream=True)
    
    async for token in stream_response:
        yield token

# --- Internal Pipeline Implementation ---
async def _run_pipeline_internal(
    query: str,
    session_id: str,
    event_callback: Callable[[Dict[str, Any]], Any],
    slot_id: int
) -> str:
    """Internal implementation of the orchestrator DAG pipeline tagged by slot ID."""
    pipeline_start_time = time.time()
    
    # Stage helper to wrap latency measuring and educational trace event emitting
    async def run_stage(stage_name: str, coro_func: Callable[[], Any]) -> Any:
        start_time = time.time()
        
        # Reset trace properties for this execution context
        last_system_prompt.set(None)
        last_user_prompt.set(None)
        last_raw_response.set(None)
        
        await event_callback({
            "event": "stage_start",
            "stage": stage_name,
            "model_slot_id": slot_id,
            "timestamp": start_time * 1000
        })
        
        output = await coro_func()
        
        end_time = time.time()
        duration_ms = (end_time - start_time) * 1000
        
        output_dict = {}
        if hasattr(output, "model_dump"):
            output_dict = output.model_dump()
        elif isinstance(output, dict):
            output_dict = output
        else:
            output_dict = {"text": str(output)}
            
        await event_callback({
            "event": "stage_complete",
            "stage": stage_name,
            "model_slot_id": slot_id,
            "duration_ms": round(duration_ms, 2),
            "output": output_dict,
            "timestamp": end_time * 1000,
            
            # Educational tracing metadata
            "system_prompt": last_system_prompt.get(),
            "user_prompt": last_user_prompt.get(),
            "raw_llm_response": last_raw_response.get(),
            "active_key_masked": last_key_used.get(),
            "provider_used": last_provider.get()
        })
        return output

    # 1. Intent Analyzer
    intent = await run_stage("intent_analyzer", lambda: analyze_intent(query))
    
    # 2 & 3. Memory & Knowledge Retrieval (Executed Concurrently for Speed)
    memory_task = run_stage(
        "memory", 
        lambda: retrieve_memory(query, session_id, intent.requires_memory)
    )
    kb_task = run_stage(
        "knowledge_retrieval", 
        lambda: retrieve_knowledge(query, intent.requires_retrieval)
    )
    memory, kb = await asyncio.gather(memory_task, kb_task)
    
    # 4. Planner (Iteration 1)
    plan = await run_stage(
        "planner", 
        lambda: generate_plan(query, intent, memory, kb)
    )
    
    # 5. Logic / Critic (Iteration 1)
    critique = await run_stage(
        "logic_critic", 
        lambda: critique_plan(query, intent, kb, plan)
    )
    
    # Revision cycle
    if not critique.plan_approved:
        print(f"[Slot {slot_id}] Plan rejected by critic. Starting revision cycle...")
        
        plan = await run_stage(
            "planner_revision", 
            lambda: generate_plan(
                query, intent, memory, kb, 
                critique_feedback="\n".join(critique.issues_found)
            )
        )
        
        critique = await run_stage(
            "logic_critic_revision", 
            lambda: critique_plan(query, intent, kb, plan)
        )
    
    # 6. Writer (Streaming)
    writer_start_time = time.time()
    await event_callback({
        "event": "stage_start",
        "stage": "writer",
        "model_slot_id": slot_id,
        "timestamp": writer_start_time * 1000
    })
    
    final_response_chunks = []
    async for chunk in generate_response_stream(query, intent, kb, plan):
        final_response_chunks.append(chunk)
        await event_callback({
            "event": "token",
            "stage": "writer",
            "model_slot_id": slot_id,
            "text_chunk": chunk
        })
        await asyncio.sleep(0.01)
        
    final_response = "".join(final_response_chunks)
    writer_end_time = time.time()
    writer_duration_ms = (writer_end_time - writer_start_time) * 1000
    
    await event_callback({
        "event": "stage_complete",
        "stage": "writer",
        "model_slot_id": slot_id,
        "duration_ms": round(writer_duration_ms, 2),
        "output": {"text": final_response},
        "timestamp": writer_end_time * 1000,
        "system_prompt": last_system_prompt.get(),
        "user_prompt": last_user_prompt.get(),
        "raw_llm_response": final_response,
        "active_key_masked": last_key_used.get(),
        "provider_used": last_provider.get()
    })
    
    # Update Session Memory per slot
    storage_key = f"{session_id}_{slot_id}"
    if storage_key not in session_histories:
        session_histories[storage_key] = []
    session_histories[storage_key].append(MemoryExchange(role="user", content=query))
    session_histories[storage_key].append(MemoryExchange(role="assistant", content=final_response))
    
    if len(session_histories[storage_key]) > 20:
        session_histories[storage_key] = session_histories[storage_key][-20:]
        
    # Complete pipeline
    pipeline_duration_ms = (time.time() - pipeline_start_time) * 1000
    await event_callback({
        "event": "pipeline_complete",
        "model_slot_id": slot_id,
        "total_duration_ms": round(pipeline_duration_ms, 2),
        "final_output": final_response,
        "confidence_score": critique.confidence_score,
        "timestamp": time.time() * 1000
    })
    
    return final_response


# --- Full Pipeline Orchestrator ---
async def run_pipeline(
    query: str,
    session_id: str,
    event_callback: Callable[[Dict[str, Any]], Any],
    custom_api_key: Optional[str] = None
) -> str:
    """Runs up to 3 model slots concurrently, distributing provided API keys."""
    # Split the override key input if comma-separated
    keys = [k.strip() for k in custom_api_key.split(",") if k.strip()] if custom_api_key else []
    
    # Distribute keys to slot pools:
    # If 1 key provided, distribute to all slots.
    # If multiple, round-robin them.
    slot_keys = {0: [], 1: [], 2: []}
    if len(keys) == 1:
        slot_keys[0] = [keys[0]]
        slot_keys[1] = [keys[0]]
        slot_keys[2] = [keys[0]]
    elif len(keys) >= 2:
        for i, k in enumerate(keys):
            slot_keys[i % 3].append(k)

    current_api_keys_pool.set(slot_keys)

    # Throttled execution task runner to space out parallel API start bounds
    async def run_slot_pipeline(slot_id: int):
        # ContextVars isolate automatically in async Tasks
        current_model_slot.set(slot_id)
        # Apply a minor stagger to avoid triggering simultaneous RPM limit flags
        if slot_id > 0:
            await asyncio.sleep(slot_id * 0.150)
            
        try:
            return await _run_pipeline_internal(query, session_id, event_callback, slot_id)
        except Exception as e:
            print(f"Model Slot {slot_id} failed: {e}")
            await event_callback({
                "event": "error",
                "model_slot_id": slot_id,
                "message": f"Execution failed: {str(e)}"
            })
            return ""

    # Execute all slots concurrently
    results = await asyncio.gather(
        run_slot_pipeline(0),
        run_slot_pipeline(1),
        run_slot_pipeline(2)
    )
    return results[0]
