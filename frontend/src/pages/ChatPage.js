import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sendSocketMessage, getConnectionStatus, getSocket, exchangePublicKey, getPublicKey } from '../services/socket';
import { setAuthToken, getAuthenticatedApi } from '../services/api';
import ChatHeader from '../components/ChatHeader';
import ChatMessages from '../components/ChatMessages';
import TypingIndicator from '../components/TypingIndicator';
import ScrollToBottomButton from '../components/ScrollToBottomButton';
import ComposeBar from '../components/ComposeBar';
import UserSelectModal from '../components/UserSelectModal';
import VoiceCallModal from '../components/VoiceCallModal';
import VideoCallModal from '../components/VideoCallModal';
import SmartSearch from '../components/SmartSearch';
import useChatSocket from '../hooks/useChatSocket';
import useReadReceipts from '../hooks/useReadReceipts';
import useImageUpload from '../hooks/useImageUpload';
import useVoiceMessage from '../hooks/useVoiceMessage';
import useVoiceCall from '../hooks/useVoiceCall';
import useVideoCall from '../hooks/useVideoCall';
import useEncryption from '../hooks/useEncryption';
import { forwardMessage } from '../services/chat';

//

export default function ChatPage({ user, onLogout, onUserUpdate }){
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [otherUserId, setOtherUserId] = useState(localStorage.getItem('otherUserId') || '');
  const [otherUser, setOtherUser] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [showOtherUserModal, setShowOtherUserModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  // Theme (light / dark) - sync from localStorage
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [loading, setLoading] = useState(true);

  // E2EE encryption hook
  const encryption = useEncryption();

  // Listen for theme changes from localStorage (from App.js toggle)
  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(localStorage.getItem('theme') || 'light');
    };
    
    // Check for theme changes periodically
    const interval = setInterval(handleThemeChange, 100);
    
    return () => clearInterval(interval);
  }, []);

  // Image upload via hook
  const { uploading, uploadImage } = useImageUpload({
    userId: user.id,
    otherUserId: otherUserId || localStorage.getItem('otherUserId'),
    conversationId,
    setMessages
  });
  const [lastTypingTime, setLastTypingTime] = useState(0);
  const [sending, setSending] = useState(false);
  const [prevMessagesLength, setPrevMessagesLength] = useState(0);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleAvatarUpdate = (newUrl) => {
    if (onUserUpdate) {
      onUserUpdate({ avatarUrl: newUrl });
    }
  };
  
  const connectedRef = useRef(false);
  const audioStreamRef = useRef(null); // kept for cleanup compatibility (managed inside hook too)
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const chatContainerRef = useRef(null);
  const sendingRef = useRef(false);
  const cleanupTimeoutsRef = useRef(new Set());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Check if user is near bottom of chat
  const isNearBottom = () => {
    if (!chatContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100; // Within 100px of bottom
  };

  // Handle scroll events to detect when user scrolls up
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const isNear = isNearBottom();
    setUserScrolledUp(!isNear);
  };

  // WebSocket connection, reconnection, and typing via hook
  const lastTypingTimeRef = useRef(0);
  
  // Wrapper for setMessages to handle decryption of encrypted messages
  const setMessagesWithDecryption = useCallback((updater) => {
    setMessages(prevMessages => {
      const newMessages = typeof updater === 'function' ? updater(prevMessages) : updater;
      
      // Decrypt any encrypted messages
      return Array.isArray(newMessages) 
        ? newMessages.map(msg => {
            // If message has ciphertext and nonce, try to decrypt
            if (msg.ciphertext && msg.encryptionNonce && msg.senderId) {
              try {
                const keyPair = encryption.getKeyPair();
                const senderPublicKey = encryption.getPublicKeyForUser(msg.senderId);
                
                if (senderPublicKey && keyPair) {
                  const decrypted = encryption.decryptMessage(
                    msg.ciphertext,
                    msg.encryptionNonce,
                    senderPublicKey
                  );
                  if (decrypted) {
                    console.log('Decrypted message:', msg.id);
                    return {
                      ...msg,
                      content: decrypted,
                      ciphertext: undefined,
                      encryptionNonce: undefined,
                      isDecrypted: true
                    };
                  }
                } else {
                  console.warn('Cannot decrypt message - missing keys for sender:', msg.senderId);
                }
              } catch (error) {
                console.error('Failed to decrypt message:', error);
                // Keep original encrypted message
              }
            }
            return msg;
          })
        : newMessages;
    });
  }, [encryption]);
  
  const { onTyping: onTypingHook } = useChatSocket({
    token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
    userId: user.id,
    availableUsers,
    setMessages: setMessagesWithDecryption,
    setTypingUser,
    setConnectionStatus,
    setReconnectAttempts,
    isReconnecting,
    setIsReconnecting,
    connectedRef,
    typingTimeoutRef,
    onUserStatusChange: (statusData) => {
      if (statusData.userId === otherUserId) {
        setOtherUserOnline(statusData.status === 'online');
      }
    }
  });

  // Handle call end - create call log message
  const handleCallEnd = useCallback((duration, callType = 'voice') => {
    const formatDuration = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (mins > 0) {
        return `${mins}m ${secs}s`;
      }
      return `${secs}s`;
    };

    const callLabel = callType === 'video' ? 'Video call' : 'Voice call';
    const callLogMessage = {
      id: `call-log-${callType}-` + Date.now(),
      type: 'call',
      content: `${callLabel} • ${formatDuration(duration)}`,
      senderId: user.id,
      receiverId: otherUserId,
      conversationId,
      timestamp: new Date().toISOString(),
      metadata: { duration, callType }
    };

    setMessages(prev => [...prev, callLogMessage]);

    // Save to backend
    const authenticatedApi = getAuthenticatedApi();
    authenticatedApi.post('/api/chat/messages', {
      type: 'call',
      content: `${callLabel} • ${formatDuration(duration)}`,
      receiverId: otherUserId,
      conversationId,
      metadata: { duration, callType }
    }).catch(error => {
      console.error('Failed to save call log:', error);
    });
  }, [user.id, otherUserId, conversationId]);

  // Voice call hook
  const {
    callState: voiceCallState,
    incomingCall: incomingVoiceCall,
    callDuration: voiceCallDuration,
    startCall: startVoiceCall,
    answerCall: answerVoiceCall,
    rejectCall: rejectVoiceCall,
    endCall: endVoiceCall,
    localStreamRef: voiceLocalStreamRef,
    remoteStreamRef: voiceRemoteStreamRef
  } = useVoiceCall({
    socket: getSocket(),
    userId: user.id,
    otherUserId: otherUserId,
    otherUser: otherUser,
    onCallEnd: (duration) => handleCallEnd(duration, 'voice')
  });

  // Video call hook
  const {
    callState: videoCallState,
    incomingCall: incomingVideoCall,
    callDuration: videoCallDuration,
    isMuted,
    isVideoOff,
    startCall: startVideoCall,
    answerCall: answerVideoCall,
    rejectCall: rejectVideoCall,
    endCall: endVideoCall,
    toggleMute,
    toggleVideo,
    localStreamRef: videoLocalStreamRef,
    remoteStreamRef: videoRemoteStreamRef
  } = useVideoCall({
    socket: getSocket(),
    userId: user.id,
    otherUserId: otherUserId,
    otherUser: otherUser,
    onCallEnd: (duration) => handleCallEnd(duration, 'video')
  });

  // Smart scroll behavior - only scroll to bottom when appropriate
  useEffect(() => {
    const currentLength = messages.length;
    const wasAtBottom = !userScrolledUp;
    
    // Scroll to bottom only if:
    // 1. New message was added (not just array change)
    // 2. User was already near bottom
    // 3. Or it's the initial load
    if (currentLength > prevMessagesLength && (wasAtBottom || prevMessagesLength === 0)) {
      scrollToBottom();
    }
    
    setPrevMessagesLength(currentLength);
  }, [messages, userScrolledUp, prevMessagesLength]);

  useEffect(()=>{
    // apply saved theme on mount
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
    // persist
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const initializeChat = async () => {
      try {
        const token = localStorage.getItem('token');
        console.log('Token from localStorage:', token ? 'present' : 'missing');
        if (!token) {
          console.error('No token found in localStorage');
          setLoading(false);
          return;
        }

        // Set auth token for API requests
        setAuthToken(token);
        
        // Fetch available users
        const authenticatedApi = getAuthenticatedApi();
        const usersRes = await authenticatedApi.get('/api/auth/users');
        const users = usersRes.data;
        console.log('Users response:', users);
        setAvailableUsers(users);
        // Always use deterministic user IDs for conversation
        let otherId = otherUserId;

        if (!otherId) {
          // Default to System first so invite code is visible, otherwise first non-self contact
          const systemUser = users.find(u => u.id === '000000000000000000000000');
          const firstContact = users.find(u => u.id !== user.id && u.id !== '000000000000000000000000');
          const pick = systemUser || firstContact;
          if (pick) {
            otherId = pick.id;
            setOtherUserId(otherId);
            setOtherUser(pick);
            localStorage.setItem('otherUserId', otherId);
          }
        } else {
          const found = users.find(u => u.id === otherId);
          setOtherUser(found || null);
        }
        
        // Always use the same conversation for the same user pair
        if (otherId) {
          try {
            console.log('Creating/getting conversation with other user:', otherId);
            console.log('Current user ID:', user.id);
            
            // Validate that otherId exists
            if (!otherId || otherId === 'undefined' || otherId === 'null') {
              console.error('Invalid otherId:', otherId);
              throw new Error('Invalid other user ID');
            }
            
            // Use the getAuthenticatedApi to ensure the token is included in this specific request
            const authenticatedApi = getAuthenticatedApi();
            console.log('Authorization header for conversation request:', 
              authenticatedApi.defaults.headers.common['Authorization'] || 'none');
            console.log('Using other user ID:', otherId);
            const conv = await authenticatedApi.post('/api/chat/conversation?other=' + otherId);
            console.log('Conversation response:', conv.data);
            
            // Use _id from MongoDB response
            const conversationId = conv.data._id || conv.data.id;
            setConversationId(conversationId);
            console.log('Loading messages for conversation:', conversationId);
            const res = await authenticatedApi.get('/api/chat/messages?conversationId=' + conversationId);
            console.log('Messages response:', res.data);
            // Use wrapper to decrypt messages on initial load
            setMessagesWithDecryption(res.data);
            // Mark messages as read when conversation is loaded
            markMessagesAsRead(conversationId);
          } catch (error) {
            console.error('Error creating/getting conversation:', error);
            if (error.response) {
              console.error('Response status:', error.response.status);
              console.error('Response data:', error.response.data);
              
              // Show user-friendly error message
              const errorMessage = error.response.data?.message || error.message;
              alert(`Failed to load conversation: ${errorMessage}`);
            } else {
              alert(`Failed to load conversation: ${error.message}`);
            }
          }
        } else {
          console.warn('No other user ID available - cannot create conversation');
        }
        setLoading(false);
      } catch (e) {
        console.error('conversation load failed', e);
        if (e.response) {
          console.error('Response status:', e.response.status);
          console.error('Response data:', e.response.data);
        }
        alert(`Failed to load conversation: ${e.message || 'Unknown error'}`);
        setLoading(false);
      }
    };

    initializeChat();
    let cleanupIntervalId;
    
    // Exchange public key with server for E2EE after connection
    const keyExchangeTimeout = setTimeout(() => {
      if (encryption.getKeyPair()) {
        encryption.exchangeKey();
        console.log('Public key exchanged with server');
      }
    }, 500);
    
    // Setup periodic cleanup of old temporary messages
    cleanupIntervalId = setInterval(() => {
      setMessages(prev => prev.map(msg => {
        if (msg.temporary && msg.timestamp) {
          const messageAge = Date.now() - new Date(msg.timestamp).getTime();
          if (messageAge > 15000) { return { ...msg, temporary: false }; }
        }
        return msg;
      }));
    }, 5000);
    return () => { if (cleanupIntervalId) clearInterval(cleanupIntervalId); };
  }, []);

  // Read receipts via hook
  const { markMessagesAsRead } = useReadReceipts(conversationId, messages);

  // Comprehensive cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('ChatPage cleanup: Cleaning up resources');
      
      // Clear all timeouts
      cleanupTimeoutsRef.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      cleanupTimeoutsRef.current.clear();
      
      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Reset refs
      sendingRef.current = false;
      connectedRef.current = false;
      
      // WebSocket cleanup handled by useChatSocket hook
    };
  }, []);

  const send = async (e) => {
    e?.preventDefault();
    
    // Prevent race conditions with ref check
    if (!text.trim() || sendingRef.current || sending) return;
    
    sendingRef.current = true;
    setSending(true);
    
    const currentUserId = user.id;
    const targetUserId = otherUserId || localStorage.getItem('otherUserId');
    
    if (!targetUserId) {
      alert('No chat partner available. Please register another user first.');
      sendingRef.current = false;
      setSending(false);
      return;
    }
    
    if (editingMessage) {
      // For editing messages, try WebSocket first, then HTTP fallback
      const success = sendSocketMessage({ 
        id: editingMessage.id, 
        type: 'text', 
        content: text.trim(), 
        receiverId: targetUserId, 
        conversationId,
        senderId: currentUserId
      });
      
      if (!success) {
        // HTTP fallback for editing (if available in your backend)
        console.log('WebSocket edit failed, trying HTTP fallback');
        alert('Failed to edit message. WebSocket may be disconnected.');
      }
      
      setEditingMessage(null);
    } else {
      // Create a temporary message object for optimistic UI update
      const tempMessage = {
        id: 'temp-' + Date.now(), // Temporary ID
        type: 'text',
        content: text.trim(),
        senderId: currentUserId,
        receiverId: targetUserId,
        conversationId,
        timestamp: new Date().toISOString(),
        temporary: true, // Mark as temporary
        replyTo: replyingTo ? {
          id: replyingTo.id,
          senderId: replyingTo.senderId,
          type: replyingTo.type,
          content: replyingTo.content,
          metadata: replyingTo.metadata
        } : null
      };
      
      // Add message immediately to UI (optimistic update)
      setMessages(prev => [...prev, tempMessage]);
      
      // Always scroll to bottom when user sends a message
      setTimeout(() => {
        scrollToBottom();
        setUserScrolledUp(false);
      }, 100);
      
      // Get receiver's public key for encryption
      const receiverPublicKey = encryption.getPublicKeyForUser(targetUserId);
      let messageToSend;
      
      if (receiverPublicKey && encryption.getKeyPair()) {
        // Encrypt the message
        const encrypted = encryption.encryptMessage(text.trim(), receiverPublicKey);
        if (encrypted) {
          messageToSend = {
            receiverId: targetUserId,
            type: 'text',
            ciphertext: encrypted.ciphertext,
            nonce: encrypted.nonce,
            conversationId,
            senderId: currentUserId,
            replyTo: replyingTo?.id || null
          };
          console.log('Message encrypted with E2EE');
        } else {
          // Fallback to plaintext if encryption fails
          messageToSend = {
            receiverId: targetUserId,
            type: 'text',
            content: text.trim(),
            conversationId,
            senderId: currentUserId,
            replyTo: replyingTo?.id || null
          };
          console.warn('Encryption failed, sending as plaintext');
        }
      } else {
        // No public key or keypair available, send as plaintext
        messageToSend = {
          receiverId: targetUserId,
          type: 'text',
          content: text.trim(),
          conversationId,
          senderId: currentUserId,
          replyTo: replyingTo?.id || null
        };
        console.log('No encryption keys available, sending as plaintext');
      }
      
      // Try WebSocket first
      const wsSuccess = sendSocketMessage(messageToSend);
      
      // Set up automatic cleanup of temporary message after 10 seconds
      const cleanupTimeout = setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id && msg.temporary 
            ? { ...msg, temporary: false } // Remove temporary flag to hide "sending..."
            : msg
        ));
        cleanupTimeoutsRef.current.delete(cleanupTimeout);
      }, 10000);
      
      // Track timeout for cleanup
      cleanupTimeoutsRef.current.add(cleanupTimeout);
      
      if (!wsSuccess) {
        clearTimeout(cleanupTimeout);
        cleanupTimeoutsRef.current.delete(cleanupTimeout);
        
        // If WebSocket fails, try HTTP API fallback
        try {
          console.log('WebSocket send failed, trying HTTP API fallback');
          const authenticatedApi = getAuthenticatedApi();
          const message = {
            type: 'text',
            content: text.trim(),
            receiverId: targetUserId,
            conversationId
          };
          
          const response = await authenticatedApi.post('/api/chat/messages', message);
          console.log('Message sent successfully via HTTP API');
          
          // Replace temporary message with real message from server
          if (response.data) {
            setMessages(prev => prev.map(msg => 
              msg.id === tempMessage.id ? { ...response.data, temporary: false } : msg
            ));
          }
        } catch (apiError) {
          console.error('HTTP API fallback also failed:', apiError);
          // Remove the temporary message if both methods fail
          setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
          alert('Failed to send message. Please check your connection and try again.');
        }
      } else {
        console.log('Message sent successfully via WebSocket');
        // WebSocket success - the cleanup timeout will handle removing the temporary flag
      }
    }
    
    setText('');
    setReplyingTo(null); // Clear reply after sending
    sendingRef.current = false;
    setSending(false);
  };

  // uploadImage now provided by hook

  const { recording, startRecording, stopRecording } = useVoiceMessage({
    userId: user.id,
    otherUserId: otherUserId || localStorage.getItem('otherUserId'),
    conversationId,
    setMessages
  });

  const onEdit = (m) => { 
    setEditingMessage(m); 
    setText(m.content); 
  }

  const handleReply = (message) => {
    setReplyingTo(message);
    // Focus on input (optional)
  }

  const cancelReply = () => {
    setReplyingTo(null);
  }
  
  const onDelete = async (m) => { 
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }
    
    console.log('Deleting message:', m.id);
    
    // Try WebSocket first
    const success = sendSocketMessage({ 
      id: m.id, 
      type: 'delete', 
      conversationId,
      senderId: user.id
    });
    
    if (success) {
      console.log('Delete message sent via WebSocket - waiting for confirmation');
      
      // Set a timeout fallback in case WebSocket confirmation never comes
      setTimeout(() => {
        setMessages(prev => {
          const stillExists = prev.find(msg => msg.id === m.id);
          if (stillExists) {
            console.log('WebSocket delete confirmation timeout - falling back to optimistic deletion');
            return prev.filter(msg => msg.id !== m.id);
          }
          return prev;
        });
      }, 5000); // 5 second timeout
      
      return;
    }
    
    console.log('WebSocket delete failed, trying HTTP API fallback');
    
    try {
      // HTTP API fallback - with optimistic deletion
      const messageToDelete = m.id;
      setMessages(prev => prev.filter(msg => msg.id !== messageToDelete));
      
      const authenticatedApi = getAuthenticatedApi();
      await authenticatedApi.delete(`/api/chat/messages/${m.id}`);
      console.log('Message deleted successfully via HTTP API');
    } catch (error) {
      console.error('HTTP API delete also failed:', error);
      
      // Restore the message if HTTP API fails
      setMessages(prev => {
        // Check if message is already back (to avoid duplicates)
        if (prev.find(msg => msg.id === m.id)) {
          return prev;
        }
        // Add it back in the correct position based on timestamp
        const newMessages = [...prev, m];
        return newMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      });
      
      alert('Failed to delete message. Please check your connection and try again.');
    }
  }

  const onTyping = () => {
    onTypingHook(otherUserId || localStorage.getItem('otherUserId') || 'other', conversationId, lastTypingTimeRef, setLastTypingTime);
  };

  const selectOtherUser = (selectedUserId) => {
    if (!selectedUserId.trim()) return;
    const selectedUser = availableUsers.find(u => u.id === selectedUserId);
    setOtherUser(selectedUser);
    setOtherUserId(selectedUserId);
    localStorage.setItem('otherUserId', selectedUserId.trim());
    setShowOtherUserModal(false);
    window.location.reload();
  }

  const cancelEdit = () => {
    setEditingMessage(null);
    setText('');
  };

  if (loading) {
    const darkMode = theme === 'dark';
    return (
      <div style={{ minHeight: '100vh', background: darkMode ? '#0b141a' : 'linear-gradient(to bottom right, #eef2ff, #fff, #faf5ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 32px', position: 'relative' }}>
            <div style={{ animation: 'spin 1s linear infinite', borderRadius: '50%', height: '80px', width: '80px', border: '4px solid #e0e7ff' }}></div>
            <div style={{ animation: 'spin 1s linear infinite', borderRadius: '50%', height: '80px', width: '80px', border: '4px solid #4f46e5', borderTopColor: 'transparent', position: 'absolute', top: 0, left: 0 }}></div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: darkMode ? '#fff' : '#1f2937', marginBottom: '8px' }}>Loading Your Chat</h3>
          <p style={{ color: darkMode ? '#9ca3af' : '#4b5563' }}>Connecting to the conversation...</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '16px' }}>
            <div style={{ width: '8px', height: '8px', background: '#4f46e5', borderRadius: '50%', animation: 'bounce 1.4s infinite' }}></div>
            <div style={{ width: '8px', height: '8px', background: '#4f46e5', borderRadius: '50%', animation: 'bounce 1.4s infinite', animationDelay: '0.1s' }}></div>
            <div style={{ width: '8px', height: '8px', background: '#4f46e5', borderRadius: '50%', animation: 'bounce 1.4s infinite', animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  const darkMode = theme === 'dark';
  const colors = {
    bg: darkMode ? '#0b141a' : '#ece5dd',
    chatBg: darkMode ? '#0b141a' : '#fff',
    header: darkMode ? '#1f2c33' : '#075e54',
    headerText: darkMode ? '#e9edef' : '#fff',
    bubbleOut: darkMode ? '#005c4b' : '#fff',
    bubbleOutText: darkMode ? '#e9edef' : '#222',
    bubbleIn: darkMode ? '#1f2c33' : '#dcf8c6',
    bubbleInText: darkMode ? '#e9edef' : '#222',
    timestamp: darkMode ? '#8696a0' : '#999',
    inputBg: darkMode ? '#1f2c33' : '#f0f0f0',
    inputBorder: darkMode ? '#2a3942' : '#ddd',
    inputText: darkMode ? '#e9edef' : '#222',
    sendBtn: darkMode ? '#00a884' : '#25d366',
  };

  return (
    <div style={{ background: colors.bg, minHeight: '100vh' }}>
      {/* WhatsApp-style chat container */}
      <div style={{ maxWidth: '64rem', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', background: colors.chatBg, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Modern Chat Header */}
        <ChatHeader
          otherUser={otherUser}
          connectionStatus={connectionStatus}
          typingUser={typingUser}
          isReconnecting={isReconnecting}
          reconnectAttempts={reconnectAttempts}
          theme={theme}
          availableUsers={availableUsers}
          setShowOtherUserModal={setShowOtherUserModal}
          setShowSearchModal={setShowSearchModal}
          user={user}
          messages={messages}
          colors={colors}
          onStartVoiceCall={startVoiceCall}
          onStartVideoCall={startVideoCall}
          voiceCallState={voiceCallState}
          videoCallState={videoCallState}
          otherUserOnline={otherUserOnline}
          onLogout={onLogout}
          onAvatarUpdate={handleAvatarUpdate}
        />

          {/* Modern Messages Area */}
          <div 
            ref={chatContainerRef}
            onScroll={handleScroll}
            style={{ flex: 1, overflowY: 'auto', background: colors.bg, position: 'relative' }}
          >
            {/* Messages container with padding for mobile/desktop */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ChatMessages messages={messages} user={user} otherUser={otherUser} onEdit={onEdit} onDelete={onDelete} onReply={handleReply} onForward={(m)=>{ setForwardingMessage(m); setShowForwardModal(true); }} colors={colors} />
              <TypingIndicator typingUser={typingUser} colors={colors} />
            </div>
            
            {/* Scroll to bottom button - appears when user scrolled up */}
            {userScrolledUp && (
              <ScrollToBottomButton onClick={() => { scrollToBottom(); setUserScrolledUp(false); }} />
            )}
            
            {/* Scroll to bottom ref */}
            <div ref={messagesEndRef} />
          </div>

          {/* Modern Input Area */}
          <ComposeBar
            text={text}
            setText={setText}
            onTyping={onTyping}
            otherUser={otherUser}
            uploading={uploading}
            uploadImage={uploadImage}
            recording={recording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            sending={sending}
            editingMessage={editingMessage}
            cancelEdit={cancelEdit}
            replyingTo={replyingTo}
            cancelReply={cancelReply}
            send={send}
            connectionStatus={connectionStatus}
            colors={colors}
            currentUserId={user.id}
          />
        </div>

      {/* Modern User Selection Modal */}
      {/* Smart Search Modal */}
      {showSearchModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: colors.chatBg,
            borderRadius: '12px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowSearchModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: colors.headerText,
                zIndex: 1
              }}
            >
              ×
            </button>
            <SmartSearch
              conversationId={conversationId}
              onResultClick={(msg) => {
                console.log('Selected message:', msg);
                setShowSearchModal(false);
                // Scroll to message if needed
                scrollToBottom();
              }}
              darkMode={theme === 'dark'}
            />
          </div>
        </div>
      )}

      <UserSelectModal
        show={showOtherUserModal}
        onClose={() => setShowOtherUserModal(false)}
        availableUsers={availableUsers}
        currentUserId={user.id}
        onSelect={(id) => selectOtherUser(id)}
      />

      {/* Forward Message Modal */}
      <UserSelectModal
        show={showForwardModal}
        onClose={() => { setShowForwardModal(false); setForwardingMessage(null); }}
        availableUsers={availableUsers}
        currentUserId={user.id}
        onSelect={async (targetId) => {
          try {
            if (!forwardingMessage) return;
            const id = forwardingMessage.id || forwardingMessage._id;
            const res = await forwardMessage({ messageId: id, targetUserId: targetId });
            const newMessages = res.data?.messages || [];
            // If forwarding to the currently open chat, append
            if (otherUserId === targetId) {
              setMessages(prev => [...prev, ...newMessages]);
              setTimeout(() => scrollToBottom(), 50);
            }
            setShowForwardModal(false);
            setForwardingMessage(null);
          } catch (err) {
            console.error('Forward failed:', err);
            alert(err.response?.data?.message || 'Failed to forward message');
          }
        }}
      />

      {/* Voice Call Modal */}
      <VoiceCallModal
        callState={voiceCallState}
        incomingCall={incomingVoiceCall}
        callDuration={voiceCallDuration}
        otherUser={otherUser}
        onAnswer={answerVoiceCall}
        onReject={rejectVoiceCall}
        onEnd={endVoiceCall}
        localStreamRef={voiceLocalStreamRef}
        remoteStreamRef={voiceRemoteStreamRef}
        colors={colors}
      />

      {/* Video Call Modal */}
      <VideoCallModal
        callState={videoCallState}
        incomingCall={incomingVideoCall}
        callDuration={videoCallDuration}
        otherUser={otherUser}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        onAnswer={answerVideoCall}
        onReject={rejectVideoCall}
        onEnd={endVideoCall}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        localStreamRef={videoLocalStreamRef}
        remoteStreamRef={videoRemoteStreamRef}
        colors={colors}
      />
    </div>
  );
}
