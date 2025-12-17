import React from 'react';
import ProfileModal from './ProfileModal';
import { getAvatarUrl } from '../services/avatarService';

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
  onLogout,
  onAvatarUpdate
}) {
  // Highlight the Contacts button for first-time users
  const [showContactsHint, setShowContactsHint] = React.useState(() => !localStorage.getItem('contacts_hint_dismissed'));
  const [showProfileModal, setShowProfileModal] = React.useState(false);

  const displayUser = otherUser || user;

  return (
    <header style={{ background: colors.header, color: colors.headerText, padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative' }}>
        <img
          src={getAvatarUrl(displayUser?.avatarUrl) || `https://ui-avatars.com/api/?name=${displayUser?.displayName || displayUser?.username || 'User'}`}
          alt="Avatar"
          style={{ border: `2px solid ${otherUserOnline ? '#25d366' : '#6b7280'}`, borderRadius: '50%', width: '40px', height: '40px', objectFit: 'cover' }}
        />
        {otherUserOnline && (
          <div style={{ position: 'absolute', bottom: '0', right: '0', width: '12px', height: '12px', background: '#4ade80', border: '2px solid ' + colors.header, borderRadius: '50%' }}></div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{displayUser?.displayName || displayUser?.username || 'User'}</span>
          {/* Contacts pill next to title */}
          <button
            onClick={() => {
              setShowOtherUserModal(true);
              if (showContactsHint) {
                localStorage.setItem('contacts_hint_dismissed', '1');
                setShowContactsHint(false);
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '9999px',
              background: theme === 'dark' ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)',
              color: theme === 'dark' ? '#e5e7eb' : '#1f2937',
              border: '1px solid rgba(99,102,241,0.35)',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: showContactsHint ? '0 0 0 6px rgba(99,102,241,0.15), 0 0 16px rgba(99,102,241,0.35)' : 'none'
            }}
            title="Contacts"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '16px', height: '16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a2.25 2.25 0 01-.732 1.651c-1.047.942-2.772.971-3.84.06A7.501 7.501 0 014.5 14.25m10.5 4.878V21m0 0h2.25M15 21h-2.25M6.75 7.5a3.75 3.75 0 107.5 0 3.75 3.75 0 00-7.5 0z" />
            </svg>
            <span className="contacts-label" style={{ display: 'inline' }}>Contacts</span>
          </button>
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

      {/* Removed duplicate round Contacts icon; replaced with title-adjacent pill */}

      {/* Profile Button */}
      <button
        onClick={() => setShowProfileModal(true)}
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
          justifyContent: 'center'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        title="Profile Settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
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

      {/* Profile Modal */}
      <ProfileModal
        show={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        onAvatarUpdate={(newUrl) => {
          console.log('[chat] Avatar updated:', newUrl);
          if (onAvatarUpdate) {
            onAvatarUpdate(newUrl);
          }
          // Also update the displayed user avatar immediately
          user.avatarUrl = newUrl;
          setShowProfileModal(false);
        }}
      />
    </header>
  );
}
