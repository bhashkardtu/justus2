import React, { useState } from 'react';
import AudioMessage from './AudioMessage';
import ImageMessage from './ImageMessage';
import DocumentMessage from './DocumentMessage';
import CallMessage from './CallMessage';
import { fmtTime } from '../utils/format';

export default function ChatMessages({ messages, user, otherUser, onEdit, onDelete, onReply, colors }) {
  const [showMenu, setShowMenu] = useState(null); // { messageId, x, y }
  const [hoveredMessage, setHoveredMessage] = useState(null);

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

  const handleMenuToggle = (e, msg) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setShowMenu({
      messageId: msg.id || msg._id,
      x: rect.left,
      y: rect.bottom + 5,
      message: msg
    });
  };

  const handleCloseMenu = () => {
    setShowMenu(null);
  };

  // Close menu when clicking anywhere
  React.useEffect(() => {
    if (showMenu) {
      const handler = () => handleCloseMenu();
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [showMenu]);

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
          ? { alignSelf: 'flex-end', background: colors.bubbleOut, color: colors.bubbleOutText, borderRadius: '8px 0 8px 8px', padding: '10px 14px', maxWidth: '70%', marginBottom: '2px', boxShadow: '0 1px 1px rgba(0,0,0,0.1)', position: 'relative' }
          : { alignSelf: 'flex-start', background: colors.bubbleIn, color: colors.bubbleInText, borderRadius: '0 8px 8px 8px', padding: '10px 14px', maxWidth: '70%', marginBottom: '2px', boxShadow: '0 1px 1px rgba(0,0,0,0.1)', position: 'relative' };
        
        return (
          <div 
            key={msg.id || idx} 
            style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
            onMouseEnter={() => setHoveredMessage(msg.id || msg._id)}
            onMouseLeave={() => setHoveredMessage(null)}
          >
            <div 
              style={bubbleStyle}
            >
              {msg.replyTo && renderReplyTo(msg.replyTo, messages)}
              {msg.type === 'text' && <span>{msg.content}</span>}
              {msg.type === 'image' && <ImageMessage message={msg} />}
              {msg.type === 'audio' && <AudioMessage message={msg} />}
              {msg.type === 'document' && <DocumentMessage message={msg} />}
            </div>

            {/* Dropdown Menu Button - appears on hover */}
            {hoveredMessage === (msg.id || msg._id) && (
              <button
                onClick={(e) => handleMenuToggle(e, msg)}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: isOwn ? '4px' : 'auto',
                  left: isOwn ? 'auto' : '4px',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: 0,
                  zIndex: 10,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}
                title="Message options"
              >
                ⋮
              </button>
            )}

            <div style={{ fontSize: '0.75rem', color: colors.timestamp, marginTop: '2px', textAlign: isOwn ? 'right' : 'left' }}>
              {fmtTime(msg.timestamp || msg.createdAt)}
              {isOwn && msg.read && <span style={{ marginLeft: '8px', color: '#22c55e' }}>✓✓</span>}
              {msg.temporary && <span style={{ marginLeft: '8px', color: '#eab308' }}>sending...</span>}
            </div>
          </div>
        );
      })}

      {/* Context Menu */}
      {showMenu && (
        <div
          style={{
            position: 'fixed',
            top: showMenu.y,
            left: showMenu.x,
            background: colors.chatBg || '#fff',
            border: `1px solid ${colors.inputBorder || '#ddd'}`,
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '150px',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Reply Option */}
          <div
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              background: 'transparent',
              borderBottom: `1px solid ${colors.inputBorder || '#eee'}`,
              color: colors.inputText || '#222',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = colors.inputBg || '#f5f5f5'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            onClick={() => {
              if (onReply) onReply(showMenu.message);
              handleCloseMenu();
            }}
          >
            💬 Reply
          </div>

          {/* Edit Option (only for own text messages) */}
          {showMenu.message.senderId === user.id && showMenu.message.type === 'text' && (
            <div
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                background: 'transparent',
                borderBottom: `1px solid ${colors.inputBorder || '#eee'}`,
                color: colors.inputText || '#222',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = colors.inputBg || '#f5f5f5'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
              onClick={() => {
                if (onEdit) onEdit(showMenu.message);
                handleCloseMenu();
              }}
            >
              ✏️ Edit
            </div>
          )}

          {/* Delete Option (only for own messages) */}
          {showMenu.message.senderId === user.id && (
            <div
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                background: 'transparent',
                color: '#ef4444',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = colors.inputBg || '#f5f5f5'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
              onClick={() => {
                if (onDelete) {
                  onDelete(showMenu.message);
                }
                handleCloseMenu();
              }}
            >
              🗑️ Delete
            </div>
          )}
        </div>
      )}
    </>
  );
}
