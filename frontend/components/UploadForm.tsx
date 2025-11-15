'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface UploadFormProps {
  onUploadComplete?: () => void;
}

export default function UploadForm({ onUploadComplete }: UploadFormProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(f => f.type === 'application/pdf');
    
    if (pdfFile) {
      await uploadFile(pdfFile);
    } else {
      setError('Please upload a PDF file');
      setTimeout(() => setError(null), 3000);
    }
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file');
        setTimeout(() => setError(null), 3000);
        return;
      }
      await uploadFile(file);
    }
  }, []);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setSuccess(false);
    setUploadProgress('Uploading file...');
    
    try {
      // Upload the file
      const response = await api.uploadPaper(file);
      
      // Backend returns { paper: {...}, concept_graph: {...} }
      const paperId = response.paper.id;
      
      setUploadProgress('Processing paper...');
      
      // Wait a moment for processing to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess(true);
      setUploadProgress('Upload complete!');
      
      // Call the callback if provided
      if (onUploadComplete) {
        onUploadComplete();
      }
      
      // Navigate to the paper details page after a short delay
      setTimeout(() => {
        router.push(`/papers/${paperId}`);
      }, 1500);
      
    } catch (err: any) {
      console.error('Upload error:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Upload failed. Please try again.';
      setError(errorMessage);
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center transition-all
          ${isDragging ? 'border-indigo-500 bg-indigo-50 scale-105' : 'border-gray-300 hover:border-indigo-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${success ? 'border-green-500 bg-green-50' : ''}
          ${error ? 'border-red-500 bg-red-50' : ''}
        `}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="h-16 w-16 text-indigo-600 animate-spin mb-4" />
            <p className="text-lg font-medium text-gray-700">
              {uploadProgress}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              This may take 30-60 seconds
            </p>
            <div className="mt-4 w-full max-w-xs">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full animate-pulse w-3/4"></div>
              </div>
            </div>
          </div>
        ) : success ? (
          <div className="flex flex-col items-center">
            <CheckCircle className="h-16 w-16 text-green-600 mb-4" />
            <p className="text-lg font-medium text-green-700">
              Upload Successful!
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Redirecting to paper details...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center">
            <AlertCircle className="h-16 w-16 text-red-600 mb-4" />
            <p className="text-lg font-medium text-red-700 mb-2">
              Upload Failed
            </p>
            <p className="text-sm text-red-600 mb-4">
              {error}
            </p>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Upload Research Paper
            </h3>
            <p className="text-sm text-gray-500 mb-2">
              Drag and drop your PDF here, or click to browse
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Supported format: PDF (max 50MB)
            </p>
            
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
              disabled={isUploading}
            />
            
            <label
              htmlFor="file-upload"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer transition-colors shadow-sm hover:shadow-md"
            >
              <Upload className="h-5 w-5 mr-2" />
              Choose File
            </label>
          </>
        )}
      </div>

      {/* Upload Tips */}
      {!isUploading && !success && !error && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">
            📚 Tips for best results:
          </h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Upload clear, text-based PDFs (not scanned images)</li>
            <li>• Papers with clear section headings work best</li>
            <li>• Processing typically takes 30-60 seconds</li>
            <li>• You'll be able to chat, quiz, and visualize concepts</li>
          </ul>
        </div>
      )}
    </div>
  );
}