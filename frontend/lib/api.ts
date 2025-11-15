import axios, { AxiosInstance } from 'axios';

// ==================== TYPES ====================

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Paper {
  id: string;
  filename: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  metadata: {
    title: string | null;
    authors: string[];
    abstract: string | null;
    keywords: string[];
    publication_date?: string | null;
    doi?: string | null;
  } | null;
  sections: Section[];
  total_pages: number;
  processed_at: string | null;
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

export interface PaperSummary {
  paper_id: string;
  overall_summary: string;
  key_findings: string[];
  section_summaries: Record<string, string>;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
}

export interface Concept {
  id: string;
  name: string;
  type: string;
  definition: string;
  explanation: string;
  difficulty: string;
  paper_id: string;
  page_numbers: number[];
  prerequisites: string[];
  related_concepts: string[];
  examples: string[];
  equations: string[];
}

export interface ConceptGraph {
  paper_id: string;
  concepts: Concept[];
  edges: Array<{
    source_id: string;
    target_id: string;
    relationship_type: string;
    strength: number;
  }>;
  num_concepts: number;
  num_edges: number;
  complexity_score: number;
}

export interface Quiz {
  id: string;
  paper_id: string;
  user_id: string | null;
  title: string;
  questions: QuizQuestion[];
  total_questions: number;
  target_concepts: string[];
  difficulty_level: 'easy' | 'medium' | 'hard';
  is_adaptive: boolean;
  created_at: string;
  time_limit: number | null;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  concept_id: string;
  paper_id: string;
  page_reference: number | null;
  concepts: string[];
}

export interface QuizAnswer {
  question_id: string;
  user_answer: string;
  is_correct?: boolean;
  time_taken_seconds?: number;
}

export interface QuizResult {
  quiz_id: string;
  user_id: string;
  paper_id: string;
  answers: QuizAnswer[];
  score: number;
  score_percentage: number;
  total_questions: number;
  correct_answers: number;
  time_taken: number;
  submitted_at: string;
  question_results: any[];
  weak_concepts: string[];
  strong_concepts: string[];
  concept_scores: Record<string, number>;
}

// ==================== API CLIENT ====================

class StudyMentorAPI {
  private api: AxiosInstance;
  private authToken: string | null = null;

  constructor(baseURL: string = 'http://localhost:8000/api') {
    this.api = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage on init
    if (typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('auth_token');
    }

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.logout();
        }
        return Promise.reject(error);
      }
    );
  }

  // ==================== AUTH MANAGEMENT ====================

  setAuthToken(token: string) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  getAuthToken(): string | null {
    if (!this.authToken && typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('auth_token');
    }
    return this.authToken;
  }

  logout() {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      window.location.href = '/auth/login';
    }
  }

  // ==================== PAPER ENDPOINTS ====================

  async uploadPaper(file: File): Promise<{ paper: Paper; concept_graph: ConceptGraph | null }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.api.post('/papers/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getPapers(): Promise<Paper[]> {
    const response = await this.api.get('/papers');
    return response.data;
  }

  async getPaper(paperId: string): Promise<Paper> {
    const response = await this.api.get(`/papers/${paperId}`);
    return response.data;
  }

  async getPaperSummary(paperId: string): Promise<PaperSummary> {
    const response = await this.api.get(`/papers/${paperId}/summary`);
    return response.data;
  }

  async getPaperConcepts(paperId: string): Promise<ConceptGraph> {
    const response = await this.api.get(`/papers/${paperId}/concepts`);
    return response.data;
  }

  async deletePaper(paperId: string): Promise<void> {
    await this.api.delete(`/papers/${paperId}`);
  }

  async downloadPaper(paperId: string): Promise<Blob> {
    const response = await this.api.get(`/papers/${paperId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // ==================== QUIZ ENDPOINTS ====================

  async generateQuiz(
    paperId: string,
    userId: string,
    numQuestions: number = 5,
    difficulty?: 'easy' | 'medium' | 'hard'
  ): Promise<{ quiz_id: string; questions: QuizQuestion[]; time_limit: number | null }> {
    const response = await this.api.post('/quiz/generate', {
      paper_id: paperId,
      num_questions: numQuestions,
      difficulty: difficulty || 'medium',
      question_types: ['multiple_choice', 'true_false'],
      time_limit: 30,
    });
    return response.data;
  }

  async generateAdaptiveQuiz(
    paperId: string,
    userId: string,
    numQuestions: number = 5
  ): Promise<{ quiz_id: string; questions: QuizQuestion[]; time_limit: number | null }> {
    // Note: Your backend doesn't have a separate adaptive endpoint yet
    // This uses the same endpoint - you may want to add adaptive logic later
    return this.generateQuiz(paperId, userId, numQuestions, 'medium');
  }

  async getQuiz(quizId: string): Promise<Quiz> {
    const response = await this.api.get(`/quiz/${quizId}`);
    return response.data;
  }

  async evaluateQuiz(
    quizId: string,
    answers: QuizAnswer[],
    userId: string
  ): Promise<QuizResult> {
    // Convert answers array to object format expected by backend
    const answersObj = answers.reduce((acc, ans) => ({
      ...acc,
      [ans.question_id]: ans.user_answer
    }), {});

    const response = await this.api.post(`/quiz/${quizId}/submit`, {
      answers: answersObj,
      time_taken: answers.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0),
    });
    return response.data;
  }

  async getQuizResults(quizId: string): Promise<QuizResult[]> {
    const response = await this.api.get(`/quiz/${quizId}/results`);
    return response.data;
  }

  async getPaperQuizzes(paperId: string): Promise<Quiz[]> {
    const response = await this.api.get(`/quiz/paper/${paperId}`);
    return response.data;
  }

  async deleteQuiz(quizId: string): Promise<void> {
    await this.api.delete(`/quiz/${quizId}`);
  }

  // ==================== CHAT ENDPOINTS ====================

  async createChatSession(
    paperId: string,
    tutoringMode: string = 'socratic',
    userBackground: string = 'intermediate'
  ): Promise<any> {
    const response = await this.api.post('/chat/sessions', {
      paper_id: paperId,
      tutoring_mode: tutoringMode,
      user_background: userBackground,
    });
    return response.data;
  }

  async getChatSession(sessionId: string): Promise<any> {
    const response = await this.api.get(`/chat/sessions/${sessionId}`);
    return response.data;
  }

  async sendChatMessage(sessionId: string, message: string, pageNumber?: number): Promise<any> {
    const response = await this.api.post('/chat/message', {
      session_id: sessionId,
      message: message,
      page_number: pageNumber,
    });
    return response.data;
  }

  async getHint(sessionId: string, concept: string, difficulty: string = 'medium'): Promise<any> {
    const response = await this.api.post('/chat/hint', {
      session_id: sessionId,
      concept: concept,
      difficulty: difficulty,
    });
    return response.data;
  }

  async getPaperSessions(paperId: string): Promise<any[]> {
    const response = await this.api.get(`/chat/sessions/paper/${paperId}`);
    return response.data;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.api.delete(`/chat/sessions/${sessionId}`);
  }

  // ==================== PROGRESS ENDPOINTS ====================

  async getPaperProgress(paperId: string): Promise<any> {
    const response = await this.api.get(`/progress/paper/${paperId}`);
    return response.data;
  }

  async getProgressSummary(): Promise<any> {
    const response = await this.api.get('/progress/summary');
    return response.data;
  }

  async getConceptMastery(paperId: string): Promise<any[]> {
    const response = await this.api.get(`/progress/concepts/${paperId}`);
    return response.data;
  }

  async updateConceptMastery(
    paperId: string,
    conceptId: string,
    understood: boolean
  ): Promise<any> {
    const response = await this.api.post('/progress/concept/update', {
      paper_id: paperId,
      concept_id: conceptId,
      understood: understood,
    });
    return response.data;
  }

  async startStudySession(paperId: string): Promise<{ session_id: string; message: string }> {
    const response = await this.api.post('/progress/session/start', {
      paper_id: paperId,
    });
    return response.data;
  }

  async endStudySession(paperId: string, conceptsLearned: string[] = []): Promise<any> {
    const response = await this.api.post('/progress/session/end', {
      paper_id: paperId,
      concepts_learned: conceptsLearned,
    });
    return response.data;
  }

  // ==================== USER ENDPOINTS ====================

  async getCurrentUser(): Promise<User> {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  // ==================== UTILITY FUNCTIONS ====================

  async getUserProgress(userId: string, paperId: string): Promise<any> {
    return this.getPaperProgress(paperId);
  }

  async getConceptsDueForReview(userId: string, paperId: string): Promise<any> {
    const progress = await this.getPaperProgress(paperId);
    const dueConcepts = progress.concepts_mastery?.filter((c: any) => {
      if (!c.last_reviewed) return true; // Never reviewed
      if (!c.next_review) return false;
      return new Date(c.next_review) <= new Date();
    }) || [];
    
    return {
      count: dueConcepts.length,
      concepts: dueConcepts
    };
  }

  async getRetentionStats(userId: string, paperId: string): Promise<any> {
    const progress = await this.getPaperProgress(paperId);
    const total = progress.concepts_mastery?.length || 0;
    
    if (total === 0) {
      return {
        overall_retention: 0,
        concepts_mastered: 0,
        concepts_in_progress: 0,
        concepts_struggling: 0,
        average_confidence: 0
      };
    }

    const mastered = progress.concepts_mastery.filter((c: any) => c.mastery_level >= 0.8).length;
    const struggling = progress.concepts_mastery.filter((c: any) => c.mastery_level < 0.5).length;
    
    return {
      overall_retention: mastered / total,
      concepts_mastered: mastered,
      concepts_in_progress: total - mastered - struggling,
      concepts_struggling: struggling,
      average_confidence: progress.concepts_mastery.reduce((sum: number, c: any) => 
        sum + c.mastery_level, 0) / total
    };
  }
}

// Create and export singleton instance
const api = new StudyMentorAPI(
  typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL 
    ? process.env.NEXT_PUBLIC_API_URL 
    : 'http://localhost:8000/api'
);

export default api;
export { api };