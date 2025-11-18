'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
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
      const response = await api.uploadPaper(file);
      const paperId = response.paper.id;
      
      setUploadProgress('Processing paper...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess(true);
      setUploadProgress('Upload complete!');
      
      if (onUploadComplete) {
        onUploadComplete();
      }
      
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
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-fuchsia-600/10 dark:from-violet-500/5 dark:via-purple-500/5 dark:to-fuchsia-500/5 blur-3xl"></div>
        
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-300
            ${isDragging 
              ? 'border-purple-500 bg-gradient-to-br from-purple-50 via-fuchsia-50 to-violet-50 dark:from-purple-900/20 dark:via-fuchsia-900/20 dark:to-violet-900/20 scale-[1.02] shadow-2xl' 
              : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm'}
            ${isUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-xl'}
            ${success ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' : ''}
            ${error ? 'border-red-500 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20' : ''}
          `}
        >
          {isUploading ? (
            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 blur-2xl opacity-30 animate-pulse"></div>
                <Loader2 className="relative h-20 w-20 text-purple-600 dark:text-purple-400 animate-spin" />
              </div>
              <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 dark:from-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent mb-2">
                {uploadProgress}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                This may take 30-60 seconds
              </p>
              <div className="w-full max-w-md">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 dark:from-violet-500 dark:via-purple-500 dark:to-fuchsia-500 rounded-full animate-pulse w-3/4"></div>
                </div>
              </div>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 blur-2xl opacity-30"></div>
                <CheckCircle className="relative h-20 w-20 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">
                Upload Successful!
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Redirecting to paper details...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-rose-600 blur-2xl opacity-30"></div>
                <AlertCircle className="relative h-20 w-20 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300 mb-3">
                Upload Failed
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mb-6 max-w-md">
                {error}
              </p>
              <button
                onClick={() => setError(null)}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-fuchsia-400 blur-2xl opacity-20"></div>
                  <FileText className="relative h-20 w-20 mx-auto text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-3">
                Upload Research Paper
              </h3>
              <p className="text-base text-gray-600 dark:text-gray-400 mb-2">
                Drag and drop your PDF here, or click to browse
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-8">
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
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white text-lg font-bold rounded-2xl cursor-pointer transition-all shadow-lg hover:shadow-2xl transform hover:scale-105"
              >
                <Upload className="h-6 w-6" />
                Choose File
              </label>
            </>
          )}
        </div>
      </div>

      {!isUploading && !success && !error && (
        <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/10 dark:via-indigo-900/10 dark:to-purple-900/10 border border-blue-200 dark:border-blue-800/50 rounded-2xl backdrop-blur-sm">
          <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            Tips for best results:
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
              <span>Upload clear, text-based PDFs (not scanned images)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
              <span>Papers with clear section headings work best</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
              <span>Processing typically takes 30-60 seconds</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
              <span>You'll be able to chat, quiz, and visualize concepts</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}