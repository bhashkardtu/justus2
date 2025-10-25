import React from 'react';

export default function TypingIndicator({ typingUser, colors }) {
  if (!typingUser) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
      <div style={{ background: colors?.bubbleIn || '#dcf8c6', borderRadius: '12px', padding: '8px 12px', display: 'flex', gap: '4px' }}>
        <div style={{ width: '8px', height: '8px', background: colors?.timestamp || '#999', borderRadius: '50%', animation: 'bounce 1.4s infinite' }}></div>
        <div style={{ width: '8px', height: '8px', background: colors?.timestamp || '#999', borderRadius: '50%', animation: 'bounce 1.4s infinite', animationDelay: '0.2s' }}></div>
        <div style={{ width: '8px', height: '8px', background: colors?.timestamp || '#999', borderRadius: '50%', animation: 'bounce 1.4s infinite', animationDelay: '0.4s' }}></div>
      </div>
    </div>
  );
}
