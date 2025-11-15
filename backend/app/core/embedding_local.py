from sentence_transformers import SentenceTransformer
from typing import List


class LocalEmbeddingService:
    """
    Local embeddings using sentence-transformers (100% free, no API needed)
    """
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize with a lightweight model
        - all-MiniLM-L6-v2: Fast, 384 dimensions, ~80MB
        - all-mpnet-base-v2: Better quality, 768 dimensions, ~420MB
        """
        print(f"Loading local embedding model: {model_name}...")
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
        print(f"Model loaded successfully! Dimension: {self.dimension}")
        
    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        embedding = self.model.encode(text, show_progress_bar=False)
        return embedding.tolist()
    
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts (batched)"""
        print(f"Generating local embeddings for {len(texts)} texts...")
        embeddings = self.model.encode(texts, show_progress_bar=True, batch_size=32)
        return embeddings.tolist()
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings for this model"""
        return self.dimension