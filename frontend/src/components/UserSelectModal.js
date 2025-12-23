import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { getAvatarUrl } from '../services/avatarService';

export default function UserSelectModal({ show, onClose, availableUsers, currentUserId, onSelect }) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);

  // ESC key handler
  useEffect(() => {
    if (!show) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  // Click outside handler
  useEffect(() => {
    if (!show) return;
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [show, onClose]);

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="contacts-modal-title">
      <div ref={modalRef} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 animate-in zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <h3 id="contacts-modal-title" className="text-xl font-bold text-gray-900 mb-2">Contacts</h3>
          <p className="text-gray-500 text-sm">Select a contact or add a new one</p>
        </div>

        {/* Add Contact Form */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2 mb-3">
            <svg className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-indigo-800">
              <p className="font-semibold mb-1">Add new contact:</p>
              <p className="text-indigo-700">Enter the invite code shared by your friend. Check your chat with <strong>System</strong> for your own invite link!</p>
            </div>
          </div>
          <form onSubmit={handleConnect}>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    placeholder="Enter 8-character invite code" 
                    className="flex-1 p-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    maxLength={8}
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
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {availableUsers.filter(u => u.id !== currentUserId).length === 0 && (
             <p className="text-center text-gray-400 py-4">No contacts yet. Add someone using their invite code!</p>
          )}
          {availableUsers.filter(u => u.id !== currentUserId).map(u => (
            <button key={u.id} onClick={() => onSelect(u.id)} className="w-full text-left p-4 hover:bg-gray-50 rounded-xl transition-colors duration-200 border border-transparent hover:border-gray-200">
              <div className="flex items-center space-x-3">
                <img
                  src={getAvatarUrl(u.avatarUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || u.username)}&size=48&background=6366f1&color=ffffff&bold=true`}
                  alt=""
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || u.username)}&size=48&background=6366f1&color=ffffff&bold=true`;
                  }}
                  className="w-12 h-12 rounded-full object-cover shadow-md border-2 border-indigo-200"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{u.displayName || u.username}</div>
                  <div className="text-sm text-gray-500 truncate">@{u.username}</div>
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
