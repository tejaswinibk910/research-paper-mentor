from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List
from datetime import datetime, timedelta
import uuid
from app.models.progress import (
    UserProgress, ConceptMastery, StudySession,
    ProgressSummary, LearningInsight, LearningInsightType,
    ProgressUpdate
)
from app.api.routes.papers import papers_db, concept_graphs_db
from app.api.routes.quiz import quiz_results_db
from app.api.routes.chat import chat_sessions_db
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter()

user_progress_db: Dict[str, UserProgress] = {}
study_sessions_db: Dict[str, List[StudySession]] = {}


def get_or_create_progress(user_id: str, paper_id: str) -> UserProgress:
    """Get or create user progress for a paper"""
    key = f"{user_id}_{paper_id}"
    if key not in user_progress_db:
        user_progress_db[key] = UserProgress(
            user_id=user_id,
            paper_id=paper_id
        )
    return user_progress_db[key]


@router.get("/progress/paper/{paper_id}", response_model=UserProgress)
async def get_paper_progress(
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get user progress for a specific paper"""
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    progress = get_or_create_progress(str(current_user.id), paper_id)
    _update_progress(progress, str(current_user.id), paper_id)
    
    return progress


@router.get("/progress/summary", response_model=ProgressSummary)
async def get_progress_summary(current_user: User = Depends(get_current_user)):
    """Get overall progress summary for user"""
    user_id = str(current_user.id)
    
    print(f"\n📊 Generating progress summary for user {user_id}")
    
    user_papers = list(papers_db.values())
    
    print(f"   Found {len(user_papers)} papers")
    
    total_papers = len(user_papers)
    total_study_time = 0
    papers_mastered = 0
    total_concepts = 0
    mastered_concepts = 0
    
    for paper in user_papers:
        progress = get_or_create_progress(user_id, paper.id)
        _update_progress(progress, user_id, paper.id)
        
        total_study_time += progress.total_study_time
        
        if progress.completion_percentage >= 80:
            papers_mastered += 1
        
        for concept in progress.concepts_mastery:
            total_concepts += 1
            if concept.mastery_level >= 0.8:
                mastered_concepts += 1
    
    recent_sessions = []
    if user_id in study_sessions_db:
        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_sessions = [
            s for s in study_sessions_db[user_id]
            if s.start_time >= week_ago
        ]
    
    avg_quiz_score = _calculate_average_quiz_score(user_id)
    study_streak = _calculate_study_streak(user_id)
    insights = _generate_insights(user_id, user_papers)
    
    print(f"✅ Summary generated:")
    print(f"   Papers: {total_papers}")
    print(f"   Concepts: {mastered_concepts}/{total_concepts}")
    print(f"   Avg Quiz Score: {avg_quiz_score:.1f}%")
    print(f"   Study Streak: {study_streak} days")
    
    return ProgressSummary(
        user_id=user_id,
        total_papers_studied=total_papers,
        total_study_time=total_study_time,
        papers_mastered=papers_mastered,
        concepts_learned=mastered_concepts,
        total_concepts=total_concepts,
        average_quiz_score=avg_quiz_score,
        study_streak=study_streak,
        recent_activity=recent_sessions,
        insights=insights
    )


@router.get("/progress/concepts/{paper_id}", response_model=List[ConceptMastery])
async def get_concept_mastery(
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get concept mastery levels for a paper"""
    print(f"\n🎯 Getting concept mastery for paper {paper_id}, user {current_user.id}")
    
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    if paper_id not in concept_graphs_db:
        print(f"⚠️  No concept graph for paper {paper_id}")
        return []
    
    progress = get_or_create_progress(str(current_user.id), paper_id)
    _update_progress(progress, str(current_user.id), paper_id)
    
    print(f"✅ Returning {len(progress.concepts_mastery)} concept masteries")
    
    return progress.concepts_mastery


@router.get("/progress/{user_id}/{paper_id}/due-for-review")
async def get_concepts_due_for_review(
    user_id: str,
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get concepts due for review"""
    if str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if paper_id not in concept_graphs_db:
        return {"count": 0, "concepts": []}
    
    concepts = concept_graphs_db[paper_id].concepts
    
    # For now, return empty - can implement spaced repetition later
    return {"count": 0, "concepts": []}


@router.get("/progress/{user_id}/{paper_id}/retention")
async def get_retention_stats(
    user_id: str,
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get retention statistics"""
    if str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    print(f"\n📈 Calculating retention stats for user {user_id}, paper {paper_id}")
    
    if paper_id not in concept_graphs_db:
        return {
            "overall_retention": 0.0,
            "concepts_mastered": 0,
            "concepts_in_progress": 0,
            "concepts_struggling": 0
        }
    
    progress = get_or_create_progress(user_id, paper_id)
    _update_progress(progress, user_id, paper_id)
    
    concepts = concept_graphs_db[paper_id].concepts
    total = len(concepts)
    
    mastered = sum(1 for cm in progress.concepts_mastery if cm.mastery_level >= 0.8)
    struggling = sum(1 for cm in progress.concepts_mastery if cm.mastery_level < 0.5 and cm.times_quizzed > 0)
    in_progress = total - mastered - struggling
    
    overall = mastered / total if total > 0 else 0.0
    
    stats = {
        "overall_retention": overall,
        "concepts_mastered": mastered,
        "concepts_in_progress": in_progress,
        "concepts_struggling": struggling
    }
    
    print(f"✅ Stats: {stats}")
    
    return stats


def _update_progress(progress: UserProgress, user_id: str, paper_id: str):
    """Update progress based on recent quiz results"""
    
    print(f"\n🔄 Updating progress for user {user_id}, paper {paper_id}")
    
    # Get all quiz results for this user-paper combo
    user_paper_key = f"{user_id}_{paper_id}"
    quiz_results = quiz_results_db.get(user_paper_key, [])
    
    print(f"   Found {len(quiz_results)} quiz results")
    
    if not quiz_results:
        # Initialize concepts with 0 mastery
        if paper_id in concept_graphs_db:
            concept_graph = concept_graphs_db[paper_id]
            progress.concepts_mastery = []
            
            for concept in concept_graph.concepts:
                progress.concepts_mastery.append(
                    ConceptMastery(
                        concept_id=concept.id,
                        concept_name=concept.name,
                        paper_id=paper_id,
                        mastery_level=0.0,
                        times_quizzed=0,
                        times_reviewed=0
                    )
                )
        print(f"   Initialized {len(progress.concepts_mastery)} concepts with 0 mastery")
        return
    
    # Calculate stats from quiz results
    progress.quiz_attempts = len(quiz_results)
    
    if quiz_results:
        total_score = sum(r.score for r in quiz_results)
        progress.average_quiz_score = total_score / len(quiz_results)
    
    # Build concept mastery from quiz results
    if paper_id in concept_graphs_db:
        concept_graph = concept_graphs_db[paper_id]
        concept_stats = {}
        
        # Aggregate all quiz results for each concept
        for quiz_result in quiz_results:
            for answer in quiz_result.answers:
                # Find which concept this question was about
                concept_id = None
                
                # Try to get concept_id from answer or question
                if hasattr(answer, 'concept_id'):
                    concept_id = answer.concept_id
                else:
                    # Need to find question to get concept_id
                    # This requires looking up the quiz
                    pass
                
                if concept_id:
                    if concept_id not in concept_stats:
                        concept_stats[concept_id] = {
                            'correct': 0,
                            'total': 0
                        }
                    
                    concept_stats[concept_id]['total'] += 1
                    if answer.is_correct:
                        concept_stats[concept_id]['correct'] += 1
        
        print(f"   Calculated stats for {len(concept_stats)} concepts")
        
        # Update concept mastery
        progress.concepts_mastery = []
        
        for concept in concept_graph.concepts:
            stats = concept_stats.get(concept.id, {'correct': 0, 'total': 0})
            
            mastery_level = 0.0
            if stats['total'] > 0:
                mastery_level = stats['correct'] / stats['total']
            
            progress.concepts_mastery.append(
                ConceptMastery(
                    concept_id=concept.id,
                    concept_name=concept.name,
                    paper_id=paper_id,
                    mastery_level=mastery_level,
                    times_quizzed=stats['total'],
                    times_reviewed=stats['total']
                )
            )
        
        print(f"   Updated {len(progress.concepts_mastery)} concept masteries")
    
    # Calculate completion
    if progress.concepts_mastery:
        avg_mastery = sum(c.mastery_level for c in progress.concepts_mastery) / len(progress.concepts_mastery)
        progress.completion_percentage = int(avg_mastery * 100)
        print(f"   Completion: {progress.completion_percentage}%")


def _calculate_average_quiz_score(user_id: str) -> float:
    """Calculate average quiz score across all papers"""
    all_results = []
    for key, results_list in quiz_results_db.items():
        if key.startswith(f"{user_id}_"):
            all_results.extend(results_list)
    
    if not all_results:
        return 0.0
    
    return sum(r.score for r in all_results) / len(all_results)


def _calculate_study_streak(user_id: str) -> int:
    """Calculate current study streak in days"""
    if user_id not in study_sessions_db:
        return 0
    
    sessions = sorted(study_sessions_db[user_id], key=lambda s: s.start_time, reverse=True)
    if not sessions:
        return 0
    
    streak = 0
    current_date = datetime.utcnow().date()
    
    for session in sessions:
        session_date = session.start_time.date()
        
        if session_date == current_date:
            if streak == 0:
                streak = 1
        elif session_date == current_date - timedelta(days=streak + 1):
            streak += 1
        else:
            break
    
    return streak


def _generate_insights(user_id: str, papers: list) -> List[LearningInsight]:
    """Generate learning insights"""
    insights = []
    
    all_results = []
    for key, results_list in quiz_results_db.items():
        if key.startswith(f"{user_id}_"):
            all_results.extend(results_list)
    
    if all_results:
        avg_score = sum(r.score for r in all_results) / len(all_results)
        if avg_score >= 80:
            insights.append(LearningInsight(
                type=LearningInsightType.ACHIEVEMENT,
                message=f"Excellent quiz performance! Average score: {avg_score:.1f}%",
                action="You're mastering the material!"
            ))
        elif avg_score < 60:
            insights.append(LearningInsight(
                type=LearningInsightType.SUGGESTION,
                message=f"Quiz scores could improve. Current average: {avg_score:.1f}%",
                action="Try reviewing weak concepts and using the tutor chat."
            ))
    
    if user_id in study_sessions_db:
        sessions = study_sessions_db[user_id]
        if len(sessions) >= 3:
            insights.append(LearningInsight(
                type=LearningInsightType.ACHIEVEMENT,
                message=f"Great consistency! You've completed {len(sessions)} study sessions.",
                action="Keep up the excellent study habits!"
            ))
    
    if not insights:
        insights.append(LearningInsight(
            type=LearningInsightType.SUGGESTION,
            message="Start your learning journey!",
            action="Take a quiz to begin tracking your progress."
        ))
    
    return insights[:5]


@router.post("/progress/session/start")
async def start_study_session(
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Start a new study session"""
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    session_id = str(uuid.uuid4())
    session = StudySession(
        id=session_id,
        paper_id=paper_id,
        user_id=str(current_user.id),
        start_time=datetime.utcnow()
    )
    
    user_id = str(current_user.id)
    if user_id not in study_sessions_db:
        study_sessions_db[user_id] = []
    
    study_sessions_db[user_id].append(session)
    
    return {"session_id": session_id, "message": "Study session started"}

@router.get("/progress/debug/{user_id}/{paper_id}")
async def debug_progress(
    user_id: str,
    paper_id: str
    # REMOVED: current_user: User = Depends(get_current_user)
):
    """Debug endpoint to check quiz results"""
    from app.api.routes.quiz import quiz_results_db
    
    key = f"{user_id}_{paper_id}"
    results = quiz_results_db.get(key, [])
    
    return {
        "key": key,
        "num_results": len(results),
        "all_keys": list(quiz_results_db.keys()),
        "results": [
            {
                "quiz_id": r.quiz_id,
                "score": r.score_percentage,
                "concept_scores": r.concept_scores,
                "num_concepts": len(r.concept_scores),
                "total_questions": r.total_questions,
                "correct_answers": r.correct_answers
            }
            for r in results
        ]
    }
