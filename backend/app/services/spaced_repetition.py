from datetime import datetime, timedelta
from typing import List, Dict
from app.models.concept import ConceptUnderstanding
from app.models.quiz import QuizResult


class SpacedRepetitionService:
    """
    Implement spaced repetition using SM-2 algorithm
    to optimize learning retention
    """
    
    def __init__(self):
        # SM-2 algorithm constants
        self.MIN_EASE_FACTOR = 1.3
        self.INITIAL_EASE_FACTOR = 2.5
    
    def update_concept_understanding(
        self,
        understanding: ConceptUnderstanding,
        quiz_result: QuizResult,
        concept_id: str
    ) -> ConceptUnderstanding:
        """
        Update concept understanding based on quiz performance
        
        Args:
            understanding: Current understanding state
            quiz_result: Result of the quiz
            concept_id: ID of the concept
            
        Returns:
            Updated ConceptUnderstanding
        """
        # Get performance on this concept
        if concept_id not in quiz_result.concept_scores:
            return understanding
        
        score = quiz_result.concept_scores[concept_id]
        
        # Update statistics
        understanding.times_quizzed += 1
        
        if score >= 0.5:  # Consider 50% as "correct" for multi-question concepts
            understanding.correct_answers += 1
        
        # Calculate quality of response (0-5 scale for SM-2)
        quality = self._score_to_quality(score)
        
        # Update using SM-2 algorithm
        understanding = self._sm2_algorithm(understanding, quality)
        
        # Update confidence level
        understanding.confidence_level = min(
            understanding.correct_answers / understanding.times_quizzed,
            1.0
        )
        
        # Mark as understood if high performance
        if understanding.confidence_level >= 0.8 and understanding.times_quizzed >= 2:
            understanding.is_understood = True
        
        return understanding
    
    def _sm2_algorithm(
        self,
        understanding: ConceptUnderstanding,
        quality: int
    ) -> ConceptUnderstanding:
        """
        SM-2 spaced repetition algorithm
        
        Args:
            understanding: Current understanding
            quality: Quality of recall (0-5)
            
        Returns:
            Updated understanding with new interval and ease factor
        """
        # If quality < 3, reset interval to 1
        if quality < 3:
            understanding.interval_days = 1
            understanding.ease_factor = max(
                self.INITIAL_EASE_FACTOR - 0.2,
                self.MIN_EASE_FACTOR
            )
        else:
            # Update ease factor
            understanding.ease_factor = max(
                understanding.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
                self.MIN_EASE_FACTOR
            )
            
            # Update interval
            if understanding.interval_days == 1:
                understanding.interval_days = 6
            else:
                understanding.interval_days = int(
                    understanding.interval_days * understanding.ease_factor
                )
        
        # Update review dates
        now = datetime.utcnow()
        understanding.last_reviewed = now.isoformat()
        understanding.next_review = (
            now + timedelta(days=understanding.interval_days)
        ).isoformat()
        
        understanding.times_reviewed += 1
        
        return understanding
    
    def _score_to_quality(self, score: float) -> int:
        """
        Convert 0-1 score to SM-2 quality (0-5)
        
        5: Perfect recall
        4: Correct with hesitation
        3: Correct with difficulty
        2: Incorrect but remembered
        1: Incorrect, familiar
        0: Complete blackout
        """
        if score >= 0.95:
            return 5
        elif score >= 0.8:
            return 4
        elif score >= 0.6:
            return 3
        elif score >= 0.4:
            return 2
        elif score >= 0.2:
            return 1
        else:
            return 0
    
    def get_concepts_due_for_review(
        self,
        understandings: List[ConceptUnderstanding],
        include_new: bool = True
    ) -> List[str]:
        """
        Get concepts that are due for review
        
        Args:
            understandings: List of concept understandings
            include_new: Include concepts never reviewed
            
        Returns:
            List of concept IDs due for review
        """
        now = datetime.utcnow()
        due_concepts = []
        
        for understanding in understandings:
            # New concepts (never reviewed)
            if understanding.last_reviewed is None:
                if include_new:
                    due_concepts.append(understanding.concept_id)
                continue
            
            # Check if due for review
            if understanding.next_review:
                next_review = datetime.fromisoformat(understanding.next_review)
                if next_review <= now:
                    due_concepts.append(understanding.concept_id)
        
        return due_concepts
    
    def prioritize_concepts_for_review(
        self,
        understandings: List[ConceptUnderstanding],
        max_concepts: int = 10
    ) -> List[str]:
        """
        Prioritize which concepts to review
        
        Priority factors:
        1. Overdue concepts (past next_review date)
        2. Low confidence concepts
        3. Important but not yet mastered
        
        Args:
            understandings: All concept understandings
            max_concepts: Maximum concepts to return
            
        Returns:
            Prioritized list of concept IDs
        """
        now = datetime.utcnow()
        scored_concepts = []
        
        for understanding in understandings:
            score = 0.0
            
            # Factor 1: Overdue (0-10 points)
            if understanding.next_review:
                next_review = datetime.fromisoformat(understanding.next_review)
                days_overdue = (now - next_review).days
                if days_overdue > 0:
                    score += min(days_overdue, 10)
            else:
                # Never reviewed - high priority
                score += 8
            
            # Factor 2: Low confidence (0-5 points)
            score += (1.0 - understanding.confidence_level) * 5
            
            # Factor 3: Not understood but reviewed (0-3 points)
            if not understanding.is_understood and understanding.times_reviewed > 0:
                score += 3
            
            # Factor 4: Never quizzed (0-2 points)
            if understanding.times_quizzed == 0:
                score += 2
            
            scored_concepts.append((understanding.concept_id, score))
        
        # Sort by score (highest first)
        scored_concepts.sort(key=lambda x: x[1], reverse=True)
        
        return [concept_id for concept_id, _ in scored_concepts[:max_concepts]]
    
    def calculate_retention_rate(
        self,
        understandings: List[ConceptUnderstanding]
    ) -> Dict[str, float]:
        """
        Calculate overall retention statistics
        
        Returns:
            Dictionary with retention metrics
        """
        if not understandings:
            return {
                "overall_retention": 0.0,
                "concepts_mastered": 0,
                "concepts_in_progress": 0,
                "concepts_struggling": 0,
                "average_confidence": 0.0
            }
        
        total = len(understandings)
        mastered = sum(1 for u in understandings if u.is_understood)
        struggling = sum(
            1 for u in understandings 
            if u.times_quizzed >= 3 and u.confidence_level < 0.5
        )
        in_progress = total - mastered - struggling
        
        avg_confidence = sum(u.confidence_level for u in understandings) / total
        
        return {
            "overall_retention": mastered / total if total > 0 else 0.0,
            "concepts_mastered": mastered,
            "concepts_in_progress": in_progress,
            "concepts_struggling": struggling,
            "average_confidence": avg_confidence
        }
    
    def predict_forgetting_curve(
        self,
        understanding: ConceptUnderstanding,
        days_ahead: int = 30
    ) -> List[Dict[str, any]]:
        """
        Predict forgetting curve for a concept
        
        Returns list of predicted retention at different time points
        """
        if not understanding.last_reviewed:
            return []
        
        last_reviewed = datetime.fromisoformat(understanding.last_reviewed)
        predictions = []
        
        for day in range(0, days_ahead + 1, 5):
            date = last_reviewed + timedelta(days=day)
            
            # Simple forgetting curve: R(t) = e^(-t/S)
            # where S is strength (related to ease factor and interval)
            strength = understanding.interval_days * understanding.ease_factor / 2
            retention = understanding.confidence_level * (2.71828 ** (-day / max(strength, 1)))
            
            predictions.append({
                "date": date.isoformat(),
                "days_since_review": day,
                "predicted_retention": min(retention, 1.0)
            })
        
        return predictions