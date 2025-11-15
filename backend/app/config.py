import os
from typing import List
from dotenv import load_dotenv

# Load .env file
load_dotenv()


class Settings:
    """Application settings loaded from environment variables"""
    
    def __init__(self):
        # API Keys
        self.openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
        self.anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
        self.groq_api_key: str = os.getenv("GROQ_API_KEY", "")
        
        # Database
        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./research_mentor.db")
        
        # Vector Database
        self.chroma_persist_directory: str = os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma_db")
        self.chromadb_dir: str = self.chroma_persist_directory  # Alias for compatibility
        
        # LLM Configuration
        self.default_llm_provider: str = os.getenv("DEFAULT_LLM_PROVIDER", "groq")
        self.default_model: str = os.getenv("DEFAULT_MODEL", "llama-3.3-70b-versatile")
        
        # Embedding Configuration
        self.use_local_embeddings: bool = os.getenv("USE_LOCAL_EMBEDDINGS", "true").lower() == "true"
        self.local_embedding_model: str = os.getenv("LOCAL_EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        self.embedding_model: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
        
        # Application
        self.app_name: str = "Research Paper Mentor"
        self.debug: bool = os.getenv("DEBUG", "True").lower() == "true"
        self.upload_dir: str = os.getenv("UPLOAD_DIR", "./uploads")
        self.max_upload_size: int = int(os.getenv("MAX_UPLOAD_SIZE", "52428800"))
        self.max_file_size: int = self.max_upload_size  # Alias for compatibility
        
        # Chunking
        self.max_chunk_size: int = int(os.getenv("MAX_CHUNK_SIZE", "1200"))
        self.chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "200"))
        
        # Auth Settings
        self.secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production-please-make-it-secure")
        self.algorithm: str = os.getenv("ALGORITHM", "HS256")
        self.access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days
        
        # CORS - Parse comma-separated origins
        origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
        self.allowed_origins: List[str] = [origin.strip() for origin in origins_str.split(',') if origin.strip()]
        
        # Server
        self.host: str = os.getenv("HOST", "0.0.0.0")
        self.port: int = int(os.getenv("PORT", "8000"))
        
        # Validate required fields based on provider
        if self.default_llm_provider == "openai":
            if not self.openai_api_key:
                raise ValueError("OPENAI_API_KEY is required when using OpenAI provider")
        
        if self.default_llm_provider == "anthropic":
            if not self.anthropic_api_key:
                raise ValueError("ANTHROPIC_API_KEY is required when using Anthropic provider")
        
        if self.default_llm_provider == "groq":
            if not self.groq_api_key:
                raise ValueError("GROQ_API_KEY is required when using Groq provider")
        
        # Validate embedding configuration (only warn, don't fail)
        if not self.use_local_embeddings and not self.openai_api_key:
            print("⚠️  WARNING: No OPENAI_API_KEY and USE_LOCAL_EMBEDDINGS=false")
            print("    Set USE_LOCAL_EMBEDDINGS=true to use local embeddings")
        
        # Create necessary directories
        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(self.chroma_persist_directory, exist_ok=True)


# Create settings instance
settings = Settings()