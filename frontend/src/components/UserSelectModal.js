import React, { useState } from 'react';
import api from '../services/api';

export default function UserSelectModal({ show, onClose, availableUsers, currentUserId, onSelect }) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    if (localStorage.getItem('invite_connecting') === '1') {
      alert('An invite is already being processed. Please wait...');
      return;
    }
    
    setLoading(true);
    localStorage.setItem('invite_connecting', '1');
    try {
      const res = await api.post('/api/auth/connect', { inviteCode: inviteCode.trim() });
      alert(`Connected with ${res.data.user.displayName}!`);
      window.location.reload();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to connect');
    } finally {
      setLoading(false);
      localStorage.removeItem('invite_connecting');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 animate-in zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Contacts</h3>
          <p className="text-gray-500 text-sm">Select a contact or add a new one</p>
        </div>

        {/* Add Contact Form */}
        <form onSubmit={handleConnect} className="mb-6">
            <div className="flex gap-2">
                <input 
                    type="text" 
                    placeholder="Enter Invite Code" 
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                />
                <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
                >
                    {loading ? '...' : 'Add'}
                </button>
            </div>
        </form>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {availableUsers.filter(u => u.id !== currentUserId).length === 0 && (
             <p className="text-center text-gray-400 py-4">No contacts yet. Add someone using their invite code!</p>
          )}
          {availableUsers.filter(u => u.id !== currentUserId).map(u => (
            <button key={u.id} onClick={() => onSelect(u.id)} className="w-full text-left p-4 hover:bg-gray-50 rounded-xl transition-colors duration-200 border border-transparent hover:border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-white font-semibold">{(u.displayName || u.username).charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{u.displayName || u.username}</div>
                  <div className="text-sm text-gray-500 truncate">ID: {u.id.slice(0, 8)}...</div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-6 w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl transition-colors duration-200 font-medium">Cancel</button>
      </div>
    </div>
  );
}
