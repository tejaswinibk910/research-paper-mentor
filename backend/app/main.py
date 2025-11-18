from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.routes import papers, chat, quiz, progress, auth
from app.core.database import init_db
from contextlib import asynccontextmanager

# Import persistent storage
try:
    from app.core.persistent_storage import storage, save_all_databases, load_all_databases
    PERSISTENCE_ENABLED = True
except ImportError:
    print("Persistent storage not available - data will be lost on restart")
    PERSISTENCE_ENABLED = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    print(" Starting Research Paper Mentor API...")
    
    # Initialize database (creates user tables)
    print(" Initializing database...")
    init_db()
    print(" Database initialized")
    
    if PERSISTENCE_ENABLED:
        print(" Loading saved data...")
        try:
            (loaded_papers, loaded_summaries, loaded_concepts,
             loaded_chats, loaded_quizzes, loaded_results,
             loaded_understandings) = load_all_databases()
            
            # Import all necessary models
            from app.models.paper import PaperResponse, Section, PaperMetadata
            from app.models.paper import PaperSummary
            from app.models.concept import ConceptGraph, Concept, ConceptEdge
            from app.models.chat import ChatSession, Message, MessageRole, TutoringMode
            from app.models.quiz import Quiz, Question, QuizResult, QuizAnswer
            from app.models.progress import UserProgress, ConceptMastery
            
            # ============ RESTORE PAPERS ============
            if loaded_papers:
                for paper_id, paper_data in loaded_papers.items():
                    try:
                        # Convert nested objects
                        if isinstance(paper_data, dict):
                            # Convert sections
                            if 'sections' in paper_data and paper_data['sections']:
                                paper_data['sections'] = [
                                    Section(**s) if isinstance(s, dict) else s
                                    for s in paper_data['sections']
                                ]
                            
                            # Convert metadata
                            if 'metadata' in paper_data and isinstance(paper_data['metadata'], dict):
                                paper_data['metadata'] = PaperMetadata(**paper_data['metadata'])
                            
                            # Create PaperResponse
                            paper = PaperResponse(**paper_data)
                            papers.papers_db[paper_id] = paper
                        else:
                            papers.papers_db[paper_id] = paper_data
                    except Exception as e:
                        print(f"    Skipping corrupted paper {paper_id}: {e}")
                
                print(f"    Loaded {len(papers.papers_db)} papers")
            
            # ============ RESTORE SUMMARIES ============
            if loaded_summaries:
                for summary_id, summary_data in loaded_summaries.items():
                    try:
                        if isinstance(summary_data, dict):
                            summary = PaperSummary(**summary_data)
                            papers.summaries_db[summary_id] = summary
                        else:
                            papers.summaries_db[summary_id] = summary_data
                    except Exception as e:
                        print(f"    Skipping corrupted summary {summary_id}: {e}")
                
                print(f"    Loaded {len(papers.summaries_db)} summaries")
            
            # ============ RESTORE CONCEPT GRAPHS ============
            if loaded_concepts:
                for concept_id, concept_data in loaded_concepts.items():
                    try:
                        if isinstance(concept_data, dict):
                            # Convert concepts list
                            if 'concepts' in concept_data and concept_data['concepts']:
                                concept_data['concepts'] = [
                                    Concept(**c) if isinstance(c, dict) else c
                                    for c in concept_data['concepts']
                                ]
                            
                            # Convert edges list
                            if 'edges' in concept_data and concept_data['edges']:
                                concept_data['edges'] = [
                                    ConceptEdge(**e) if isinstance(e, dict) else e
                                    for e in concept_data['edges']
                                ]
                            
                            concept_graph = ConceptGraph(**concept_data)
                            papers.concept_graphs_db[concept_id] = concept_graph
                        else:
                            papers.concept_graphs_db[concept_id] = concept_data
                    except Exception as e:
                        print(f"    Skipping corrupted concept graph {concept_id}: {e}")
                
                print(f"    Loaded {len(papers.concept_graphs_db)} concept graphs")
            
            # ============ RESTORE CHAT SESSIONS ============
            if loaded_chats:
                for chat_id, chat_data in loaded_chats.items():
                    try:
                        if isinstance(chat_data, dict):
                            # Convert messages list
                            if 'messages' in chat_data and chat_data['messages']:
                                chat_data['messages'] = [
                                    Message(**m) if isinstance(m, dict) else m
                                    for m in chat_data['messages']
                                ]
                            
                            # Convert tutoring_mode enum
                            if 'tutoring_mode' in chat_data:
                                if isinstance(chat_data['tutoring_mode'], str):
                                    chat_data['tutoring_mode'] = TutoringMode(chat_data['tutoring_mode'])
                            
                            chat_session = ChatSession(**chat_data)
                            chat.chat_sessions_db[chat_id] = chat_session
                        else:
                            chat.chat_sessions_db[chat_id] = chat_data
                    except Exception as e:
                        print(f"    Skipping corrupted chat session {chat_id}: {e}")
                
                print(f"    Loaded {len(chat.chat_sessions_db)} chat sessions")
            
            # ============ RESTORE QUIZZES ============
            if loaded_quizzes:
                for quiz_id, quiz_data in loaded_quizzes.items():
                    try:
                        if isinstance(quiz_data, dict):
                            # Convert questions list
                            if 'questions' in quiz_data and quiz_data['questions']:
                                quiz_data['questions'] = [
                                    Question(**q) if isinstance(q, dict) else q
                                    for q in quiz_data['questions']
                                ]
                            
                            quiz_obj = Quiz(**quiz_data)
                            quiz.quizzes_db[quiz_id] = quiz_obj
                        else:
                            quiz.quizzes_db[quiz_id] = quiz_data
                    except Exception as e:
                        print(f"    Skipping corrupted quiz {quiz_id}: {e}")
                
                print(f"    Loaded {len(quiz.quizzes_db)} quizzes")
            
            # ============ RESTORE QUIZ RESULTS ============
            if loaded_results:
                for result_key, results_list in loaded_results.items():
                    try:
                        converted_results = []
                        for result_data in results_list:
                            if isinstance(result_data, dict):
                                # Convert answers list
                                if 'answers' in result_data and result_data['answers']:
                                    result_data['answers'] = [
                                        QuizAnswer(**a) if isinstance(a, dict) else a
                                        for a in result_data['answers']
                                    ]
                                
                                result = QuizResult(**result_data)
                                converted_results.append(result)
                            else:
                                converted_results.append(result_data)
                        
                        quiz.quiz_results_db[result_key] = converted_results
                    except Exception as e:
                        print(f"    Skipping corrupted quiz results {result_key}: {e}")
                
                print(f"    Loaded {len(quiz.quiz_results_db)} quiz result sets")
            
            # ============ RESTORE USER PROGRESS ============
            if loaded_understandings:
                for progress_key, progress_data in loaded_understandings.items():
                    try:
                        if isinstance(progress_data, dict):
                            # Convert concepts_mastery list
                            if 'concepts_mastery' in progress_data and progress_data['concepts_mastery']:
                                progress_data['concepts_mastery'] = [
                                    ConceptMastery(**cm) if isinstance(cm, dict) else cm
                                    for cm in progress_data['concepts_mastery']
                                ]
                            
                            user_progress = UserProgress(**progress_data)
                            progress.user_progress_db[progress_key] = user_progress
                        else:
                            progress.user_progress_db[progress_key] = progress_data
                    except Exception as e:
                        print(f"    Skipping corrupted progress {progress_key}: {e}")
                
                print(f"    Loaded {len(progress.user_progress_db)} user progress records")
            
            print(" Data restored successfully")
        except Exception as e:
            print(f" Error loading saved data: {e}")
            import traceback
            traceback.print_exc()
    
    print(" Server ready!")
    
    yield  # Server is running
    
    # Shutdown
    print(" Shutting down Research Paper Mentor API...")
    
    if PERSISTENCE_ENABLED:
        print(" Saving data...")
        try:
            save_all_databases(
                papers.papers_db,
                papers.summaries_db,
                papers.concept_graphs_db,
                chat.chat_sessions_db,
                quiz.quizzes_db,
                quiz.quiz_results_db,
                progress.user_progress_db
            )
            print(" Data saved successfully")
        except Exception as e:
            print(f" Error saving data: {e}")
            import traceback
            traceback.print_exc()


