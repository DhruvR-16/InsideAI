# Inside AI — See How AI Thinks

> A transparent, real-time visualization of how a multi-agent LLM pipeline processes your query from start to finish.

Inside AI breaks open the black box of AI reasoning. Instead of just showing you a final answer, it exposes the **complete internal pipeline** — intent analysis, memory retrieval, knowledge search, planning, self-critique, and response generation — all rendered live in your browser as each stage executes.

---

## ✨ What Makes It Different

Most AI tools give you a prompt box and an answer. Inside AI shows you **everything in between**:

| Stage | What It Does | What You See |
|---|---|---|
| 🎯 **Intent Analyzer** | Classifies the query type, complexity, and entities | Category, complexity tag, extracted entities |
| 🧠 **Session Memory** | Retrieves relevant context from your conversation history | Matched history indices, context relevance |
| 📚 **Knowledge Retrieval (RAG)** | Searches a local ChromaDB vector database for relevant knowledge | Source documents, retrieval scores |
| 📋 **Response Planner** | Creates a structured outline for the response | Approach strategy, section headings, key points |
| 🔍 **Logic Critic** | Audits the plan for factual accuracy and completeness | Confidence score, issues found, approval status |
| ✍️ **Output Writer** | Streams the final Markdown response token by token | Live token stream with timing |

### Smart Fast-Track

Simple queries like *"What is AI?"* are automatically detected and **fast-tracked** — the planner and critic stages are skipped entirely, cutting response time from ~8s to ~2.5s. The timeline shows these as grayed-out "Skipped" cards so you can see the optimization in action.

---

## 🖥️ Dashboard Layout

The interface is a **3-column layout**:

1. **Chat Panel** (left) — Conversation thread with streaming responses and quick-start cards
2. **Execution Monitor** (center) — Toggle between:
   - **Pipeline Timeline** — Vertical trace of each stage with live status, latency, and detailed output
   - **DAG Flow Graph** — Interactive React Flow node graph showing the pipeline topology
3. **Inspector Panel** (right) — Deep-dive into any stage's raw system prompt, user prompt, LLM response, and parsed output

Click any past assistant message to replay its execution trace.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.10+, FastAPI, WebSockets, AsyncGroq, ChromaDB (ONNX embeddings) |
| **Frontend** | React (Vite), React Flow (`@xyflow/react`), Lucide React, Vanilla CSS |
| **LLM Providers** | Groq (cloud, fast), Ollama (local, private, free) |
| **Data** | Pydantic schemas, JSON structured outputs, session-based memory |

---

## 📦 Project Structure

```
InsideAI/
├── backend/
│   ├── main.py              # FastAPI app, WebSocket endpoint, CORS
│   ├── orchestrator.py       # 6-stage DAG pipeline, LLM routing, fast-track logic
│   ├── rag.py                # ChromaDB vector store, document seeding, query
│   ├── schemas.py            # Pydantic models (Intent, Plan, Critique, etc.)
│   ├── requirements.txt      # Python dependencies
│   └── chroma_db/            # Auto-generated vector database (created on first run)
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main shell — chat, layout, WebSocket state
│   │   ├── index.css         # Full design system — animations, grid, components
│   │   └── components/
│   │       ├── ExecutionTimeline.jsx  # Live vertical pipeline trace
│   │       ├── FlowGraph.jsx          # Interactive React Flow DAG graph
│   │       ├── InspectorPanel.jsx     # Deep-dive stage inspector
│   │       └── MetricsPanel.jsx       # Latency and confidence metrics
│   └── package.json
├── .env                      # Environment variables (API keys, provider config)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Python 3.10+](https://www.python.org/)
- [Ollama](https://ollama.com/) *(optional, for free local fallback)*
- A [Groq API key](https://console.groq.com/) *(free tier available)*

### 1. Clone & Configure

```bash
git clone https://github.com/DhruvR-16/InsideAI.git
cd InsideAI
```

Create a `.env` file in the project root:

```ini
GROQ_API_KEY="your_groq_api_key_here"

# LLM Provider: groq | ollama | hybrid
# 'hybrid' tries Groq first, falls back to local Ollama on rate-limit
LLM_PROVIDER="hybrid"

# Ollama settings (only needed if using ollama or hybrid)
OLLAMA_HOST="http://localhost:11434"
OLLAMA_MODEL="qwen2.5:3b"

# Token limit for LLM responses
MAX_TOKENS=400
```

### 2. Setup Backend

```bash
# Create and activate virtual environment
python3 -m venv backend/.venv
source backend/.venv/bin/activate    # macOS/Linux
# backend\.venv\Scripts\activate     # Windows

# Install dependencies
pip install -r backend/requirements.txt

# Start the server (seeds ChromaDB on first run)
PYTHONPATH=. uvicorn backend.main:app --port 8000
```

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. (Optional) Setup Ollama for Local Fallback

```bash
# Install Ollama from https://ollama.com
ollama pull qwen2.5:3b
# Verify: open http://localhost:11434 — should show "Ollama is running"
```

### 5. Open the App

Navigate to **http://localhost:5173** — you're ready to go.

---

## 🔍 How to Use

1. **Ask a question** — Type a query or click a Quick Start card
2. **Watch the pipeline** — The timeline traces each stage in real-time with latency
3. **Inspect any stage** — Click a node in the DAG graph to open the Inspector Panel with raw prompts and responses
4. **Replay past traces** — Click any previous assistant message to re-render its execution trace
5. **Stop generation** — Hit the red stop button (replaces send button while running) to abort mid-stream
6. **Override API keys** — Paste comma-separated Groq keys in the header field for key rotation

---

## ⚡ Architecture

```
User Query
    │
    ▼
┌─────────────────┐
│  Intent Analyzer │ ── Classifies complexity, entities, dependencies
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌───────────────────┐
│ Memory │ │ Knowledge (RAG)   │  ── Parallel execution
└────┬───┘ └────────┬──────────┘
     └──────┬───────┘
            ▼
     ┌──────────────┐
     │   Planner    │ ◄──── Revision loop if critic rejects
     └──────┬───────┘         │
            ▼                 │
     ┌──────────────┐         │
     │ Logic Critic │ ────────┘
     └──────┬───────┘
            ▼
     ┌──────────────┐
     │    Writer    │ ── Streams tokens via WebSocket
     └──────────────┘
```

**Simple queries** skip the Planner → Critic loop entirely (fast-track).

---

## 🔑 API Key Rotation

The system supports **multi-key rotation** to avoid Groq rate limits:

- Paste comma-separated keys in the header field: `key1,key2,key3`
- The backend cycles through them automatically on 429 errors
- Falls back to local Ollama if all keys are exhausted (in `hybrid` mode)

---

## 📄 License

Private Portfolio Project. Unauthorized distribution or copying is prohibited.
