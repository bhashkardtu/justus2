import React, { useState, useEffect } from 'react';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import { setAuthToken } from './services/api';

export default function App(){
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');
    
    if (token && userData) {
      try {
        setAuthToken(token);
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Failed to restore user session:', error);
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('userData', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.clear();
    setAuthToken(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading JustUs..." />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      <header className="bg-white shadow-lg border-b">
        <div className="max-w-6xl mx-auto py-4 px-6 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">JU</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">JustUs</h1>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Private Chat</span>
          </div>
          {user && (
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Welcome, <span className="font-semibold text-indigo-600">{user.displayName || user.username}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-6xl mx-auto py-8 px-4">
        {!user ? <LoginPage onLogin={handleLogin} /> : <ChatPage user={user} onLogout={handleLogout} />}
      </main>
    </div>
    </ErrorBoundary>
  )
}
