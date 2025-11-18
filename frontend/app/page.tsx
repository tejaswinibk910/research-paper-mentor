'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Paper } from '@/lib/types';
import UploadForm from '@/components/UploadForm';
import Link from 'next/link';
import { FileText, Clock, CheckCircle, XCircle, Loader2, TrendingUp } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

function HomePage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPapers();
  }, []);

  const loadPapers = async () => {
    try {
      const data = await api.getPapers();
      setPapers(data);
    } catch (error) {
      console.error('Failed to load papers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'from-green-500 to-emerald-600';
      case 'processing':
        return 'from-amber-500 to-orange-600';
      case 'failed':
        return 'from-red-500 to-rose-600';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section with Gradient Background */}
        <div className="relative mb-12 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-fuchsia-600/20 dark:from-violet-500/10 dark:via-purple-500/10 dark:to-fuchsia-500/10 blur-3xl -z-10"></div>
          
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 dark:from-violet-400 dark:via-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
              AI-Powered Research
            </span>
            <br />
            <span className="text-gray-900 dark:text-white">Paper Mentor</span>
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto flex items-center justify-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Upload papers, visualize concepts, and learn with AI tutoring
          </p>
        </div>

        {/* Upload Section */}
        <div className="mb-16">
          <UploadForm onUploadComplete={loadPapers} />
        </div>

        {/* Papers Section */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              Your Papers
            </h2>
            {papers.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-fuchsia-100 dark:from-purple-900/30 dark:to-fuchsia-900/30 rounded-full">
                <div className="h-2 w-2 rounded-full bg-purple-600 dark:bg-purple-400 animate-pulse"></div>
                <span className="text-sm font-semibold text-purple-900 dark:text-purple-300">
                  {papers.length} {papers.length === 1 ? 'paper' : 'papers'}
                </span>
              </div>
            )}
          </div>
          
          {loading ? (
            <div className="text-center py-20">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 blur-xl opacity-50"></div>
                <Loader2 className="relative inline-block h-16 w-16 animate-spin text-purple-600 dark:text-purple-400" />
              </div>
              <p className="mt-6 text-gray-600 dark:text-gray-400 font-medium">Loading your papers...</p>
            </div>
          ) : papers.length === 0 ? (
            <div className="relative overflow-hidden text-center py-20 bg-gradient-to-br from-white via-purple-50/30 to-fuchsia-50/30 dark:from-gray-800 dark:via-purple-900/10 dark:to-fuchsia-900/10 rounded-3xl shadow-xl border border-purple-200/50 dark:border-purple-800/50">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-400/20 to-fuchsia-400/20 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-violet-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
              
              <div className="relative">
                <div className="inline-block p-6 bg-gradient-to-br from-purple-100 to-fuchsia-100 dark:from-purple-900/30 dark:to-fuchsia-900/30 rounded-2xl mb-6">
                  <FileText className="h-16 w-16 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  No papers uploaded yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Upload your first research paper to get started with AI-powered learning
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {papers.map((paper) => (
                <Link
                  key={paper.id}
                  href={`/papers/${paper.id}`}
                  className="group block"
                >
                  <div className="relative h-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border border-gray-200 dark:border-gray-700 overflow-hidden transform group-hover:scale-[1.02]">
                    {/* Gradient overlay on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${getStatusColor(paper.status)} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
                    
                    <div className="relative">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-gradient-to-br from-purple-100 to-fuchsia-100 dark:from-purple-900/30 dark:to-fuchsia-900/30 rounded-xl group-hover:scale-110 transition-transform duration-300">
                          <FileText className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(paper.status)}
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 line-clamp-2 min-h-[3.5rem] group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {paper.metadata?.title || paper.filename}
                      </h3>
                      
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex-1 h-1 bg-gradient-to-r from-purple-200 to-fuchsia-200 dark:from-purple-900/50 dark:to-fuchsia-900/50 rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${getStatusColor(paper.status)} rounded-full ${paper.status === 'ready' ? 'w-full' : paper.status === 'processing' ? 'w-1/2 animate-pulse' : 'w-1/4'}`}></div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                          {paper.total_pages} pages
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                        <span className={`
                          px-3 py-1.5 rounded-full text-xs font-bold
                          ${paper.status === 'ready' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' : ''}
                          ${paper.status === 'processing' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white' : ''}
                          ${paper.status === 'failed' ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white' : ''}
                        `}>
                          {paper.status}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(paper.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <HomePage />
    </ProtectedRoute>
  );
}