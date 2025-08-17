import React, { useState, useEffect, useRef } from 'react';
import { connectSocket, sendSocketMessage, disconnectSocket, getConnectionStatus, isWebSocketConnected } from '../services/socket';
import api, { setAuthToken, getAuthenticatedApi } from '../services/api';
import MessageItem from '../components/MessageItem';

export default function ChatPage({ user, onLogout }){
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [otherUserId, setOtherUserId] = useState(localStorage.getItem('otherUserId') || '');
  const [otherUser, setOtherUser] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [showOtherUserModal, setShowOtherUserModal] = useState(false);
  // Theme (light / dark)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [lastTypingTime, setLastTypingTime] = useState(0);
  const [sending, setSending] = useState(false);
  
  const connectedRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        
        // Set the auth token in the api service
        setAuthToken(token);
        
        console.log('Making request to /api/auth/users');
        const usersRes = await api.get('/api/auth/users');
        const users = usersRes.data;
        console.log('Users response:', users);
        setAvailableUsers(users);
        // Always use deterministic user IDs for conversation
        let otherId = otherUserId;
        if (!otherId) {
          const found = users.find(u => u.id !== user.id);
          if (found) {
            otherId = found.id;
            setOtherUserId(otherId);
            setOtherUser(found);
            localStorage.setItem('otherUserId', otherId);
          }
        } else {
          const found = users.find(u => u.id === otherId);
          setOtherUser(found);
        }
        
        // Always use the same conversation for the same user pair
        if (otherId) {
         
          try {
            console.log('Creating/getting conversation with other user:', otherId);
            // Use the getAuthenticatedApi to ensure the token is included in this specific request
            const authenticatedApi = getAuthenticatedApi();
            console.log('Authorization header for conversation request:', 
              authenticatedApi.defaults.headers.common['Authorization'] || 'none');
             console.log('Using other bkb2  user ID:', otherId);
            const conv = await authenticatedApi.post('/api/chat/conversation?other=' + otherId);
            console.log('Conversation response:', conv.data);
            setConversationId(conv.data.id);
            console.log('Loading messages for conversation:', conv.data.id);
            const res = await authenticatedApi.get('/api/chat/messages?conversationId=' + conv.data.id);
            console.log('Messages response:', res.data);
            setMessages(res.data);
            
            // Mark messages as read when conversation is loaded
            markMessagesAsRead(conv.data.id);
          } catch (error) {
            console.error('Error creating/getting conversation:', error);
            if (error.response) {
              console.error('Response status:', error.response.status);
              console.error('Response data:', error.response.data);
            }
          }
        }
      } catch (e) {
        console.error('conversation load failed', e);
        if (e.response) {
          console.error('Response status:', e.response.status);
          console.error('Response data:', e.response.data);
        }
        alert(`Failed to load conversation: ${e.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    initializeChat();

    const token = localStorage.getItem('token');
    
    // Function to connect WebSocket that can be called for reconnections
    const connectWebSocket = () => {
      if (!token) {
        console.log('No token available for WebSocket connection');
        return;
      }
      
      // Don't try to connect if already connected
      if (connectedRef.current) {
        console.log('WebSocket already connected, skipping connection attempt');
        return;
      }
      
      console.log('Connecting to WebSocket...');
      setConnectionStatus('connecting');
      
      connectSocket(token, (message) => {
        if (message && message.type && message.type.startsWith('system:')) return;
        
        console.log('Received message via WebSocket:', message);
        
        // Handle read receipt updates
        if (message.type === 'MESSAGE_READ') {
          console.log('Received read receipt for message:', message.message.id);
          setMessages(prev => prev.map(msg => 
            msg.id === message.message.id 
              ? { ...msg, read: true, readAt: message.message.readAt }
              : msg
          ));
          return;
        }
        
        // Handle incoming messages
        setMessages(prev => {
          // More robust temporary message removal
          // Remove temporary messages that match the incoming real message
          const filteredMessages = prev.filter(msg => {
            if (!msg.temporary) return true; // Keep all non-temporary messages
            
            // Remove temporary message if it matches the incoming message
            const isMatchingTemp = (
              msg.content === message.content && 
              msg.senderId === message.senderId &&
              msg.type === message.type &&
              (msg.conversationId === message.conversationId || (!msg.conversationId && !message.conversationId))
            );
            
            if (isMatchingTemp) {
              console.log('Removing temporary message:', msg.id, 'for real message:', message.id);
              return false; // Remove this temporary message
            }
            
            return true; // Keep this message
          });
          
          // Check if message already exists (avoid duplicates)
          const messageExists = filteredMessages.some(msg => msg.id === message.id);
          if (messageExists) {
            console.log('Message already exists, skipping:', message.id);
            return prev; // Return original to avoid unnecessary re-renders
          }
          
          console.log('Adding new message:', message.id);
          return [...filteredMessages, message];
        });
      }, () => { 
        connectedRef.current = true; 
        setConnectionStatus('connected');
        console.log('WebSocket connected successfully');
      }, {
        onEdited: (edited) => {
          setMessages(prev => prev.map(p => p.id === edited.id ? { ...p, edited: true, content: edited.content, editedAt: edited.editedAt } : p));
        },
        onDeleted: (d) => {
          setMessages(prev => prev.map(p => p.id === d.id ? { ...p, deleted: true } : p));
        },
        onTyping: (t) => {
          setTypingUser(t.fromDisplay || 'Other user');
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 2000);
        },
        onRead: (r) => {
          setMessages(prev => prev.map(p => p.id === r.id ? { ...p, read: true } : p));
        },
        // Enhanced connection lost handler
        onConnectionLost: () => {
          console.log('WebSocket connection lost');
          connectedRef.current = false;
          setConnectionStatus('reconnecting');
          
          // Wait 2 seconds before attempting to reconnect to avoid rapid reconnection attempts
          setTimeout(() => {
            if (!connectedRef.current) {
              console.log('Attempting to reconnect WebSocket...');
              connectWebSocket();
            }
          }, 2000);
        }
      });
    };
    
    // Initial connection and periodic health check
    let intervalId = null;
    let cleanupIntervalId = null;
    
    if (token) {
      connectWebSocket();
      
      // Setup periodic connection health check
      intervalId = setInterval(() => {
        const currentStatus = getConnectionStatus();
        if (currentStatus !== 'connected') {
          console.log('Health check: WebSocket status:', currentStatus, '- attempting to reconnect...');
          setConnectionStatus('reconnecting');
          connectWebSocket();
        } else {
          // Update connection status if it's now connected
          if (connectionStatus !== 'connected') {
            setConnectionStatus('connected');
          }
        }
      }, 15000); // Check every 15 seconds instead of 10
      
      // Setup periodic cleanup of old temporary messages
      cleanupIntervalId = setInterval(() => {
        setMessages(prev => prev.map(msg => {
          if (msg.temporary && msg.timestamp) {
            const messageAge = Date.now() - new Date(msg.timestamp).getTime();
            // Remove temporary flag from messages older than 15 seconds
            if (messageAge > 15000) {
              console.log('Auto-removing temporary flag from old message:', msg.id);
              return { ...msg, temporary: false };
            }
          }
          return msg;
        }));
      }, 5000); // Check every 5 seconds
    }
    
    // Unified cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
      }
      disconnectSocket();
      clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Mark messages as read when they come into view
  const markMessagesAsRead = async (conversationId) => {
    if (!conversationId) return;
    
    try {
      const authenticatedApi = getAuthenticatedApi();
      await authenticatedApi.post('/api/chat/messages/mark-read', { conversationId });
      console.log('Messages marked as read for conversation:', conversationId);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  // Mark messages as read when window comes into focus
  useEffect(() => {
    const handleFocus = () => {
      if (conversationId) {
        console.log('Window focused, marking messages as read');
        markMessagesAsRead(conversationId);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && conversationId) {
        console.log('Page became visible, marking messages as read');
        markMessagesAsRead(conversationId);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [conversationId]);

  // Mark messages as read when new messages arrive and chat is visible
  useEffect(() => {
    if (conversationId && !document.hidden && messages.length > 0) {
      // Small delay to ensure the user actually sees the messages
      const timeoutId = setTimeout(() => {
        markMessagesAsRead(conversationId);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [messages, conversationId]);

  const send = async (e) => {
    e?.preventDefault();
    if(!text.trim() || sending) return; // Prevent multiple sends
    
    setSending(true);
    
    const currentUserId = user.id;
    const targetUserId = otherUserId || localStorage.getItem('otherUserId');
    
    if (!targetUserId) {
      alert('No chat partner available. Please register another user first.');
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
        temporary: true // Mark as temporary
      };
      
      // Add message immediately to UI (optimistic update)
      setMessages(prev => [...prev, tempMessage]);
      
      // Try WebSocket first
      const wsSuccess = sendSocketMessage({ 
        receiverId: targetUserId, 
        type: 'text', 
        content: text.trim(), 
        conversationId,
        senderId: currentUserId
      });
      
      // Set up automatic cleanup of temporary message after 10 seconds
      const cleanupTimeout = setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id && msg.temporary 
            ? { ...msg, temporary: false } // Remove temporary flag to hide "sending..."
            : msg
        ));
      }, 10000);
      
      if (!wsSuccess) {
        clearTimeout(cleanupTimeout); // Clear timeout if we're doing HTTP fallback
        
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
    setSending(false);
  }

  const uploadImage = async (file) => {
    if (!file) return;
    
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (conversationId) fd.append('conversationId', conversationId);
      
      console.log('Uploading image file:', file.name, 'size:', file.size, 'type:', file.type);
      
      // Use authenticated API instance for upload
      const authenticatedApi = getAuthenticatedApi();
      const res = await authenticatedApi.post('/api/media/upload', fd, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      
      const id = res.data.id;
      console.log('Image uploaded to server with ID:', id);
      
      // Use full URL with hostname (authentication will be handled by MessageItem)
      const url = `http://localhost:8080/api/media/file/${id}`;
      
      console.log('Image uploaded successfully, ID:', id, 'URL:', url);
      
      // Create a temporary message for optimistic UI update
      const currentUserId = user.id;
      const targetUserId = otherUserId || localStorage.getItem('otherUserId');
      
      const tempMessage = {
        id: 'temp-image-' + Date.now(),
        type: 'image',
        content: url,
        senderId: currentUserId,
        receiverId: targetUserId,
        conversationId,
        timestamp: new Date().toISOString(),
        temporary: true
      };
      
      // Show message in UI immediately
      setMessages(prev => [...prev, tempMessage]);
      
      // Send via WebSocket
      const success = sendSocketMessage({ 
        receiverId: targetUserId || 'other', 
        type: 'image', 
        content: url, 
        conversationId,
        senderId: currentUserId
      });
      
      if (!success) {
        // If WebSocket fails, fall back to HTTP API
        try {
          console.log('WebSocket send failed, trying HTTP API fallback');
          const message = {
            type: 'image',
            content: url,
            receiverId: targetUserId,
            conversationId
          };
          await authenticatedApi.post('/api/chat/messages', message);
          alert('Image sent via HTTP (WebSocket unavailable)');
        } catch (apiError) {
          console.error('HTTP API fallback failed:', apiError);
          // Remove temporary message if both methods fail
          setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
          alert('Failed to send image message. Please try again.');
        }
      } else {
        console.log('Image message sent successfully via WebSocket');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices) {
      alert('Voice recording is not supported in your browser.');
      return;
    }
    
    try {
      setRecording(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('file', blob, 'voice.webm');
        if (conversationId) fd.append('conversationId', conversationId);
        
        try {
          const res = await api.post('/api/media/upload', fd, { 
            headers: { 'Content-Type': 'multipart/form-data' } 
          });
          const id = res.data.id;
          // Use full URL with hostname (authentication will be handled by MessageItem)
          const url = `http://localhost:8080/api/media/file/${id}`;
          console.log('Audio uploaded successfully, ID:', id, 'URL:', url);
          
          // Create a temporary message for optimistic UI update
          const currentUserId = user.id;
          const targetUserId = otherUserId || localStorage.getItem('otherUserId');
          
          const tempMessage = {
            id: 'temp-audio-' + Date.now(),
            type: 'audio',
            content: url,
            senderId: currentUserId,
            receiverId: targetUserId,
            conversationId,
            timestamp: new Date().toISOString(),
            temporary: true
          };
          
          // Show message in UI immediately
          setMessages(prev => [...prev, tempMessage]);
          
          // Send via WebSocket
          const success = sendSocketMessage({ 
            receiverId: targetUserId || 'other', 
            type: 'audio', 
            content: url, 
            conversationId,
            senderId: currentUserId
          });
          
          if (!success) {
            // If WebSocket fails, fall back to HTTP API
            try {
              console.log('WebSocket send failed, trying HTTP API fallback');
              const authenticatedApi = getAuthenticatedApi();
              const message = {
                type: 'audio',
                content: url,
                receiverId: targetUserId,
                conversationId
              };
              await authenticatedApi.post('/api/chat/messages', message);
              alert('Audio sent via HTTP (WebSocket unavailable)');
            } catch (apiError) {
              console.error('HTTP API fallback failed:', apiError);
              // Remove temporary message if both methods fail
              setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
              alert('Failed to send audio message. Please try again.');
            }
          } else {
            console.log('Audio message sent successfully via WebSocket');
          }
        } catch (error) {
          console.error('Voice upload failed:', error);
          alert('Failed to send voice message. Please try again.');
        }
        
        stream.getTracks().forEach(track => track.stop());
        setRecording(false);
      };
      
      mr.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to access microphone. Please check your permissions.');
      setRecording(false);
    }
  }

  const stopRecording = () => { 
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  }

  const onEdit = (m) => { 
    setEditingMessage(m); 
    setText(m.content); 
  }
  
  const onDelete = (m) => { 
    sendSocketMessage({ id: m.id, type: 'delete', conversationId }); 
  }

  const onTyping = () => {
    const now = Date.now();
    if (now - lastTypingTime > 1000) { // Throttle to 1 per second
      setLastTypingTime(now);
      sendSocketMessage({ 
        receiverId: otherUserId || localStorage.getItem('otherUserId') || 'other', 
        type: 'typing', 
        content: '', 
        conversationId 
      });
    }
  }

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
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-8 relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-indigo-200"></div>
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-indigo-600 border-t-transparent absolute top-0 left-0"></div>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Loading Your Chat</h3>
          <p className="text-gray-600">Connecting to the conversation...</p>
          <div className="flex justify-center space-x-1 mt-4">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto p-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Modern Chat Header */}
          <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white p-6">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">
                    {otherUser ? `${otherUser.displayName || otherUser.username}` : 'JustUs Chat'}
                  </h2>
                  <div className="flex items-center space-x-2 text-sm text-white/90">
                    <div className={`w-2 h-2 rounded-full ${
                      connectionStatus === 'connected' ? 'bg-green-400 shadow-lg shadow-green-400/50' : 
                      connectionStatus === 'reconnecting' ? 'bg-orange-400 animate-pulse shadow-lg shadow-orange-400/50' : 
                      'bg-red-400 shadow-lg shadow-red-400/50'
                    }`}></div>
                    <span className="font-medium">{
                      connectionStatus === 'connected' ? 'Online' : 
                      connectionStatus === 'reconnecting' ? 'Connecting...' : 
                      'Offline'
                    }</span>
                    {!otherUser && availableUsers.length === 1 && <span className="text-white/70">• Solo Chat</span>}
                    {!otherUser && availableUsers.length === 0 && <span className="text-white/70">• No Users</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="modern-button p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 border border-white/20"
                  title="Toggle theme"
                >
                  {theme === 'light' ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-9H21M3 12H2.34M17.66 6.34l-.71.71M6.34 17.66l-.71.71M17.66 17.66l-.71-.71M6.34 6.34l-.71-.71M12 5a7 7 0 100 14 7 7 0 000-14z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    </svg>
                  )}
                </button>
              </div>
              {availableUsers.length > 1 && (
                <button
                  onClick={() => setShowOtherUserModal(true)}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-xl transition-all duration-300 font-medium shadow-lg border border-white/30"
                >
                  Switch User
                </button>
              )}
            </div>
          </div>

          {/* Modern Messages Area */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-3 bg-gradient-to-b from-gray-50/50 to-white/50 backdrop-blur-sm custom-scrollbar">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-20">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-modern-lg float-animation">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2 gradient-text">Start Your Conversation</h3>
                <p className="text-gray-500">Send a message to begin chatting!</p>
              </div>
            ) : (
              messages.map(m => (
                <MessageItem 
                  key={m.id} 
                  m={m} 
                  me={user.id} 
                  onEdit={onEdit} 
                  onDelete={onDelete} 
                />
              ))
            )}
            {typingUser && (
              <div className="flex items-center space-x-3 text-gray-500 bg-white/60 backdrop-blur-sm rounded-2xl p-4 w-fit glass-effect">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot"></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot"></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot"></div>
                </div>
                <span className="text-sm font-medium gradient-text">{typingUser} is typing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Modern Input Area */}
          <div className="border-t border-gray-200/50 bg-white/70 backdrop-blur-xl p-6">
            {editingMessage && (
              <div className="mb-4 p-4 bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="text-sm font-medium text-amber-800">Editing message</span>
                  </div>
                  <button onClick={cancelEdit} className="text-amber-600 hover:text-amber-800 transition-colors p-1 rounded-lg hover:bg-amber-100">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            
            <form onSubmit={send} className="flex items-end space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <textarea
                    className="modern-input w-full px-6 py-4 bg-gray-100/50 backdrop-blur-sm border border-gray-200/50 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none transition-all duration-300 placeholder-gray-500 font-medium"
                    value={text}
                    onChange={e => {
                      setText(e.target.value);
                      onTyping();
                    }}
                    onKeyPress={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Type your message..."
                    rows="2"
                    disabled={!otherUser}
                  />
                </div>
              </div>
              
              <div className="flex space-x-2">
                {/* Modern File Upload */}
                <label className="modern-button cursor-pointer glass-effect hover:bg-gray-200/70 p-3 rounded-xl transition-all duration-300 shadow-modern border border-gray-200/50 disabled:opacity-50">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => { if(e.target.files[0]) uploadImage(e.target.files[0]); }}
                    className="hidden"
                    disabled={!otherUser || uploading}
                  />
                  {uploading ? (
                    <div className="modern-spinner"></div>
                  ) : (
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </label>

                {/* Modern Voice Recording */}
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  className={`modern-button p-3 rounded-xl transition-all duration-300 shadow-modern border ${
                    recording 
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse border-red-300 shadow-red-200' 
                      : 'glass-effect hover:bg-gray-200/70 text-gray-600 border-gray-200/50'
                  }`}
                  disabled={!otherUser}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Modern Send Button */}
                <button
                  type="submit"
                  disabled={!text.trim() || !otherUser || sending}
                  className={`modern-button px-6 py-3 rounded-xl transition-all duration-300 font-semibold text-white shadow-modern-lg border border-transparent ${
                    connectionStatus === 'connected' 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-200' 
                      : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 shadow-orange-200'
                  } disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none`}
                  title={connectionStatus !== 'connected' ? 'Using HTTP fallback (WebSocket disconnected)' : 'Send via WebSocket'}
                >
                  {sending ? (
                    <div className="modern-spinner border-white border-t-transparent"></div>
                  ) : editingMessage ? (
                    'Update'
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>Send</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modern User Selection Modal */}
      {showOtherUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-effect rounded-3xl p-8 w-96 max-w-md shadow-modern-lg border border-white/20 animate-in zoom-in duration-300">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center gradient-text">Select Chat Partner</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
              {availableUsers.filter(u => u.id !== user.id).map(u => (
                <button
                  key={u.id}
                  onClick={() => selectOtherUser(u.id)}
                  className="modern-button w-full text-left p-4 hover:bg-indigo-50/70 backdrop-blur-sm rounded-2xl transition-all duration-300 border border-transparent hover:border-indigo-200/50 hover:shadow-modern"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {(u.displayName || u.username).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{u.displayName || u.username}</div>
                      <div className="text-sm text-gray-500">ID: {u.id.slice(0, 8)}...</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowOtherUserModal(false)}
              className="modern-button mt-6 w-full glass-effect hover:bg-gray-200/70 text-gray-800 py-3 rounded-2xl transition-all duration-300 font-semibold border border-gray-200/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
