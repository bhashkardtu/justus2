import React, { useState } from 'react';
import { login } from '../../services/auth';
import { setAuthToken } from '../../services/api';

export default function LoginPage({ onLogin, onSwitchToSignup, onRequiresVerification, theme }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const darkMode = theme === 'dark';

  const validateForm = () => {
    const newErrors = {};
    if (!username.trim()) newErrors.username = 'Username or Email is required';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const res = await login({ username: username.trim(), password });
      const data = res.data;
      setAuthToken(data.token);
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.user.id);
      onLogin(data.user);
    } catch (error) {
      console.error('Login failed:', error);

      if (error.requiresVerification) {
        onRequiresVerification(error.email);
        return;
      }

      setErrors({ general: error.message || 'Login failed' });
    } finally {
      setLoading(false);
    }
  }

  const inputClass = `w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 outline-none ${darkMode
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
    }`;

  const labelClass = `block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-100px)]">
      <div className="w-full max-w-md">
        <div className={`rounded-2xl p-8 shadow-xl ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="text-center mb-8">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-indigo-900/50' : 'bg-gradient-to-br from-indigo-500 to-purple-600'
              }`}>
              <span className="text-white font-bold text-2xl">JU</span>
            </div>
            <h2 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Welcome Back
            </h2>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
              Sign in to continue to JustUs
            </p>
          </div>

          {errors.general && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
              {errors.general}
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className={labelClass}>Username or Email</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
                placeholder="Enter your username or email"
              />
              {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-lg shadow-indigo-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Don't have an account?{' '}
              <button
                onClick={onSwitchToSignup}
                className="font-medium text-indigo-500 hover:text-indigo-400 transition-colors"
              >
                Create account
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
