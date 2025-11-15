from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class ConceptMastery(BaseModel):
    """Concept mastery tracking"""
    concept_id: str
    concept_name: str
    paper_id: str
    mastery_level: float = 0.0
    times_reviewed: int = 0
    times_quizzed: int = 0  # ADDED: Track how many times this concept was quizzed
    last_reviewed: Optional[datetime] = None
    first_encountered: datetime = Field(default_factory=datetime.utcnow)


class StudySession(BaseModel):
    """Study session tracking"""
    id: str
    paper_id: str
    user_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: int = 0
    concepts_learned: List[str] = []
    quiz_taken: bool = False
    chat_interactions: int = 0


class UserProgress(BaseModel):
    """User progress for a paper"""
    user_id: str
    paper_id: str
    completion_percentage: int = 0
    total_study_time: int = 0
    concepts_mastery: List[ConceptMastery] = []
    quiz_attempts: int = 0
    average_quiz_score: float = 0.0
    questions_asked: int = 0
    last_studied: Optional[datetime] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)


class LearningInsightType(str, Enum):
    """Types of learning insights"""
    ACHIEVEMENT = "achievement"
    SUGGESTION = "suggestion"
    REMINDER = "reminder"
    WARNING = "warning"


class LearningInsight(BaseModel):
    """Learning insight or recommendation"""
    type: LearningInsightType
    message: str
    action: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ProgressSummary(BaseModel):
    """Overall progress summary for user"""
    user_id: str
    total_papers_studied: int
    total_study_time: int
    papers_mastered: int
    concepts_learned: int
    total_concepts: int
    average_quiz_score: float
    study_streak: int
    recent_activity: List[StudySession] = []
    insights: List[LearningInsight] = []


class ProgressUpdate(BaseModel):
    """Request to update progress"""
    paper_id: str
    concept_id: Optional[str] = None
    understood: bool
    time_spent: Optional[int] = None


class WeeklyProgress(BaseModel):
    """Weekly progress report"""
    user_id: str
    week_start: datetime
    week_end: datetime
    total_study_time: int
    papers_studied: List[str]
    concepts_learned: int
    quizzes_completed: int
    average_score: float
    study_days: int