'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load token and user from localStorage on mount
  useEffect(() => {
    const loadAuth = async () => {
      const storedToken = localStorage.getItem('auth_token');
      
      if (storedToken) {
        setToken(storedToken);
        
        // Fetch user info
        try {
          const response = await axios.get('http://localhost:8000/api/auth/me', {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });
          setUser(response.data);
        } catch (error) {
          // Token invalid, clear it
          localStorage.removeItem('auth_token');
          setToken(null);
        }
      }
      
      setLoading(false);
    };

    loadAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post('http://localhost:8000/api/auth/login', {
        email,
        password,
      });

      const { access_token } = response.data;
      
      // Store token
      localStorage.setItem('auth_token', access_token);
      setToken(access_token);

      // Fetch user info
      const userResponse = await axios.get('http://localhost:8000/api/auth/me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      setUser(userResponse.data);
      router.push('/');
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  };

  const register = async (
    email: string,
    username: string,
    password: string,
    fullName?: string
  ) => {
    try {
      await axios.post('http://localhost:8000/api/auth/register', {
        email,
        username,
        password,
        full_name: fullName,
      });

      // Auto-login after registration
      await login(email, password);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Registration failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    router.push('/auth/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}