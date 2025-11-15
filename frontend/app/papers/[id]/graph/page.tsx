'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { ConceptGraph } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function ConceptGraphPage() {
  const params = useParams();
  const paperId = params.id as string;
  const [concepts, setConcepts] = useState<ConceptGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConcepts();
  }, [paperId]);

  const loadConcepts = async () => {
    try {
      const data = await api.getPaperConcepts(paperId);
      setConcepts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load concepts');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !concepts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-600">{error || 'No concepts found'}</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-md px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Concept Graph</h1>
          <p className="text-sm text-gray-600">
            {concepts.num_concepts} concepts • {concepts.num_edges} relationships • 
            Complexity: {concepts.complexity_score.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Graph Container - Embed your HTML viewer */}
      <div className="flex-1 relative bg-gray-900">
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Concept Graph Visualization</h2>
            <p className="mb-4">Open your universal-concept-graph-viewer.html separately</p>
            <p className="text-sm text-gray-400">Or integrate React Flow here</p>
          </div>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="bg-white border-t px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">
              {concepts.concepts.filter(c => c.difficulty === 'beginner').length}
            </div>
            <div className="text-sm text-gray-600">Beginner Concepts</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {concepts.concepts.filter(c => c.difficulty === 'intermediate').length}
            </div>
            <div className="text-sm text-gray-600">Intermediate</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {concepts.concepts.filter(c => c.difficulty === 'advanced').length}
            </div>
            <div className="text-sm text-gray-600">Advanced</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {concepts.edges.filter(e => e.relationship_type === 'prerequisite').length}
            </div>
            <div className="text-sm text-gray-600">Prerequisites</div>
          </div>
        </div>
      </div>
    </div>
  );
}