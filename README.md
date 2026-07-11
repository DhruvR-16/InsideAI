# Inside AI

Ever wondered what actually happens between typing a question and getting an AI response? Inside AI shows you.

It's a visual playground that breaks open the "black box" of AI reasoning. You ask a question, and instead of just getting an answer, you watch the entire thinking process unfold — step by step, in real time.

---

## How It Works

When you send a query, it doesn't just go to one model and come back. It flows through a **6-stage pipeline**, where each stage has a specific job:

```
Your Question
      │
      ▼
 Intent Analyzer     →  "What kind of question is this? Simple or complex?"
      │
  ┌───┴───┐
  ▼       ▼
Memory   Knowledge   →  Checks conversation history + searches a local knowledge base
  └───┬───┘              (these two run in parallel to save time)
      ▼
   Planner           →  Creates a structured outline for the response
      ▼
   Critic            →  Reviews the plan — "Is this actually good? Did we miss anything?"
      │                   If not happy, sends it back to the Planner (revision loop)
      ▼
   Writer            →  Streams the final answer, token by token
```

**The twist:** If the question is simple (like "what is AI?"), the system detects that and skips the Planner and Critic entirely. No point planning a 3-section essay for a one-liner. This cuts response time from ~8s to ~2.5s.

Every single one of these stages — the prompts sent, the raw JSON responses, the latency, the decisions — is visible in the UI. Nothing is hidden.

---

## What You See on Screen

The dashboard has three columns:

- **Left** — Chat. Ask questions, see streaming responses, click past messages to replay their traces.
- **Center** — Live pipeline timeline showing each stage lighting up as it executes, with latency and output previews.
- **Right** — Inspector panel. Click any stage to see the exact system prompt, user prompt, and raw LLM response that was used.

---

## The Stack

**Backend:** Python, FastAPI, WebSockets for real-time streaming, ChromaDB for local vector search (RAG), Pydantic for structured outputs.

**Frontend:** React (Vite), React Flow for the DAG visualization, Lucide icons, vanilla CSS.

**LLM:** Groq API (fast cloud inference) with automatic fallback to Ollama (local, free, private) when rate-limited.

---

## Running It Locally

**You need:** Node.js 18+, Python 3.10+, a free [Groq API key](https://console.groq.com/).

```bash
# Clone
git clone https://github.com/DhruvR-16/InsideAI.git
cd InsideAI
```

Create a `.env` file in the root:

```ini
GROQ_API_KEY="your_key_here"
LLM_PROVIDER="hybrid"
OLLAMA_HOST="http://localhost:11434"
OLLAMA_MODEL="qwen2.5:3b"
MAX_TOKENS=400
```

Start the backend:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
PYTHONPATH=. uvicorn backend.main:app --port 8000
```

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```
