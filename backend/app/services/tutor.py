from typing import List, Dict, Optional
from app.core.llm import LLMService
from app.core.vector_store import vector_store
from app.models.chat import (
    ChatSession, Message, MessageRole, TutoringMode,
    ChatResponse, HintResponse
)
from app.models.concept import Concept


class SocraticTutor:
    """
    Socratic tutoring system that guides users to understanding
    through questions rather than direct answers
    """
    
    def __init__(self):
        self.llm = LLMService()
    
    def respond_to_query(
        self,
        session: ChatSession,
        user_message: str,
        concepts: List[Concept],
        page_number: Optional[int] = None
    ) -> ChatResponse:
        """
        Respond to a user query
        """
        print(f"Processing query in {session.tutoring_mode.value} mode...")
        
        # Find relevant context - increased n_results for better context
        relevant_chunks = self._get_relevant_context(
            paper_id=session.paper_id,
            query=user_message,
            page_number=page_number,
            n_results=5
        )
        
        # Debug logging
        if relevant_chunks:
            print(f"✅ Retrieved {len(relevant_chunks)} chunks from paper")
        else:
            print(f"⚠️  No chunks retrieved for query")
        
        # Identify related concepts
        related_concepts = self._identify_related_concepts(
            user_message=user_message,
            concepts=concepts
        )
        
        # Generate response based on tutoring mode
        if session.tutoring_mode == TutoringMode.SOCRATIC:
            response_text = self._generate_socratic_response(
                session=session,
                user_message=user_message,
                context=relevant_chunks,
                related_concepts=related_concepts
            )
        elif session.tutoring_mode == TutoringMode.HINT:
            response_text = self._generate_hint_based_response(
                session=session,
                user_message=user_message,
                context=relevant_chunks,
                related_concepts=related_concepts
            )
        elif session.tutoring_mode == TutoringMode.ANALOGIES:
            response_text = self._generate_analogy_response(
                session=session,
                user_message=user_message,
                context=relevant_chunks,
                related_concepts=related_concepts
            )
        else:  # DIRECT mode
            response_text = self._generate_direct_response(
                session=session,
                user_message=user_message,
                context=relevant_chunks
            )
        
        # Return ChatResponse
        response = ChatResponse(
            session_id=session.id,
            message=response_text,
            related_concepts=[c.id for c in related_concepts]
        )
        
        return response
    
    def _generate_socratic_response(
        self,
        session: ChatSession,
        user_message: str,
        context: List[Dict],
        related_concepts: List[Concept]
    ) -> str:
        """Generate Socratic-style response"""
        
        history = self._build_conversation_history(session)
        paper_context = "\n\n".join([c["text"] for c in context]) if context else ""
        
        concept_info = ""
        if related_concepts:
            concept_info = "\n".join([
                f"- {c.name}: {c.definition}"
                for c in related_concepts[:3]
            ])
        
        system_prompt = f"""You are a Socratic tutor helping a student understand a research paper.

TUTORING PRINCIPLES:
1. NEVER give direct answers immediately
2. Guide the student to discover answers through questions
3. Ask one question at a time
4. Build on previous exchanges
5. Reference the paper when relevant

STUDENT BACKGROUND: {session.user_background}

RELEVANT CONCEPTS:
{concept_info}

PAPER CONTEXT:
{paper_context[:2500]}

Guide with questions based on the paper context above."""

        messages = [
            {"role": "system", "content": system_prompt}
        ] + history + [
            {"role": "user", "content": user_message}
        ]
        
        try:
            response = self.llm.generate(
                messages=messages,
                temperature=0.7,
                max_tokens=400
            )
            return response.strip()
        except Exception as e:
            print(f"Error in LLM generation: {e}")
            return "I'm here to help you understand this paper. What specific aspect would you like to explore?"
    
    def _generate_hint_based_response(
        self,
        session: ChatSession,
        user_message: str,
        context: List[Dict],
        related_concepts: List[Concept]
    ) -> str:
        """Generate progressive hints BASED ON THE PAPER"""
        
        hint_level = self._determine_hint_level(session, user_message)
        paper_context = "\n\n".join([c["text"] for c in context]) if context else ""
        
        concept_info = ""
        if related_concepts:
            concept_info = "\n".join([
                f"- {c.name}: {c.definition}"
                for c in related_concepts[:3]
            ])
        
        prompt = f"""The student is asking: "{user_message}"

IMPORTANT: Base your hint on the paper content below.

PAPER CONTEXT:
{paper_context[:2500]}

RELATED CONCEPTS:
{concept_info}

Provide hint level {hint_level} of 3 that points to specific parts of the paper:
- Level 1: Point to which section of the paper to look at
- Level 2: Narrow down to specific paragraphs from the paper
- Level 3: Give guidance using the paper content

Hint (level {hint_level}):"""

        history = self._build_conversation_history(session)
        messages = history + [{"role": "user", "content": prompt}]
        
        try:
            response = self.llm.generate(
                messages=messages,
                temperature=0.5,
                max_tokens=400
            )
            return f"💡 Hint {hint_level}/3: {response.strip()}"
        except Exception as e:
            print(f"Error generating hint: {e}")
            return f"💡 Hint {hint_level}/3: Look at the methodology and results sections of the paper."
    
    def _generate_analogy_response(
        self,
        session: ChatSession,
        user_message: str,
        context: List[Dict],
        related_concepts: List[Concept]
    ) -> str:
        """Generate response using analogies CONNECTED TO THE PAPER"""
        
        paper_context = "\n\n".join([c["text"] for c in context]) if context else ""
        
        concept_info = ""
        if related_concepts:
            c = related_concepts[0]
            concept_info = f"Concept: {c.name}\nDefinition: {c.definition}\nExplanation: {c.explanation}"
        
        prompt = f"""Student question: "{user_message}"

PAPER CONTENT:
{paper_context[:2500]}

{concept_info}

INSTRUCTIONS:
1. Explain what the paper says about this
2. Provide an analogy that helps understand it
3. Connect back to the specific research

Student background: {session.user_background}"""

        history = self._build_conversation_history(session)
        messages = history + [{"role": "user", "content": prompt}]
        
        try:
            response = self.llm.generate(
                messages=messages,
                temperature=0.7,
                max_tokens=600
            )
            return response.strip()
        except Exception as e:
            print(f"Error generating analogy: {e}")
            return "Let me explain this concept based on the paper..."
    
    def _generate_direct_response(
        self,
        session: ChatSession,
        user_message: str,
        context: List[Dict]
    ) -> str:
        """Generate direct answer (matches old signature)"""
        
        paper_context = "\n\n".join([c["text"] for c in context]) if context else ""
        
        system_prompt = f"""You are a knowledgeable tutor explaining a research paper to a student.

Provide clear, direct explanations based on the paper content below.

STUDENT BACKGROUND: {session.user_background}

PAPER CONTEXT:
{paper_context[:2500]}

Answer the student's question using the paper content above."""

        history = self._build_conversation_history(session)
        messages = [
            {"role": "system", "content": system_prompt}
        ] + history + [
            {"role": "user", "content": user_message}
        ]
        
        try:
            response = self.llm.generate(
                messages=messages,
                temperature=0.7,
                max_tokens=500
            )
            return response.strip()
        except Exception as e:
            print(f"Error generating direct response: {e}")
            return "Based on the paper, let me explain..."
    
    def generate_progressive_hints(
        self,
        paper_id: str,
        question: str,
        current_level: int,
        max_level: int = 3
    ) -> HintResponse:
        """Generate a progressive hint"""
        
        context = self._get_relevant_context(paper_id, question, n_results=5)
        paper_context = "\n\n".join([c["text"] for c in context]) if context else ""
        
        if current_level >= max_level:
            prompt = f"""Question: {question}

PAPER CONTEXT:
{paper_context[:2500]}

Provide the complete answer citing the paper."""
        else:
            prompt = f"""Question: {question}

PAPER CONTEXT:
{paper_context[:2500]}

Provide hint level {current_level + 1} of {max_level} using the paper."""
        
        try:
            response = self.llm.generate(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
                max_tokens=400
            )
            hint_text = response.strip()
        except Exception as e:
            print(f"Error generating progressive hint: {e}")
            hint_text = "Review the relevant sections of the paper."
        
        return HintResponse(
            hint=hint_text,
            difficulty="medium"
        )
    
    def _get_relevant_context(
        self,
        paper_id: str,
        query: str,
        page_number: Optional[int] = None,
        n_results: int = 5
    ) -> List[Dict]:
        """Retrieve relevant context from paper"""
        
        try:
            filter_metadata = None
            if page_number:
                filter_metadata = {"page_start": str(page_number)}
            
            results = vector_store.search(
                paper_id=paper_id,
                query=query,
                n_results=n_results,
                filter_metadata=filter_metadata
            )
            
            return results
        except Exception as e:
            print(f"Error retrieving context: {e}")
            return []
    
    def _identify_related_concepts(
        self,
        user_message: str,
        concepts: List[Concept]
    ) -> List[Concept]:
        """Identify concepts related to user's question"""
        
        user_message_lower = user_message.lower()
        
        related = []
        for concept in concepts:
            if (concept.name.lower() in user_message_lower or
                any(word in user_message_lower for word in concept.name.lower().split())):
                related.append(concept)
        
        related.sort(key=lambda c: c.importance_score, reverse=True)
        
        return related[:5]
    
    def _build_conversation_history(
        self,
        session: ChatSession,
        max_messages: int = 10
    ) -> List[Dict[str, str]]:
        """Build conversation history for LLM"""
        
        history = []
        for msg in session.messages[-max_messages:]:
            if msg.role != MessageRole.SYSTEM:
                history.append({
                    "role": msg.role.value,
                    "content": msg.content
                })
        
        return history
    
    def _determine_hint_level(
        self,
        session: ChatSession,
        user_message: str
    ) -> int:
        """Determine what hint level to provide"""
        
        stuck_indicators = ["help", "stuck", "don't understand", "confused", "hint", "more"]
        
        if any(indicator in user_message.lower() for indicator in stuck_indicators):
            recent_messages = session.messages[-5:]
            stuck_count = sum(
                1 for msg in recent_messages
                if msg.role == MessageRole.USER and 
                any(indicator in msg.content.lower() for indicator in stuck_indicators)
            )
            return min(stuck_count, 3)
        
        return 1
    
    def _extract_page_references(self, chunks: List[Dict]) -> List[int]:
        """Extract page numbers from chunks"""
        pages = set()
        for chunk in chunks:
            metadata = chunk.get("metadata", {})
            if "page_start" in metadata:
                try:
                    pages.add(int(metadata["page_start"]))
                except:
                    pass
        
        return sorted(list(pages))