import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Optional
from app.config import settings

# Choose embedding service based on config
if settings.use_local_embeddings:
    from app.core.embedding_local import LocalEmbeddingService as EmbeddingService
    print("Using LOCAL embeddings (sentence-transformers)")
else:
    from app.core.llm import EmbeddingService
    print("Using OpenAI embeddings")


class VectorStore:
    """
    Interface for ChromaDB vector database
    """
    
    def __init__(self):
        # Initialize ChromaDB client
        self.client = chromadb.PersistentClient(
            path=settings.chroma_persist_directory,
            settings=ChromaSettings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Initialize embedding service
        if settings.use_local_embeddings:
            self.embedding_service = EmbeddingService(settings.local_embedding_model)
        else:
            self.embedding_service = EmbeddingService()
    
    def create_collection(self, paper_id: str) -> chromadb.Collection:
        """Create or get collection for a paper"""
        collection_name = f"paper_{paper_id}"
        
        # Delete if exists (for reprocessing)
        try:
            self.client.delete_collection(collection_name)
        except:
            pass
        
        collection = self.client.create_collection(
            name=collection_name,
            metadata={"paper_id": paper_id}
        )
        
        return collection
    
    def get_collection(self, paper_id: str) -> Optional[chromadb.Collection]:
        """Get existing collection"""
        collection_name = f"paper_{paper_id}"
        try:
            return self.client.get_collection(collection_name)
        except:
            return None
    
    def add_chunks(
        self,
        paper_id: str,
        chunks: List[Dict]
    ):
        """
        Add text chunks to the vector store
        
        Args:
            paper_id: ID of the paper
            chunks: List of chunk dictionaries with 'text' and metadata
        """
        collection = self.create_collection(paper_id)
        
        # Extract texts for embedding
        texts = [chunk["text"] for chunk in chunks]
        
        # Generate embeddings (batch)
        print(f"Generating embeddings for {len(texts)} chunks...")
        embeddings = self.embedding_service.embed_texts(texts)
        
        # Prepare data for ChromaDB
        ids = [chunk["chunk_id"] for chunk in chunks]
        metadatas = []
        
        for chunk in chunks:
            # Copy metadata and remove 'text' field
            meta = {k: v for k, v in chunk.items() if k != "text"}
            # Convert all values to strings (ChromaDB requirement)
            meta = {k: str(v) if v is not None else "" for k, v in meta.items()}
            metadatas.append(meta)
        
        # Add to collection
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )
        
        print(f"Added {len(chunks)} chunks to vector store for paper {paper_id}")
    
    def search(
        self,
        paper_id: str,
        query: str,
        n_results: int = 5,
        filter_metadata: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Search for relevant chunks
        
        Args:
            paper_id: ID of the paper
            query: Search query
            n_results: Number of results to return
            filter_metadata: Optional metadata filters
            
        Returns:
            List of matching chunks with scores
        """
        collection = self.get_collection(paper_id)
        if not collection:
            return []
        
        # Generate query embedding
        query_embedding = self.embedding_service.embed_text(query)
        
        # Search
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=filter_metadata
        )
        
        # Format results
        formatted_results = []
        for i in range(len(results['ids'][0])):
            formatted_results.append({
                "chunk_id": results['ids'][0][i],
                "text": results['documents'][0][i],
                "metadata": results['metadatas'][0][i],
                "distance": results['distances'][0][i] if 'distances' in results else None
            })
        
        return formatted_results
    
    def search_by_section(
        self,
        paper_id: str,
        query: str,
        section_id: str,
        n_results: int = 3
    ) -> List[Dict]:
        """Search within a specific section"""
        return self.search(
            paper_id=paper_id,
            query=query,
            n_results=n_results,
            filter_metadata={"section_id": section_id}
        )
    
    def get_chunk_by_id(self, paper_id: str, chunk_id: str) -> Optional[Dict]:
        """Retrieve a specific chunk by ID"""
        collection = self.get_collection(paper_id)
        if not collection:
            return None
        
        results = collection.get(ids=[chunk_id])
        
        if not results['ids']:
            return None
        
        return {
            "chunk_id": results['ids'][0],
            "text": results['documents'][0],
            "metadata": results['metadatas'][0]
        }
    
    def get_all_chunks(self, paper_id: str) -> List[Dict]:
        """Get all chunks for a paper"""
        collection = self.get_collection(paper_id)
        if not collection:
            return []
        
        results = collection.get()
        
        chunks = []
        for i in range(len(results['ids'])):
            chunks.append({
                "chunk_id": results['ids'][i],
                "text": results['documents'][i],
                "metadata": results['metadatas'][i]
            })
        
        return chunks
    
    def delete_collection(self, paper_id: str):
        """Delete a paper's collection"""
        collection_name = f"paper_{paper_id}"
        try:
            self.client.delete_collection(collection_name)
            print(f"Deleted collection for paper {paper_id}")
        except Exception as e:
            print(f"Error deleting collection: {e}")


# Singleton instance
vector_store = VectorStore()