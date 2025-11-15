"""
Papers Dashboard React Component
TypeScript/React code for displaying user's papers
"""

// components/PapersDashboard.tsx

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  Brain,
  MessageSquare,
  Trophy,
  Clock,
  Search,
  Filter,
  Download,
  ChevronRight,
  BookOpen,
  Users,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import api, { Paper } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface PapersDashboardProps {
  onPaperSelect: (paperId: string) => void;
  onUploadClick: () => void;
}

const PapersDashboard: React.FC<PapersDashboardProps> = ({
  onPaperSelect,
  onUploadClick,
}) => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Load papers on component mount
  useEffect(() => {
    loadPapers();
  }, []);

  // Auto-refresh for processing papers
  useEffect(() => {
    const processingPapers = papers.filter(p => p.processing_status === 'processing');
    
    if (processingPapers.length > 0) {
      const interval = setInterval(() => {
        checkProcessingStatus(processingPapers);
      }, 3000); // Check every 3 seconds
      
      return () => clearInterval(interval);
    }
  }, [papers]);

  const loadPapers = async () => {
    try {
      setLoading(true);
      const fetchedPapers = await api.getPapers();
      setPapers(fetchedPapers);
    } catch (error) {
      console.error('Error loading papers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load papers. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkProcessingStatus = async (processingPapers: Paper[]) => {
    for (const paper of processingPapers) {
      try {
        const status = await api.getPaperStatus(paper.id);
        
        if (status.status !== 'processing') {
          // Reload papers if any status changed
          await loadPapers();
          
          if (status.status === 'completed') {
            toast({
              title: 'Processing Complete',
              description: `"${paper.title}" is ready for study!`,
            });
          } else if (status.status === 'failed') {
            toast({
              title: 'Processing Failed',
              description: `Failed to process "${paper.title}"`,
              variant: 'destructive',
            });
          }
        }
      } catch (error) {
        console.error(`Error checking status for paper ${paper.id}:`, error);
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPapers();
    setRefreshing(false);
    toast({
      title: 'Refreshed',
      description: 'Papers list updated',
    });
  };

  const handleDelete = async (paperId: string, paperTitle: string) => {
    try {
      await api.deletePaper(paperId);
      setPapers(papers.filter(p => p.id !== paperId));
      toast({
        title: 'Paper Deleted',
        description: `"${paperTitle}" has been removed`,
      });
    } catch (error) {
      console.error('Error deleting paper:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete paper',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // Filter papers based on search and status
  const filteredPapers = papers.filter(paper => {
    const matchesSearch = paper.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          paper.abstract?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          paper.authors?.some(author => 
                            author.toLowerCase().includes(searchTerm.toLowerCase())
                          );
    
    const matchesStatus = filterStatus === 'all' || paper.processing_status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-64">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Your Papers</h1>
          <p className="text-gray-600 mt-1">
            {papers.length} paper{papers.length !== 1 ? 's' : ''} in your library
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={onUploadClick}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Paper
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search papers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('completed')}
          >
            Ready
          </Button>
          <Button
            variant={filterStatus === 'processing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('processing')}
          >
            Processing
          </Button>
        </div>
      </div>

      {/* Papers Grid */}
      {filteredPapers.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {searchTerm || filterStatus !== 'all' 
              ? 'No papers found' 
              : 'No papers yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Upload your first research paper to get started'}
          </p>
          {!searchTerm && filterStatus === 'all' && (
            <Button onClick={onUploadClick}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Your First Paper
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPapers.map((paper) => (
            <Card
              key={paper.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => paper.processing_status === 'completed' && onPaperSelect(paper.id)}
            >
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge className={`${getStatusColor(paper.processing_status)} text-white`}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(paper.processing_status)}
                      {paper.processing_status}
                    </span>
                  </Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Paper?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{paper.title}" and all associated data.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(paper.id, paper.title)}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                
                <CardTitle className="line-clamp-2 text-lg">
                  {paper.title}
                </CardTitle>
                
                {paper.authors && paper.authors.length > 0 && (
                  <CardDescription className="flex items-center gap-1 mt-2">
                    <Users className="w-3 h-3" />
                    <span className="line-clamp-1 text-sm">
                      {paper.authors.slice(0, 2).join(', ')}
                      {paper.authors.length > 2 && ` +${paper.authors.length - 2}`}
                    </span>
                  </CardDescription>
                )}
              </CardHeader>
              
              <CardContent>
                {paper.abstract && (
                  <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                    {paper.abstract}
                  </p>
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {paper.page_count} pages
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(paper.uploaded_at), { addSuffix: true })}
                  </span>
                </div>
              </CardContent>
              
              {paper.processing_status === 'completed' && (
                <CardFooter className="pt-4 border-t">
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Navigate to summary view
                        onPaperSelect(paper.id);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Navigate to chat
                        onPaperSelect(paper.id);
                      }}
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Chat
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Navigate to quiz
                        onPaperSelect(paper.id);
                      }}
                    >
                      <Trophy className="w-4 h-4 mr-1" />
                      Quiz
                    </Button>
                  </div>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PapersDashboard;

// Also export a simplified version for imports
export { PapersDashboard };