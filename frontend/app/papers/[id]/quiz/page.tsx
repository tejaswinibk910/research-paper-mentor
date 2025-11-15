'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Quiz, QuizQuestion, QuizAnswer, QuestionDifficulty } from '@/lib/types';
import { Loader2, CheckCircle, XCircle, Trophy, RotateCcw, Settings, Zap } from 'lucide-react';

type QuizMode = 'standard' | 'adaptive';

const getConceptName = (conceptId: string, concepts: any[]): string => {
  const concept = concepts?.find((c: any) => c.id === conceptId);
  return concept ? concept.name : conceptId;
};

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [concepts, setConcepts] = useState<any[]>([]);
  
  const [showSettings, setShowSettings] = useState(true);
  const [mode, setMode] = useState<QuizMode>('standard');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('medium');
  const [numQuestions, setNumQuestions] = useState(5);

  useEffect(() => {
    const loadConcepts = async () => {
      try {
        const conceptGraph = await api.getPaperConcepts(paperId);
        setConcepts(conceptGraph.concepts);
      } catch (error) {
        console.error('Failed to load concepts:', error);
      }
    };
    loadConcepts();
  }, [paperId]);

  const generateQuiz = async () => {
    setGenerating(true);
    setShowSettings(false);
    try {
      let newQuiz;
      
      if (mode === 'adaptive') {
        newQuiz = await api.generateAdaptiveQuiz(
          paperId,
          'user-123',
          numQuestions
        );
      } else {
        newQuiz = await api.generateQuiz(
          paperId,
          'user-123',
          numQuestions,
          difficulty
        );
      }
      
      setQuiz(newQuiz);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setShowResults(false);
    } catch (error) {
      console.error('Failed to generate quiz:', error);
      alert('Failed to generate quiz. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    
    setLoading(true);
    try {
      const quizAnswers: QuizAnswer[] = quiz.questions.map(q => ({
        question_id: q.id,
        user_answer: answers[q.id] || '',
      }));

      const result = await api.evaluateQuiz(quiz.id, quizAnswers, 'user-123');
      setResults(result);
      setShowResults(true);
      
      // ADDED: Mark quiz as completed so progress page refreshes
      localStorage.setItem('quizCompleted', 'true');
      
      console.log('Quiz submitted! Progress updated automatically.');
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      alert('Failed to submit quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetake = () => {
    setShowSettings(true);
    setQuiz(null);
    setShowResults(false);
    setAnswers({});
    setCurrentQuestionIndex(0);
  };

  if (showSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Configure Your Quiz
            </h1>

            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Quiz Mode
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setMode('standard')}
                  className={`
                    p-4 rounded-lg border-2 transition-all text-left
                    ${mode === 'standard'
                      ? 'border-indigo-600 bg-indigo-50 text-gray-900'
                      : 'border-gray-200 hover:border-indigo-300 text-gray-700'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="h-5 w-5 text-indigo-600" />
                    <span className="font-semibold text-gray-900">Standard Quiz</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Choose your difficulty level
                  </p>
                </button>

                <button
                  onClick={() => setMode('adaptive')}
                  className={`
                    p-4 rounded-lg border-2 transition-all text-left
                    ${mode === 'adaptive'
                      ? 'border-indigo-600 bg-indigo-50 text-gray-900'
                      : 'border-gray-200 hover:border-indigo-300 text-gray-700'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-5 w-5 text-indigo-600" />
                    <span className="font-semibold text-gray-900">Adaptive Quiz</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Focuses on your weak areas
                  </p>
                </button>
              </div>
            </div>

            {mode === 'standard' && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Difficulty Level
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {(['easy', 'medium', 'hard'] as QuestionDifficulty[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`
                        py-3 rounded-lg border-2 transition-all font-medium capitalize
                        ${difficulty === level
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                          : 'border-gray-200 hover:border-indigo-300 text-gray-700'
                        }
                      `}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Number of Questions
              </h2>
              <select
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-600 focus:outline-none"
              >
                <option value={3}>3 questions</option>
                <option value={5}>5 questions</option>
                <option value={10}>10 questions</option>
                <option value={15}>15 questions</option>
              </select>
            </div>

            <button
              onClick={generateQuiz}
              disabled={generating}
              className="w-full py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating Quiz...
                </span>
              ) : (
                `Generate ${mode === 'adaptive' ? 'Adaptive' : difficulty} Quiz`
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
        <p className="text-gray-600">
          Generating your {mode === 'adaptive' ? 'adaptive' : difficulty} quiz...
        </p>
      </div>
    );
  }

  if (!quiz && !generating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-600 mb-4">Failed to generate quiz</p>
        <button
          onClick={handleRetake}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (showResults && results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 text-center">
            <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Quiz Complete!
            </h1>
            {quiz?.is_adaptive && (
              <p className="text-indigo-600 font-medium mb-2">
                🎯 Adaptive Quiz - Focused on your weak areas
              </p>
            )}
            <div className="text-5xl font-bold text-indigo-600 mb-2">
              {results.score_percentage.toFixed(1)}%
            </div>
            <p className="text-xl text-gray-600">
              {results.correct_answers} / {results.total_questions} correct
            </p>
          </div>

          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-8">
            <p className="text-green-800 font-medium">
              ✓ Your learning progress has been automatically updated!
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Question Review
            </h2>
            <div className="space-y-6">
              {quiz?.questions.map((question, i) => {
                const userAnswer = answers[question.id];
                const answerResult = results.answers.find(
                  (a: any) => a.question_id === question.id
                );
                const isCorrect = answerResult?.is_correct;

                return (
                  <div
                    key={question.id}
                    className={`border-l-4 pl-4 py-2 ${
                      isCorrect ? 'border-green-500' : 'border-red-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {i + 1}. {question.question}
                      </h3>
                      {isCorrect ? (
                        <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                    
                    {question.type === 'multiple_choice' && question.options && (
                      <div className="space-y-2 mb-3">
                        {question.options.map((option, j) => (
                          <div
                            key={j}
                            className={`px-3 py-2 rounded-lg text-sm ${
                              option === question.correct_answer
                                ? 'bg-green-100 text-green-800 font-medium'
                                : option === userAnswer && !isCorrect
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-50 text-gray-700'
                            }`}
                          >
                            {option}
                            {option === question.correct_answer && ' ✓'}
                            {option === userAnswer && option !== question.correct_answer && ' ✗'}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mt-3">
                      <p className="text-sm text-blue-900">
                        <strong>Explanation:</strong> {question.explanation}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {results.weak_concepts && results.weak_concepts.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                📚 Concepts to Review
              </h2>
              <p className="text-gray-600 mb-4">
                Focus on these concepts to improve your understanding:
              </p>
              <div className="flex flex-wrap gap-2">
                {results.weak_concepts.map((conceptId: string, i: number) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm"
                  >
                    {getConceptName(conceptId, concepts)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {results.strong_concepts && results.strong_concepts.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                ✓ Mastered Concepts
              </h2>
              <div className="flex flex-wrap gap-2">
                {results.strong_concepts.map((conceptId: string, i: number) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                  >
                    {getConceptName(conceptId, concepts)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <button
              onClick={handleRetake}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <RotateCcw className="h-5 w-5" />
              Take Another Quiz
            </button>
            <button
              onClick={() => router.push(`/progress`)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              View Progress
            </button>
            <button
              onClick={() => router.push(`/papers/${paperId}`)}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Back to Paper
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = quiz?.questions[currentQuestionIndex];
  const progress = quiz ? ((currentQuestionIndex + 1) / quiz.questions.length) * 100 : 0;
  const allAnswered = quiz?.questions.every(q => answers[q.id]);

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 text-center">
          {quiz?.is_adaptive && (
            <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium mb-2">
              🎯 Adaptive Quiz - Personalized for You
            </span>
          )}
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Question {currentQuestionIndex + 1} of {quiz?.questions.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <span className={`
              px-3 py-1 rounded-full text-sm font-medium
              ${currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-800' : ''}
              ${currentQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
              ${currentQuestion.difficulty === 'hard' ? 'bg-red-100 text-red-800' : ''}
            `}>
              {currentQuestion.difficulty}
            </span>
            <span className="text-sm text-gray-500">
              {currentQuestion.type.replace('_', ' ')}
            </span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {currentQuestion.question}
          </h2>

          {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(currentQuestion.id, option)}
                  className={`
                    w-full text-left px-4 py-3 rounded-lg border-2 transition-all
                    ${answers[currentQuestion.id] === option
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                      : 'border-gray-200 hover:border-indigo-300 text-gray-700'
                    }
                  `}
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
                  {option}
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'true_false' && (
            <div className="space-y-3">
              {['True', 'False'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(currentQuestion.id, option)}
                  className={`
                    w-full text-left px-4 py-3 rounded-lg border-2 transition-all
                    ${answers[currentQuestion.id] === option
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                      : 'border-gray-200 hover:border-indigo-300 text-gray-700'
                    }
                  `}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'short_answer' && (
            <textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
              placeholder="Type your answer here..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-600 focus:outline-none"
              rows={4}
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {currentQuestionIndex < (quiz?.questions.length || 0) - 1 ? (
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Quiz'
              )}
            </button>
          )}
        </div>

        {!allAnswered && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Please answer all questions before submitting
          </p>
        )}
      </div>
    </div>
  );
}