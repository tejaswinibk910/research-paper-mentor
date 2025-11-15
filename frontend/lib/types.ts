// Paper Types
export interface Paper {
  id: string;
  filename: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  metadata: {
    title: string;
    authors: string[];
    abstract?: string;
    keywords: string[];
    publication_date?: string;
    doi?: string;
  };
  sections: Section[];
  total_pages: number;
  processed_at?: string;
  created_at: string;
}

export interface Section {
  id: string;
  title: string;
  content: string;
  page_start: number;
  page_end: number;
  chunk_ids: string[];
}

// Summary Types
export interface PaperSummary {
  paper_id: string;
  overall_summary: string;
  key_findings: string[];
  section_summaries: Record<string, string>;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
}

// Concept Types
export interface Concept {
  id: string;
  name: string;
  type: 'definition' | 'method' | 'equation' | 'term' | 'theory' | 'result';
  definition: string;
  explanation: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  paper_id: string;
  section_id?: string;
  page_numbers: number[];
  prerequisites: string[];
  related_concepts: string[];
  examples: string[];
  equations: string[];
  importance_score: number;
}

export interface ConceptEdge {
  source_id: string;
  target_id: string;
  relationship_type: 'prerequisite' | 'related' | 'part_of' | 'example_of';
  strength: number;
}

export interface ConceptGraph {
  paper_id: string;
  concepts: Concept[];
  edges: ConceptEdge[];
  num_concepts: number;
  num_edges: number;
  complexity_score: number;
}

// Chat Types
export type TutoringMode = 'socratic' | 'hint_based' | 'analogies' | 'direct';

export interface ChatSession {
  id: string;
  paper_id: string;
  user_id?: string;
  user_background: string;
  tutoring_mode: TutoringMode;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  concept_ids?: string[];
  page_references?: number[];
}

export interface ChatResponse {
  session_id: string;
  message: Message;
  relevant_concepts: string[];
  is_question: boolean;
}

// Quiz Types
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  difficulty: QuestionDifficulty;
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  concept_id: string;
  paper_id: string;
  page_reference?: number;
  distractor_explanations?: Record<string, string>;
}

export interface Quiz {
  id: string;
  paper_id: string;
  user_id?: string;
  title: string;
  questions: QuizQuestion[];
  total_questions: number;
  target_concepts: string[];
  difficulty_level: QuestionDifficulty;
  is_adaptive: boolean;
  created_at: string;
}

export interface QuizAnswer {
  question_id: string;
  user_answer: string;
  is_correct?: boolean;
  time_taken?: number;
}

export interface QuizResult {
  quiz_id: string;
  user_id: string;
  paper_id: string;
  answers: QuizAnswer[];
  total_questions: number;
  correct_answers: number;
  score_percentage: number;
  concept_scores: Record<string, number>;
  weak_concepts: string[];
  strong_concepts: string[];
  completed_at: string;
}

// Progress Types
export interface ConceptUnderstanding {
  concept_id: string;
  times_quizzed: number;
  correct_answers: number;
  confidence_level: number;
  is_understood: boolean;
  last_reviewed?: string;
  next_review?: string;
  interval_days: number;
  ease_factor: number;
  times_reviewed: number;
}

export interface UserProgress {
  user_id: string;
  paper_id: string;
  concept_understandings: ConceptUnderstanding[];
  total_time_spent: number;
  quizzes_taken: number;
  average_quiz_score: number;
  mastered_concepts: number;
  struggling_concepts: string[];
  last_accessed: string;
}

// API Response Types
export interface APIError {
  detail: string;
}

export interface UploadResponse {
  id?: string;
  paper_id?: string;
  filename: string;
  status: string;
  message?: string;
}

