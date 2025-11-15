from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List
import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.chat import (
    ChatSession, ChatRequest, ChatResponse,
    Message, MessageRole, TutoringMode,
    HintRequest, HintResponse
)
from app.services.tutor import SocraticTutor
from app.api.routes.papers import papers_db, concept_graphs_db
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter()

# In-memory storage
chat_sessions_db: Dict[str, ChatSession] = {}


# Request model for chat session creation
class ChatSessionCreateRequest(BaseModel):
    paper_id: str
    tutoring_mode: str = "socratic"
    user_background: str = "intermediate"


@router.post("/chat/sessions", response_model=ChatSession)
async def create_chat_session(
    request: ChatSessionCreateRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new chat session"""
    if request.paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    session_id = str(uuid.uuid4())
    
    # Convert string to TutoringMode enum
    try:
        mode = TutoringMode(request.tutoring_mode.lower())
    except ValueError:
        mode = TutoringMode.SOCRATIC
    
    session = ChatSession(
        id=session_id,
        paper_id=request.paper_id,
        user_id=str(current_user.id),
        tutoring_mode=mode,
        user_background=request.user_background
    )
    
    chat_sessions_db[session_id] = session
    
    return session


@router.get("/chat/sessions/{session_id}", response_model=ChatSession)
async def get_chat_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get chat session"""
    if session_id not in chat_sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = chat_sessions_db[session_id]
    
    if session.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return session


@router.post("/chat/message")
async def send_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """Send a message in chat session"""
    if request.session_id not in chat_sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = chat_sessions_db[request.session_id]
    
    if session.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Add user message to session
    user_message = Message(
        role=MessageRole.USER,
        content=request.message,
        paper_id=session.paper_id,
        page_references=[request.page_number] if request.page_number else []
    )
    session.messages.append(user_message)
    session.questions_asked += 1
    session.last_active = datetime.utcnow()
    
    try:
        # Get concepts from concept graph
        concepts = []
        if session.paper_id in concept_graphs_db:
            concept_graph = concept_graphs_db[session.paper_id]
            concepts = concept_graph.concepts
        
        # Use the tutor's respond_to_query method
        tutor = SocraticTutor()
        tutor_response = tutor.respond_to_query(
            session=session,
            user_message=request.message,
            concepts=concepts,
            page_number=request.page_number
        )
        
        # Add assistant message to session
        assistant_message = Message(
            role=MessageRole.ASSISTANT,
            content=tutor_response.message,
            paper_id=session.paper_id,
            page_references=[]
        )
        session.messages.append(assistant_message)
        
        # Update concepts discussed - use related_concepts attribute
        if tutor_response.related_concepts:
            session.concepts_discussed.extend(tutor_response.related_concepts)
            session.concepts_discussed = list(set(session.concepts_discussed))
        
        # Return response matching the expected format
        return {
            "session_id": session.id,
            "message": tutor_response.message,
            "suggestions": [
                "Can you explain this in simpler terms?",
                "What are the key takeaways?",
                "How does this relate to the main topic?"
            ],
            "related_concepts": tutor_response.related_concepts[:5] if tutor_response.related_concepts else []
        }
        
    except Exception as e:
        print(f"❌ Error generating response: {e}")
        import traceback
        traceback.print_exc()
        
        # Fallback response
        fallback_text = "I'm having trouble processing that right now. Could you try rephrasing your question?"
        
        assistant_message = Message(
            role=MessageRole.ASSISTANT,
            content=fallback_text,
            paper_id=session.paper_id,
            page_references=[]
        )
        session.messages.append(assistant_message)
        
        return {
            "session_id": session.id,
            "message": fallback_text,
            "suggestions": [
                "Try asking a different question",
                "Ask about a specific section",
                "Request an explanation of a concept"
            ],
            "related_concepts": []
        }


@router.post("/chat/hint")
async def get_hint(
    request: HintRequest,
    current_user: User = Depends(get_current_user)
):
    """Get a hint for understanding"""
    if request.session_id not in chat_sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = chat_sessions_db[request.session_id]
    
    if session.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        tutor = SocraticTutor()
        hint_response = tutor.generate_progressive_hints(
            paper_id=session.paper_id,
            question=request.concept,
            current_level=0,
            max_level=3
        )
        
        session.hints_used += 1
        
        return hint_response
        
    except Exception as e:
        print(f"❌ Error generating hint: {e}")
        return {
            "hint": "Try breaking down the concept into smaller parts and thinking about each piece.",
            "difficulty": request.difficulty,
            "related_concepts": []
        }


@router.get("/chat/sessions/paper/{paper_id}", response_model=List[ChatSession])
async def get_paper_sessions(
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all chat sessions for a paper"""
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    sessions = [
        session for session in chat_sessions_db.values()
        if session.paper_id == paper_id and session.user_id == str(current_user.id)
    ]
    
    return sessions


@router.delete("/chat/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a chat session"""
    if session_id not in chat_sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = chat_sessions_db[session_id]
    
    if session.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    del chat_sessions_db[session_id]
    
    return {"message": "Session deleted successfully"}


@router.put("/chat/sessions/{session_id}/mode")
async def update_tutoring_mode(
    session_id: str,
    mode: str,
    current_user: User = Depends(get_current_user)
):
    """Update tutoring mode for session"""
    if session_id not in chat_sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = chat_sessions_db[session_id]
    
    if session.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        session.tutoring_mode = TutoringMode(mode.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid tutoring mode: {mode}")
    
    session.last_active = datetime.utcnow()
    
    return {"message": "Tutoring mode updated", "mode": session.tutoring_mode.value}