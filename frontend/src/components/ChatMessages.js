import React from 'react';
import AudioMessage from './AudioMessage';
import ImageMessage from './ImageMessage';
import DocumentMessage from './DocumentMessage';
import CallMessage from './CallMessage';
import { fmtTime } from '../utils/format';

export default function ChatMessages({ messages, user, otherUser, onEdit, onDelete, colors }) {
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
          ? { alignSelf: 'flex-end', background: colors.bubbleOut, color: colors.bubbleOutText, borderRadius: '8px 0 8px 8px', padding: '10px 14px', maxWidth: '70%', marginBottom: '2px', boxShadow: '0 1px 1px rgba(0,0,0,0.1)' }
          : { alignSelf: 'flex-start', background: colors.bubbleIn, color: colors.bubbleInText, borderRadius: '0 8px 8px 8px', padding: '10px 14px', maxWidth: '70%', marginBottom: '2px', boxShadow: '0 1px 1px rgba(0,0,0,0.1)' };
        return (
          <div key={msg.id || idx} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={bubbleStyle}>
              {msg.type === 'text' && <span>{msg.content}</span>}
              {msg.type === 'image' && <ImageMessage message={msg} />}
              {msg.type === 'audio' && <AudioMessage message={msg} />}
              {msg.type === 'document' && <DocumentMessage message={msg} />}
            </div>
            <div style={{ fontSize: '0.75rem', color: colors.timestamp, marginTop: '2px', textAlign: isOwn ? 'right' : 'left' }}>
              {fmtTime(msg.timestamp || msg.createdAt)}
              {isOwn && msg.read && <span style={{ marginLeft: '8px', color: '#22c55e' }}>✓✓</span>}
              {msg.temporary && <span style={{ marginLeft: '8px', color: '#eab308' }}>sending...</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}
