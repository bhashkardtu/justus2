import React, { useState } from 'react';
import AudioMessage from './AudioMessage';
import ImageMessage from './ImageMessage';
import DocumentMessage from './DocumentMessage';
import CallMessage from './CallMessage';
import { fmtTime } from '../utils/format';

export default function ChatMessages({ messages, user, otherUser, onEdit, onDelete, onReply, onForward, colors }) {
  const [showOriginalMap, setShowOriginalMap] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  const longPressTimer = React.useRef(null);

  const toggleShowOriginal = (msgId) => {
    setShowOriginalMap(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const renderReplyTo = (replyTo, allMessages) => {
    if (!replyTo) return null;

    // Handle both populated (from backend) and id-only (temporary) replyTo
    let replyMessage = replyTo;
    
    // If replyTo is just an ID string, find the message in the list
    if (typeof replyTo === 'string') {
      replyMessage = allMessages.find(m => m.id === replyTo || m._id === replyTo);
      if (!replyMessage) return null;
    }
    
    // If replyTo doesn't have content but has an id, find it
    if (replyTo.id && !replyTo.content && !replyTo.type) {
      replyMessage = allMessages.find(m => m.id === replyTo.id || m._id === replyTo.id);
      if (!replyMessage) return null;
    }

    const getReplyContent = () => {
      switch (replyMessage.type) {
        case 'text':
          return replyMessage.content;
        case 'image':
          return '📷 Image';
        case 'audio':
          return '🎤 Voice message';
        case 'document':
          return `📄 ${replyMessage.metadata?.filename || 'Document'}`;
        case 'call':
          return '📞 Call';
        default:
          return replyMessage.content;
      }
    };

    return (
      <div style={{
        padding: '6px 10px',
        marginBottom: '6px',
        borderLeft: `3px solid ${colors.primary || '#3b82f6'}`,
        background: colors.replyBg || 'rgba(0,0,0,0.05)',
        borderRadius: '4px',
        fontSize: '0.8rem',
        cursor: 'pointer'
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Optional: Scroll to the replied message
      }}
      >
        <div style={{ 
          fontWeight: 600, 
          color: colors.primary || '#3b82f6',
          marginBottom: '2px',
          fontSize: '0.75rem'
        }}>
          {replyMessage.senderId === user.id ? 'You' : (otherUser?.displayName || otherUser?.username || 'User')}
        </div>
        <div style={{ 
          color: colors.replyText || 'rgba(0,0,0,0.6)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {getReplyContent()}
        </div>
      </div>
    );
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      message: msg
    });
  };

  const handleLongPressStart = (e, msg) => {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setContextMenu({
        x: touch.clientX,
        y: touch.clientY,
        message: msg,
        isMobile: true
      });
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  React.useEffect(() => {
    if (contextMenu) {
      const handler = () => closeContextMenu();
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [contextMenu]);

  return (
    <>
      {messages.map((msg, idx) => {
        const isOwn = msg.senderId === user.id;
        
        // Special styling for call logs
        if (msg.type === 'call') {
          return (
            <div key={msg.id || idx} style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              margin: '8px 0'
            }}>
              <CallMessage message={msg} isOwn={isOwn} />
              <div style={{ fontSize: '0.7rem', color: colors.timestamp, marginTop: '2px' }}>
                {fmtTime(msg.timestamp || msg.createdAt)}
              </div>
            </div>
          );
        }
        
        const bubbleStyle = isOwn 
          ? { background: colors.bubbleOut, color: colors.bubbleOutText, borderRadius: '8px 0 8px 8px', padding: '10px 14px', maxWidth: '70%', boxShadow: '0 1px 1px rgba(0,0,0,0.1)', position: 'relative' }
          : { background: colors.bubbleIn, color: colors.bubbleInText, borderRadius: '0 8px 8px 8px', padding: '10px 14px', maxWidth: '70%', boxShadow: '0 1px 1px rgba(0,0,0,0.1)', position: 'relative' };
        
        return (
          <div 
            key={msg.id || idx} 
            style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: isOwn ? 'flex-end' : 'flex-start',
              position: 'relative',
              marginBottom: '2px'
            }}
          >
            <div 
              onContextMenu={(e) => handleContextMenu(e, msg)}
              onTouchStart={(e) => handleLongPressStart(e, msg)}
              onTouchEnd={handleLongPressEnd}
              onTouchMove={handleLongPressEnd}
              style={bubbleStyle}
            >
              {msg.replyTo && renderReplyTo(msg.replyTo, messages)}
              {msg.type === 'text' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                   {msg.translatedText && !isOwn ? (
                     <>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '2px' }}>
                         <span style={{ fontSize: '10px', opacity: 0.8, fontWeight: 'bold', textTransform: 'uppercase' }}>
                           {showOriginalMap[msg.id] ? 'Original' : 'Translated'}
                         </span>
                         <button 
                           onClick={(e) => { e.stopPropagation(); toggleShowOriginal(msg.id); }}
                           style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', fontSize: '10px', cursor: 'pointer', padding: 0, opacity: 0.8 }}
                         >
                           {showOriginalMap[msg.id] ? 'Show Translation' : 'Show Original'}
                         </button>
                       </div>
                       <span style={{ whiteSpace: 'pre-line' }}>
                         {showOriginalMap[msg.id] ? msg.content : msg.translatedText}
                       </span>
                     </>
                   ) : (
                     <span style={{ whiteSpace: 'pre-line' }}>{msg.content}</span>
                   )}
                </div>
              )}
              {msg.type === 'image' && <ImageMessage message={msg} />}
              {msg.type === 'audio' && <AudioMessage message={msg} />}
              {msg.type === 'document' && <DocumentMessage message={msg} />}
              {/* Mobile: Arrow-down button to open context menu */}
              {isOwn && (
                <span
                  className="mobile-context-arrow"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.08)',
                    position: 'absolute',
                    left: '-34px',
                    right: 'auto',
                    top: 8,
                    zIndex: 2,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    border: 'none',
                    fontSize: 18,
                    color: colors.timestamp || '#888',
                    visibility: 'hidden',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenu({
                      x: e.currentTarget.getBoundingClientRect().left,
                      y: e.currentTarget.getBoundingClientRect().top,
                      message: msg,
                      isMobile: true
                    });
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </span>
              )}
              <div
                className={
                  isOwn
                    ? 'chat-bubble chat-bubble-own' // sender styling
                    : 'chat-bubble chat-bubble-other' // receiver styling
                }
                style={bubbleStyle}
              >
                {msg.text}
              </div>
              {!isOwn && (
                <span
                  className="mobile-context-arrow"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.08)',
                    position: 'absolute',
                    left: 'auto',
                    right: '-34px',
                    top: 8,
                    zIndex: 2,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    border: 'none',
                    fontSize: 18,
                    color: colors.timestamp || '#888',
                    visibility: 'hidden',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenu({
                      x: e.currentTarget.getBoundingClientRect().right,
                      y: e.currentTarget.getBoundingClientRect().top,
                      message: msg,
                      isMobile: true
                    });
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.75rem', color: colors.timestamp, marginTop: '2px', textAlign: isOwn ? 'right' : 'left' }}>
              {fmtTime(msg.timestamp || msg.createdAt)}
              {isOwn && msg.read && <span style={{ marginLeft: '8px', color: '#22c55e' }}>✓✓</span>}
              {msg.temporary && <span style={{ marginLeft: '8px', color: '#eab308' }}>sending...</span>}
            </div>
            {/* Show arrow only on mobile via CSS */}
            <style>{`
              @media (max-width: 600px) {
                .mobile-context-arrow {
                  visibility: visible !important;
                }
              }
            `}</style>
          </div>
        );
      })}

      {/* Context Menu - Modern, positioned left/right of bubble, not blocking */}
      {contextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: contextMenu.isMobile ? 'rgba(0,0,0,0.5)' : 'transparent',
              zIndex: 999
            }}
            onClick={closeContextMenu}
          />
          <div
            style={{
              position: 'fixed',
              top: (contextMenu.y - 75 - (contextMenu.isMobile ? 0 : 120)),
              left: contextMenu.message.senderId === user.id
                ? (contextMenu.x - 270) // sender: menu to left
                : (contextMenu.x + 40), // receiver: menu to right
              borderRadius: '8px',
              minWidth: '200px',
              background: colors.chatBg || '#222',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 1000,
              overflow: 'hidden',
              color: colors.inputText || '#fff',
              fontSize: '15px',
              transition: 'top 0.15s, left 0.15s'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Menu items with icons */}
            <div style={{ padding: '8px 0' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', cursor: 'pointer', borderBottom: `1px solid ${colors.inputBorder || '#333'}` }}
                onClick={() => { onReply(contextMenu.message); closeContextMenu(); }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                Reply
              </div>
              {contextMenu.message.senderId === user.id && contextMenu.message.type === 'text' && (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', cursor: 'pointer', borderBottom: `1px solid ${colors.inputBorder || '#333'}` }}
                  onClick={() => { onEdit(contextMenu.message); closeContextMenu(); }}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  Edit
                </div>
              )}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', cursor: 'pointer', borderBottom: `1px solid ${colors.inputBorder || '#333'}` }}
                onClick={() => { onForward(contextMenu.message); closeContextMenu(); }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                Forward
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', cursor: 'pointer', color: '#ef4444' }}
                onClick={() => { onDelete(contextMenu.message); closeContextMenu(); }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                {contextMenu.message.senderId === user.id ? 'Delete for everyone' : 'Delete for me'}
              </div>
            </div>
            {contextMenu.isMobile && (
              <div
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderTop: `1px solid ${colors.inputBorder || '#333'}`,
                  color: colors.inputText || '#fff',
                  fontSize: '15px',
                  fontWeight: 600,
                  textAlign: 'center'
                }}
                onClick={closeContextMenu}
              >
                Cancel
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
