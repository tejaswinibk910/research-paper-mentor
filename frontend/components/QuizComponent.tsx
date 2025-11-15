// Quiz Component with Difficulty Selection and Adaptive Mode
// Add this to your Quiz page/component

import { useState } from 'react';
import { api } from '@/lib/api';

type QuestionDifficulty = 'easy' | 'medium' | 'hard';
type QuizMode = 'standard' | 'adaptive';

export function QuizGenerator({ paperId, userId }: { paperId: string; userId: string }) {
  const [mode, setMode] = useState<QuizMode>('standard');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);

  const generateQuiz = async () => {
    setLoading(true);
    try {
      let generatedQuiz;
      
      if (mode === 'adaptive') {
        // Generate adaptive quiz based on past performance
        generatedQuiz = await api.generateAdaptiveQuiz(
          paperId,
          userId,
          numQuestions
        );
      } else {
        // Generate standard quiz with selected difficulty
        generatedQuiz = await api.generateQuiz(
          paperId,
          userId,
          numQuestions,
          difficulty
        );
      }
      
      setQuiz(generatedQuiz);
    } catch (error) {
      console.error('Failed to generate quiz:', error);
      alert('Failed to generate quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="quiz-generator">
      <h2>Generate Quiz</h2>
      
      {/* Quiz Mode Selection */}
      <div className="mode-selection">
        <h3>Quiz Mode</h3>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              value="standard"
              checked={mode === 'standard'}
              onChange={(e) => setMode(e.target.value as QuizMode)}
            />
            Standard Quiz
            <span className="description">Choose difficulty level</span>
          </label>
          
          <label>
            <input
              type="radio"
              value="adaptive"
              checked={mode === 'adaptive'}
              onChange={(e) => setMode(e.target.value as QuizMode)}
            />
            Adaptive Quiz
            <span className="description">Focuses on your weak areas</span>
          </label>
        </div>
      </div>

      {/* Difficulty Selection (only for standard mode) */}
      {mode === 'standard' && (
        <div className="difficulty-selection">
          <h3>Difficulty Level</h3>
          <div className="button-group">
            <button
              className={difficulty === 'easy' ? 'active' : ''}
              onClick={() => setDifficulty('easy')}
            >
              Easy
            </button>
            <button
              className={difficulty === 'medium' ? 'active' : ''}
              onClick={() => setDifficulty('medium')}
            >
              Medium
            </button>
            <button
              className={difficulty === 'hard' ? 'active' : ''}
              onClick={() => setDifficulty('hard')}
            >
              Hard
            </button>
          </div>
        </div>
      )}

      {/* Number of Questions */}
      <div className="num-questions">
        <h3>Number of Questions</h3>
        <select
          value={numQuestions}
          onChange={(e) => setNumQuestions(Number(e.target.value))}
        >
          <option value={3}>3 questions</option>
          <option value={5}>5 questions</option>
          <option value={10}>10 questions</option>
          <option value={15}>15 questions</option>
        </select>
      </div>

      {/* Generate Button */}
      <button
        onClick={generateQuiz}
        disabled={loading}
        className="generate-button"
      >
        {loading ? 'Generating...' : `Generate ${mode === 'adaptive' ? 'Adaptive' : difficulty} Quiz`}
      </button>

      {/* Display Quiz */}
      {quiz && <QuizDisplay quiz={quiz} userId={userId} />}
    </div>
  );
}

// Quiz Display Component
function QuizDisplay({ quiz, userId }: { quiz: any; userId: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    try {
      // Convert answers to required format
      const quizAnswers = quiz.questions.map((q: any) => ({
        question_id: q.id,
        user_answer: answers[q.id] || '',
      }));

      // Submit quiz
      const quizResult = await api.evaluateQuiz(
        quiz.id,
        quizAnswers,
        userId
      );

      setResult(quizResult);
      setSubmitted(true);

      // Progress is now automatically updated on the backend!
      console.log('Quiz submitted! Progress updated automatically.');
      
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      alert('Failed to submit quiz. Please try again.');
    }
  };

  if (submitted && result) {
    return (
      <div className="quiz-result">
        <h2>Quiz Results</h2>
        <div className="score">
          <p>Score: {result.score_percentage.toFixed(1)}%</p>
          <p>Correct: {result.correct_answers} / {result.total_questions}</p>
        </div>

        {/* Show weak concepts */}
        {result.weak_concepts.length > 0 && (
          <div className="weak-concepts">
            <h3>Concepts to Review:</h3>
            <ul>
              {result.weak_concepts.map((conceptId: string) => (
                <li key={conceptId}>{conceptId}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Show strong concepts */}
        {result.strong_concepts.length > 0 && (
          <div className="strong-concepts">
            <h3>Mastered Concepts:</h3>
            <ul>
              {result.strong_concepts.map((conceptId: string) => (
                <li key={conceptId}>{conceptId}</li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={() => window.location.reload()}>
          Take Another Quiz
        </button>
      </div>
    );
  }

  return (
    <div className="quiz-questions">
      <h2>{quiz.title}</h2>
      <p className="quiz-info">
        {quiz.is_adaptive && '🎯 Adaptive Quiz - Focusing on your weak areas'}
        {!quiz.is_adaptive && `Difficulty: ${quiz.difficulty_level}`}
      </p>

      {quiz.questions.map((question: any, index: number) => (
        <div key={question.id} className="question">
          <h3>Question {index + 1}</h3>
          <p>{question.question}</p>

          <div className="options">
            {question.options.map((option: string) => (
              <label key={option}>
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={answers[question.id] === option}
                  onChange={(e) =>
                    setAnswers({ ...answers, [question.id]: e.target.value })
                  }
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={Object.keys(answers).length !== quiz.questions.length}
        className="submit-button"
      >
        Submit Quiz
      </button>
    </div>
  );
}

// CSS (add to your styles)
const styles = `
.quiz-generator {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.mode-selection,
.difficulty-selection,
.num-questions {
  margin-bottom: 30px;
}

.radio-group label,
.button-group button {
  display: block;
  margin: 10px 0;
  padding: 15px;
  border: 2px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-group label:hover,
.button-group button:hover {
  border-color: #007bff;
  background-color: #f0f8ff;
}

.button-group button.active {
  border-color: #007bff;
  background-color: #007bff;
  color: white;
}

.description {
  display: block;
  font-size: 0.9em;
  color: #666;
  margin-top: 5px;
}

.generate-button,
.submit-button {
  width: 100%;
  padding: 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.generate-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.quiz-result {
  margin-top: 30px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.score {
  font-size: 24px;
  font-weight: bold;
  text-align: center;
  margin: 20px 0;
}

.weak-concepts,
.strong-concepts {
  margin-top: 20px;
}

.weak-concepts {
  color: #d9534f;
}

.strong-concepts {
  color: #5cb85c;
}
`;
