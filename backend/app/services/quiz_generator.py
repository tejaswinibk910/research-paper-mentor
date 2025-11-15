from typing import List, Dict, Optional
from app.core.llm import LLMService
from app.core.vector_store import vector_store
from app.models.quiz import (
    Question,              
    QuestionType,
    QuestionDifficulty,
    Quiz,
    QuizSubmission,
    QuizResult,  # ADDED
    QuizAnswer   # ADDED
)
from app.models.concept import Concept
import uuid
from datetime import datetime


class QuizGenerator:
    """
    Generate quizzes with adaptive difficulty
    """
    
    def __init__(self):
        self.llm = LLMService()
    
    def generate_quiz(
        self,
        paper_id: str,
        concepts: List[Concept],
        num_questions: int = 5,
        difficulty: Optional[QuestionDifficulty] = None,
        focus_concepts: Optional[List[str]] = None,
        user_id: Optional[str] = None
    ) -> Quiz:
        """
        Generate a quiz for a paper
        
        Args:
            paper_id: ID of the paper
            concepts: List of concepts from the paper
            num_questions: Number of questions to generate
            difficulty: Target difficulty level
            focus_concepts: Specific concept IDs to focus on
            user_id: Optional user ID
            
        Returns:
            Quiz object
        """
        print(f"Generating quiz for paper {paper_id}...")
        
        # Filter concepts if focus is specified
        if focus_concepts:
            concepts = [c for c in concepts if c.id in focus_concepts]
        
        # Select concepts to quiz
        selected_concepts = self._select_concepts_for_quiz(
            concepts=concepts,
            num_questions=num_questions
        )
        
        # Generate questions
        questions = []
        for concept in selected_concepts:
            question = self._generate_question_for_concept(
                concept=concept,
                paper_id=paper_id,
                difficulty=difficulty
            )
            if question:
                questions.append(question)
        
        # Create quiz
        quiz = Quiz(
            id=str(uuid.uuid4()),
            paper_id=paper_id,
            user_id=user_id,
            title=f"Concept Check Quiz - {len(questions)} Questions",
            questions=questions,
            total_questions=len(questions),
            target_concepts=[c.id for c in selected_concepts],
            difficulty_level=difficulty or QuestionDifficulty.MEDIUM,
            is_adaptive=False
        )
        
        return quiz
    
    def generate_adaptive_quiz(
        self,
        paper_id: str,
        concepts: List[Concept],
        past_results: List[QuizResult],
        num_questions: int = 5
    ) -> Quiz:
        """
        Generate an adaptive quiz based on past performance
        
        Args:
            paper_id: ID of the paper
            concepts: All concepts from paper
            past_results: Previous quiz results
            num_questions: Number of questions
            
        Returns:
            Adaptive quiz focusing on weak areas
        """
        print(f"Generating adaptive quiz for paper {paper_id}...")
        
        # Analyze past performance
        weak_concept_ids = self._identify_weak_concepts(past_results)
        
        # Get weak concepts
        weak_concepts = [c for c in concepts if c.id in weak_concept_ids]
        
        # If not enough weak concepts, add some random ones
        if len(weak_concepts) < num_questions:
            other_concepts = [c for c in concepts if c.id not in weak_concept_ids]
            weak_concepts.extend(other_concepts[:num_questions - len(weak_concepts)])
        
        # Generate quiz
        quiz = self.generate_quiz(
            paper_id=paper_id,
            concepts=concepts,
            num_questions=num_questions,
            focus_concepts=[c.id for c in weak_concepts[:num_questions]]
        )
        
        quiz.is_adaptive = True
        quiz.title = "Adaptive Quiz - Focus on Weak Areas"
        
        return quiz
    
    def _select_concepts_for_quiz(
        self,
        concepts: List[Concept],
        num_questions: int
    ) -> List[Concept]:
        """Select which concepts to include in quiz"""
        
        # Sort by importance
        sorted_concepts = sorted(
            concepts,
            key=lambda c: c.importance_score,
            reverse=True
        )
        
        # Select top concepts
        return sorted_concepts[:num_questions]
    
    def _generate_question_for_concept(
        self,
        concept: Concept,
        paper_id: str,
        difficulty: Optional[QuestionDifficulty] = None
    ) -> Optional[Question]:
        """Generate a question for a specific concept"""
        
        # Get relevant context from paper
        context = self._get_concept_context(paper_id, concept)
        
        # Determine difficulty
        if difficulty is None:
            difficulty = self._map_concept_difficulty_to_question_difficulty(
                concept.difficulty
            )
        
        # Generate question using LLM
        question_data = self._generate_question_with_llm(
            concept=concept,
            context=context,
            difficulty=difficulty
        )
        
        if not question_data:
            return None
        
        # Create Question object
        question = Question(
            id=str(uuid.uuid4()),
            type=QuestionType(question_data.get("type", "multiple_choice")),
            difficulty=difficulty,
            question=question_data["question"],
            options=question_data.get("options"),
            correct_answer=question_data["correct_answer"],
            explanation=question_data["explanation"],
            concept_id=concept.id,
            paper_id=paper_id,
            page_reference=concept.page_numbers[0] if concept.page_numbers else None,
            distractor_explanations=question_data.get("distractor_explanations")
        )
        
        return question
    
    def _generate_question_with_llm(
        self,
        concept: Concept,
        context: str,
        difficulty: QuestionDifficulty
    ) -> Optional[Dict]:
        """Use LLM to generate a question"""
        
        prompt = f"""Generate a {difficulty.value} difficulty multiple choice question about this concept.

CONCEPT: {concept.name}
DEFINITION: {concept.definition}
EXPLANATION: {concept.explanation}

CONTEXT FROM PAPER:
{context}

Generate a question that tests understanding (not just memorization).

Return ONLY valid JSON in this format:
{{
  "type": "multiple_choice",
  "question": "Clear, specific question?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": "Option A",
  "explanation": "Why this answer is correct and others are wrong",
  "distractor_explanations": {{
    "Option B": "Why this is incorrect",
    "Option C": "Why this is incorrect",
    "Option D": "Why this is incorrect"
  }}
}}

Requirements:
- Question should test understanding, not just recall
- All options should be plausible
- Explanation should reference the paper context
- Return ONLY the JSON, no other text"""

        try:
            response = self.llm.generate(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=800,
                json_mode=True
            )
            
            question_data = self.llm.parse_json_response(response)
            return question_data
            
        except Exception as e:
            print(f"Error generating question: {e}")
            return None
    
    def _get_concept_context(self, paper_id: str, concept: Concept) -> str:
        """Get relevant context for a concept from the paper"""
        
        # Search for relevant chunks
        results = vector_store.search(
            paper_id=paper_id,
            query=f"{concept.name} {concept.definition}",
            n_results=2
        )
        
        context = "\n\n".join([r["text"] for r in results])
        return context[:1500]  # Limit context length
    
    def _map_concept_difficulty_to_question_difficulty(
        self,
        concept_difficulty
    ) -> QuestionDifficulty:
        """Map concept difficulty to question difficulty"""
        mapping = {
            "beginner": QuestionDifficulty.EASY,
            "intermediate": QuestionDifficulty.MEDIUM,
            "advanced": QuestionDifficulty.HARD
        }
        return mapping.get(concept_difficulty.value, QuestionDifficulty.MEDIUM)
    
    def _identify_weak_concepts(
        self,
        past_results: List[QuizResult]
    ) -> List[str]:
        """Identify concepts the user struggles with"""
        
        concept_performance = {}
        
        for result in past_results:
            for concept_id, score in result.concept_scores.items():
                if concept_id not in concept_performance:
                    concept_performance[concept_id] = []
                concept_performance[concept_id].append(score)
        
        # Calculate average performance per concept
        weak_concepts = []
        for concept_id, scores in concept_performance.items():
            avg_score = sum(scores) / len(scores)
            if avg_score < 0.7:  # Below 70% is considered weak
                weak_concepts.append((concept_id, avg_score))
        
        # Sort by performance (worst first)
        weak_concepts.sort(key=lambda x: x[1])
        
        return [concept_id for concept_id, _ in weak_concepts]
    
    def evaluate_quiz(
        self,
        quiz: Quiz,
        answers: List[QuizAnswer],
        user_id: str
    ) -> QuizResult:
        """
        Evaluate quiz answers and create result
        
        Args:
            quiz: The quiz that was taken
            answers: User's answers
            user_id: ID of the user
            
        Returns:
            QuizResult with scores and analysis
        """
        correct_count = 0
        concept_scores = {}
        
        # Evaluate each answer
        for answer in answers:
            # Find the question
            question = next(
                (q for q in quiz.questions if q.id == answer.question_id),
                None
            )
            
            if question:
                # Check if correct
                is_correct = (
                    answer.user_answer.strip().lower() == 
                    question.correct_answer.strip().lower()
                )
                answer.is_correct = is_correct
                
                if is_correct:
                    correct_count += 1
                
                # Track concept performance
                concept_id = question.concept_id
                if concept_id not in concept_scores:
                    concept_scores[concept_id] = []
                concept_scores[concept_id].append(1.0 if is_correct else 0.0)
        
        # Calculate concept averages
        concept_avg_scores = {
            concept_id: sum(scores) / len(scores)
            for concept_id, scores in concept_scores.items()
        }
        
        # Identify weak and strong concepts
        weak_concepts = [
            concept_id for concept_id, score in concept_avg_scores.items()
            if score < 0.7
        ]
        strong_concepts = [
            concept_id for concept_id, score in concept_avg_scores.items()
            if score >= 0.9
        ]
        
        # Create result
        result = QuizResult(
            quiz_id=quiz.id,
            user_id=user_id,
            paper_id=quiz.paper_id,
            answers=answers,
            total_questions=quiz.total_questions,
            correct_answers=correct_count,
            score_percentage=(correct_count / quiz.total_questions * 100),
            concept_scores=concept_avg_scores,
            weak_concepts=weak_concepts,
            strong_concepts=strong_concepts
        )
        
        return result