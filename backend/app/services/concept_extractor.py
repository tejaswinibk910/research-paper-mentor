from typing import List, Dict
from app.core.llm import LLMService
from app.core.vector_store import vector_store
from app.models.concept import (
    Concept, ConceptGraph, ConceptEdge, 
    ConceptType, ConceptDifficulty
)
import json
import uuid


class ConceptExtractor:
    """
    Extract key concepts from research papers and build knowledge graphs
    """
    
    def __init__(self):
        self.llm = LLMService()
    
    def extract_concepts(
        self,
        paper_id: str,
        sections: List[Dict],
        max_concepts: int = 30
    ) -> ConceptGraph:
        """
        Extract concepts from paper sections
        
        Args:
            paper_id: ID of the paper
            sections: List of section dictionaries
            max_concepts: Maximum number of concepts to extract
            
        Returns:
            ConceptGraph with concepts and relationships
        """
        print(f"Extracting concepts from paper {paper_id}...")
        
        # Combine sections for context
        paper_text = self._prepare_text(sections)
        
        # Extract concepts using LLM
        concepts_data = self._extract_concepts_with_llm(
            paper_text=paper_text,
            paper_id=paper_id,
            max_concepts=max_concepts
        )
        
        # Build concept objects
        concepts = []
        for concept_data in concepts_data:
            concept = Concept(
                id=str(uuid.uuid4()),
                name=concept_data["name"],
                type=ConceptType(concept_data.get("type", "term")),
                definition=concept_data["definition"],
                explanation=concept_data["explanation"],
                difficulty=ConceptDifficulty(concept_data.get("difficulty", "intermediate")),
                paper_id=paper_id,
                page_numbers=concept_data.get("page_numbers", []),
                prerequisites=[],  # Will be filled in next step
                related_concepts=[],
                examples=concept_data.get("examples", []),
                equations=concept_data.get("equations", []),
                importance_score=concept_data.get("importance", 0.5)
            )
            concepts.append(concept)
        
        # Extract relationships between concepts
        edges = self._extract_relationships(concepts, paper_text)
        
        # Update prerequisites based on edges
        for edge in edges:
            if edge.relationship_type == "prerequisite":
                for concept in concepts:
                    if concept.id == edge.target_id:
                        concept.prerequisites.append(edge.source_id)
            elif edge.relationship_type == "related":
                for concept in concepts:
                    if concept.id == edge.source_id:
                        concept.related_concepts.append(edge.target_id)
        
        # Build graph
        graph = ConceptGraph(
            paper_id=paper_id,
            concepts=concepts,
            edges=edges,
            num_concepts=len(concepts),
            num_edges=len(edges),
            complexity_score=self._calculate_complexity(concepts, edges)
        )
        
        return graph
    
    def _prepare_text(self, sections: List[Dict], max_length: int = 15000) -> str:
        """Prepare paper text for concept extraction"""
        text_parts = []
        
        for section in sections:
            title = section.get("title", "")
            content = section.get("content", "")
            
            text_parts.append(f"## {title}\n\n{content}\n\n")
        
        full_text = "".join(text_parts)
        
        # Truncate if too long
        if len(full_text) > max_length:
            full_text = full_text[:max_length] + "..."
        
        return full_text
    
    def _extract_concepts_with_llm(
        self,
        paper_text: str,
        paper_id: str,
        max_concepts: int
    ) -> List[Dict]:
        """Use LLM to extract concepts"""
        
        prompt = f"""You are an expert at analyzing research papers and extracting key concepts.

Given the following research paper excerpt, extract the {max_concepts} most important concepts.

For each concept, provide:
1. name: Clear, concise name
2. type: One of [definition, theory, equation, method, result, term]
3. definition: Brief 1-2 sentence definition
4. explanation: Detailed explanation (2-4 sentences)
5. difficulty: One of [beginner, intermediate, advanced]
6. examples: List of 1-2 concrete examples if applicable
7. equations: List of key equations if applicable
8. importance: Score from 0.0 to 1.0 indicating centrality to the paper

Return ONLY a valid JSON array with no additional text:
[
  {{
    "name": "Neural Network",
    "type": "definition",
    "definition": "A computational model inspired by biological neural networks.",
    "explanation": "Neural networks consist of interconnected nodes (neurons) organized in layers...",
    "difficulty": "intermediate",
    "examples": ["Convolutional Neural Networks for image recognition"],
    "equations": ["y = σ(Wx + b)"],
    "importance": 0.9
  }}
]

PAPER TEXT:
{paper_text}

Remember: Return ONLY the JSON array, no other text."""

        try:
            response = self.llm.generate(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=4000,
                json_mode=True
            )
            
            concepts = self.llm.parse_json_response(response)
            
            # Handle both array and object responses
            if isinstance(concepts, dict) and "concepts" in concepts:
                concepts = concepts["concepts"]
            
            return concepts[:max_concepts]
            
        except Exception as e:
            print(f"Error extracting concepts: {e}")
            return []
    
    def _extract_relationships(
        self,
        concepts: List[Concept],
        paper_text: str
    ) -> List[ConceptEdge]:
        """Extract relationships between concepts"""
        
        concept_names = [c.name for c in concepts]
        concept_map = {c.name: c.id for c in concepts}
        
        prompt = f"""Given these concepts from a research paper, identify relationships between them.

CONCEPTS:
{json.dumps(concept_names, indent=2)}

For each relationship, specify:
1. source: The prerequisite or broader concept
2. target: The dependent or specific concept
3. relationship_type: One of [prerequisite, related, part_of, example_of]
4. strength: 0.0 to 1.0 indicating relationship strength

Return ONLY a valid JSON array:
[
  {{
    "source": "Neural Network",
    "target": "Backpropagation",
    "relationship_type": "prerequisite",
    "strength": 0.9
  }}
]

Context from paper:
{paper_text[:3000]}

Return ONLY the JSON array."""

        try:
            response = self.llm.generate(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=2000,
                json_mode=True
            )
            
            relationships = self.llm.parse_json_response(response)
            
            if isinstance(relationships, dict) and "relationships" in relationships:
                relationships = relationships["relationships"]
            
            # Convert to ConceptEdge objects
            edges = []
            for rel in relationships:
                source_name = rel.get("source")
                target_name = rel.get("target")
                
                if source_name in concept_map and target_name in concept_map:
                    edge = ConceptEdge(
                        source_id=concept_map[source_name],
                        target_id=concept_map[target_name],
                        relationship_type=rel.get("relationship_type", "related"),
                        strength=rel.get("strength", 1.0)
                    )
                    edges.append(edge)
            
            return edges
            
        except Exception as e:
            print(f"Error extracting relationships: {e}")
            return []
    
    def _calculate_complexity(
        self,
        concepts: List[Concept],
        edges: List[ConceptEdge]
    ) -> float:
        """Calculate overall paper complexity score"""
        if not concepts:
            return 0.0
        
        # Factors: number of concepts, difficulty distribution, graph density
        num_concepts = len(concepts)
        num_edges = len(edges)
        
        # Difficulty score
        difficulty_scores = {
            ConceptDifficulty.BEGINNER: 0.3,
            ConceptDifficulty.INTERMEDIATE: 0.6,
            ConceptDifficulty.ADVANCED: 1.0
        }
        avg_difficulty = sum(
            difficulty_scores[c.difficulty] for c in concepts
        ) / num_concepts
        
        # Graph density
        max_edges = num_concepts * (num_concepts - 1) / 2
        density = num_edges / max_edges if max_edges > 0 else 0
        
        # Combined complexity score
        complexity = (
            0.3 * min(num_concepts / 30, 1.0) +  # Concept count factor
            0.4 * avg_difficulty +                  # Difficulty factor
            0.3 * density                           # Interconnection factor
        )
        
        return min(complexity, 1.0)