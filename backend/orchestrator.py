import os
import json
import time
import asyncio
import httpx
from typing import List, Dict, Any, Callable, AsyncGenerator
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

# In-memory session history store
# Schema: { session_id: [MemoryExchange] }
session_histories: Dict[str, List[MemoryExchange]] = {}
import contextvars

# Thread-safe and async-safe context variable to store custom user-provided API keys
current_api_key = contextvars.ContextVar("current_api_key", default=None)
groq_client = None

def get_groq_client() -> AsyncGroq:
    global groq_client
    # If a custom API key is set in the context, create a dedicated client for it
    custom_key = current_api_key.get()
    if custom_key:
        return AsyncGroq(api_key=custom_key)
        
    if not groq_client:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set in environment.")
        groq_client = AsyncGroq(api_key=api_key)
    return groq_client

async def call_groq_with_retry(
    messages: List[Dict[str, str]],
    model: str = DEFAULT_MODEL,
    json_mode: bool = False,
    stream: bool = False
) -> Any:
    """Wrapper around Groq API calls with rate-limit retries."""
    client = get_groq_client()
    backoff = INITIAL_BACKOFF

    for attempt in range(MAX_RETRIES):
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": 0.1,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            
            if stream:
                raw_stream = await client.chat.completions.create(**kwargs, stream=True)
                async def text_stream():
                    async for chunk in raw_stream:
                        if chunk.choices and chunk.choices[0].delta.content:
                            yield chunk.choices[0].delta.content
                return text_stream()
            
            response = await client.chat.completions.create(**kwargs)
            return response.choices[0].message.content.strip()
        except RateLimitError as e:
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
    model: str = OLLAMA_MODEL,
    json_mode: bool = False,
    stream: bool = False
) -> Any:
    """Calls local Ollama instance via its OpenAI-compatible API."""
    url = f"{OLLAMA_HOST}/v1/chat/completions"
    
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.1,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
        
    try:
        # Use a generous timeout for local models that might run on slower GPUs/CPUs
        async with httpx.AsyncClient(timeout=90.0) as client:
            if stream:
                payload["stream"] = True
                async def text_stream():
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
                                        yield token
                                except Exception:
                                    pass
                return text_stream()
            else:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"Ollama call failed: {e}")
        raise e

async def call_llm(
    messages: List[Dict[str, str]],
    model: str = DEFAULT_MODEL,
    json_mode: bool = False,
    stream: bool = False
) -> Any:
    """Unified interface to route calls between Groq and local Ollama based on provider configuration."""
    provider = os.getenv("LLM_PROVIDER", "hybrid").lower()
    
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
        "Ensure requires_retrieval is true if the query asks about technical, historical, scientific, or biological topics (e.g., Transformers, attention, CRISPR, DNA, DNS, public-key cryptography, quantum computing, RAG, RLHF, etc.).\n"
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
    if not requires_memory or session_id not in session_histories or not session_histories[session_id]:
        return MemoryContext(relevant_history=[], found_context=False)
    
    history = session_histories[session_id]
    
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

# --- Full Pipeline Orchestrator ---
async def run_pipeline(
    query: str,
    session_id: str,
    event_callback: Callable[[Dict[str, Any]], Any],
    custom_api_key: str = None
) -> str:
    """Wrapper that sets the custom API key context before running the pipeline."""
    token = current_api_key.set(custom_api_key)
    try:
        return await _run_pipeline_internal(query, session_id, event_callback)
    finally:
        current_api_key.reset(token)

async def _run_pipeline_internal(
    query: str,
    session_id: str,
    event_callback: Callable[[Dict[str, Any]], Any]
) -> str:
    """Internal implementation of the orchestrator DAG pipeline."""
    pipeline_start_time = time.time()
    
    # Stage helper to wrap latency measuring and event emitting
    async def run_stage(stage_name: str, coro_func: Callable[[], Any]) -> Any:
        start_time = time.time()
        await event_callback({
            "event": "stage_start",
            "stage": stage_name,
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
            
        await event_callback({
            "event": "stage_complete",
            "stage": stage_name,
            "duration_ms": round(duration_ms, 2),
            "output": output_dict,
            "timestamp": end_time * 1000
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
    
    # If the plan was rejected, we allow exactly one revision cycle
    if not critique.plan_approved:
        print("Plan rejected by critic. Starting revision cycle...")
        
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
        "timestamp": writer_start_time * 1000
    })
    
    final_response_chunks = []
    async for chunk in generate_response_stream(query, intent, kb, plan):
        final_response_chunks.append(chunk)
        await event_callback({
            "event": "token",
            "stage": "writer",
            "text_chunk": chunk
        })
        await asyncio.sleep(0.01)
        
    final_response = "".join(final_response_chunks)
    writer_end_time = time.time()
    writer_duration_ms = (writer_end_time - writer_start_time) * 1000
    
    await event_callback({
        "event": "stage_complete",
        "stage": "writer",
        "duration_ms": round(writer_duration_ms, 2),
        "output": {"text": final_response},
        "timestamp": writer_end_time * 1000
    })
    
    # Update Session Memory
    if session_id not in session_histories:
        session_histories[session_id] = []
    session_histories[session_id].append(MemoryExchange(role="user", content=query))
    session_histories[session_id].append(MemoryExchange(role="assistant", content=final_response))
    
    if len(session_histories[session_id]) > 20:
        session_histories[session_id] = session_histories[session_id][-20:]
        
    # Complete pipeline
    pipeline_duration_ms = (time.time() - pipeline_start_time) * 1000
    await event_callback({
        "event": "pipeline_complete",
        "total_duration_ms": round(pipeline_duration_ms, 2),
        "final_output": final_response,
        "confidence_score": critique.confidence_score,
        "timestamp": time.time() * 1000
    })
    
    return final_response
