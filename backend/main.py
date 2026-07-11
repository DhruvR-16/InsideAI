import os
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from backend.orchestrator import run_pipeline
from backend.rag import seed_knowledge_base

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("InsideAI")

app = FastAPI(title="Inside AI Backend", version="1.0.0")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the actual frontend domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up Inside AI server...")
    # Seed knowledge base on start if empty
    try:
        seed_knowledge_base()
    except Exception as e:
        logger.error(f"Failed to seed knowledge base: {e}")

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Inside AI Backend is running"}

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, api_key: str = None):
    await websocket.accept()
    logger.info(f"WebSocket client connected. Session ID: {session_id}")
    
    try:
        while True:
            # Wait for query from the client
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                query = payload.get("query")
            except json.JSONDecodeError:
                await websocket.send_json({
                    "event": "error",
                    "message": "Invalid JSON format"
                })
                continue
                
            if not query:
                await websocket.send_json({
                    "event": "error",
                    "message": "Missing 'query' field in request"
                })
                continue
                
            logger.info(f"Received query: '{query}' for session: {session_id}")
            
            # Callback function to stream events directly to client
            async def send_event_to_client(event_data: dict):
                try:
                    await websocket.send_json(event_data)
                except Exception as e:
                    logger.error(f"Error sending event over WebSocket: {e}")

            # Run the multi-agent pipeline
            try:
                await run_pipeline(
                    query=query,
                    session_id=session_id,
                    event_callback=send_event_to_client,
                    custom_api_key=api_key
                )
            except Exception as e:
                logger.error(f"Error running pipeline: {e}")
                await websocket.send_json({
                    "event": "error",
                    "message": f"Pipeline execution failed: {str(e)}"
                })
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected. Session ID: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
