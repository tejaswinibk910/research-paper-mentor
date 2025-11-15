from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
import uuid

Base = declarative_base()


# SQLAlchemy Model (Database)
class User(Base):
    """User database model"""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Pydantic Schemas (API)
class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr
    username: str
    full_name: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


class UserResponse(UserBase):
    """Schema for user response (without password)"""
    id: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True  # For Pydantic v2 (was orm_mode in v1)


class UserInDB(UserBase):
    """User schema with hashed password"""
    id: str
    hashed_password: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str
    user: UserResponse


class TokenData(BaseModel):
    """Data stored in JWT token"""
    email: Optional[str] = None
    user_id: Optional[str] = None