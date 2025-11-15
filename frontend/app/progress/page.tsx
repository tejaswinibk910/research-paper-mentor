'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProgressDashboard } from '@/components/ProgressDashboard';
import { api } from '@/lib/api';

type ViewMode = 'summary' | 'detailed' | 'due-only';
type SortBy = 'confidence' | 'name' | 'difficulty' | 'next-review';

export default function ProgressPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');
  const [paperId, setPaperId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // New state for filtering and organization
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [sortBy, setSortBy] = useState<SortBy>('confidence');
  const [showOnlyStruggling, setShowOnlyStruggling] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await api.getCurrentUser();
        setUserId(user.id);

        const token = localStorage.getItem('auth_token');
        
        if (!token) {
          console.error('No authentication token found');
          throw new Error('Not authenticated');
        }

        const response = await fetch('http://localhost:8000/api/papers', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch papers: ${response.status}`);
        }
        
        const userPapers = await response.json();
        console.log('✅ Fetched papers:', userPapers);
        setPapers(userPapers);
        
        if (userPapers && userPapers.length > 0) {
          const lastPaperId = localStorage.getItem('lastViewedPaperId');
          
          if (lastPaperId && userPapers.find((p: any) => p.id === lastPaperId)) {
            setPaperId(lastPaperId);
          } else {
            setPaperId(userPapers[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  useEffect(() => {
    const checkQuizCompletion = () => {
      const quizCompleted = localStorage.getItem('quizCompleted');
      if (quizCompleted === 'true') {
        console.log('🎯 Quiz completion detected! Refreshing progress...');
        setRefreshKey(prev => prev + 1);
        localStorage.removeItem('quizCompleted');
      }
    };

    checkQuizCompletion();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkQuizCompletion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkQuizCompletion);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkQuizCompletion);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your progress...</p>
        </div>
      </div>
    );
  }

  if (!userId || !paperId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            No Paper Selected
          </h2>
          <p className="text-gray-600 mb-6">
            Please upload a paper to start tracking your progress.
          </p>
          <a
            href="/"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Learning Progress
          </h1>
          <p className="text-gray-600">
            Track your understanding and review schedule
          </p>
          
          {papers.length > 1 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Paper:
              </label>
              <select
                value={paperId}
                onChange={(e) => {
                  setPaperId(e.target.value);
                  localStorage.setItem('lastViewedPaperId', e.target.value);
                  setRefreshKey(prev => prev + 1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {papers.map((paper) => (
                  <option key={paper.id} value={paper.id}>
                    {paper.filename}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* View Controls */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* View Mode Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('summary')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'summary'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setViewMode('due-only')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'due-only'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Due for Review
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'detailed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Concepts
              </button>
            </div>

            {/* Filters (only show in detailed view) */}
            {viewMode === 'detailed' && (
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search concepts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 placeholder-gray-500 text-gray-900"
                />

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  <option value="confidence">Sort by Confidence</option>
                  <option value="name">Sort by Name</option>
                  <option value="difficulty">Sort by Difficulty</option>
                  <option value="next-review">Sort by Review Date</option>
                </select>

                {/* Filter struggling */}
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyStruggling}
                    onChange={(e) => setShowOnlyStruggling(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Need Practice Only
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Progress Dashboard with filters passed as props */}
        <ProgressDashboard 
          key={refreshKey} 
          paperId={paperId} 
          userId={userId}
          viewMode={viewMode}
          sortBy={sortBy}
          showOnlyStruggling={showOnlyStruggling}
          searchTerm={searchTerm}
        />

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => {
              localStorage.setItem('lastViewedPaperId', paperId);
              router.push(`/papers/${paperId}/quiz`);
            }}
            className="p-8 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:shadow-xl transition-all text-center group"
          >
            <div className="text-6xl mb-3">📝</div>
            <h3 className="font-bold text-xl text-gray-900 mb-2 group-hover:text-blue-600">
              Take a Quiz
            </h3>
            <p className="text-base text-gray-700">Test your knowledge</p>
          </button>

          <button
            onClick={() => {
              localStorage.setItem('lastViewedPaperId', paperId);
              router.push(`/papers/${paperId}/chat`);
            }}
            className="p-8 bg-white border-2 border-gray-300 rounded-lg hover:border-green-500 hover:shadow-xl transition-all text-center group"
          >
            <div className="text-6xl mb-3">💬</div>
            <h3 className="font-bold text-xl text-gray-900 mb-2 group-hover:text-green-600">
              Ask Tutor
            </h3>
            <p className="text-base text-gray-700">Get help with concepts</p>
          </button>

          <button
            onClick={() => {
              console.log('🔄 Manual refresh triggered');
              setRefreshKey(prev => prev + 1);
            }}
            className="p-8 bg-white border-2 border-gray-300 rounded-lg hover:border-purple-500 hover:shadow-xl transition-all text-center group"
          >
            <div className="text-6xl mb-3">🔄</div>
            <h3 className="font-bold text-xl text-gray-900 mb-2 group-hover:text-purple-600">
              Refresh Progress
            </h3>
            <p className="text-base text-gray-700">Update your stats</p>
          </button>
        </div>
      </div>
    </div>
  );
}