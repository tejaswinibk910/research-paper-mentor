from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class MessageRole(str, Enum):
    """Chat message roles"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class TutoringMode(str, Enum):
    """Tutoring modes"""
    SOCRATIC = "socratic"  # Ask guiding questions
    DIRECT = "direct"  # Give direct explanations
    HINT = "hint"  # Provide hints only
    ANALOGIES = "analogies"  # Use analogies and real-world examples


class Message(BaseModel):
    """Chat message model"""
    role: MessageRole
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    paper_id: Optional[str] = None
    page_references: List[int] = []


class ChatSession(BaseModel):
    """Chat session model"""
    id: str
    paper_id: str
    user_id: Optional[str] = None
    tutoring_mode: TutoringMode = TutoringMode.SOCRATIC
    user_background: str = "intermediate"  # beginner, intermediate, advanced
    messages: List[Message] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: datetime = Field(default_factory=datetime.utcnow)
    concepts_discussed: List[str] = []
    questions_asked: int = 0
    hints_used: int = 0


class ChatRequest(BaseModel):
    """Request to send a message"""
    session_id: str
    message: str
    page_number: Optional[int] = None


class ChatResponse(BaseModel):
    """Response from chat"""
    session_id: str
    message: str
    suggestions: List[str] = []
    related_concepts: List[str] = []


class HintRequest(BaseModel):
    """Request for a hint"""
    session_id: str
    concept: str
    difficulty: str = "medium"  # easy, medium, hard


class HintResponse(BaseModel):
    """Hint response"""
    hint: str
    difficulty: str
    related_concepts: List[str] = []