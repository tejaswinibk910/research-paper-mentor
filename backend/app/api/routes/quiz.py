from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List
from datetime import datetime
from app.models.quiz import (
    Quiz, QuizGenerationRequest, QuizResult,
    QuizSubmission, QuizAnswer, AdaptiveQuizRequest
)
from app.services.quiz_generator import QuizGenerator
from app.api.routes.papers import papers_db, concept_graphs_db
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter()

quizzes_db: Dict[str, Quiz] = {}
quiz_results_db: Dict[str, List[QuizResult]] = {}

quiz_generator = QuizGenerator()


@router.post("/quiz/generate", response_model=Quiz)
async def generate_quiz(
    request: QuizGenerationRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate a new quiz"""
    
    print(f"\n🎯 Generating quiz for paper {request.paper_id}")
    
    if request.paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    if request.paper_id not in concept_graphs_db:
        raise HTTPException(status_code=400, detail="Concepts not available")
    
    concepts = concept_graphs_db[request.paper_id].concepts
    
    if not concepts:
        raise HTTPException(status_code=400, detail="No concepts found")
    
    print(f"✅ Found {len(concepts)} concepts")
    
    if request.focus_concepts:
        concepts = [c for c in concepts if c.id in request.focus_concepts]
    
    if request.num_questions > len(concepts):
        request.num_questions = len(concepts)
    
    try:
        quiz = quiz_generator.generate_quiz(
            paper_id=request.paper_id,
            concepts=concepts,
            num_questions=request.num_questions,
            difficulty=request.difficulty,
            focus_concepts=request.focus_concepts,
            user_id=str(current_user.id)
        )
        
        quizzes_db[quiz.id] = quiz
        print(f"✅ Quiz generated: {len(quiz.questions)} questions")
        
        return quiz
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quiz/{quiz_id}", response_model=Quiz)
async def get_quiz(
    quiz_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get quiz"""
    if quiz_id not in quizzes_db:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    quiz = quizzes_db[quiz_id]
    if quiz.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return quiz


@router.post("/quiz/{quiz_id}/submit", response_model=QuizResult)
async def submit_quiz(
    quiz_id: str,
    submission: QuizSubmission,
    current_user: User = Depends(get_current_user)
):
    """Submit quiz and get results"""
    
    print(f"\n📝 Submitting quiz {quiz_id}")
    
    if quiz_id not in quizzes_db:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    quiz = quizzes_db[quiz_id]
    
    if quiz.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Grade quiz
        correct_count = 0
        answers_list = []
        question_results = []
        concept_scores_raw = {}  # Track individual scores per concept
        
        print(f"   Grading {len(quiz.questions)} questions...")
        
        for question in quiz.questions:
            user_answer = submission.answers.get(question.id, "")
            is_correct = user_answer.strip().lower() == question.correct_answer.strip().lower()
            
            if is_correct:
                correct_count += 1
            
            # Create answer object WITH concept_id
            answer = QuizAnswer(
                question_id=question.id,
                user_answer=user_answer,
                is_correct=is_correct,
                concept_id=question.concept_id  # CRITICAL: Set concept_id from question
            )
            
            answers_list.append(answer)
            
            # Track concept scores
            if question.concept_id:
                if question.concept_id not in concept_scores_raw:
                    concept_scores_raw[question.concept_id] = []
                concept_scores_raw[question.concept_id].append(1.0 if is_correct else 0.0)
                
                print(f"   Q{len(answers_list)}: Concept {question.concept_id[:8]}... = {'✓' if is_correct else '✗'}")
            
            # Create result detail
            question_results.append({
                "question_id": question.id,
                "question": question.question,
                "user_answer": user_answer,
                "correct_answer": question.correct_answer,
                "is_correct": is_correct,
                "explanation": question.explanation,
                "concept_id": question.concept_id
            })
        
        # Calculate average score per concept
        concept_scores = {
            concept_id: sum(scores) / len(scores)
            for concept_id, scores in concept_scores_raw.items()
        }
        
        print(f"\n   📊 Concept Scores:")
        for cid, score in concept_scores.items():
            print(f"      {cid[:8]}...: {score:.1%}")
        
        # Calculate totals
        total = len(quiz.questions)
        percentage = (correct_count / total * 100) if total > 0 else 0
        
        # Identify weak/strong concepts
        weak = [cid for cid, avg in concept_scores.items() if avg < 0.7]
        strong = [cid for cid, avg in concept_scores.items() if avg >= 0.9]
        
        # Create result
        result = QuizResult(
            quiz_id=quiz_id,
            user_id=str(current_user.id),
            paper_id=quiz.paper_id,
            answers=answers_list,
            score=percentage,
            score_percentage=percentage,
            total_questions=total,
            correct_answers=correct_count,
            time_taken=submission.time_taken,
            question_results=question_results,
            weak_concepts=weak,
            strong_concepts=strong,
            concept_scores=concept_scores  # CRITICAL: Set concept_scores!
        )
        
        # Store result
        key = f"{current_user.id}_{quiz.paper_id}"
        if key not in quiz_results_db:
            quiz_results_db[key] = []
        quiz_results_db[key].append(result)
        
        print(f"\n✅ Quiz Graded:")
        print(f"   Score: {correct_count}/{total} ({percentage:.1f}%)")
        print(f"   Concepts tracked: {len(concept_scores)}")
        print(f"   Weak concepts: {len(weak)}")
        print(f"   Strong concepts: {len(strong)}")
        print(f"   Stored in: {key}")
        
        return result
        
    except Exception as e:
        print(f"❌ Error grading quiz: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quiz/results/{user_id}/{paper_id}", response_model=List[QuizResult])
async def get_quiz_results(
    user_id: str,
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get quiz results"""
    if str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    key = f"{user_id}_{paper_id}"
    results = quiz_results_db.get(key, [])
    
    print(f"\n📊 Getting quiz results for {key}")
    print(f"   Found {len(results)} results")
    
    return results


@router.post("/quiz/generate/adaptive", response_model=Quiz)
async def generate_adaptive_quiz(
    request: AdaptiveQuizRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate adaptive quiz"""
    if request.paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    if request.paper_id not in concept_graphs_db:
        raise HTTPException(status_code=400, detail="Concepts not available")
    
    key = f"{request.user_id}_{request.paper_id}"
    past_results = quiz_results_db.get(key, [])
    
    if not past_results:
        return await generate_quiz(
            QuizGenerationRequest(
                paper_id=request.paper_id,
                num_questions=request.num_questions
            ),
            current_user
        )
    
    concepts = concept_graphs_db[request.paper_id].concepts
    
    try:
        quiz = quiz_generator.generate_adaptive_quiz(
            paper_id=request.paper_id,
            concepts=concepts,
            past_results=past_results,
            num_questions=request.num_questions
        )
        quiz.user_id = str(current_user.id)
        quizzes_db[quiz.id] = quiz
        return quiz
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))