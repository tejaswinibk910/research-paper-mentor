from typing import List, Dict
import tiktoken
from app.config import settings
import uuid


class TextChunker:
    #Split text into chunks with overlap for embedding and retrieval

    
    def __init__(
        self,
        chunk_size: int = None,
        chunk_overlap: int = None,
        encoding_name: str = "cl100k_base"
    ):
        self.chunk_size = chunk_size or settings.max_chunk_size
        self.chunk_overlap = chunk_overlap or settings.chunk_overlap
        self.encoding = tiktoken.get_encoding(encoding_name)
    
    def chunk_text(
        self,
        text: str,
        metadata: Dict = None
    ) -> List[Dict]:
        
        # Tokenize the full text
        tokens = self.encoding.encode(text)
        
        chunks = []
        start_idx = 0
        chunk_id = 0
        
        while start_idx < len(tokens):
            # Get chunk tokens
            end_idx = min(start_idx + self.chunk_size, len(tokens))
            chunk_tokens = tokens[start_idx:end_idx]
            
            # Decode back to text
            chunk_text = self.encoding.decode(chunk_tokens)
            
            # Generate unique chunk ID
            unique_id = f"chunk_{uuid.uuid4().hex[:8]}_{chunk_id}"
            
            # Create chunk metadata
            chunk_meta = {
                "chunk_id": unique_id,
                "start_token": start_idx,
                "end_token": end_idx,
                "token_count": len(chunk_tokens),
                "text": chunk_text,
            }
            
            # Add custom metadata
            if metadata:
                chunk_meta.update(metadata)
            
            chunks.append(chunk_meta)
            
            # Move to next chunk with overlap
            start_idx += (self.chunk_size - self.chunk_overlap)
            chunk_id += 1
        
        return chunks
    
    def chunk_sections(
        self,
        sections: List[Dict],
        paper_id: str
    ) -> List[Dict]:
        """
        Chunk sections from a paper, preserving section information
        
        Args:
            sections: List of sections with 'title' and 'content'
            paper_id: ID of the paper
            
        Returns:
            List of chunks with section metadata
        """
        all_chunks = []
        global_chunk_id = 0
        
        for section_idx, section in enumerate(sections):
            section_metadata = {
                "paper_id": paper_id,
                "section_id": f"section_{section_idx}",
                "section_title": section.get("title", ""),
                "page_start": section.get("page_start"),
                "page_end": section.get("page_end"),
            }
            
            # Chunk this section's content
            chunks = self.chunk_text(
                text=section["content"],
                metadata=section_metadata
            )
            
            # Ensure globally unique IDs across all sections
            for chunk in chunks:
                chunk["chunk_id"] = f"{paper_id}_chunk_{global_chunk_id}"
                global_chunk_id += 1
            
            all_chunks.extend(chunks)
        
        return all_chunks
    
    def smart_chunk(
        self,
        text: str,
        section_title: str = None,
        respect_paragraphs: bool = True
    ) -> List[str]:
        """
        Smarter chunking that tries to respect paragraph boundaries
        
        Args:
            text: Text to chunk
            section_title: Optional section title to prepend
            respect_paragraphs: Try to break at paragraph boundaries
            
        Returns:
            List of text chunks
        """
        # Prepend section title if provided
        if section_title:
            text = f"# {section_title}\n\n{text}"
        
        if not respect_paragraphs:
            # Use simple token-based chunking
            chunks = self.chunk_text(text)
            return [c["text"] for c in chunks]
        
        # Split into paragraphs
        paragraphs = text.split("\n\n")
        
        chunks = []
        current_chunk = ""
        current_tokens = 0
        
        for para in paragraphs:
            para_tokens = len(self.encoding.encode(para))
            
            # If single paragraph exceeds chunk size, split it
            if para_tokens > self.chunk_size:
                # Save current chunk if it exists
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                    current_tokens = 0
                
                # Split large paragraph
                para_chunks = self.chunk_text(para)
                chunks.extend([c["text"] for c in para_chunks])
                continue
            
            # Check if adding this paragraph exceeds chunk size
            if current_tokens + para_tokens > self.chunk_size:
                # Save current chunk
                chunks.append(current_chunk.strip())
                
                # Start new chunk with overlap
                # Take last paragraph as overlap
                current_chunk = para + "\n\n"
                current_tokens = para_tokens
            else:
                # Add to current chunk
                current_chunk += para + "\n\n"
                current_tokens += para_tokens
        
        # Add final chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def count_tokens(self, text: str) -> int:
        return len(self.encoding.encode(text))