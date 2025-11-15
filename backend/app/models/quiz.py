from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class QuestionType(str, Enum):
    """Types of quiz questions"""
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    CONCEPT_MATCHING = "concept_matching"


class QuestionDifficulty(str, Enum):
    """Question difficulty levels"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class Question(BaseModel):
    """Quiz question model"""
    id: str
    type: QuestionType
    difficulty: QuestionDifficulty
    question: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: str
    concept_id: str
    paper_id: str
    concepts: List[str] = []
    page_reference: Optional[int] = None
    distractor_explanations: Optional[Dict[str, str]] = None


class QuizAnswer(BaseModel):
    """Individual quiz answer"""
    question_id: str
    user_answer: str
    is_correct: bool = False
    time_taken_seconds: Optional[int] = None
    concept_id: Optional[str] = None  # ADDED: Track which concept this answer is for


class Quiz(BaseModel):
    """Quiz model"""
    id: str
    paper_id: str
    user_id: Optional[str] = None
    title: str = "Concept Check Quiz"
    questions: List[Question]
    total_questions: int
    target_concepts: List[str] = []
    difficulty: QuestionDifficulty = QuestionDifficulty.MEDIUM
    difficulty_level: QuestionDifficulty = QuestionDifficulty.MEDIUM
    created_at: datetime = Field(default_factory=datetime.utcnow)
    time_limit: Optional[int] = None
    is_adaptive: bool = False


class QuizGenerationRequest(BaseModel):
    """Request to generate a quiz"""
    paper_id: str
    user_id: Optional[str] = None
    num_questions: int = 5
    difficulty: Optional[QuestionDifficulty] = None
    focus_concepts: Optional[List[str]] = None
    question_types: List[QuestionType] = [
        QuestionType.MULTIPLE_CHOICE,
        QuestionType.TRUE_FALSE
    ]
    time_limit: Optional[int] = 30


class AdaptiveQuizRequest(BaseModel):
    """Request to generate adaptive quiz"""
    paper_id: str
    user_id: str
    num_questions: int = 5


QuizRequest = QuizGenerationRequest


class QuizResponse(BaseModel):
    """Response with generated quiz"""
    quiz_id: str
    questions: List[Question]
    time_limit: Optional[int] = None


class QuizSubmission(BaseModel):
    """Quiz submission from user"""
    answers: Dict[str, str]
    time_taken: int


class QuizResult(BaseModel):
    """Quiz result after grading"""
    quiz_id: str
    user_id: str
    paper_id: str
    answers: List[QuizAnswer]
    score: float
    score_percentage: float
    total_questions: int
    correct_answers: int
    time_taken: int = 0
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime = Field(default_factory=datetime.utcnow)
    question_results: List[Dict[str, Any]] = []
    weak_concepts: List[str] = []
    strong_concepts: List[str] = []
    concept_scores: Dict[str, float] = {}
    
    def __init__(self, **data):
        super().__init__(**data)
        if 'score_percentage' not in data and 'score' in data:
            self.score_percentage = self.score
        elif 'score' not in data and 'score_percentage' in data:
            self.score = self.score_percentage