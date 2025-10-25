import React from 'react';

export default function UserSelectModal({ show, onClose, availableUsers, currentUserId, onSelect }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 animate-in zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Select Chat Partner</h3>
          <p className="text-gray-500 text-sm">Choose who you want to chat with</p>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
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
