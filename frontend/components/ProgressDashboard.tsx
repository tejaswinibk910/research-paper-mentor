'use client';

import { useEffect, useState } from 'react';

type ViewMode = 'summary' | 'detailed' | 'due-only';
type SortBy = 'confidence' | 'name' | 'difficulty' | 'next-review';

interface ProgressDashboardProps {
  paperId: string;
  userId: string;
  viewMode?: ViewMode;
  sortBy?: SortBy;
  showOnlyStruggling?: boolean;
  searchTerm?: string;
}

interface ConceptUnderstanding {
  concept_id: string;
  user_id: string;
  paper_id: string;
  is_understood: boolean;
  confidence_level: number;
  times_reviewed: number;
  times_quizzed: number;
  correct_answers: number;
  last_reviewed: string | null;
  next_review: string | null;
  ease_factor: number;
  interval_days: number;
}

interface Concept {
  id: string;
  name: string;
  type: string;
  definition: string;
  difficulty: string;
  importance_score: number;
}

interface RetentionStats {
  overall_retention: number;
  concepts_mastered: number;
  concepts_in_progress: number;
  concepts_struggling: number;
  average_confidence: number;
}

export function ProgressDashboard({ 
  paperId, 
  userId,
  viewMode = 'summary',
  sortBy = 'confidence',
  showOnlyStruggling = false,
  searchTerm = ''
}: ProgressDashboardProps) {
  const [conceptProgress, setConceptProgress] = useState<ConceptUnderstanding[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [retentionStats, setRetentionStats] = useState<RetentionStats | null>(null);
  const [dueForReview, setDueForReview] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProgress();
  }, [paperId, userId]);

  const fetchProgress = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      console.log('📊 Fetching progress for paper:', paperId);

      // Fetch concepts first - this is the critical one
      const conceptsRes = await fetch(`http://localhost:8000/api/papers/${paperId}/concepts`, { headers });
      
      if (!conceptsRes.ok) {
        console.error('❌ Concepts fetch failed:', conceptsRes.status);
        if (conceptsRes.status === 404) {
          setError('Concepts not found. The paper may need to be re-processed.');
        } else if (conceptsRes.status === 403) {
          setError('Access denied. Please check your authentication.');
        } else {
          setError(`Failed to load concepts (${conceptsRes.status})`);
        }
        setLoading(false);
        return;
      }

      const conceptsData = await conceptsRes.json();
      console.log('✅ Concepts loaded:', conceptsData);
      
      // The API returns { paper_id, concepts: [...], edges: [...] }
      if (conceptsData.concepts && Array.isArray(conceptsData.concepts)) {
        setConcepts(conceptsData.concepts);
        console.log(`   Found ${conceptsData.concepts.length} concepts`);
      } else {
        console.warn('⚠️ Unexpected concepts format:', conceptsData);
        setConcepts([]);
      }

      // Fetch progress data - this creates records if they don't exist
      const progressRes = await fetch(`http://localhost:8000/api/progress/${userId}/${paperId}/concepts`, { headers });
      
      if (progressRes.ok) {
        const progressData = await progressRes.json();
        console.log('✅ Progress loaded:', progressData);
        
        if (Array.isArray(progressData)) {
          setConceptProgress(progressData);
          console.log(`   Found ${progressData.length} progress records`);
        } else {
          console.warn('⚠️ Progress data is not an array:', progressData);
          setConceptProgress([]);
        }
      } else {
        console.warn(`⚠️ Progress fetch failed (${progressRes.status}) - this is normal for new papers`);
        // For new papers, progress records don't exist yet
        // The backend should auto-create them, but if it doesn't, we just show 0 progress
        setConceptProgress([]);
      }

      // Fetch retention stats
      const statsRes = await fetch(`http://localhost:8000/api/progress/${userId}/${paperId}/retention`, { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        console.log('✅ Stats loaded:', statsData);
        setRetentionStats(statsData);
      } else {
        console.warn('⚠️ Stats not available');
        setRetentionStats(null);
      }

      // Fetch due for review
      const dueRes = await fetch(`http://localhost:8000/api/progress/${userId}/${paperId}/due-for-review`, { headers });
      if (dueRes.ok) {
        const dueData = await dueRes.json();
        console.log('✅ Due for review loaded:', dueData);
        setDueForReview(dueData.concepts || []);
      } else {
        console.warn('⚠️ Due for review not available');
        setDueForReview([]);
      }

    } catch (err) {
      console.error('❌ Error fetching progress:', err);
      setError('Failed to load progress data. Please refresh the page.');
      setConceptProgress([]);
      setConcepts([]);
      setRetentionStats(null);
      setDueForReview([]);
    } finally {
      setLoading(false);
    }
  };

  const getConceptDetails = (conceptId: string): Concept | undefined => {
    return concepts.find(c => c.id === conceptId);
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    return date.toLocaleDateString();
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'intermediate':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'advanced':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getFilteredAndSortedConcepts = () => {
    let filtered = Array.isArray(conceptProgress) ? [...conceptProgress] : [];

    if (searchTerm && searchTerm.trim() !== '') {
      filtered = filtered.filter(progress => {
        const concept = getConceptDetails(progress.concept_id);
        return concept?.name.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    if (showOnlyStruggling) {
      filtered = filtered.filter(p => 
        p.times_quizzed >= 2 && p.confidence_level < 0.6
      );
    }

    const sorted = filtered.sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return a.confidence_level - b.confidence_level;
        case 'name':
          const conceptA = getConceptDetails(a.concept_id);
          const conceptB = getConceptDetails(b.concept_id);
          return (conceptA?.name || '').localeCompare(conceptB?.name || '');
        case 'difficulty':
          const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
          const diffA = getConceptDetails(a.concept_id)?.difficulty || 'intermediate';
          const diffB = getConceptDetails(b.concept_id)?.difficulty || 'intermediate';
          return (difficultyOrder[diffA as keyof typeof difficultyOrder] || 2) - 
                 (difficultyOrder[diffB as keyof typeof difficultyOrder] || 2);
        case 'next-review':
          const dateA = a.next_review ? new Date(a.next_review).getTime() : Infinity;
          const dateB = b.next_review ? new Date(b.next_review).getTime() : Infinity;
          return dateA - dateB;
        default:
          return 0;
      }
    });

    return sorted;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-300 text-yellow-900 px-6 py-4 rounded-lg">
        <div className="flex items-start">
          <div className="text-3xl mr-3">⚠️</div>
          <div>
            <h3 className="font-bold text-lg mb-2">Progress Not Available</h3>
            <p className="text-sm mb-3">{error}</p>
            <div className="bg-yellow-100 border border-yellow-200 rounded p-3 text-sm">
              <p className="font-semibold mb-2">Try these steps:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Click the "Refresh Progress" button</li>
                <li>Take a quiz to generate progress data</li>
                <li>Check the browser console (F12) for detailed errors</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (concepts.length === 0) {
    return (
      <div className="bg-blue-50 border-2 border-blue-300 text-blue-900 px-6 py-4 rounded-lg">
        <div className="flex items-start">
          <div className="text-3xl mr-3">📚</div>
          <div>
            <h3 className="font-bold text-lg mb-2">No Concepts Available</h3>
            <p className="text-sm mb-3">
              No concepts were found for this paper.
            </p>
            <div className="bg-blue-100 border border-blue-200 rounded p-3 text-sm">
              <p className="font-semibold mb-2">Possible reasons:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Paper is still being processed</li>
                <li>Concept extraction failed</li>
                <li>Server was restarted (in-memory data lost)</li>
              </ul>
              <p className="mt-2 font-semibold">Solution: Try re-uploading your paper</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If we have concepts but no progress, show all concepts with 0 progress
  // This happens when the backend hasn't created progress records yet
  const displayProgress = conceptProgress.length > 0 ? conceptProgress : 
    concepts.map(concept => ({
      concept_id: concept.id,
      user_id: userId,
      paper_id: paperId,
      is_understood: false,
      confidence_level: 0,
      times_reviewed: 0,
      times_quizzed: 0,
      correct_answers: 0,
      last_reviewed: null,
      next_review: null,
      ease_factor: 2.5,
      interval_days: 1
    }));

  // Summary View
  if (viewMode === 'summary') {
    return (
      <div>
        {retentionStats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Overall Retention"
                value={`${(retentionStats.overall_retention * 100).toFixed(0)}%`}
                color="blue"
                icon="🎯"
              />
              <StatCard
                title="Mastered"
                value={retentionStats.concepts_mastered.toString()}
                color="green"
                icon="✅"
              />
              <StatCard
                title="In Progress"
                value={retentionStats.concepts_in_progress.toString()}
                color="yellow"
                icon="📚"
              />
              <StatCard
                title="Need Practice"
                value={retentionStats.concepts_struggling.toString()}
                color="red"
                icon="⚠️"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {dueForReview.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    Due for Review ({dueForReview.length})
                  </h3>
                  <div className="space-y-2">
                    {dueForReview.slice(0, 5).map((concept) => (
                      <div
                        key={concept.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="font-medium text-gray-900">{concept.name}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getDifficultyColor(concept.difficulty)}`}>
                          {concept.difficulty}
                        </span>
                      </div>
                    ))}
                    {dueForReview.length > 5 && (
                      <p className="text-sm text-gray-500 mt-2">
                        +{dueForReview.length - 5} more concepts
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Need More Practice
                </h3>
                <div className="space-y-2">
                  {displayProgress
                    .filter(p => p.times_quizzed >= 2 && p.confidence_level < 0.6)
                    .slice(0, 5)
                    .map(progress => {
                      const concept = getConceptDetails(progress.concept_id);
                      if (!concept) return null;
                      return (
                        <div
                          key={progress.concept_id}
                          className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                        >
                          <span className="font-medium text-gray-900">{concept.name}</span>
                          <span className="text-sm text-gray-600">
                            {(progress.confidence_level * 100).toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  {displayProgress.filter(p => p.times_quizzed >= 2 && p.confidence_level < 0.6).length === 0 && (
                    <p className="text-sm text-gray-500 italic">
                      No struggling concepts yet. Take quizzes to track progress!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Due Only View
  if (viewMode === 'due-only') {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900">
            Concepts Due for Review ({dueForReview.length})
          </h2>
        </div>
        {dueForReview.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              All Caught Up!
            </h3>
            <p className="text-gray-600">
              You have no concepts due for review right now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {dueForReview.map((concept) => {
              const progress = displayProgress.find(p => p.concept_id === concept.id);
              return (
                <div
                  key={concept.id}
                  className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">{concept.name}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {concept.definition}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getDifficultyColor(concept.difficulty)}`}>
                      {concept.difficulty}
                    </span>
                    {progress && (
                      <span className="text-sm text-gray-600">
                        {(progress.confidence_level * 100).toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Detailed View - Use displayProgress which includes fallback data
  const filteredConcepts = (() => {
    let filtered = [...displayProgress];

    if (searchTerm && searchTerm.trim() !== '') {
      filtered = filtered.filter(progress => {
        const concept = getConceptDetails(progress.concept_id);
        return concept?.name.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    if (showOnlyStruggling) {
      filtered = filtered.filter(p => 
        p.times_quizzed >= 2 && p.confidence_level < 0.6
      );
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return a.confidence_level - b.confidence_level;
        case 'name':
          const conceptA = getConceptDetails(a.concept_id);
          const conceptB = getConceptDetails(b.concept_id);
          return (conceptA?.name || '').localeCompare(conceptB?.name || '');
        default:
          return 0;
      }
    });
  })();

  return (
    <div>
      {retentionStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="Overall Retention"
            value={`${(retentionStats.overall_retention * 100).toFixed(0)}%`}
            color="blue"
            icon="🎯"
          />
          <StatCard
            title="Mastered"
            value={retentionStats.concepts_mastered.toString()}
            color="green"
            icon="✅"
          />
          <StatCard
            title="In Progress"
            value={retentionStats.concepts_in_progress.toString()}
            color="yellow"
            icon="📚"
          />
          <StatCard
            title="Need Practice"
            value={retentionStats.concepts_struggling.toString()}
            color="red"
            icon="⚠️"
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900">
            All Concepts ({filteredConcepts.length} of {displayProgress.length})
          </h2>
          {conceptProgress.length === 0 && (
            <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
              📊 Showing {concepts.length} concepts with default progress. Take quizzes to build your learning data!
            </p>
          )}
          {showOnlyStruggling && filteredConcepts.length === 0 && (
            <p className="text-sm text-gray-600 mt-2">
              No concepts have been quizzed 2+ times with low confidence yet. Uncheck "Need Practice Only" to see all concepts.
            </p>
          )}
        </div>

        {filteredConcepts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">
              {searchTerm ? 'No concepts match your search.' : 
               showOnlyStruggling ? 'No struggling concepts yet. Keep practicing!' :
               'No concepts available.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Concept
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Practice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Performance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Review
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredConcepts.map((progress) => {
                  const concept = getConceptDetails(progress.concept_id);
                  if (!concept) return null;

                  return (
                    <tr key={progress.concept_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{concept.name}</div>
                          <div className="text-sm text-gray-500">{concept.type}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2 mr-2 max-w-[120px]">
                            <div
                              className={`h-2 rounded-full ${getConfidenceColor(progress.confidence_level)}`}
                              style={{ width: `${progress.confidence_level * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 min-w-[40px]">
                            {(progress.confidence_level * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div>Reviewed: {progress.times_reviewed}×</div>
                        <div>Quizzed: {progress.times_quizzed}×</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {progress.times_quizzed > 0 ? (
                          <span>
                            {progress.correct_answers}/{progress.times_quizzed} (
                            {((progress.correct_answers / progress.times_quizzed) * 100).toFixed(0)}%)
                          </span>
                        ) : (
                          <span className="text-gray-400">No data</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {formatDate(progress.next_review)}
                      </td>
                      <td className="px-6 py-4">
                        {progress.is_understood ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Mastered
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Learning
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  color: 'blue' | 'green' | 'yellow' | 'red';
  icon?: string;
}

function StatCard({ title, value, color, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm text-gray-500 mb-1">{title}</div>
          <div className="text-3xl font-bold text-gray-900">{value}</div>
        </div>
        {icon && (
          <div className="text-4xl ml-4">{icon}</div>
        )}
      </div>
    </div>
  );
}