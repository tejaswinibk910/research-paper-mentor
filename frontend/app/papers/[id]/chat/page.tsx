'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Send, Loader2, MessageSquare, Lightbulb, Settings } from 'lucide-react';

export default function ChatPage() {
  const params = useParams();
  const paperId = params.id as string;

  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tutoringMode, setTutoringMode] = useState('socratic');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    initializeChat();
  }, [paperId]);

  const initializeChat = async () => {
    try {
      setLoading(true);
      setError(null);

      const existingSessions = await api.getPaperSessions(paperId);
      
      let chatSession;
      if (existingSessions && existingSessions.length > 0) {
        chatSession = existingSessions[0];
        setMessages(chatSession.messages || []);
        setTutoringMode(chatSession.tutoring_mode || 'socratic');
      } else {
        chatSession = await api.createChatSession(
          paperId,
          tutoringMode,
          'intermediate'
        );
        setMessages([]);
      }
      
      setSession(chatSession);
    } catch (err: any) {
      console.error('Failed to initialize chat:', err);
      setError(err.response?.data?.detail || 'Failed to initialize chat');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !session || sending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    const userMsg = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await api.sendChatMessage(session.id, userMessage);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
      }]);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const handleModeChange = async (newMode: string) => {
    if (!session) return;
    
    try {
      await fetch(`http://localhost:8000/api/chat/sessions/${session.id}/mode?mode=${newMode}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      setTutoringMode(newMode);
      setShowSettings(false);
    } catch (err) {
      console.error('Failed to update mode:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-fuchsia-600 blur-xl opacity-50"></div>
            <Loader2 className="relative h-12 w-12 animate-spin text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">Initializing chat...</p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <div className="text-center max-w-md">
          <MessageSquare className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Chat Error</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={initializeChat}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-purple-50/30 dark:from-gray-900 dark:to-purple-900/10">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-100 to-fuchsia-100 dark:from-purple-900/30 dark:to-fuchsia-900/30 rounded-xl">
            <MessageSquare className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              AI Tutor Chat
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Mode: <span className="capitalize font-semibold text-purple-600 dark:text-purple-400">{tutoringMode}</span>
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
        >
          <Settings className="h-5 w-5" />
          <span className="font-medium">Settings</span>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 border-b border-purple-200 dark:border-purple-800 px-6 py-4">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">Tutoring Mode</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['socratic', 'direct', 'hint', 'analogies'].map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                  tutoringMode === mode
                    ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg scale-105'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 leading-relaxed">
            <strong className="text-purple-600 dark:text-purple-400">Socratic:</strong> Guides with questions • 
            <strong className="text-purple-600 dark:text-purple-400"> Direct:</strong> Clear explanations • 
            <strong className="text-purple-600 dark:text-purple-400"> Hint:</strong> Progressive hints • 
            <strong className="text-purple-600 dark:text-purple-400"> Analogies:</strong> Real-world examples
          </p>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-fuchsia-400 blur-2xl opacity-20"></div>
              <MessageSquare className="relative h-20 w-20 text-purple-600 dark:text-purple-400 mx-auto" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Start Your Learning Journey
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
              Ask questions about the paper. The AI tutor will guide you through {tutoringMode} questioning.
            </p>
            <div className="mt-6 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "What is the main contribution of this paper?",
                  "Can you explain the methodology?",
                  "What are the key findings?",
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInputMessage(suggestion)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-100 to-fuchsia-100 dark:from-purple-900/30 dark:to-fuchsia-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium hover:shadow-md transition-all border border-purple-200 dark:border-purple-800"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-2xl px-5 py-4 shadow-md ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                <p className="text-xs mt-2 opacity-70">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 shadow-md">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        )}

        {error && messages.length > 0 && (
          <div className="flex justify-center">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 shadow-lg">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask a question about the paper..."
            disabled={sending}
            className="flex-1 px-5 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white bg-white dark:bg-gray-900 placeholder-gray-500 dark:placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || sending}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            Send
          </button>
        </form>
      </div>
    </div>
  );
}