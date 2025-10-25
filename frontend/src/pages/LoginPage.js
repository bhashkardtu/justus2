import React, { useState } from 'react';
import { login, register } from '../services/auth';
import { setAuthToken } from '../services/api';

export default function LoginPage({ onLogin, theme }){
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const darkMode = theme === 'dark';

  const validateForm = () => {
    const newErrors = {};
    
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setErrors({});
    
    try {
      const fn = isRegister ? register : login;
      const res = await fn({ username: username.trim(), password });
      const data = res.data;
      setAuthToken(data.token);
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.user.id);
      onLogin(data.user);
    } catch (error) {
      console.error('Login/Register failed:', error);
      
      let errorMessage = 'An unexpected error occurred. Please try again.';
      
      if (error.response?.status === 401) {
        if (isRegister) {
          errorMessage = 'Registration failed. Username might already be taken.';
        } else {
          errorMessage = 'Invalid username or password. Please try again.';
        }
      } else if (error.response?.status === 409) {
        errorMessage = 'Username already exists. Please choose a different one.';
      } else if (error.response?.status === 400) {
        // Extract the specific error message from backend
        errorMessage = error.response?.data?.message || error.message || 'Bad request. Please check your input.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  }

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setUsername('');
    setPassword('');
    setErrors({});
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-md">
        <div className={`rounded-xl p-8 border ${
          darkMode 
            ? 'bg-gray-800 border-gray-700 shadow-2xl' 
            : 'bg-white border-gray-200 shadow-2xl'
        }`}>
          <div className="text-center mb-8">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
              darkMode ? 'bg-indigo-900/50' : 'bg-gradient-to-br from-indigo-500 to-purple-600'
            }`}>
              <span className="text-white font-bold text-2xl">JU</span>
            </div>
            <h2 className={`text-3xl font-bold mb-2 ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
              {isRegister ? 'Join JustUs for private conversations' : 'Sign in to continue chatting'}
            </p>
          </div>

          {errors.general && (
            <div className={`mb-6 p-4 border rounded-lg ${
              darkMode 
                ? 'bg-red-900/30 border-red-700 text-red-300' 
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{errors.general}</span>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="space-y-6">
            <div>
              <label htmlFor="username" className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Username
              </label>
              <input 
                id="username"
                className={`w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.username 
                    ? darkMode 
                      ? 'border-red-500 bg-red-900/20 text-white placeholder-red-300' 
                      : 'border-red-400 bg-red-50 text-gray-900 placeholder-red-400' 
                    : darkMode 
                      ? 'border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 hover:border-gray-500' 
                      : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 hover:border-gray-400'
                }`}
                value={username} 
                onChange={e => {
                  setUsername(e.target.value);
                  if (errors.username) setErrors({...errors, username: null});
                }}
                placeholder="Enter your username"
                disabled={loading}
                autoComplete="username"
              />
              {errors.username && (
                <p className={`mt-1 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{errors.username}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Password
              </label>
              <input 
                id="password"
                type="password"
                className={`w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.password 
                    ? darkMode 
                      ? 'border-red-500 bg-red-900/20 text-white placeholder-red-300' 
                      : 'border-red-400 bg-red-50 text-gray-900 placeholder-red-400' 
                    : darkMode 
                      ? 'border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 hover:border-gray-500' 
                      : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 hover:border-gray-400'
                }`}
                value={password} 
                onChange={e => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({...errors, password: null});
                }}
                placeholder="Enter your password"
                disabled={loading}
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
              {errors.password && (
                <p className={`mt-1 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{errors.password}</p>
              )}
            </div>

            <button 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md hover:shadow-lg" 
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isRegister ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                isRegister ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
              {isRegister ? 'Already have an account?' : "Don't have an account?"}
            </p>
            <button 
              className={`mt-2 font-semibold transition-colors duration-200 ${
                darkMode 
                  ? 'text-indigo-400 hover:text-indigo-300' 
                  : 'text-indigo-600 hover:text-indigo-700'
              }`}
              onClick={toggleMode}
              disabled={loading}
            >
              {isRegister ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