# Create FastAPI app with lifespan
app = FastAPI(
    title="Research Paper Mentor API",
    description="AI-powered research paper understanding and learning",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers - AUTH MUST BE FIRST!
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(papers.router, prefix="/api", tags=["papers"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(quiz.router, prefix="/api", tags=["quiz"])
app.include_router(progress.router, prefix="/api", tags=["progress"])


@app.get("/")
async def root():
    return {
        "message": "Research Paper Mentor API",
        "status": "running",
        "version": "1.0.0",
        "persistence": "enabled" if PERSISTENCE_ENABLED else "disabled",
        "endpoints": {
            "auth": "/api/auth/register, /api/auth/login, /api/auth/me",
            "papers": "/api/upload, /api/{paper_id}",
            "chat": "/api/sessions, /api/message",
            "quiz": "/api/quiz/generate",
            "progress": "/api/progress/{user_id}/{paper_id}"
        }
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "persistence": PERSISTENCE_ENABLED
    }


# Manual save endpoint (optional - for debugging)
if PERSISTENCE_ENABLED:
    @app.post("/admin/save")
    async def manual_save():
        """Manually trigger a save (for testing)"""
        try:
            save_all_databases(
                papers.papers_db,
                papers.summaries_db,
                papers.concept_graphs_db,
                chat.chat_sessions_db,
                quiz.quizzes_db,
                quiz.quiz_results_db,
                progress.user_progress_db
            )
            return {"message": "Data saved successfully"}
        except Exception as e:
            return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )