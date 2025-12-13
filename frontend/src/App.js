import React, { useState, useEffect, lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import api, { setAuthToken } from './services/api';

// Lazy load pages for better performance
const ChatPage = lazy(() => import('./pages/ChatPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));

export default function App(){
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [view, setView] = useState('login'); // login, signup, verify
  const [verificationEmail, setVerificationEmail] = useState('');

  // Check for invite link on load
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/connect/')) {
      const inviteCode = path.split('/connect/')[1];
      if (inviteCode) {
        localStorage.setItem('pendingInviteCode', inviteCode);
        // Clean URL to avoid re-processing
        window.history.replaceState({}, document.title, '/');
      }
    }
  }, []);

  // Process pending invite when user is logged in
  useEffect(() => {
    const processPendingInvite = async () => {
      const inviteCode = localStorage.getItem('pendingInviteCode');
      if (inviteCode && user) {
        if (localStorage.getItem('invite_connecting') === '1') return; // prevent duplicate
        localStorage.setItem('invite_connecting', '1');
        try {
          const res = await api.post('/api/auth/connect', { inviteCode });
          localStorage.removeItem('pendingInviteCode');
          alert(`Connected with ${res.data.user.displayName}!`);
          // Force reload to update contacts list
          window.location.reload();
        } catch (error) {
          console.error('Failed to connect:', error);
          const msg = error.response?.data?.message || 'Failed to connect using invite link.';
          if (msg !== 'Already connected') {
             alert(msg);
          }
          localStorage.removeItem('pendingInviteCode');
        } finally {
          localStorage.removeItem('invite_connecting');
        }
      }
    };

    if (user) {
      processPendingInvite();
    }
  }, [user]);

  // Sync theme changes from localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setTheme(localStorage.getItem('theme') || 'light');
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also check for theme changes every 100ms (for same-tab updates)
    const interval = setInterval(() => {
      const currentTheme = localStorage.getItem('theme') || 'light';
      if (currentTheme !== theme) {
        setTheme(currentTheme);
      }
    }, 100);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [theme]);

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
    setView('chat');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.clear();
    setAuthToken(null);
    setView('login');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  if (loading) {
    const darkMode = theme === 'dark';
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode 
          ? 'bg-gray-900' 
          : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
      }`}>
        <LoadingSpinner size="lg" text="Loading JustUs..." />
      </div>
    );
  }

  const darkMode = theme === 'dark';

  const renderContent = () => {
    if (user) {
      return <ChatPage user={user} onLogout={handleLogout} />;
    }

    if (view === 'signup') {
      return (
        <SignupPage 
          onSignupSuccess={(email) => {
            setVerificationEmail(email);
            setView('verify');
          }}
          onSwitchToLogin={() => setView('login')}
          theme={theme}
        />
      );
    }
    
    if (view === 'verify') {
      return (
        <VerifyEmailPage 
          email={verificationEmail}
          onVerificationSuccess={handleLogin}
          theme={theme}
        />
      );
    }

    return (
      <LoginPage 
        onLogin={handleLogin} 
        onSwitchToSignup={() => setView('signup')}
        onRequiresVerification={(email) => {
          setVerificationEmail(email);
          setView('verify');
        }}
        theme={theme} 
      />
    );
  };

  return (
    <ErrorBoundary>
      <div className={`min-h-screen ${
        darkMode 
          ? 'bg-gray-900' 
          : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
      }`}>
      <header className={`shadow-lg border-b ${
        darkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-6xl mx-auto py-4 px-6 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">JU</span>
            </div>
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>JustUs</h1>
            <span className={`text-sm px-2 py-1 rounded-full ${darkMode ? 'text-gray-300 bg-gray-700' : 'text-gray-500 bg-gray-100'}`}>Private Chat</span>
          </div>
          <div className="flex items-center space-x-4">
            {/* Theme Toggle Button - Always Visible */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-all duration-200 ${
                darkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? (
                // Sun icon for light mode
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                // Moon icon for dark mode
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
            {user && (
              <>
                <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Welcome, <span className="font-semibold text-indigo-600">{user.displayName || user.username}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto py-8 px-4">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        }>
          {renderContent()}
        </Suspense>
      </main>
    </div>
    </ErrorBoundary>
  )
}
