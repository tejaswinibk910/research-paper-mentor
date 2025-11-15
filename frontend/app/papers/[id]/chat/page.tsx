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

      // Check if there's an existing session for this paper
      const existingSessions = await api.getPaperSessions(paperId);
      
      let chatSession;
      if (existingSessions && existingSessions.length > 0) {
        // Use the most recent session
        chatSession = existingSessions[0];
        setMessages(chatSession.messages || []);
        setTutoringMode(chatSession.tutoring_mode || 'socratic');
      } else {
        // Create new session
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

    // Add user message to UI immediately
    const userMsg = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Send message to backend
      const response = await api.sendChatMessage(session.id, userMessage);
      
      // Add assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
      }]);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
      
      // Remove the user message if it failed
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Initializing chat...</p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <MessageSquare className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Chat Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={initializeChat}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">AI Tutor Chat</h1>
            <p className="text-sm text-gray-500">
              Mode: <span className="capitalize font-medium">{tutoringMode}</span>
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Settings className="h-5 w-5" />
          Settings
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-indigo-50 border-b px-6 py-4">
          <h3 className="font-semibold text-gray-900 mb-3">Tutoring Mode</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {['socratic', 'direct', 'hint', 'analogies'].map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tutoringMode === mode
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            <strong>Socratic:</strong> Guides you with questions • 
            <strong> Direct:</strong> Clear explanations • 
            <strong> Hint:</strong> Progressive hints • 
            <strong> Analogies:</strong> Real-world examples
          </p>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Start Your Learning Journey
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Ask questions about the paper. The AI tutor will guide you to understand 
              the concepts through {tutoringMode} questioning.
            </p>
            <div className="mt-6 space-y-2">
              <p className="text-sm text-gray-600 font-medium">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "What is the main contribution of this paper?",
                  "Can you explain the methodology?",
                  "What are the key findings?",
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInputMessage(suggestion)}
                    className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm hover:bg-indigo-100 transition-colors"
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
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            </div>
          </div>
        )}

        {error && messages.length > 0 && (
          <div className="flex justify-center">
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t px-6 py-4">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask a question about the paper..."
            disabled={sending}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 bg-white"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || sending}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
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