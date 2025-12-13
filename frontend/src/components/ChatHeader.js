import React from 'react';

export default function ChatHeader({
  otherUser,
  connectionStatus,
  typingUser,
  isReconnecting,
  theme,
  availableUsers,
  setShowOtherUserModal,
  user,
  messages,
  colors,
  onStartVoiceCall,
  onStartVideoCall,
  voiceCallState,
  videoCallState,
  otherUserOnline,
  onLogout
}) {
  return (
    <header style={{ background: colors.header, color: colors.headerText, padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ position: 'relative' }}>
        <img
          src={otherUser?.avatarUrl || `https://ui-avatars.com/api/?name=${otherUser?.displayName || otherUser?.username || 'User'}`}
          alt="Avatar"
          style={{ border: `2px solid ${otherUserOnline ? '#25d366' : '#6b7280'}`, borderRadius: '50%', width: '40px', height: '40px', objectFit: 'cover' }}
        />
        {otherUserOnline && (
          <div style={{ position: 'absolute', bottom: '0', right: '0', width: '12px', height: '12px', background: '#4ade80', border: '2px solid ' + colors.header, borderRadius: '50%' }}></div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{otherUser?.displayName || otherUser?.username || 'User'}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: theme === 'dark' ? '#8696a0' : '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: '18px' }}>
          {typingUser ? (
            <span style={{ color: '#4ade80', fontWeight: 600 }}>typing...</span>
          ) : otherUserOnline ? (
            <span style={{ color: '#4ade80' }}>online</span>
          ) : (
            <span>offline</span>
          )}
          {isReconnecting && <span style={{ marginLeft: '8px', color: '#eab308' }}>• reconnecting...</span>}
        </div>
      </div>
      
      {/* Voice Call Button */}
      {otherUser && voiceCallState === 'idle' && videoCallState === 'idle' && (
        <button
          onClick={onStartVoiceCall}
          disabled={connectionStatus !== 'connected'}
          style={{
            padding: '8px',
            borderRadius: '50%',
            background: connectionStatus === 'connected' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            color: colors.headerText,
            cursor: connectionStatus === 'connected' ? 'pointer' : 'not-allowed',
            opacity: connectionStatus === 'connected' ? 1 : 0.5,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={e => { if (connectionStatus === 'connected') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; }}
          onMouseLeave={e => e.currentTarget.style.background = connectionStatus === 'connected' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)'}
          title={connectionStatus === 'connected' ? 'Voice call' : 'Connect to enable calls'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
        </button>
      )}

      {/* Video Call Button */}
      {otherUser && voiceCallState === 'idle' && videoCallState === 'idle' && (
        <button
          onClick={onStartVideoCall}
          disabled={connectionStatus !== 'connected'}
          style={{
            padding: '8px',
            borderRadius: '50%',
            background: connectionStatus === 'connected' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            color: colors.headerText,
            cursor: connectionStatus === 'connected' ? 'pointer' : 'not-allowed',
            opacity: connectionStatus === 'connected' ? 1 : 0.5,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={e => { if (connectionStatus === 'connected') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; }}
          onMouseLeave={e => e.currentTarget.style.background = connectionStatus === 'connected' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)'}
          title={connectionStatus === 'connected' ? 'Video call' : 'Connect to enable calls'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </button>
      )}

      {/* Add Contact / Select Contact Button */}
      <button
        onClick={() => setShowOtherUserModal(true)}
        style={{
          padding: '8px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.05)',
          border: 'none',
          color: colors.headerText,
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: '8px'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        title="Contacts"
      >
        {/* User plus icon */}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a2.25 2.25 0 01-.732 1.651c-1.047.942-2.772.971-3.84.06A7.501 7.501 0 014.5 14.25m10.5 4.878V21m0 0h2.25M15 21h-2.25M6.75 7.5a3.75 3.75 0 107.5 0 3.75 3.75 0 00-7.5 0z" />
        </svg>
      </button>

      {/* Logout Button */}
      <button
        onClick={onLogout}
        style={{
          padding: '8px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.05)',
          border: 'none',
          color: colors.headerText,
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: '8px'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        title="Logout"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
        </svg>
      </button>
    </header>
  );
}
