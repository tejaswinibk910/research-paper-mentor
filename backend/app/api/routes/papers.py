from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from fastapi.responses import FileResponse
from typing import List, Dict, Optional
import shutil
from pathlib import Path
import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.paper import (
    PaperResponse, PaperMetadata, Section, 
    PaperStatus
)
from app.models.concept import ConceptGraph, Concept, ConceptEdge
from app.services.pdf_processor import PDFProcessor
from app.services.concept_extractor import ConceptExtractor
from app.core.deps import get_current_user
from app.models.user import User
from app.services.summary_generator import SummaryGenerator
from app.models.paper import PaperSummary
from app.core.chunker import TextChunker
from app.core.vector_store import vector_store



router = APIRouter()

# Response model that includes concept graph
class PaperWithConcepts(BaseModel):
    paper: PaperResponse
    concept_graph: Optional[ConceptGraph] = None

# In-memory storage (replace with database later)
papers_db: Dict[str, PaperResponse] = {}
concept_graphs_db: Dict[str, ConceptGraph] = {}
summaries_db: Dict[str, PaperSummary] = {}  # NEW: Cache summaries

# Storage directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/papers/upload", response_model=PaperWithConcepts)
async def upload_paper(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload and process a research paper"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Generate unique ID
    paper_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{paper_id}.pdf"
    
    # Save file
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # Initialize PDF processor with context manager
        with PDFProcessor(str(file_path)) as pdf_processor:
            
            # Extract metadata
            metadata_dict = pdf_processor.extract_metadata()
            
            # Get page count
            num_pages = pdf_processor.total_pages
            
            # Extract text from all pages
            pages_data = pdf_processor.extract_text_by_page()
            
            # Combine all text
            text_content = "\n\n".join([page["text"] for page in pages_data])
            
            # Extract sections
            sections_data = pdf_processor.extract_sections()
        
        # Create metadata object
        metadata = PaperMetadata(
            title=metadata_dict.get("title") or file.filename,
            authors=metadata_dict.get("authors", []),
            abstract=metadata_dict.get("abstract"),
            keywords=metadata_dict.get("keywords", [])
        )
        
        # Create sections with consistent IDs
        sections = []
        for idx, sec in enumerate(sections_data):
            section_id = f"section_{idx}"  # FIXED: Consistent ID format
            sections.append(Section(
                id=section_id,
                title=sec["title"],
                content=sec["content"],
                page_start=sec["page_start"],
                page_end=sec["page_end"],
                chunk_ids=[]
            ))
        
         # NEW: Chunk text for vector store
        print(f"\n🔪 Chunking text for embeddings...")
        chunker = TextChunker()
        chunks = chunker.chunk_sections(
            sections=[s.dict() for s in sections],
            paper_id=paper_id
        )
        print(f"✅ Created {len(chunks)} chunks")
        
        # NEW: Store in vector database
        print(f"💾 Storing in vector database...")
        try:
            vector_store.add_chunks(
                paper_id=paper_id,
                chunks=chunks
            )
            print(f"✅ Added {len(chunks)} chunks to vector store for paper {paper_id}")
        except Exception as e:
            print(f"❌ Error storing chunks: {e}")
            import traceback
            traceback.print_exc()
            # Clean up and fail
            if file_path.exists():
                file_path.unlink()
            raise HTTPException(status_code=500, detail=f"Failed to store embeddings: {str(e)}")
    
        
        # Create paper response
        paper = PaperResponse(
            id=paper_id,
            filename=file.filename,
            status=PaperStatus.READY,
            metadata=metadata,
            sections=sections,
            total_pages=num_pages,
            processed_at=datetime.utcnow()
        )
        
        papers_db[paper_id] = paper
        
        # Extract concepts in background (simplified for now)
        concept_graph = None
        try:
            concept_extractor = ConceptExtractor()
            
            # The extract_concepts method returns a ConceptGraph directly
            concept_graph = concept_extractor.extract_concepts(
                paper_id=paper_id,
                sections=sections_data,
                max_concepts=30
            )
            
            concept_graphs_db[paper_id] = concept_graph
            
        except Exception as e:
            print(f"Error extracting concepts: {e}")
            import traceback
            traceback.print_exc()
        
        return PaperWithConcepts(paper=paper, concept_graph=concept_graph)
        
    except Exception as e:
        # Clean up file if processing fails
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@router.get("/papers/{paper_id}/summary", response_model=PaperSummary)
async def get_paper_summary(
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Generate and return paper summary (cached)"""
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    # FIXED: Check cache first
    if paper_id in summaries_db:
        print(f"✅ Returning cached summary for paper {paper_id}")
        return summaries_db[paper_id]
    
    paper = papers_db[paper_id]
    
    try:
        # Convert sections to dict format for summary generator
        sections_data = [
            {
                "id": section.id,  # FIXED: Include section ID
                "title": section.title,
                "content": section.content,
                "page_start": section.page_start,
                "page_end": section.page_end
            }
            for section in paper.sections
        ]
        
        # Convert metadata to dict
        metadata_dict = None
        if paper.metadata:
            metadata_dict = {
                "title": paper.metadata.title,
                "authors": paper.metadata.authors,
                "abstract": paper.metadata.abstract,
                "keywords": paper.metadata.keywords
            }
        
        # Generate summary
        print(f"🔄 Generating NEW summary for paper {paper_id}...")
        summary_generator = SummaryGenerator()
        summary = summary_generator.generate_paper_summary(
            paper_id=paper_id,
            sections=sections_data,
            metadata=metadata_dict
        )
        
        # FIXED: Cache the summary
        summaries_db[paper_id] = summary
        print(f"💾 Cached summary for paper {paper_id}")
        
        return summary
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error generating summary: {str(e)}"
        )


@router.post("/papers/{paper_id}/summary/regenerate", response_model=PaperSummary)
async def regenerate_summary(
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Force regenerate paper summary (clears cache)"""
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    # FIXED: Clear cache before regenerating
    if paper_id in summaries_db:
        del summaries_db[paper_id]
        print(f"🗑️  Cleared cache for paper {paper_id}")
    
    # Generate new summary
    return await get_paper_summary(paper_id, current_user)


@router.get("/papers/{paper_id}", response_model=PaperResponse)
async def get_paper(
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get paper details"""
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    return paper


@router.get("/papers/{paper_id}/download")
async def download_paper(
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Download original PDF"""
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    file_path = UPLOAD_DIR / f"{paper_id}.pdf"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=paper.filename,
        media_type="application/pdf"
    )


@router.delete("/papers/{paper_id}")
async def delete_paper(
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a paper"""
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    try:
        vector_store.delete_collection(paper_id)
        print(f"✅ Deleted vector store for paper {paper_id}")
    except Exception as e:
        print(f"⚠️  Error deleting vector store: {e}")

    # Delete file
    file_path = UPLOAD_DIR / f"{paper_id}.pdf"
    if file_path.exists():
        file_path.unlink()
    
    # Delete from databases
    del papers_db[paper_id]
    if paper_id in concept_graphs_db:
        del concept_graphs_db[paper_id]
    if paper_id in summaries_db:  # FIXED: Also delete cached summary
        del summaries_db[paper_id]
    
    return {"message": "Paper deleted successfully"}


@router.get("/papers", response_model=List[PaperResponse])
async def list_papers(current_user: User = Depends(get_current_user)):
    """List all papers for current user"""
    return list(papers_db.values())


@router.get("/papers/{paper_id}/concepts", response_model=ConceptGraph)
async def get_concepts(
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get concept graph for a paper"""
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    if paper_id not in concept_graphs_db:
        raise HTTPException(status_code=404, detail="Concepts not found")
    
    return concept_graphs_db[paper_id]


@router.get("/papers/{paper_id}/sections", response_model=List[Section])
async def get_sections(
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get paper sections"""
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    return paper.sections