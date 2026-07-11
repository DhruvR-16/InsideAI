# Inside AI

Inside AI is a transparent, visual multi-agent reasoning pipeline that demonstrates the inner thinking stages of a modern Large Language Model (LLM) agent chain. The project splits a single query into a Directed Acyclic Graph (DAG) of processing blocks, visualizing the results in a sleek React Flow-based frontend dashboard in real-time.

Designed as a local-first application, it supports high-speed API completions via Groq and integrates a local, private fallback to **Ollama** running on your local machine to bypass rate limits for free.

---

## 🚀 Key Features

*   **Sequential Multi-Agent DAG Pipeline**:
    *   **Intent Analyzer**: Categorizes task targets, complexity, and dynamically resolves dependencies.
    *   **Session Memory**: Matches and retrieves relevant context from past conversation history.
    *   **Vector Search (RAG)**: Integrates a local, embedded ChromaDB database seeded with technical articles.
    *   **Response Planner**: Outlines headings, estimated length, and approach strategy.
    *   **Logical Critic**: Audits the plan against constraints, generates revision suggestions, or approves the execution.
    *   **Output Writer**: Stream-writes the final Markdown output based on the approved plan.
*   **Interactive Trace Replays**: Click on any past assistant message in the chat thread to instantly re-render the exact execution graph and latency metrics from that specific conversation turn.
*   **Local Ollama Integration**: Native integration with local LLM models (e.g., `qwen2.5:3b`) for 100% free, private, rate-limit proof execution.
*   **Hybrid Rate-Limit Fallback**: The backend automatically query-routes to Groq for speed but intercepts rate limits (429) or network timeouts to instantly fall back to local Ollama.
*   **Sleek Apple-Style Design**: A clean, minimal light-mode interface built with Vanilla CSS, responsive layouts, clear typography, and zero heavy frameworks.

---

## 🛠️ Tech Stack

*   **Backend**: Python 3.10+, FastAPI (WebSockets streaming), AsyncGroq, ChromaDB (local ONNX embeddings).
*   **Frontend**: React (Vite), React Flow (`@xyflow/react`), Lucide React.

---

## 📦 Local Installation & Setup

### 1. Prerequisites
Ensure you have the following installed on your machine:
*   [Node.js](https://nodejs.org/) (v18+)
*   [Python 3.10+](https://www.python.org/)
*   [Ollama](https://ollama.com/) (For local offline model fallback)

---

### 2. Clone the Repository & Configure Environment
Create a `.env` file in the root directory:
```ini
GROQ_API_KEY="your_groq_api_key_here"
PORT=8000

# LLM Providers Configuration
# Choices: groq | ollama | hybrid
# 'hybrid' will attempt Groq first, and fall back to local Ollama on rate-limit/network failures.
LLM_PROVIDER="hybrid"

# Ollama local settings
OLLAMA_HOST="http://localhost:11434"
OLLAMA_MODEL="qwen2.5:3b"
```

---

### 3. Start Local Ollama (Free Fallback)
1. Launch the Ollama desktop application on your Mac/PC (or run `ollama serve`).
2. Download the recommended lightweight model for local execution:
   ```bash
   ollama pull qwen2.5:3b
   ```
3. Open `http://localhost:11434` in your browser to verify it prints `"Ollama is running"`.

---

### 4. Setup Python Backend
In your terminal, navigate to the root directory and configure the backend:

```bash
# 1. Create a Python virtual environment
python3 -m venv backend/.venv

# 2. Activate the virtual environment
# On macOS/Linux:
source backend/.venv/bin/activate
# On Windows:
# .\backend\.venv\Scripts\activate

# 3. Install backend dependencies
pip install -r backend/requirements.txt

# 4. Start the FastAPI server (will seed ChromaDB database automatically on first run)
PYTHONPATH=. uvicorn backend.main:app --reload --port 8000
```
The backend server runs at `http://127.0.0.1:8000`.

---

### 5. Setup React Frontend
Open a new terminal window, navigate to the `frontend` folder, and configure the React app:

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the Vite development server
npm run dev
```
The frontend application runs at `http://localhost:5173/`.

---

## 🔍 How to Run and Verify

1.  Open your browser and navigate to **`http://localhost:5173/`**.
2.  Submit a query (e.g. *`Explain CRISPR-Cas9`* or click a Quick Start card).
3.  Watch the right-hand panel build the DAG. Nodes will transition:
    *   **Grey (Idle)** ➔ **Blue (Running)** ➔ **Green (Success)** ➔ **Orange (Warning/Revision)**.
4.  Once complete, click on any box in the graph (e.g. **Logical Critic**) to slide open the **Inspector Panel** showing raw input/output logs, plan critiques, and execution duration.
5.  Send a second prompt (e.g. *`How is DNA different?`*). Click on your **first assistant message** in the chat feed to watch the graph update to display the trace from that previous turn.

---

## 🛡️ License
Private Portfolio Project. Unauthorized distribution or copying is prohibited.
