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
    else:
        # FIX: Ensure loaded data is converted to UserProgress model
        existing = user_progress_db[key]
        if isinstance(existing, dict):
            user_progress_db[key] = UserProgress(**existing)
    
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


@router.get("/progress/{user_id}/{paper_id}/concepts")
async def get_concept_progress(
    user_id: str,
    paper_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get concept progress - COMPATIBLE WITH FRONTEND"""
    if str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    print(f"\n🎯 Getting concept progress for user {user_id}, paper {paper_id}")
    
    if paper_id not in concept_graphs_db:
        raise HTTPException(status_code=404, detail="Paper concepts not found")
    
    progress = get_or_create_progress(user_id, paper_id)
    _update_progress(progress, user_id, paper_id)
    
    # Convert ConceptMastery to format expected by frontend
    concept_progress = []
    for cm in progress.concepts_mastery:
        concept_progress.append({
            "user_id": user_id,
            "concept_id": cm.concept_id,
            "paper_id": paper_id,
            "is_understood": cm.mastery_level >= 0.8,
            "confidence_level": cm.mastery_level,
            "times_reviewed": cm.times_reviewed,
            "times_quizzed": cm.times_quizzed,
            "correct_answers": int(cm.mastery_level * cm.times_quizzed) if cm.times_quizzed > 0 else 0,
            "last_reviewed": None,
            "next_review": None,
            "ease_factor": 2.5,
            "interval_days": 1
        })
    
    print(f"✅ Returning {len(concept_progress)} concept progress records")
    return concept_progress


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
            "concepts_struggling": 0,
            "average_confidence": 0.0
        }
    
    progress = get_or_create_progress(user_id, paper_id)
    _update_progress(progress, user_id, paper_id)
    
    concepts = concept_graphs_db[paper_id].concepts
    total = len(concepts)
    
    mastered = sum(1 for cm in progress.concepts_mastery if cm.mastery_level >= 0.8)
    struggling = sum(1 for cm in progress.concepts_mastery if cm.mastery_level < 0.5 and cm.times_quizzed > 0)
    in_progress = total - mastered - struggling
    
    overall = mastered / total if total > 0 else 0.0
    avg_confidence = sum(cm.mastery_level for cm in progress.concepts_mastery) / total if total > 0 else 0.0
    
    stats = {
        "overall_retention": overall,
        "concepts_mastered": mastered,
        "concepts_in_progress": in_progress,
        "concepts_struggling": struggling,
        "average_confidence": avg_confidence
    }
    
    print(f"✅ Stats: {stats}")
    
    return stats


def _update_progress(progress: UserProgress, user_id: str, paper_id: str):
    """Update progress based on recent quiz results - FIXED VERSION"""
    
    # FIX: Ensure progress is a UserProgress object, not a dict
    if isinstance(progress, dict):
        progress = UserProgress(**progress)
        # Update the database with the converted object
        key = f"{user_id}_{paper_id}"
        user_progress_db[key] = progress
    
    print(f"\n🔄 Updating progress for user {user_id}, paper {paper_id}")
    
    # Get all quiz results for this user-paper combo
    user_paper_key = f"{user_id}_{paper_id}"
    raw_quiz_results = quiz_results_db.get(user_paper_key, [])
    
    # FIX: Convert quiz results from dict to QuizResult objects
    from app.models.quiz import QuizResult
    quiz_results = []
    for result in raw_quiz_results:
        if isinstance(result, dict):
            try:
                quiz_results.append(QuizResult(**result))
            except Exception as e:
                print(f"   ⚠️ Skipping corrupted quiz result: {e}")
                continue
        else:
            quiz_results.append(result)
    
    print(f"   Found {len(quiz_results)} quiz results")
    
    if not quiz_results:
        # Initialize concepts with 0 mastery
        if paper_id in concept_graphs_db:
            # FIX: Convert concept_graph from dict to ConceptGraph object
            from app.models.concept import ConceptGraph
            raw_concept_graph = concept_graphs_db[paper_id]
            if isinstance(raw_concept_graph, dict):
                concept_graph = ConceptGraph(**raw_concept_graph)
            else:
                concept_graph = raw_concept_graph
            
            progress.concepts_mastery = []
            
            for concept in concept_graph.concepts:
                progress.concepts_mastery.append(
                    ConceptMastery(
                        concept_id=concept.id if hasattr(concept, 'id') else concept['id'],
                        concept_name=concept.name if hasattr(concept, 'name') else concept['name'],
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
        total_score = sum(r.score_percentage for r in quiz_results)
        progress.average_quiz_score = total_score / len(quiz_results)
    
    # Build concept mastery from quiz results - FIXED TO USE concept_scores
    if paper_id in concept_graphs_db:
        # FIX: Convert concept_graph from dict to ConceptGraph object
        from app.models.concept import ConceptGraph, Concept
        raw_concept_graph = concept_graphs_db[paper_id]
        if isinstance(raw_concept_graph, dict):
            concept_graph = ConceptGraph(**raw_concept_graph)
        else:
            concept_graph = raw_concept_graph
        
        concept_stats = {}
        
        print(f"   Processing {len(quiz_results)} quiz results...")
        
        # FIXED: Use concept_scores directly from quiz results
        for quiz_result in quiz_results:
            # Each quiz result has a concept_scores dict: {concept_id: score}
            if hasattr(quiz_result, 'concept_scores') and quiz_result.concept_scores:
                for concept_id, score in quiz_result.concept_scores.items():
                    if concept_id not in concept_stats:
                        concept_stats[concept_id] = {
                            'scores': [],
                            'count': 0
                        }
                    
                    concept_stats[concept_id]['scores'].append(score)
                    concept_stats[concept_id]['count'] += 1
        
        print(f"   Calculated stats for {len(concept_stats)} concepts")
        
        # Update concept mastery
        progress.concepts_mastery = []
        
        for raw_concept in concept_graph.concepts:
            # FIX: Handle concept as dict or Concept object
            if isinstance(raw_concept, dict):
                concept = Concept(**raw_concept)
            else:
                concept = raw_concept
            
            if concept.id in concept_stats:
                stats = concept_stats[concept.id]
                # Average all the scores for this concept
                mastery_level = sum(stats['scores']) / len(stats['scores'])
                times_quizzed = stats['count']
            else:
                mastery_level = 0.0
                times_quizzed = 0
            
            progress.concepts_mastery.append(
                ConceptMastery(
                    concept_id=concept.id,
                    concept_name=concept.name,
                    paper_id=paper_id,
                    mastery_level=mastery_level,
                    times_quizzed=times_quizzed,
                    times_reviewed=times_quizzed
                )
            )
            
            if times_quizzed > 0:
                print(f"   {concept.name}: {mastery_level:.1%} ({times_quizzed} times quizzed)")
        
        print(f"   Updated {len(progress.concepts_mastery)} concept masteries")
    
    # Calculate completion
    if progress.concepts_mastery:
        avg_mastery = sum(c.mastery_level for c in progress.concepts_mastery) / len(progress.concepts_mastery)
        progress.completion_percentage = int(avg_mastery * 100)
        print(f"   Completion: {progress.completion_percentage}%")

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
    from app.models.quiz import QuizResult
    
    insights = []
    
    all_results = []
    for key, results_list in quiz_results_db.items():
        if key.startswith(f"{user_id}_"):
            # Convert dicts to QuizResult objects
            for result in results_list:
                if isinstance(result, dict):
                    try:
                        all_results.append(QuizResult(**result))
                    except:
                        continue
                else:
                    all_results.append(result)
    
    if all_results:
        avg_score = sum(r.score_percentage for r in all_results) / len(all_results)
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
):
    """Debug endpoint to check quiz results"""
    key = f"{user_id}_{paper_id}"
    results = quiz_results_db.get(key, [])
    
    return {
        "key": key,
        "num_results": len(results),
        "all_keys": list(quiz_results_db.keys()),
        "results": [
            {
                "quiz_id": r.quiz_id if hasattr(r, 'quiz_id') else r.get('quiz_id'),
                "score": r.score_percentage if hasattr(r, 'score_percentage') else r.get('score_percentage'),
                "concept_scores": r.concept_scores if hasattr(r, 'concept_scores') else r.get('concept_scores'),
                "num_concepts": len(r.concept_scores) if hasattr(r, 'concept_scores') else len(r.get('concept_scores', {})),
                "total_questions": r.total_questions if hasattr(r, 'total_questions') else r.get('total_questions'),
                "correct_answers": r.correct_answers if hasattr(r, 'correct_answers') else r.get('correct_answers')
            }
            for r in results
        ]
    }