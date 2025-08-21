import React, { useState, useEffect, useRef, useCallback } from 'react';
import { connectSocket, sendSocketMessage, disconnectSocket, getConnectionStatus, isWebSocketConnected } from '../services/socket';
import api, { setAuthToken, getAuthenticatedApi } from '../services/api';
import MessageItem from '../components/MessageItem';
import Avatar from '../components/Avatar';
import { loadAuthenticatedMedia } from '../utils/mediaLoader';
import '../styles/modern-chat.css';

// AudioMessage component for handling authenticated audio playback
function AudioMessage({ message, mine }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const loadAudio = async () => {
      if (!message.content || message.temporary) {
        setAudioUrl(message.content);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);
        
        // Extract media ID from URL for caching
        const urlParts = message.content.split('/');
        const mediaId = urlParts[urlParts.length - 1].split('?')[0];
        
        console.log('Loading authenticated audio for ID:', mediaId);
        
        // Load audio with authentication
        const authenticatedBlobUrl = await loadAuthenticatedMedia(message.content, mediaId);
        setAudioUrl(authenticatedBlobUrl);
        setLoading(false);
        
        console.log('Successfully loaded authenticated audio:', authenticatedBlobUrl);
      } catch (error) {
        console.error('Failed to load authenticated audio:', error);
        setError(true);
        setLoading(false);
      }
    };

    loadAudio();
  }, [message.content, message.temporary]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      console.error('Audio playback error');
      setError(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleProgressClick = (e) => {
    const audio = audioRef.current;
    if (!audio || duration === 0) return;

    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressBarWidth = rect.width;
    const newTime = (clickX / progressBarWidth) * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="flex items-center space-x-3 py-2">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          mine ? 'bg-red-500' : 'bg-red-200'
        }`}>
          <svg className={`w-6 h-6 ${mine ? 'text-white' : 'text-red-600'}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`p-4 rounded-xl ${mine ? 'bg-red-100' : 'bg-red-50'} border border-red-200`}>
            <p className="text-sm text-red-600 mb-3 font-medium">🎵 Voice message failed to load</p>
            <button 
              className="px-4 py-2 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
              onClick={() => {
                const token = localStorage.getItem('token');
                if (token) {
                  const url = new URL(message.content);
                  url.searchParams.set('token', token);
                  window.open(url.toString(), '_blank');
                }
              }}
            >
              📥 Download Audio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 py-2">
      {/* Voice message icon */}
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
        mine ? 'bg-indigo-500' : 'bg-gray-200'
      }`}>
        <svg className={`w-6 h-6 ${mine ? 'text-white' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4z" />
          <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5H10.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
        </svg>
      </div>

      {/* Voice message content */}
      <div className="flex-1 min-w-0">
        <div className={`p-4 rounded-xl ${
          mine ? 'bg-indigo-100/80' : 'bg-gray-100/80'
        } border border-gray-200/50 backdrop-blur-sm`}>
          
          {loading ? (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-gray-600 font-medium">Loading voice message...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              
              {/* Play/Pause Button */}
              <button
                onClick={togglePlayPause}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg ${
                  mine 
                    ? 'bg-indigo-500 hover:bg-indigo-600 text-white' 
                    : 'bg-white hover:bg-gray-50 text-indigo-500 border border-gray-200'
                }`}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* Waveform/Progress */}
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  
                  {/* Progress Bar */}
                  <div 
                    className="flex-1 h-2 bg-gray-300 rounded-full cursor-pointer relative overflow-hidden"
                    onClick={handleProgressClick}
                  >
                    <div 
                      className={`h-full rounded-full transition-all duration-150 ${
                        mine ? 'bg-indigo-500' : 'bg-indigo-400'
                      }`}
                      style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                    />
                    
                    {/* Animated pulse when playing */}
                    {isPlaying && (
                      <div className={`absolute inset-0 rounded-full ${
                        mine ? 'bg-indigo-300' : 'bg-indigo-200'
                      } animate-pulse opacity-30`} />
                    )}
                  </div>

                  {/* Time Display */}
                  <div className={`text-xs font-medium tabular-nums ${
                    mine ? 'text-indigo-700' : 'text-gray-600'
                  }`}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>
                
                {/* Voice message label */}
                <div className={`mt-2 text-xs font-medium ${
                  mine ? 'text-indigo-600' : 'text-gray-500'
                }`}>
                  🎵 Voice Message
                  {isPlaying && <span className="ml-2 animate-pulse">● Playing</span>}
                </div>
              </div>
            </div>
          )}

          {/* Hidden audio element */}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              preload="metadata"
              style={{ display: 'none' }}
            />
          )}
        </div>
      </div>

      {/* Sending indicator */}
      {message.temporary && (
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin opacity-60"></div>
          <span className="text-xs opacity-60 font-medium">Sending...</span>
        </div>
      )}
    </div>
  );
}

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
  const [prevMessagesLength, setPrevMessagesLength] = useState(0);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const connectedRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
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

  // Extract WebSocket message handling to separate function
  const handleWebSocketMessage = useCallback((message) => {
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
    
    // Handle message deletion
    if (message.type === 'MESSAGE_DELETED' || message.type === 'delete') {
      console.log('Received delete confirmation for message:', message.messageId || message.id);
      const messageIdToDelete = message.messageId || message.id;
      setMessages(prev => prev.filter(msg => msg.id !== messageIdToDelete));
      return;
    }
    
    // Handle typing indicators  
    if (message.type === 'typing') {
      console.log('Received typing indicator from:', message.senderId);
      if (message.senderId !== user.id) {
        const sender = availableUsers.find(u => u.id === message.senderId);
        setTypingUser(sender ? (sender.displayName || sender.username) : 'Someone');
        
        // Clear typing indicator after 3 seconds
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(null);
        }, 3000);
      }
      return;
    }
    
    // Handle regular messages
    if (message.id && !message.temporary) {
      setMessages(prev => {
        // More robust temporary message removal
        const filteredMessages = prev.filter(msg => {
          if (!msg.temporary) return true; // Keep all non-temporary messages
          
          // Remove temporary message if it matches the incoming message
          if (msg.type === message.type && 
              msg.content === message.content && 
              msg.senderId === message.senderId) {
            console.log('Removing temporary message that matches incoming real message:', msg.id);
            return false;
          }
          
          return true;
        });
        
        // Add the new real message and sort by timestamp
        return [...filteredMessages, message].sort((a, b) => 
          new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt)
        );
      });
    }
  }, [user.id, availableUsers]);

  // WebSocket reconnection with exponential backoff
  const reconnectWebSocket = useCallback(async (token) => {
    if (isReconnecting) return;
    
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    
    setIsReconnecting(true);
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`WebSocket connection attempt ${attempt + 1}/${maxRetries}`);
        setReconnectAttempts(attempt + 1);
        setConnectionStatus('connecting');
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
          
          connectSocket(token, 
            // Message handler
            (message) => {
              handleWebSocketMessage(message);
            },
            // Success handler
            () => {
              clearTimeout(timeout);
              resolve();
              console.log('WebSocket connected successfully');
              connectedRef.current = true;
              setConnectionStatus('connected');
            },
            // Event handlers
            {
              onDeleted: (deletedMessage) => {
                console.log('Message deleted via WebSocket subscription:', deletedMessage);
                const messageIdToDelete = deletedMessage.id;
                setMessages(prev => prev.filter(msg => msg.id !== messageIdToDelete));
              },
              onEdited: (editedMessage) => {
                console.log('Message edited via WebSocket subscription:', editedMessage);
                setMessages(prev => prev.map(msg => 
                  msg.id === editedMessage.id ? { ...msg, content: editedMessage.content } : msg
                ));
              },
              onConnectionLost: () => {
                console.log('WebSocket connection lost - triggering reconnection');
                connectedRef.current = false;
                setConnectionStatus('disconnected');
                
                // Trigger reconnection after a delay
                setTimeout(() => {
                  if (!connectedRef.current) {
                    reconnectWebSocket(token);
                  }
                }, 2000);
              }
            }
          );
        });
        
        // Success - reset retry count
        setReconnectAttempts(0);
        setIsReconnecting(false);
        console.log('WebSocket connected successfully');
        return;
        
      } catch (error) {
        console.error(`WebSocket connection attempt ${attempt + 1} failed:`, error);
        
        if (attempt < maxRetries - 1) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          console.log(`Waiting ${delay}ms before next connection attempt`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All attempts failed
    setIsReconnecting(false);
    setConnectionStatus('disconnected');
    console.error('All WebSocket connection attempts failed');
  }, [isReconnecting, handleWebSocketMessage]);

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
            console.log('Using other user ID:', otherId);
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

    const token = localStorage.getItem('token');
    let intervalId;
    let cleanupIntervalId;
    
    // Function to connect WebSocket with reconnection capability
    const connectWebSocket = async () => {
      if (!token) {
        console.log('No token available for WebSocket connection');
        return;
      }
      
      // Don't try to connect if already connected
      if (connectedRef.current) {
        console.log('WebSocket already connected, skipping connection attempt');
        return;
      }
      
      try {
        await reconnectWebSocket(token);
      } catch (error) {
        console.error('Initial WebSocket connection failed:', error);
        setConnectionStatus('disconnected');
      }
    };
    
    // Initial WebSocket connection
    if (token) {
      connectWebSocket();
      
      // Setup periodic health check and reconnection logic
      intervalId = setInterval(() => {
        const currentStatus = getConnectionStatus();
        console.log('Health check: Current WebSocket status:', currentStatus);
        
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
      // Clean up audio stream if still active
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      // Stop any ongoing recording
      if (mediaRecorderRef.current && recording) {
        mediaRecorderRef.current.stop();
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
      
      // Stop audio streams
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped audio track');
        });
        audioStreamRef.current = null;
      }
      
      // Reset refs
      sendingRef.current = false;
      connectedRef.current = false;
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      
      // Disconnect WebSocket
      try {
        disconnectSocket();
        console.log('WebSocket disconnected');
      } catch (error) {
        console.warn('Error disconnecting WebSocket:', error);
      }
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
        temporary: true // Mark as temporary
      };
      
      // Add message immediately to UI (optimistic update)
      setMessages(prev => [...prev, tempMessage]);
      
      // Always scroll to bottom when user sends a message
      setTimeout(() => {
        scrollToBottom();
        setUserScrolledUp(false);
      }, 100);
      
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
    sendingRef.current = false;
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
      const url = `https://justus-9hwt.onrender.com/api/media/file/${id}`;
      
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
      audioStreamRef.current = stream;
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
          console.log('Uploading voice message...');
          const authenticatedApi = getAuthenticatedApi();
          const res = await authenticatedApi.post('/api/media/upload', fd, { 
            headers: { 'Content-Type': 'multipart/form-data' } 
          });
          const id = res.data.id;
          // Use full URL with hostname (authentication will be handled by MessageItem)
          const url = `https://justus-9hwt.onrender.com/api/media/file/${id}`;
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
              const message = {
                type: 'audio',
                content: url,
                receiverId: targetUserId,
                conversationId
              };
              await authenticatedApi.post('/api/chat/messages', message);
              console.log('Audio sent via HTTP (WebSocket unavailable)');
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
        
        // Clean up stream
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
        setRecording(false);
      };
      
      mr.start();
      console.log('Voice recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to access microphone. Please check your permissions.');
      setRecording(false);
    }
  }

  const stopRecording = () => { 
    if (mediaRecorderRef.current && recording) {
      console.log('Stopping voice recording');
      mediaRecorderRef.current.stop();
      // Stream cleanup will happen in the onstop event handler
    }
  }

  const onEdit = (m) => { 
    setEditingMessage(m); 
    setText(m.content); 
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
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-first responsive container */}
      <div className="max-w-4xl mx-auto h-screen flex flex-col bg-white shadow-xl md:my-4 md:h-[calc(100vh-2rem)] md:rounded-2xl overflow-hidden">
        {/* Modern Chat Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 md:space-x-4">
              {/* Avatar */}
              <div className="relative">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-white font-semibold text-sm md:text-base">
                    {otherUser ? (otherUser.displayName || otherUser.username).charAt(0).toUpperCase() : 'J'}
                  </span>
                </div>
                {/* Online status indicator */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full border-2 border-white ${
                  connectionStatus === 'connected' ? 'bg-emerald-400' : 
                  connectionStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 
                  'bg-red-400'
                }`}></div>
              </div>
              
              {/* User info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-gray-900 font-semibold text-base md:text-lg truncate">
                  {otherUser ? `${otherUser.displayName || otherUser.username}` : 'JustUs Chat'}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 flex items-center space-x-1">
                  <span>{
                    connectionStatus === 'connected' ? 'Online' : 
                    connectionStatus === 'connecting' ? 
                      (isReconnecting && reconnectAttempts > 0 ? 
                        `Reconnecting... (${reconnectAttempts}/5)` : 
                        'Connecting...'
                      ) : 
                    'Offline'
                  }</span>
                  {typingUser && connectionStatus === 'connected' && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-600 animate-pulse">typing...</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            
            {/* Header actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors duration-200"
                  title="Toggle theme"
                >
                  {theme === 'light' ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                </button>
                
                {/* Debug button - remove in production */}
                <button
                  onClick={() => {
                    console.log('Current messages:', messages);
                    console.log('WebSocket status:', getConnectionStatus());
                    console.log('User ID:', user.id);
                  }}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors duration-200"
                  title="Debug info"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>              {availableUsers.length > 1 && (
                <button
                  onClick={() => setShowOtherUserModal(true)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors duration-200"
                  title="Switch user"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </button>
              )}
              
              <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors duration-200">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

          {/* Modern Messages Area */}
          <div 
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto bg-gray-50 relative"
          >
            {/* Messages container with padding for mobile/desktop */}
            <div className="px-4 py-3 md:px-6 md:py-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                    <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No messages yet</h3>
                  <p className="text-gray-500 text-sm">Start a conversation by sending a message!</p>
                </div>
              ) : (
                messages.map((m, index) => {
                  const isMe = m.senderId === user.id;
                  const isConsecutive = index > 0 && messages[index - 1].senderId === m.senderId;
                  const showAvatar = !isMe && !isConsecutive;
                  
                  return (
                    <div
                      key={m.id}
                      className={`flex items-end space-x-2 group ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                    >
                      {/* Avatar for received messages */}
                      {!isMe && (
                        <div className={`w-8 h-8 flex-shrink-0 ${showAvatar ? '' : 'invisible'}`}>
                          {showAvatar && (
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-medium">
                                {(otherUser?.displayName || otherUser?.username || 'U').charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Message bubble */}
                      <div className={`max-w-xs md:max-w-sm lg:max-w-md ${isMe ? 'order-1' : ''}`}>
                        <div
                          className={`relative px-4 py-2.5 rounded-2xl shadow-sm transition-all duration-200 ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-br-md'
                              : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
                          } ${m.temporary ? 'opacity-70' : 'hover:shadow-md'}`}
                        >
                          {/* Message content based on type */}
                          {m.type === 'text' && (
                            <div>
                              <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words">
                                {m.content}
                              </p>
                              {m.temporary && (
                                <div className="flex items-center space-x-1 mt-1">
                                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60"></div>
                                  <span className="text-xs opacity-60">Sending...</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {m.type === 'image' && (
                            <div className="space-y-2">
                              <div className="relative rounded-lg overflow-hidden bg-gray-100">
                                <img 
                                  src={m.content} 
                                  alt="Shared image" 
                                  className="max-w-full h-auto max-h-64 object-cover"
                                  onError={(e) => {
                                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDIwMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04NyA0OEMsNCA0OCA3MiA1Mi43IDcyIDU4UzgyIDY4IDg3IDY4IDEwMiA2My4zIDEwMiA1OCA5Ny4zIDQ4IDg3IDQ4WiIgZmlsbD0iIzlDQTNBRiIvPgo8cGF0aCBkPSJNMTMwIDY4TDExMCA4MEw5MCA2OEwxMzAgNjhaIiBmaWxsPSIjOUNBM0FGIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iNzAiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM2QjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPgo=';
                                  }}
                                />
                              </div>
                              {m.temporary && (
                                <div className="flex items-center space-x-1">
                                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60"></div>
                                  <span className="text-xs opacity-60">Sending...</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {m.type === 'audio' && (
                            <AudioMessage message={m} mine={isMe} />
                          )}
                          
                          {/* Message timestamp and status */}
                          <div className={`flex items-center justify-end space-x-1 mt-1 ${
                            isMe ? 'text-indigo-200' : 'text-gray-400'
                          }`}>
                            <span className="text-xs">
                              {new Date(m.timestamp).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                            {isMe && (
                              <div className="flex">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                {m.read && (
                                  <svg className="w-3 h-3 -ml-1 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Message actions (edit/delete) */}
                          {isMe && !m.temporary && (
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1">
                              <button
                                onClick={() => onEdit(m)}
                                className="p-1 rounded-full bg-black/10 hover:bg-black/20 text-white/70 hover:text-white transition-colors"
                                title="Edit message"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  console.log('Delete button clicked for message:', m);
                                  onDelete(m);
                                }}
                                className="p-1 rounded-full bg-black/10 hover:bg-red-500 text-white/70 hover:text-white transition-colors"
                                title="Delete message"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          )}
                          
                          {/* Mobile context menu trigger */}
                          {isMe && !m.temporary && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                // Better mobile approach with options
                                const actions = ['Edit', 'Delete', 'Cancel'];
                                const choice = window.prompt(
                                  'Choose an action:\n1. Edit\n2. Delete\n3. Cancel\n\nEnter number (1-3):',
                                  '1'
                                );
                                
                                switch(choice) {
                                  case '1':
                                    onEdit(m);
                                    break;
                                  case '2':
                                    onDelete(m);
                                    break;
                                  default:
                                    // Cancel or invalid input
                                    break;
                                }
                              }}
                              className="absolute top-1 right-1 md:hidden p-1 rounded-full bg-black/10 text-white/70 opacity-60 hover:opacity-100"
                              title="Message options"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Spacing for sent messages */}
                      {isMe && <div className="w-8"></div>}
                    </div>
                  );
                })
              )}
              
              {/* Typing indicator */}
              {typingUser && (
                <div className="flex items-end space-x-2 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="w-8 h-8">
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-medium">
                        {(typingUser).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Scroll to bottom button - appears when user scrolled up */}
            {userScrolledUp && (
              <div className="absolute bottom-4 right-4 z-10">
                <button
                  onClick={() => {
                    scrollToBottom();
                    setUserScrolledUp(false);
                  }}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 border-2 border-white"
                  title="Scroll to bottom"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M15.707 4.293a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-5-5a1 1 0 011.414-1.414L10 8.586l4.293-4.293a1 1 0 011.414 0zm0 6a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-5-5a1 1 0 111.414-1.414L10 14.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}
            
            {/* Scroll to bottom ref */}
            <div ref={messagesEndRef} />
          </div>

          {/* Modern Input Area */}
          <div className="border-t border-gray-200 bg-white px-4 py-3 md:px-6 md:py-4">
            {editingMessage && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  <span className="text-sm font-medium text-amber-800">Editing message</span>
                </div>
                <button 
                  onClick={cancelEdit} 
                  className="p-1 rounded-lg hover:bg-amber-100 text-amber-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}
            
            <form onSubmit={send} className="flex items-end space-x-3">
              {/* Text input area */}
              <div className="flex-1 relative">
                <div className="relative">
                  <textarea
                    className="w-full px-4 py-3 pr-12 bg-gray-100 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-all duration-200 placeholder-gray-500 text-gray-900 text-sm md:text-base leading-relaxed"
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
                    placeholder={!otherUser ? "Select a user to chat with..." : "Type a message..."}
                    rows="1"
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                    disabled={!otherUser}
                  />
                  
                  {/* Attach file button inside input */}
                  <label className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-colors duration-200 cursor-pointer ${
                    !otherUser || uploading ? 'text-gray-400 cursor-not-allowed' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                  }`}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => { if(e.target.files[0]) uploadImage(e.target.files[0]); }}
                      className="hidden"
                      disabled={!otherUser || uploading}
                    />
                    {uploading ? (
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    )}
                  </label>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex space-x-2">
                {/* Voice recording button */}
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  className={`p-3 rounded-full transition-all duration-200 ${
                    !otherUser 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : recording 
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg animate-pulse' 
                        : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                  }`}
                  disabled={!otherUser}
                >
                  {recording ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a2 2 0 114 0v4a2 2 0 11-4 0V7z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Send button */}
                <button
                  type="submit"
                  disabled={!text.trim() || !otherUser || sending}
                  className={`px-4 py-3 rounded-full transition-all duration-200 font-medium text-white shadow-lg ${
                    !text.trim() || !otherUser || sending
                      ? 'bg-gray-400 cursor-not-allowed shadow-none'
                      : connectionStatus === 'connected' 
                        ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-xl active:scale-95' 
                        : 'bg-orange-500 hover:bg-orange-600 hover:shadow-xl active:scale-95'
                  }`}
                  title={connectionStatus !== 'connected' ? 'Offline mode - messages will be sent when reconnected' : 'Send message'}
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : editingMessage ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
            
            {/* Connection status bar */}
            {connectionStatus !== 'connected' && (
              <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-amber-800">
                    {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline - messages will be sent when connection is restored'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Modern User Selection Modal */}
      {showOtherUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 animate-in zoom-in-95 duration-300">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Select Chat Partner</h3>
              <p className="text-gray-500 text-sm">Choose who you want to chat with</p>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableUsers.filter(u => u.id !== user.id).map(u => (
                <button
                  key={u.id}
                  onClick={() => selectOtherUser(u.id)}
                  className="w-full text-left p-4 hover:bg-gray-50 rounded-xl transition-colors duration-200 border border-transparent hover:border-gray-200"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-white font-semibold">
                        {(u.displayName || u.username).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">
                        {u.displayName || u.username}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        ID: {u.id.slice(0, 8)}...
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowOtherUserModal(false)}
              className="mt-6 w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl transition-colors duration-200 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
