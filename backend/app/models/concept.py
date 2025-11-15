from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from enum import Enum


class ConceptType(str, Enum):
    DEFINITION = "definition"
    THEORY = "theory"
    EQUATION = "equation"
    METHOD = "method"
    RESULT = "result"
    TERM = "term"


class ConceptDifficulty(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class Concept(BaseModel):
    id: str
    name: str
    type: ConceptType
    definition: str
    explanation: str
    difficulty: ConceptDifficulty = ConceptDifficulty.INTERMEDIATE
    
    # Context
    paper_id: str
    section_id: Optional[str] = None
    page_numbers: List[int] = []
    
    # Knowledge graph
    prerequisites: List[str] = []  # IDs of prerequisite concepts
    related_concepts: List[str] = []  # IDs of related concepts
    
    # Examples and equations
    examples: List[str] = []
    equations: List[str] = []
    
    # Learning metadata
    importance_score: float = 0.5  # 0-1, how central this concept is


class ConceptEdge(BaseModel):
    source_id: str
    target_id: str
    relationship_type: str  # "prerequisite", "related", "part_of", "example_of"
    strength: float = 1.0  # 0-1, strength of relationship


class ConceptGraph(BaseModel):
    paper_id: str
    concepts: List[Concept]
    edges: List[ConceptEdge]
    
    # Graph metadata
    num_concepts: int = 0
    num_edges: int = 0
    complexity_score: float = 0.0  # Overall paper complexity


class ConceptUnderstanding(BaseModel):
    user_id: str
    concept_id: str
    paper_id: str
    
    # Understanding metrics
    is_understood: bool = False
    confidence_level: float = 0.0  # 0-1
    times_reviewed: int = 0
    times_quizzed: int = 0
    correct_answers: int = 0
    
    last_reviewed: Optional[str] = None  # ISO datetime
    next_review: Optional[str] = None
    ease_factor: float = 2.5  # For SM-2 algorithm
    interval_days: int = 1


class ConceptExtractionRequest(BaseModel):
    paper_id: str
    focus_areas: Optional[List[str]] = None  # Optional: focus on specific sections


class ConceptExtractionResponse(BaseModel):
    paper_id: str
    concepts: List[Concept]
    graph: ConceptGraph
    extraction_time: float  # seconds