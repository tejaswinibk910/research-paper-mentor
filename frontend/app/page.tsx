'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Paper } from '@/lib/types';
import UploadForm from '@/components/UploadForm';
import Link from 'next/link';
import { FileText, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
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
        return <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI-Powered Research Paper Mentor
          </h1>
          <p className="text-xl text-gray-600">
            Upload papers, visualize concepts, and learn with AI tutoring
          </p>
        </div>

        <div className="mb-16">
          <UploadForm onUploadComplete={loadPapers} />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Your Papers
          </h2>
          
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="inline-block h-12 w-12 animate-spin text-indigo-600" />
            </div>
          ) : papers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow">
              <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No papers uploaded yet</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {papers.map((paper) => (
                <Link
                  key={paper.id}
                  href={`/papers/${paper.id}`}
                  className="block"
                >
                  <div className="bg-white rounded-xl shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 h-full">
                    <div className="flex items-start justify-between mb-4">
                      <FileText className="h-8 w-8 text-indigo-600 flex-shrink-0" />
                      {getStatusIcon(paper.status)}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[3.5rem]">
                      {paper.metadata?.title || paper.filename}
                    </h3>
                    
                    <p className="text-sm text-gray-500 mb-4">
                      {paper.total_pages} pages
                    </p>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className={`
                        px-2 py-1 rounded-full font-medium
                        ${paper.status === 'ready' ? 'bg-green-100 text-green-800' : ''}
                        ${paper.status === 'processing' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${paper.status === 'failed' ? 'bg-red-100 text-red-800' : ''}
                      `}>
                        {paper.status}
                      </span>
                      <span className="text-gray-500">
                        {new Date(paper.created_at).toLocaleDateString()}
                      </span>
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