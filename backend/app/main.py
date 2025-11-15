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
    print("⚠️ Persistent storage not available - data will be lost on restart")
    PERSISTENCE_ENABLED = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    print("🚀 Starting Research Paper Mentor API...")
    
    # Initialize database (creates user tables)
    print("📊 Initializing database...")
    init_db()
    print("✅ Database initialized")
    
    if PERSISTENCE_ENABLED:
        print("💾 Loading saved data...")
        try:
            (loaded_papers, loaded_summaries, loaded_concepts,
             loaded_chats, loaded_quizzes, loaded_results,
             loaded_understandings) = load_all_databases()
            
            # Restore data to in-memory databases
            if loaded_papers:
                papers.papers_db.update(loaded_papers)
                print(f"   Loaded {len(loaded_papers)} papers")
            if loaded_summaries:
                papers.summaries_db.update(loaded_summaries)
                print(f"   Loaded {len(loaded_summaries)} summaries")
            if loaded_concepts:
                papers.concept_graphs_db.update(loaded_concepts)
                print(f"   Loaded {len(loaded_concepts)} concept graphs")
            if loaded_chats:
                chat.chat_sessions_db.update(loaded_chats)
                print(f"   Loaded {len(loaded_chats)} chat sessions")
            if loaded_quizzes:
                quiz.quizzes_db.update(loaded_quizzes)
                print(f"   Loaded {len(loaded_quizzes)} quizzes")
            if loaded_results:
                quiz.quiz_results_db.update(loaded_results)
                print(f"   Loaded {len(loaded_results)} quiz results")
            if loaded_understandings:
                progress.concept_understandings_db.update(loaded_understandings)
                print(f"   Loaded {len(loaded_understandings)} concept understandings")
            
            print("✅ Data restored successfully")
        except Exception as e:
            print(f"❌ Error loading saved data: {e}")
            import traceback
            traceback.print_exc()
    
    print("✅ Server ready!")
    
    yield  # Server is running
    
    # Shutdown
    print("🛑 Shutting down Research Paper Mentor API...")
    
    if PERSISTENCE_ENABLED:
        print("💾 Saving data...")
        try:
            save_all_databases(
                papers.papers_db,
                papers.summaries_db,
                papers.concept_graphs_db,
                chat.chat_sessions_db,
                quiz.quizzes_db,
                quiz.quiz_results_db,
                progress.concept_understandings_db
            )
            print("✅ Data saved successfully")
        except Exception as e:
            print(f"❌ Error saving data: {e}")
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
                progress.concept_understandings_db
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