import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sendSocketMessage, getConnectionStatus, getSocket, exchangePublicKey, getPublicKey } from '../../services/socket';
import { setAuthToken, getAuthenticatedApi } from '../../services/api';
import ChatHeader from '../../components/chat/layout/ChatHeader';
import ChatMessages from '../../components/chat/layout/ChatMessages';
import TypingIndicator from '../../components/chat/layout/TypingIndicator';
import ScrollToBottomButton from '../../components/chat/layout/ScrollToBottomButton';
import ComposeBar from '../../components/chat/input/ComposeBar';
import UserSelectModal from '../../components/modals/UserSelectModal';
import VoiceCallModal from '../../components/modals/VoiceCallModal';
import VideoCallModal from '../../components/modals/VideoCallModal';
import SmartSearch from '../../components/modals/SmartSearch';
import WallpaperPanel from '../../components/chat/layout/WallpaperPanel';
import useChatSocket from '../../hooks/useChatSocket';
import useReadReceipts from '../../hooks/useReadReceipts';
import useImageUpload from '../../hooks/useImageUpload';
import useVoiceMessage from '../../hooks/useVoiceMessage';
import useVoiceCall from '../../hooks/useVoiceCall';
import useVideoCall from '../../hooks/useVideoCall';
import useEncryption from '../../hooks/useEncryption';
import { forwardMessage } from '../../services/chat';
import { buildWallpaperUrl, DEFAULT_WALLPAPER, fetchWallpaper, saveWallpaper } from '../../services/wallpaperService';

const WALLPAPER_PRESETS = [
  {
    key: 'aurora',
    label: 'Aurora Mist',
    value: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)'
  },
  {
    key: 'sunset',
    label: 'Sunset Bloom',
    value: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)'
  },
  {
    key: 'noir',
    label: 'Noir Grid',
    value: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0b1220 100%)'
  },
  {
    key: 'waves',
    label: 'Pacific Waves',
    value: 'linear-gradient(135deg, #74ebd5 0%, #9face6 100%)'
  },
  {
    key: 'dune',
    label: 'Desert Dusk',
    value: 'linear-gradient(135deg, #f8fafc 0%, #fee2e2 45%, #fef3c7 100%)'
  },
  {
    key: 'forest',
    label: 'Evergreen',
    value: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 50%, #22c55e 100%)'
  },

  {
    key: 'midnight',
    label: 'Midnight Blue',
    value: '#0F172A'
  },
  {
    key: 'charcoal',
    label: 'Deep Charcoal',
    value: '#18181B'
  },
  {
    key: 'slate',
    label: 'Slate Grey',
    value: '#334155'
  },
  {
    key: 'black',
    label: 'Pure Black',
    value: '#000000'
  }
];

