import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(token, onMessage, onConnected, handlers = {}){
  if (socket && socket.connected) {
    console.log('WebSocket already connected');
    // Call onConnected immediately if we're already connected
    if (onConnected) {
      setTimeout(onConnected, 100);
    }
    return;
  }

  // Clean up any existing socket before creating a new one
  if (socket) {
    try {
      socket.disconnect();
    } catch (e) {
      console.log('Error disconnecting existing socket:', e);
    }
  }

  console.log('Creating new Socket.IO connection with token:', token ? 'present' : 'missing');

  // Create Socket.IO connection
  socket = io('http://localhost:8080', {
    auth: {
      token: token
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionAttempts: 5
  });

  // Connection event
  socket.on('connect', () => {
    console.log('Socket.IO connected');
    if (onConnected) onConnected();
  });

  // Listen for incoming messages
  socket.on('message', (data) => {
    console.log('Received message:', data);
    if (onMessage) onMessage(data);
  });

  // Listen for edited messages
  socket.on('messages.edited', (data) => {
    console.log('Message edited:', data);
    if (handlers.onEdited) handlers.onEdited(data);
  });

  // Listen for deleted messages
  socket.on('messages.deleted', (data) => {
    console.log('Message deleted:', data);
    if (handlers.onDeleted) handlers.onDeleted(data);
  });

  // Listen for typing events
  socket.on('typing', (data) => {
    console.log('User typing:', data);
    if (handlers.onTyping) handlers.onTyping(data);
  });

  // Listen for read receipts
  socket.on('MESSAGE_READ', (data) => {
    console.log('Message read:', data);
    if (handlers.onRead) handlers.onRead(data.message);
  });

  // Disconnect event
  socket.on('disconnect', (reason) => {
    console.log('Socket.IO disconnected:', reason);
    if (handlers.onConnectionLost) {
      setTimeout(() => {
        handlers.onConnectionLost();
      }, 500);
    }
  });

  // Connection error
  socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
    if (handlers.onConnectionLost) {
      setTimeout(() => {
        handlers.onConnectionLost();
      }, 500);
    }
  });

  // General error
  socket.on('error', (error) => {
    console.error('Socket.IO error:', error);
  });
}

export function sendSocketMessage(message){
  if (!socket) {
    console.error('Cannot send message - Socket not initialized');
    return false;
  }
  
  if (!socket.connected) {
    console.error('Cannot send message - Socket not connected');
    return false;
  }
  
  let eventName = 'chat.send';
  if (message.type === 'delete') eventName = 'chat.delete';
  else if (message.type === 'typing') eventName = 'chat.typing';
  else if (message.id && message.type === 'text') eventName = 'chat.edit';
  
  console.log('Sending message with event:', eventName, ':', message);
  
  try {
    socket.emit(eventName, message);
    console.log('Message sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send Socket.IO message:', error);
    return false;
  }
}

export function disconnectSocket(){
  if (socket) {
    try {
      console.log('Disconnecting Socket.IO...');
      socket.disconnect();
      socket = null;
    } catch (e) {
      console.error('Error disconnecting Socket.IO:', e);
    }
  }
}

export function getConnectionStatus() {
  if (!socket) return 'disconnected';
  if (socket.connected) return 'connected';
  if (socket.connecting) return 'connecting';
  return 'disconnected';
}

export function isWebSocketConnected() {
  return socket && socket.connected;
}

export function getSocket() {
  return socket;
}
