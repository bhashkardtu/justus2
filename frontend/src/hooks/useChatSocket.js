import { useCallback, useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket, getConnectionStatus, sendSocketMessage } from '../services/socket';

export default function useChatSocket({
  token,
  userId,
  availableUsers,
  setMessages,
  setTypingUser,
  setConnectionStatus,
  setReconnectAttempts,
  isReconnecting,
  setIsReconnecting,
  connectedRef,
  typingTimeoutRef,
  onUserStatusChange
}) {
  const healthIntervalRef = useRef(null);

  const handleWebSocketMessage = useCallback((message) => {
    if (message && message.type && message.type.startsWith('system:')) return;

    // Read receipts
    if (message.type === 'MESSAGE_READ') {
      setMessages(prev => prev.map(msg =>
        msg.id === message.message.id ? { ...msg, read: true, readAt: message.message.readAt } : msg
      ));
      return;
    }

    // Deletion
    if (message.type === 'MESSAGE_DELETED' || message.type === 'delete') {
      const messageIdToDelete = message.messageId || message.id;
      setMessages(prev => prev.filter(msg => msg.id !== messageIdToDelete));
      return;
    }

    // Typing indicator
    if (message.type === 'typing') {
      if (message.senderId !== userId) {
        const sender = availableUsers.find(u => u.id === message.senderId);
        setTypingUser(sender ? (sender.displayName || sender.username) : 'Someone');
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
      }
      return;
    }

    // Real messages
    if (message.id && !message.temporary) {
      console.log('[Frontend] Received Socket Message:', {
        id: message.id,
        type: message.type,
        content: message.content,
        translatedText: message.translatedText,
        translatedLanguage: message.translatedLanguage,
        originalLanguage: message.originalLanguage
      });

      setMessages(prev => {
        const filtered = prev.filter(msg => {
          if (!msg.temporary) return true;

          // Match by Nonce (Best for Encrypted/E2EE)
          if (msg.encryptionNonce && message.encryptionNonce && msg.encryptionNonce === message.encryptionNonce) {
            console.log('[Frontend] Matched temp message by Nonce:', msg.id);
            return false;
          }

          // Match by Content (Fallback for Plaintext)
          if (!msg.encryptionNonce && msg.type === message.type && msg.content === message.content && msg.senderId === message.senderId) {
            console.log('[Frontend] Matched temp message by Content:', msg.id);
            return false;
          }
          return true;
        });
        return [...filtered, message].sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt));
      });
    }
  }, [userId, availableUsers, setMessages, setTypingUser, typingTimeoutRef]);

  const reconnectWebSocket = useCallback(async () => {
    if (isReconnecting) return;
    const maxRetries = 5;
    const baseDelay = 1000;
    const maxDelay = 30000;
    setIsReconnecting(true);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        setReconnectAttempts(attempt + 1);
        setConnectionStatus('connecting');
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
          connectSocket(token,
            (message) => handleWebSocketMessage(message),
            () => {
              clearTimeout(timeout);
              resolve();
              connectedRef.current = true;
              setConnectionStatus('connected');
            },
            {
              onDeleted: (deletedMessage) => {
                const messageIdToDelete = deletedMessage.id;
                setMessages(prev => prev.filter(msg => msg.id !== messageIdToDelete));
              },
              onEdited: (editedMessage) => {
                setMessages(prev => prev.map(msg => msg.id === editedMessage.id ? { ...msg, content: editedMessage.content } : msg));
              },
              onUpdated: (updatedMessage) => {
                console.log('[Frontend] Message Updated (Translation):', updatedMessage.id);
                setMessages(prev => prev.map(msg => msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg));
              },
              onUserStatus: (statusData) => {
                if (onUserStatusChange) {
                  onUserStatusChange(statusData);
                }
              },
              onConnectionLost: () => {
                connectedRef.current = false;
                setConnectionStatus('disconnected');
                setTimeout(() => { if (!connectedRef.current) reconnectWebSocket(); }, 2000);
              }
            }
          );
        });
        setReconnectAttempts(0);
        setIsReconnecting(false);
        return;
      } catch (err) {
        if (attempt < maxRetries - 1) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          await new Promise(res => setTimeout(res, delay));
        }
      }
    }
    setIsReconnecting(false);
    setConnectionStatus('disconnected');
  }, [token, isReconnecting, setIsReconnecting, setReconnectAttempts, setConnectionStatus, connectedRef, handleWebSocketMessage, setMessages]);

  useEffect(() => {
    if (!token) return;

    // Connect once when token changes
    reconnectWebSocket();

    // Health check - but don't include reconnectWebSocket in the interval to avoid loops
    healthIntervalRef.current = setInterval(() => {
      const currentStatus = getConnectionStatus();
      if (currentStatus !== 'connected') {
        setConnectionStatus('reconnecting');
        // Don't call reconnectWebSocket here - it will cause infinite loops
        // The onConnectionLost handler in connectSocket already handles reconnection
      } else {
        setConnectionStatus('connected');
      }
    }, 15000);

    return () => {
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
      try { disconnectSocket(); } catch { }
      clearTimeout(typingTimeoutRef.current);
    };
  }, [token]);

  const onTyping = useCallback((otherUserId, conversationId, lastTypingTimeRef, setLastTypingTime) => {
    const now = Date.now();
    if (now - lastTypingTimeRef.current > 1000) {
      lastTypingTimeRef.current = now;
      setLastTypingTime(now);
      sendSocketMessage({ receiverId: otherUserId || 'other', type: 'typing', content: '', conversationId });
    }
  }, []);

  return { onTyping };
}
