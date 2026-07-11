import asyncio
import os
import json
from dotenv import load_dotenv
from backend.orchestrator import run_pipeline

load_dotenv()

async def mock_callback(event: dict):
    # Print the event details in a structured way
    ev_type = event.get("event")
    if ev_type == "stage_start":
        print(f"\n[STAGE START] --> {event['stage']}")
    elif ev_type == "stage_complete":
        print(f"[STAGE COMPLETE] <-- {event['stage']} (took {event['duration_ms']}ms)")
        # Print a snippet of the output
        output_str = json.dumps(event["output"], indent=2)
        # Limit lines
        lines = output_str.split("\n")
        if len(lines) > 8:
            print("\n".join(lines[:8]) + "\n  ... (truncated)")
        else:
            print(output_str)
    elif ev_type == "token":
        # Print token streaming directly
        print(event["text_chunk"], end="", flush=True)
    elif ev_type == "pipeline_complete":
        print(f"\n\n[PIPELINE COMPLETE] Total time: {event['total_duration_ms']}ms, Confidence: {event['confidence_score']}/100")

async def main():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("ERROR: GROQ_API_KEY is not set in the environment or .env file.")
        return
    
    query = "Explain transformers and the self-attention mechanism in simple terms."
    print(f"Running pipeline for query: '{query}'\n")
    
    await run_pipeline(
        query=query,
        session_id="test_session_123",
        event_callback=mock_callback
    )

if __name__ == "__main__":
    asyncio.run(main())
