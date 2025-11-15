"""
Database models for persistent storage using SQLAlchemy
"""
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)
    
    # Relationships
    papers = relationship("Paper", back_populates="user", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")
    concept_progress = relationship("ConceptProgress", back_populates="user", cascade="all, delete-orphan")

class Paper(Base):
    __tablename__ = "papers"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    authors = Column(Text)  # JSON string of authors list
    abstract = Column(Text)
    file_path = Column(String)
    file_size = Column(Integer)
    page_count = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime)
    
    # Processing status
    processing_status = Column(String, default="pending")  # pending, processing, completed, failed
    processed_at = Column(DateTime)
    
    # Extracted data
    summary = Column(Text)
    key_findings = Column(Text)  # JSON string
    sections = Column(Text)  # JSON string of sections
    
    # Relationships
    user = relationship("User", back_populates="papers")
    concepts = relationship("Concept", back_populates="paper", cascade="all, delete-orphan")
    embeddings = relationship("Embedding", back_populates="paper", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="paper", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="paper", cascade="all, delete-orphan")

class Concept(Base):
    __tablename__ = "concepts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    paper_id = Column(String, ForeignKey("papers.id"), nullable=False)
    name = Column(String, nullable=False)
    definition = Column(Text)
    category = Column(String)  # theory, method, result, etc.
    difficulty = Column(Float, default=0.5)  # 0-1 scale
    importance = Column(Float, default=0.5)  # 0-1 scale
    prerequisites = Column(Text)  # JSON list of concept IDs
    related_concepts = Column(Text)  # JSON list of concept IDs
    page_references = Column(Text)  # JSON list of page numbers
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    paper = relationship("Paper", back_populates="concepts")
    progress = relationship("ConceptProgress", back_populates="concept", cascade="all, delete-orphan")

class Embedding(Base):
    __tablename__ = "embeddings"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    paper_id = Column(String, ForeignKey("papers.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    embedding = Column(Text)  # JSON string of embedding vector
    section = Column(String)
    page_number = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    paper = relationship("Paper", back_populates="embeddings")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    paper_id = Column(String, ForeignKey("papers.id"), nullable=False)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_message_at = Column(DateTime)
    message_count = Column(Integer, default=0)
    
    # Relationships
    user = relationship("User", back_populates="chat_sessions")
    paper = relationship("Paper", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    is_question = Column(Boolean, default=False)
    relevant_concepts = Column(Text)  # JSON list of concept IDs
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session = relationship("ChatSession", back_populates="messages")

class Quiz(Base):
    __tablename__ = "quizzes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    paper_id = Column(String, ForeignKey("papers.id"), nullable=False)
    title = Column(String)
    questions = Column(Text, nullable=False)  # JSON string of questions
    is_adaptive = Column(Boolean, default=False)
    difficulty = Column(Float)  # Average difficulty
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    paper = relationship("Paper", back_populates="quizzes")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    quiz_id = Column(String, ForeignKey("quizzes.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    score = Column(Float)
    answers = Column(Text)  # JSON string of user answers
    time_spent = Column(Integer)  # seconds
    
    # Relationships
    user = relationship("User", back_populates="quiz_attempts")
    quiz = relationship("Quiz", back_populates="attempts")

class ConceptProgress(Base):
    __tablename__ = "concept_progress"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    concept_id = Column(String, ForeignKey("concepts.id"), nullable=False)
    understanding_level = Column(Float, default=0)  # 0-1 scale
    confidence = Column(Float, default=0)  # 0-1 scale
    review_count = Column(Integer, default=0)
    last_reviewed = Column(DateTime)
    next_review = Column(DateTime)
    ease_factor = Column(Float, default=2.5)  # For spaced repetition
    interval = Column(Integer, default=1)  # Days until next review
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="concept_progress")
    concept = relationship("Concept", back_populates="progress")

# Database initialization
def init_database(database_url="sqlite:///study_mentor.db"):
    """Initialize the database and create all tables"""
    engine = create_engine(database_url, echo=False)
    Base.metadata.create_all(engine)
    return engine

def get_session(engine):
    """Get a database session"""
    Session = sessionmaker(bind=engine)
    return Session()