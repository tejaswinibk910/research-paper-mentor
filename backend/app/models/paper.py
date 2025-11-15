from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class PaperStatus(str, Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class Section(BaseModel):
    id: str
    title: str
    content: str
    page_start: int
    page_end: int
    chunk_ids: List[str] = []


class PaperMetadata(BaseModel):
    title: Optional[str] = None
    authors: List[str] = []
    abstract: Optional[str] = None
    keywords: List[str] = []
    publication_date: Optional[str] = None
    doi: Optional[str] = None


class PaperCreate(BaseModel):
    filename: str
    user_id: Optional[str] = None


class PaperResponse(BaseModel):
    id: str
    filename: str
    status: PaperStatus
    metadata: Optional[PaperMetadata] = None
    sections: List[Section] = []
    total_pages: int = 0
    processed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        from_attributes = True


class PaperSummary(BaseModel):
    paper_id: str
    overall_summary: str
    key_findings: List[str]
    section_summaries: Dict[str, str]  # section_id -> summary
    difficulty_level: str = "intermediate"  # beginner, intermediate, advanced


class PaperProcessingStatus(BaseModel):
    paper_id: str
    status: PaperStatus
    progress: float = 0.0  # 0-100
    message: str = ""
    current_step: str = ""