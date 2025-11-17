'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Network, Loader2, AlertCircle, Brain, ZoomIn, ZoomOut, Maximize2, ArrowLeft } from 'lucide-react';
import * as d3 from 'd3';
import ProtectedRoute from '@/components/ProtectedRoute';

interface Concept {
  id: string;
  name: string;
  type: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  importance_score: number;
  definition: string;
  explanation: string;
  examples?: string[];
  equations?: string[];
}

interface Edge {
  source_id: string;
  target_id: string;
  relationship_type: string;
  strength: number;
}

interface ConceptGraphData {
  paper_id: string;
  concepts: Concept[];
  edges: Edge[];
  num_concepts: number;
  num_edges: number;
  complexity_score: number;
}

interface D3Node extends d3.SimulationNodeDatum, Concept {
  x?: number;
  y?: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  type: string;
  strength: number;
}

function ConceptGraphPageContent() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);

  const [graphData, setGraphData] = useState<ConceptGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [physicsEnabled, setPhysicsEnabled] = useState(true);

  // Fetch concept graph data
  useEffect(() => {
    if (!paperId) return;

    const fetchConceptGraph = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`http://localhost:8000/api/papers/${paperId}/concepts`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch concept graph');
        }

        const data: ConceptGraphData = await response.json();
        setGraphData(data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchConceptGraph();
  }, [paperId]);

  // Initialize D3 graph
  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight - 100; // Account for header

    // Clear previous graph
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Add zoom behavior
    const g = svg.append('g');
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom as any);

    // Prepare nodes and links
    const nodes: D3Node[] = graphData.concepts.map(c => ({ ...c }));
    const links: D3Link[] = graphData.edges.map(e => ({
      source: e.source_id,
      target: e.target_id,
      type: e.relationship_type,
      strength: e.strength
    }));

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links)
        .id(d => d.id)
        .distance(d => 150 + (1 - d.strength) * 100))
      .force('charge', d3.forceManyBody().strength(-600))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => 20 + (d.importance_score * 30)));

    simulationRef.current = simulation;

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('class', d => `link-${d.type}`)
      .attr('stroke', d => {
        const colors: Record<string, string> = {
          prerequisite: '#ff6b6b',
          related: '#4ecdc4',
          part_of: '#ffd93d',
          example_of: '#95e1d3'
        };
        return colors[d.type] || '#6b7280';
      })
      .attr('stroke-width', d => 1 + Math.sqrt(d.strength) * 2)
      .attr('stroke-opacity', 0.6);

    // Create nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', d => 15 + (d.importance_score * 25))
      .attr('fill', d => {
        const colors = {
          beginner: '#4ecdc4',
          intermediate: '#ffd93d',
          advanced: '#ff6b6b'
        };
        return colors[d.difficulty];
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))')
      .call(d3.drag<SVGCircleElement, D3Node>()
        .on('start', (event, d) => {
          if (!event.active && physicsEnabled) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active && physicsEnabled) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any)
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedConcept(d);
      })
      .on('mouseenter', (event, d) => {
        setHoveredNode(d.id);
        d3.select(event.currentTarget)
          .attr('stroke', '#00d4ff')
          .attr('stroke-width', 4)
          .style('filter', 'drop-shadow(0 4px 12px rgba(0, 212, 255, 0.8))');
      })
      .on('mouseleave', (event, d) => {
        if (selectedConcept?.id !== d.id) {
          setHoveredNode(null);
          d3.select(event.currentTarget)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))');
        }
      });

    // Create labels
    const label = g.append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text(d => d.name.length > 20 ? d.name.substring(0, 20) + '...' : d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', d => -(15 + (d.importance_score * 25) + 8))
      .attr('fill', '#fff')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 0 3px rgba(0, 0, 0, 0.8), 0 0 6px rgba(0, 0, 0, 0.6)');

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as D3Node).x || 0)
        .attr('y1', d => (d.source as D3Node).y || 0)
        .attr('x2', d => (d.target as D3Node).x || 0)
        .attr('y2', d => (d.target as D3Node).y || 0);

      node
        .attr('cx', d => d.x || 0)
        .attr('cy', d => d.y || 0);

      label
        .attr('x', d => d.x || 0)
        .attr('y', d => d.y || 0);
    });

    // Click on background to deselect
    svg.on('click', () => {
      setSelectedConcept(null);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graphData, physicsEnabled]);

  // Apply filters
  useEffect(() => {
    if (!svgRef.current || !graphData) return;

    const svg = d3.select(svgRef.current);
    
    svg.selectAll('circle').style('display', function(d: any) {
      const matchesDifficulty = difficultyFilter === 'all' || d.difficulty === difficultyFilter;
      const matchesType = typeFilter === 'all' || d.type === typeFilter;
      return (matchesDifficulty && matchesType) ? 'block' : 'none';
    });

    svg.selectAll('text').style('display', function(d: any) {
      const matchesDifficulty = difficultyFilter === 'all' || d.difficulty === difficultyFilter;
      const matchesType = typeFilter === 'all' || d.type === typeFilter;
      return (matchesDifficulty && matchesType) ? 'block' : 'none';
    });
  }, [difficultyFilter, typeFilter, graphData]);

  const resetZoom = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(750)
      .call(d3.zoom<SVGSVGElement, unknown>().transform as any, d3.zoomIdentity);
  };

  const zoomIn = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(300)
      .call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1.3);
  };

  const zoomOut = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(300)
      .call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 0.7);
  };

  const togglePhysics = () => {
    setPhysicsEnabled(!physicsEnabled);
    if (simulationRef.current) {
      if (!physicsEnabled) {
        simulationRef.current.alpha(0.3).restart();
      } else {
        simulationRef.current.stop();
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-gray-300">Loading concept graph...</p>
        </div>
      </div>
    );
  }

  if (error || !graphData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Graph</h2>
          <p className="text-red-400">{error || 'Failed to load concept graph'}</p>
        </div>
      </div>
    );
  }

  const difficultyStats = {
    beginner: graphData.concepts.filter(c => c.difficulty === 'beginner').length,
    intermediate: graphData.concepts.filter(c => c.difficulty === 'intermediate').length,
    advanced: graphData.concepts.filter(c => c.difficulty === 'advanced').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 border-b border-blue-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-blue-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-cyan-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                <Network className="h-6 w-6" />
                Concept Graph Visualization
              </h1>
              <p className="text-sm text-gray-300 mt-1">
                {graphData.num_concepts} concepts • {graphData.num_edges} relationships • 
                Complexity: {(graphData.complexity_score * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-4">
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="bg-gray-800 text-white border-2 border-cyan-500 rounded-lg px-4 py-2 text-sm"
            >
              <option value="all">All Difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-gray-800 text-white border-2 border-cyan-500 rounded-lg px-4 py-2 text-sm"
            >
              <option value="all">All Types</option>
              <option value="definition">Definition</option>
              <option value="theory">Theory</option>
              <option value="equation">Equation</option>
              <option value="method">Method</option>
              <option value="result">Result</option>
              <option value="term">Term</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative">
        {/* SVG Graph */}
        <svg ref={svgRef} className="w-full" style={{ height: 'calc(100vh - 100px)' }} />

        {/* Left Panel - Stats */}
        <div className="absolute top-6 left-6 bg-gradient-to-br from-blue-900/95 to-indigo-900/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-blue-700 max-w-sm">
          <h3 className="font-bold text-cyan-400 mb-4 flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5" />
            Difficulty Distribution
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Beginner</span>
                <span className="font-semibold text-cyan-400">{difficultyStats.beginner}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-cyan-400 h-2 rounded-full transition-all"
                  style={{width: `${(difficultyStats.beginner / graphData.num_concepts) * 100}%`}}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Intermediate</span>
                <span className="font-semibold text-yellow-400">{difficultyStats.intermediate}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-yellow-400 h-2 rounded-full transition-all"
                  style={{width: `${(difficultyStats.intermediate / graphData.num_concepts) * 100}%`}}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Advanced</span>
                <span className="font-semibold text-red-400">{difficultyStats.advanced}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-red-400 h-2 rounded-full transition-all"
                  style={{width: `${(difficultyStats.advanced / graphData.num_concepts) * 100}%`}}
                />
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 pt-6 border-t border-blue-700">
            <h4 className="text-sm font-bold text-cyan-400 mb-3">Relationships</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-red-400 rounded"></div>
                <span className="text-gray-300">Prerequisite</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-cyan-400 rounded"></div>
                <span className="text-gray-300">Related</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-yellow-400 rounded"></div>
                <span className="text-gray-300">Part Of</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Selected Concept */}
        {selectedConcept && (
          <div className="absolute top-6 right-6 bg-gradient-to-br from-blue-900/95 to-indigo-900/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-blue-700 max-w-md max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => setSelectedConcept(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            <h3 className="font-bold text-cyan-400 text-xl mb-4 pr-8">{selectedConcept.name}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-blue-800 text-cyan-400 rounded-full text-xs font-semibold uppercase">
                  {selectedConcept.type}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                  selectedConcept.difficulty === 'beginner' ? 'bg-cyan-900 text-cyan-400' :
                  selectedConcept.difficulty === 'intermediate' ? 'bg-yellow-900 text-yellow-400' :
                  'bg-red-900 text-red-400'
                }`}>
                  {selectedConcept.difficulty}
                </span>
                <span className="px-3 py-1 bg-purple-900 text-purple-400 rounded-full text-xs font-semibold">
                  {(selectedConcept.importance_score * 100).toFixed(0)}% Important
                </span>
              </div>
              
              <div>
                <p className="text-cyan-400 font-semibold mb-1">Definition:</p>
                <p className="text-gray-300 leading-relaxed">{selectedConcept.definition}</p>
              </div>
              
              {selectedConcept.explanation && (
                <div>
                  <p className="text-cyan-400 font-semibold mb-1">Explanation:</p>
                  <p className="text-gray-300 leading-relaxed">{selectedConcept.explanation}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-900/95 to-indigo-900/95 backdrop-blur-lg rounded-full shadow-2xl px-6 py-3 border border-blue-700 flex items-center gap-4">
          <button
            onClick={resetZoom}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full text-sm font-semibold transition-colors"
          >
            Reset View
          </button>
          <button
            onClick={togglePhysics}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-full text-sm font-semibold transition-colors"
          >
            {physicsEnabled ? 'Freeze' : 'Unfreeze'}
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2">
          <button
            onClick={zoomIn}
            className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-full font-bold text-xl transition-all shadow-lg flex items-center justify-center"
            title="Zoom In"
          >
            <ZoomIn className="h-6 w-6" />
          </button>
          <button
            onClick={zoomOut}
            className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-full font-bold text-xl transition-all shadow-lg flex items-center justify-center"
            title="Zoom Out"
          >
            <ZoomOut className="h-6 w-6" />
          </button>
          <button
            onClick={resetZoom}
            className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-full font-bold text-xl transition-all shadow-lg flex items-center justify-center"
            title="Reset Zoom"
          >
            <Maximize2 className="h-6 w-6" />
          </button>
        </div>

        {/* Help Text */}
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-blue-900/90 backdrop-blur-lg text-gray-300 px-6 py-3 rounded-full text-sm border border-blue-700">
          <span className="text-cyan-400 font-semibold">Drag</span> nodes • 
          <span className="text-cyan-400 font-semibold"> Scroll</span> to zoom • 
          <span className="text-cyan-400 font-semibold"> Click</span> for details
        </div>
      </div>
    </div>
  );
}

export default function ConceptGraphPage() {
  return (
    <ProtectedRoute>
      <ConceptGraphPageContent />
    </ProtectedRoute>
  );
}