export default function ChatPage({ user, onLogout, onUserUpdate, showContactSwitcher, setShowContactSwitcher }) {
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
  const [wallpaperSettings, setWallpaperSettings] = useState(DEFAULT_WALLPAPER);
  const [wallpaperPreview, setWallpaperPreview] = useState(DEFAULT_WALLPAPER);
  const [wallpaperPanelOpen, setWallpaperPanelOpen] = useState(false);
  const [savingWallpaper, setSavingWallpaper] = useState(false);
  const [resolvedWallpaperUrl, setResolvedWallpaperUrl] = useState('');

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

  // Listen for top-header 'Add contact' event and open the Add Contact modal
  useEffect(() => {
    const openAddContact = () => setShowOtherUserModal(true);
    window.addEventListener('open-add-contact', openAddContact);
    return () => window.removeEventListener('open-add-contact', openAddContact);
  }, []);

  // When top-header quick switch is toggled, open the unified contacts modal
  useEffect(() => {
    if (showContactSwitcher) {
      setShowOtherUserModal(true);
      // close the header switcher state back in App
      try { setShowContactSwitcher(false); } catch (e) { /* ignore if unavailable */ }
    }
  }, [showContactSwitcher, setShowContactSwitcher]);

  // Image upload via hook
  const { uploading, selectFile, uploadFile } = useImageUpload({
    userId: user.id,
    otherUserId: otherUserId || localStorage.getItem('otherUserId'),
    conversationId,
    setMessages
  });
  const openWallpaperPanel = () => {
    setWallpaperPreview(wallpaperSettings);
    setWallpaperPanelOpen(true);
  };

  // Voice call hook
  const {
    callState: voiceCallState,
    incomingCall: incomingVoiceCall,
    callDuration: voiceCallDuration,
    isMuted: voiceIsMuted,
    startCall: startVoiceCall,
    answerCall: answerVoiceCall,
    rejectCall: rejectVoiceCall,
    endCall: endVoiceCall,
    toggleMute: toggleVoiceMute,
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

  // Scroll / UI state helpers (declared before smart-scroll useEffect)
  const [lastTypingTime, setLastTypingTime] = useState(0);
  const [sending, setSending] = useState(false);
  const [prevMessagesLength, setPrevMessagesLength] = useState(0);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const connectedRef = useRef(false);
  const audioStreamRef = useRef(null); // kept for cleanup compatibility
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const chatContainerRef = useRef(null);
  const sendingRef = useRef(false);
  const cleanupTimeoutsRef = useRef(new Set());
  const lastTypingTimeRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isNearBottom = () => {
    if (!chatContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100; // within 100px
  };

  const handleScroll = () => {
    if (!isNearBottom()) setUserScrolledUp(true);
    else setUserScrolledUp(false);
  };

  // Avatar update handler
  const handleAvatarUpdate = (newUrl) => {
    if (onUserUpdate) {
      onUserUpdate({ avatarUrl: newUrl });
    }
  };

  // Call end handler (for voice/video calls)
  const handleCallEnd = (duration, type) => {
    console.log(`${type} call ended. Duration: ${duration}s`);
    // Additional call end logic if needed
  };

  // Wallpaper panel close handler
  const closeWallpaperPanel = () => {
    setWallpaperPanelOpen(false);
  };

  // Decrypt and set messages
  const setMessagesWithDecryption = (rawMessages) => {
    const decrypted = rawMessages.map(msg => {
      if (msg.ciphertext && msg.nonce && encryption.getKeyPair()) {
        try {
          const senderPublicKey = encryption.getPublicKeyForUser(msg.senderId);
          if (senderPublicKey) {
            const decryptedContent = encryption.decryptMessage(msg.ciphertext, msg.nonce, senderPublicKey);
            if (decryptedContent) {
              return { ...msg, content: decryptedContent, encrypted: true };
            }
          }
        } catch (err) {
          console.error('Failed to decrypt message:', err);
        }
      }
      return msg;
    });
    setMessages(decrypted);
  };

  // WebSocket connection via hook
  const { onTyping: onTypingHook } = useChatSocket({
    token: localStorage.getItem('token'),
    userId: user.id,
    availableUsers,
    setMessages,
    setTypingUser,
    setConnectionStatus,
    setReconnectAttempts,
    isReconnecting,
    setIsReconnecting,
    connectedRef,
    typingTimeoutRef,
    onUserStatusChange: (userId, online) => {
      if (userId === otherUserId) {
        setOtherUserOnline(online);
      }
    }
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

  useEffect(() => {
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

              // Check if it's a 401 error and redirect to sign in
              if (error.response.status === 401) {
                console.log('401 Unauthorized - Redirecting to sign in');
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                window.location.href = '/signin';
                return;
              }

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

          // Check if it's a 401 error and redirect to sign in
          if (e.response.status === 401) {
            console.log('401 Unauthorized - Redirecting to sign in');
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            window.location.href = '/signin';
            return;
          }
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

  useEffect(() => {
    const loadWallpaper = async () => {
      if (!conversationId) return;
      try {
        const settings = await fetchWallpaper(conversationId);
        const hydrated = { ...DEFAULT_WALLPAPER, ...(settings || {}) };
        setWallpaperSettings(hydrated);
        setWallpaperPreview(hydrated);
      } catch (err) {
        console.error('Failed to load wallpaper', err);
      }
    };

    loadWallpaper();
  }, [conversationId]);

  // Resolve wallpaper URL (async for blob URLs)
  useEffect(() => {
    const resolveWallpaper = async () => {
      const activePreset = WALLPAPER_PRESETS.find(p => p.key === wallpaperPreview.presetKey);
      const rawWallpaper = wallpaperPreview.sourceType === 'preset'
        ? activePreset?.value || ''
        : wallpaperPreview.imageUrl;

      if (wallpaperPreview.sourceType === 'none' || !rawWallpaper) {
        setResolvedWallpaperUrl('');
        return;
      }

      try {
        const resolved = await buildWallpaperUrl(rawWallpaper);
        setResolvedWallpaperUrl(resolved || '');
      } catch (err) {
        console.error('Failed to resolve wallpaper URL', err);
        setResolvedWallpaperUrl('');
      }
    };

    resolveWallpaper();
  }, [wallpaperPreview]);

  // Read receipts via hook
  const { markMessagesAsRead } = useReadReceipts(conversationId, messages);

  // Close contact switcher with ESC key
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showContactSwitcher) {
        setShowContactSwitcher(false);
      }
    };

    if (showContactSwitcher) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showContactSwitcher, setShowContactSwitcher]);

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
      // Get receiver's public key for encryption
      const receiverPublicKey = encryption.getPublicKeyForUser(targetUserId);
      let encryptedData = null;
      let messageToSend = null;

      if (receiverPublicKey && encryption.getKeyPair()) {
        // Encrypt the message BEFORE creating temp message
        encryptedData = encryption.encryptMessage(text.trim(), receiverPublicKey);
      }

      // Create a temporary message object for optimistic UI update
      const tempMessage = {
        id: 'temp-' + Date.now(), // Temporary ID
        type: 'text',
        content: text.trim(), // Always show plaintext locally
        senderId: currentUserId,
        receiverId: targetUserId,
        conversationId,
        timestamp: new Date().toISOString(),
        temporary: true, // Mark as temporary
        // Store encryption details in temp message for matching
        encryptionNonce: encryptedData?.nonce,
        ciphertext: encryptedData?.ciphertext,
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

      /* ... scroll logic ... */

      // Construct the actual payload
      if (encryptedData) {
        messageToSend = {
          receiverId: targetUserId,
          type: 'text',
          ciphertext: encryptedData.ciphertext,
          nonce: encryptedData.nonce,
          conversationId,
          senderId: currentUserId,
          replyTo: replyingTo?.id || null,
          plaintext: text.trim() // Send plaintext for server-side translation
        };
        console.log('[Frontend] Sending Encrypted Message:', {
          ...messageToSend,
          ciphertext: '***',
          plaintext: messageToSend.plaintext
        });
      } else {
        // Fallback to plaintext
        messageToSend = {
          receiverId: targetUserId,
          type: 'text',
          content: text.trim(),
          conversationId,
          senderId: currentUserId,
          replyTo: replyingTo?.id || null
        };
        console.log('[Frontend] No encryption keys available, sending as plaintext:', messageToSend);
      }


      // Try WebSocket first
      console.log('[Frontend] Emitting chat.send to socket...');
      const wsSuccess = sendSocketMessage(messageToSend);
      console.log('[Frontend] Socket emit success:', wsSuccess);

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

  const applyAndSaveWallpaper = async (nextSettings = wallpaperSettings) => {
    if (!conversationId) {
      alert('Conversation not ready yet');
      return;
    }
    const safeSettings = { ...DEFAULT_WALLPAPER, ...(nextSettings || {}) };
    setSavingWallpaper(true);
    try {
      setWallpaperSettings(safeSettings);
      setWallpaperPreview(safeSettings);
      await saveWallpaper(conversationId, safeSettings);
      setWallpaperPanelOpen(false);
    } catch (err) {
      console.error('Failed to save wallpaper', err);
      alert(err.response?.data?.message || 'Could not save wallpaper');
    } finally {
      setSavingWallpaper(false);
    }
  };

  const handleWallpaperUpload = async (file) => {
    if (!file || !conversationId) {
      alert('Conversation not ready yet');
      return;
    }
    setSavingWallpaper(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('conversationId', conversationId);

      const authenticatedApi = getAuthenticatedApi();
      const res = await authenticatedApi.post('/api/media/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const path = `/api/media/file/${res.data.id}`;
      const next = { ...wallpaperSettings, sourceType: 'custom', imageUrl: path };
      setWallpaperSettings(next);
      setWallpaperPreview(next);
      await saveWallpaper(conversationId, next);
    } catch (err) {
      console.error('Wallpaper upload failed', err);
      alert(err.response?.data?.message || 'Failed to upload wallpaper');
    } finally {
      setSavingWallpaper(false);
    }
  };

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
      <div style={{ minHeight: '100vh', background: darkMode ? '#0b141a' : '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 32px', position: 'relative' }}>
            <div style={{ animation: 'spin 1s linear infinite', borderRadius: '50%', height: '80px', width: '80px', border: '4px solid #060810ff' }}></div>
            <div style={{ animation: 'spin 1s linear infinite', borderRadius: '50%', height: '80px', width: '80px', border: '4px solid #111111', borderTopColor: 'transparent', position: 'absolute', top: 0, left: 0 }}></div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: darkMode ? '#fff' : '#1f2937', marginBottom: '8px' }}>Loading Your Chat</h3>
          <p style={{ color: darkMode ? '#9ca3af' : '#4b5563' }}>Connecting to the conversation...</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '16px' }}>
            <div style={{ width: '8px', height: '8px', background: '#111111', borderRadius: '50%', animation: 'bounce 1.4s infinite' }}></div>
            <div style={{ width: '8px', height: '8px', background: '#111111', borderRadius: '50%', animation: 'bounce 1.4s infinite', animationDelay: '0.1s' }}></div>
            <div style={{ width: '8px', height: '8px', background: '#111111', borderRadius: '50%', animation: 'bounce 1.4s infinite', animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }
  const darkMode = theme === 'dark';
  const colors = {
    // Glass UI Colors for both modes
    bg: darkMode ? 'transparent' : '#dee5d5ff', // Beige background for light mode
    chatBg: darkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.15)', // More transparent glass
    header: darkMode ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.35)', // More transparent header
    headerText: darkMode ? '#ffffff' : '#1a1a1a',
    bubbleOut: darkMode ? 'rgba(71, 85, 105, 0.6)' : '#dee5d5ff', // More transparent green
    bubbleOutText: darkMode ? '#ffffff' : '#111111ff', // Darker green text for contrast
    bubbleIn: darkMode ? 'rgba(51, 65, 85, 0.6)' : '#dee5d5ff', // More transparent white
    bubbleInText: darkMode ? '#ffffff' : '#1a1a1a', // Darker text for contrast
    timestamp: darkMode ? 'rgba(148, 163, 184, 0.7)' : 'rgba(0, 0, 0, 0.5)',
    inputBg: darkMode ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.4)', // More transparent input
    inputBorder: darkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(23, 22, 22, 0.6)', // Bright glass border
    inputText: darkMode ? '#ffffff' : '#1a1a1a',
    sendBtn: darkMode ? '#64748b' : '#00a85cff', // WhatsApp green button
  };



  const wallpaperActive = wallpaperSettings.sourceType !== 'none' && Boolean(resolvedWallpaperUrl);

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', padding: '10px' }}>
      {/* Glass Chat Container */}
      <div style={{
        maxWidth: '64rem',
        margin: '0 auto',
        height: 'calc(100vh - 20px)',
        display: 'flex',
        flexDirection: 'column',
        background: colors.chatBg,
        boxShadow: darkMode ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' : '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '32px',
        border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.5)',
        overflow: 'hidden'
      }}>
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
          onProfileUpdate={onUserUpdate}
          onOpenWallpaper={openWallpaperPanel}
          wallpaperActive={wallpaperActive}
        />

        {/* Modern Messages Area */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: colors.bg, position: 'relative', willChange: 'transform' }}
        >
          {wallpaperActive && resolvedWallpaperUrl && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: wallpaperIsGradient ? resolvedWallpaperUrl : `url(${resolvedWallpaperUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: `blur(${wallpaperPreview.blur || 0}px)`,
                opacity: wallpaperPreview.opacity ?? 0.9,
                transition: 'opacity 0.2s ease, filter 0.2s ease',
                zIndex: 0
              }}
            />
          )}
          {/* Messages container with padding for mobile/desktop */}
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
            <ChatMessages
              messages={messages}
              user={user}
              otherUser={otherUser}
              onEdit={onEdit}
              onDelete={onDelete}
              onReply={handleReply}
              onForward={(m) => { setForwardingMessage(m); setShowForwardModal(true); }}
              colors={colors}
              theme={theme}
            />
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
          selectFile={selectFile}
          uploadFile={uploadFile}
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
          theme={theme}
        />
      </div>

      <WallpaperPanel
        open={wallpaperPanelOpen}
        onClose={closeWallpaperPanel}
        presets={WALLPAPER_PRESETS}
        value={wallpaperPreview}
        onChange={(next) => setWallpaperPreview(next)}
        onSave={applyAndSaveWallpaper}
        onReset={() => applyAndSaveWallpaper(DEFAULT_WALLPAPER)}
        onUpload={handleWallpaperUpload}
        saving={savingWallpaper}
      />

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
              onClose={() => setShowSearchModal(false)}
            />
          </div>
        </div>
      )}

      <UserSelectModal
        show={showOtherUserModal}
        onClose={() => setShowOtherUserModal(false)}
        availableUsers={availableUsers}
        currentUserId={user.id}
        currentChatUserId={otherUserId}
        onSelect={(id) => selectOtherUser(id)}
        darkMode={theme === 'dark'}
      />

      {/* Forward Message Modal */}
      <UserSelectModal
        show={showForwardModal}
        onClose={() => { setShowForwardModal(false); setForwardingMessage(null); }}
        availableUsers={availableUsers}
        currentUserId={user.id}
        currentChatUserId={otherUserId}
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
        darkMode={theme === 'dark'}
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
