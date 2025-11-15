'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Paper, PaperSummary, ConceptGraph } from '@/lib/types';
import { 
  FileText, 
  Network, 
  MessageSquare, 
  FileQuestion, 
  Loader2,
  BookOpen,
  Lightbulb,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function PaperDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;

  const [paper, setPaper] = useState<Paper | null>(null);
  const [summary, setSummary] = useState<PaperSummary | null>(null);
  const [concepts, setConcepts] = useState<ConceptGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryLoaded, setSummaryLoaded] = useState(false);

  useEffect(() => {
    loadPaperData();
  }, [paperId]);

  const loadPaperData = async () => {
    try {
      const paperData = await api.getPaper(paperId);
      setPaper(paperData);

      if (paperData.status === 'ready') {
        // Only load summary if we haven't loaded it yet
        if (!summaryLoaded) {
          loadSummaryAndConcepts();
        } else {
          setLoading(false);
        }
      } else if (paperData.status === 'processing') {
        setTimeout(() => {
          loadPaperData();
        }, 3000);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load paper');
      setLoading(false);
    }
  };

  const loadSummaryAndConcepts = async () => {
    try {
      setLoadingSummary(true);
      const [summaryData, conceptsData] = await Promise.all([
        api.getPaperSummary(paperId).catch(() => null),
        api.getPaperConcepts(paperId).catch(() => null),
      ]);
      setSummary(summaryData);
      setConcepts(conceptsData);
      setSummaryLoaded(true);
    } catch (err) {
      console.error('Error loading summary/concepts:', err);
    } finally {
      setLoadingSummary(false);
      setLoading(false);
    }
  };

  const handleRegenerateSummary = async () => {
    setLoadingSummary(true);
    try {
      const summaryData = await api.getPaperSummary(paperId);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to regenerate summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          {paper?.status === 'processing' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Paper</h2>
              <p className="text-gray-600">This usually takes 30-60 seconds...</p>
              <p className="text-sm text-gray-500 mt-2">Auto-refreshing every 3 seconds</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-600 mb-4">{error || 'Paper not found'}</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {paper.metadata?.title || paper.filename}
              </h1>
              {paper.metadata?.authors && paper.metadata.authors.length > 0 && (
                <p className="text-gray-600">
                  By {paper.metadata.authors.join(', ')}
                </p>
              )}
            </div>
            <FileText className="h-12 w-12 text-indigo-600 flex-shrink-0" />
          </div>

          {loadingSummary ? (
            <div className="flex items-center gap-2 text-gray-600 py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Generating summary...</span>
            </div>
          ) : summary ? (
            <div className="prose max-w-none">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Summary</h3>
                <button
                  onClick={handleRegenerateSummary}
                  className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  title="Regenerate summary"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </button>
              </div>
              <p className="text-gray-700">{summary.overall_summary}</p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {paper.metadata?.keywords && paper.metadata.keywords.map((keyword, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm"
              >
                {keyword}
              </span>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-6 text-sm text-gray-500">
            <span>{paper.total_pages} pages</span>
            {summary && (
              <span className="capitalize">
                Difficulty: {summary.difficulty_level}
              </span>
            )}
            {concepts && (
              <span>{concepts.num_concepts} concepts identified</span>
            )}
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link
            href={`/papers/${paperId}/graph`}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
          >
            <Network className="h-10 w-10 text-indigo-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Concept Graph
            </h3>
            <p className="text-sm text-gray-600">
              Visualize concepts and their relationships
            </p>
          </Link>

          <Link
            href={`/papers/${paperId}/chat`}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
          >
            <MessageSquare className="h-10 w-10 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Chat & Learn
            </h3>
            <p className="text-sm text-gray-600">
              Ask questions with Socratic tutoring
            </p>
          </Link>

          <Link
            href={`/papers/${paperId}/quiz`}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
          >
            <FileQuestion className="h-10 w-10 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Take Quiz
            </h3>
            <p className="text-sm text-gray-600">
              Test your understanding
            </p>
          </Link>

          <Link
            href={`/progress`}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
          >
            <BookOpen className="h-10 w-10 text-orange-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Track Progress
            </h3>
            <p className="text-sm text-gray-600">
              View your learning progress
            </p>
          </Link>
        </div>

        {/* Key Findings */}
        {summary && summary.key_findings && summary.key_findings.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <div className="flex items-center mb-6">
              <Lightbulb className="h-6 w-6 text-yellow-500 mr-2" />
              <h2 className="text-2xl font-bold text-gray-900">
                Key Findings
              </h2>
            </div>
            <ul className="space-y-3">
              {summary.key_findings.map((finding, i) => (
                <li key={i} className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-gray-700">{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sections with Summaries */}
        {paper.sections && paper.sections.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Paper Sections
            </h2>
            <div className="space-y-6">
              {paper.sections.map((section, i) => (
                <div 
                  key={i} 
                  className="border-l-4 border-indigo-500 pl-6 py-4 bg-gray-50 rounded-r-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <ChevronRight className="h-5 w-5 text-indigo-600" />
                      {section.title}
                    </h3>
                    <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full whitespace-nowrap">
                      Pages {section.page_start}-{section.page_end}
                    </span>
                  </div>
                  
                  {summary?.section_summaries && summary.section_summaries[section.id] ? (
                    <div className="mt-3 pl-7">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {summary.section_summaries[section.id]}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 pl-7">
                      <p className="text-sm text-gray-500 italic">
                        {loadingSummary ? 'Generating summary...' : 'Summary not available'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}