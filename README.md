# research-paper-mentor
Adaptive Study Mentor for Research Papers — generates concept maps, Socratic Q&amp;A tutoring, and adaptive quizzes from any uploaded paper using LLMs.
#  AI Research Paper Study Mentor

An AI-powered learning platform that transforms static research PDFs into interactive, personalized learning experiences with Socratic tutoring, adaptive quizzes, spaced repetition, and knowledge graphs.

##  Features

###  Intelligent Paper Processing
- **PDF Upload & Analysis**: Automatically extract text, metadata, sections, and structure from research papers
- **Semantic Chunking**: Smart text segmentation with overlap for optimal context preservation
- **Vector Embeddings**: Local or cloud-based embeddings for semantic search (ChromaDB)

###  AI-Powered Learning
- **Concept Extraction**: Automatically identify key concepts, definitions, and relationships
- **Knowledge Graphs**: Visualize concept relationships with interactive graphs
- **Paper Summaries**: Generate comprehensive summaries with key findings and difficulty assessment

###  Interactive Tutoring
Four distinct tutoring modes:
- **Socratic Mode**: Learn through guided questioning
- **Direct Mode**: Get straightforward explanations
- **Hint-Based Mode**: Receive progressive hints
- **Analogy Mode**: Understand through relatable comparisons

###  Adaptive Learning
- **Quiz Generation**: Auto-generate multiple-choice, true/false, and short-answer questions
- **Spaced Repetition**: SM-2 algorithm for optimal review scheduling
- **Progress Tracking**: Monitor concept mastery, retention stats, and learning history

###  User Experience
- **Authentication**: Secure user registration and JWT-based login
- **Multi-Paper Management**: Upload and manage multiple research papers
- **Real-time Chat**: Interactive conversations with context-aware AI tutor
- **Progress Dashboard**: Visualize learning progress and retention metrics

##  Getting Started

### Prerequisites

- **Python**: 3.11+
- **Node.js**: 18+ 
- **npm/yarn**: Latest version
- **API Keys**: OpenAI, Anthropic, or Groq (at least one required)

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   ```bash
   # Copy example env file
   cp .env.example .env

   # Edit .env file with your configuration
   ```

   Required `.env` configuration:
   ```env
   # API Keys (at least one required)
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   GROQ_API_KEY=gsk_...

   # LLM Configuration
   DEFAULT_LLM_PROVIDER=groq  # Options: openai, anthropic, groq
   DEFAULT_MODEL=llama-3.3-70b-versatile

   # Embedding Configuration
   USE_LOCAL_EMBEDDINGS=true  # true = sentence-transformers, false = OpenAI
   LOCAL_EMBEDDING_MODEL=all-MiniLM-L6-v2
   EMBEDDING_MODEL=text-embedding-3-small  # If using OpenAI embeddings

   # Database
   DATABASE_URL=sqlite:///./research_mentor.db

   # Vector Database
   CHROMA_PERSIST_DIRECTORY=./chroma_db

   # Application
   SECRET_KEY=your-secret-key-change-in-production
   DEBUG=True
   UPLOAD_DIR=./uploads
   MAX_UPLOAD_SIZE=52428800  # 50MB

   # Chunking
   MAX_CHUNK_SIZE=1200
   CHUNK_OVERLAP=200

   # Auth
   ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days

   # CORS
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

5. **Initialize database**
   ```bash
   python init_db.py
   ```

6. **Run the backend server**
   ```bash
   # Development mode
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

   # Production mode
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

   The API will be available at `http://localhost:8000`
   - API Documentation: `http://localhost:8000/docs`
   - Alternative Docs: `http://localhost:8000/redoc`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure environment (if needed)**
   Create `.env.local` if you need custom configuration:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

   The frontend will be available at `http://localhost:3000`

5. **Build for production**
   ```bash
   npm run build
   npm run start
   ```
##  Technology Stack

### Backend
- **FastAPI**: Modern Python web framework
- **SQLAlchemy**: ORM for database operations
- **SQLite**: Lightweight database (easily upgradeable to PostgreSQL)
- **ChromaDB**: Vector database for semantic search
- **PyMuPDF (fitz)**: PDF text extraction
- **sentence-transformers**: Local embeddings
- **OpenAI/Anthropic/Groq**: LLM providers
- **JWT**: Authentication
- **Pydantic**: Data validation

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Axios**: HTTP client
- **Lucide React**: Icon library
- **Context API**: State management

##  Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Protected API endpoints
- CORS configuration
- Input validation with Pydantic
- SQL injection prevention via ORM

##  Key Algorithms

### Spaced Repetition (SM-2)
- Optimizes review intervals based on performance
- Tracks ease factor for each concept
- Schedules reviews at increasing intervals

### Text Chunking
- Semantic-aware chunking with overlap
- Preserves context across chunks
- Optimized for embedding and retrieval

### Concept Extraction
- LLM-powered concept identification
- Relationship mapping
- Difficulty assessment


