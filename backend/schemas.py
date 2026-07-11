from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

# --- Module Schemas ---

class IntentAnalysis(BaseModel):
    intent_category: str = Field(..., description="Category: factual_explanation | comparison | creative | procedural | analytical")
    core_question: str = Field(..., description="One sentence restatement of the core question")
    requires_retrieval: bool = Field(..., description="True if external search/retrieval is needed")
    requires_memory: bool = Field(..., description="True if referencing previous turns is needed")
    complexity: str = Field(..., description="Complexity level: simple | moderate | complex")
    key_entities: List[str] = Field(..., description="Key entities extracted from the query")

class MemoryExchange(BaseModel):
    role: str = Field(..., description="user or assistant")
    content: str = Field(..., description="The message content")

class MemoryContext(BaseModel):
    relevant_history: List[MemoryExchange] = Field(default_factory=list, description="Relevant past exchanges in this session")
    found_context: bool = Field(..., description="True if matching past context was found")

class RetrievedChunk(BaseModel):
    text: str = Field(..., description="The chunk text")
    score: float = Field(..., description="Cosine similarity score")
    source: str = Field(..., description="Source of the chunk")

class KnowledgeRetrieval(BaseModel):
    retrieved_chunks: List[RetrievedChunk] = Field(default_factory=list, description="Matches from knowledge base")
    retrieval_used: bool = Field(..., description="True if knowledge retrieval was executed")

class PlanSection(BaseModel):
    heading: str = Field(..., description="Section heading")
    key_points: List[str] = Field(..., description="Bullet points under this section")

class Plan(BaseModel):
    approach: str = Field(..., description="One sentence strategy for generating the response")
    sections: List[PlanSection] = Field(..., description="Structured sections of the planned response")
    estimated_length: str = Field(..., description="Estimated length: short | medium | long")

class Critique(BaseModel):
    issues_found: List[str] = Field(..., description="List of logical or factual issues identified")
    plan_approved: bool = Field(..., description="True if the plan is ready to be written")
    confidence_score: int = Field(..., description="Self-assessed confidence score out of 100")
    confidence_rationale: str = Field(..., description="Explanation of why this confidence score was given")

# --- WebSocket Event Schemas ---

class WSStageStart(BaseModel):
    event: str = "stage_start"
    stage: str
    timestamp: float

class WSStageComplete(BaseModel):
    event: str = "stage_complete"
    stage: str
    duration_ms: float
    output: Dict[str, Any]
    timestamp: float

class WSToken(BaseModel):
    event: str = "token"
    stage: str = "writer"
    text_chunk: str

class WSPipelineComplete(BaseModel):
    event: str = "pipeline_complete"
    total_duration_ms: float
    final_output: str
    confidence_score: int
    timestamp: float
