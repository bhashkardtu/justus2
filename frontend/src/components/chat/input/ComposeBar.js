import React, { useState, useEffect } from 'react';
import ReplyPreview from './ReplyPreview';
import BotActivation from './BotActivation';

export default function ComposeBar({
  text,
  setText,
  onTyping,
  otherUser,
  uploading,
  uploadImage,
  recording,
  startRecording,
  stopRecording,
  sending,
  editingMessage,
  cancelEdit,
  replyingTo,
  cancelReply,
  send,
  connectionStatus,
  colors,
  currentUserId
}) {
  const [isBotActive, setIsBotActive] = useState(false);

  // Check if bot mode is active
  useEffect(() => {
    const botTriggered = text.trim().startsWith('@#');
    setIsBotActive(botTriggered);
  }, [text]);

  const handleBotDeactivate = () => {
    setText('');
    setIsBotActive(false);
  };

  return (
    <form onSubmit={send} style={{ background: colors.inputBg, borderTop: `1px solid ${colors.inputBorder}`, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Bot Activation Indicator */}
      <BotActivation isActive={isBotActive} onDeactivate={handleBotDeactivate} />

      {/* Reply Preview */}
      {replyingTo && (
        <ReplyPreview
          replyToMessage={{
            ...replyingTo,
            currentUserId,
            senderName: replyingTo.senderId === currentUserId ? 'You' : (otherUser?.displayName || otherUser?.username || 'User')
          }}
          onCancel={cancelReply}
          colors={colors}
        />
      )}

      {/* Edit Preview */}
      {editingMessage && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: '8px', background: '#fef3c7', color: '#92400e', fontSize: '0.75rem', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10, borderRadius: '8px 8px 0 0' }}>
          <span>Editing message</span>
          <button type="button" style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} onClick={cancelEdit}>Cancel</button>
        </div>
      )}

      {/* Input Bar */}
      <div style={{ padding: '10px 8px', display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1.5vw, 8px)' }}>
        <button
          type="button"
          style={{ padding: 'clamp(6px, 2vw, 8px)', borderRadius: '50%', background: 'none', border: 'none', color: colors.inputText, cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.background = colors.inputBorder}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
          onClick={uploadImage}
          disabled={uploading || sending || !otherUser}
          title="Attach image or PDF"
        >
          {uploading ? (
            <div style={{ width: '24px', height: '24px', border: '2px solid #9ca3af', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '24px', height: '24px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          )}
        </button>

        <input
          style={{ flex: 1, minWidth: 0, border: 'none', background: colors.inputBg, color: colors.inputText, padding: 'clamp(6px, 2vw, 8px) clamp(8px, 2.5vw, 12px)', borderRadius: '20px', fontSize: 'clamp(0.875rem, 4vw, 1rem)', outline: 'none' }}
          type="text"
          placeholder={otherUser ? `Message ${otherUser.displayName || otherUser.username}` : 'Type a message...'}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }}
          onInput={onTyping}
          disabled={sending || uploading || !otherUser}
          autoFocus={typeof window !== 'undefined' && window.innerWidth > 768}
        />

        <button
          type="button"
          style={{ padding: 'clamp(6px, 2vw, 8px)', borderRadius: '50%', background: recording ? '#ef4444' : 'none', border: 'none', color: recording ? '#fff' : colors.inputText, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
          onMouseEnter={e => { if (!recording) e.currentTarget.style.background = colors.inputBorder; }}
          onMouseLeave={e => { if (!recording) e.currentTarget.style.background = 'none'; }}
          onClick={recording ? stopRecording : startRecording}
          disabled={sending || uploading || !otherUser}
          title={recording ? 'Stop recording' : 'Record voice message'}
        >
          {recording ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" style={{ width: '24px', height: '24px' }}>
              <circle cx="12" cy="12" r="8" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '24px', height: '24px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        <button
          type="submit"
          style={{ background: colors.sendBtn, color: '#fff', border: 'none', borderRadius: '50%', width: 'clamp(36px, 11vw, 44px)', height: 'clamp(36px, 11vw, 44px)', minWidth: '36px', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.background = colors.sendBtn === '#00a884' ? '#008f6f' : '#20ba5a'}
          onMouseLeave={e => e.currentTarget.style.background = colors.sendBtn}
          disabled={sending || uploading || !text.trim() || !otherUser}
          title={connectionStatus !== 'connected' ? 'Offline - will send when reconnected' : 'Send'}
        >
          {sending ? (
            <div style={{ width: '24px', height: '24px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '24px', height: '24px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </div>

      {connectionStatus !== 'connected' && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: '4px', padding: '8px 12px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '0 0 8px 8px', fontSize: '0.75rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', background: '#fbbf24', borderRadius: '50%', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
          <span>{connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline - messages will be sent when connection is restored'}</span>
        </div>
      )}
    </form>
  );
}
