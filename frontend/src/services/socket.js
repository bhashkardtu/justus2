import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

let client = null;

export function connectSocket(token, onMessage, onConnected, handlers = {}){
  if (client && client.active) {
    console.log('WebSocket already connected and active');
    // Call onConnected immediately if we're already connected
    if (onConnected) {
      setTimeout(onConnected, 100);
    }
    return;
  }

  // Clean up any existing client before creating a new one
  if (client) {
    try {
      client.deactivate();
    } catch (e) {
      console.log('Error deactivating existing client:', e);
    }
  }

  console.log('Creating new WebSocket connection with token:', token ? 'present' : 'missing');
  
  // Decode token to get user ID for user-specific subscriptions
  let userId = null;
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
      console.log('Extracted user ID from token:', userId);
    } catch (e) {
      console.error('Failed to extract user ID from token:', e);
    }
  }

  client = new Client({
    webSocketFactory: () => new SockJS('https://justus-9hwt.onrender.com/ws?token=' + token),
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      console.log('WebSocket connected, subscribing to topics...');
      
      // Subscribe to user-specific topic for receiving messages
      if (userId) {
        console.log('Subscribing to user topic: /topic/user/' + userId);
        client.subscribe('/topic/user/' + userId, msg => {
          try { 
            const body = JSON.parse(msg.body); 
            console.log('Received message on user topic:', body);
            onMessage && onMessage(body); 
          } catch(e){
            console.error('Error parsing message:', e);
          }
        });
      }
      
      // Keep global subscription as fallback
      client.subscribe('/topic/messages', msg => {
        try { 
          const body = JSON.parse(msg.body); 
          console.log('Received message on global topic:', body);
          onMessage && onMessage(body); 
        } catch(e){
          console.error('Error parsing message:', e);
        }
      });
      
      client.subscribe('/topic/messages.edited', msg => { try { handlers.onEdited && handlers.onEdited(JSON.parse(msg.body)); } catch(e){} });
      client.subscribe('/topic/messages.deleted', msg => { try { handlers.onDeleted && handlers.onDeleted(JSON.parse(msg.body)); } catch(e){} });
      client.subscribe('/user/queue/typing', msg => { try { handlers.onTyping && handlers.onTyping(JSON.parse(msg.body)); } catch(e){} });
      client.subscribe('/topic/messages.read', msg => { try { handlers.onRead && handlers.onRead(JSON.parse(msg.body)); } catch(e){} });
      if (onConnected) onConnected();
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
      if (handlers.onConnectionLost) {
        setTimeout(() => {
          handlers.onConnectionLost();
        }, 500);
      }
    },
    onStompError: (frame) => {
      console.error('WebSocket error:', frame);
      if (handlers.onConnectionLost) {
        setTimeout(() => {
          handlers.onConnectionLost();
        }, 500);
      }
    }
  });
  client.activate();
}

export function sendSocketMessage(message){
  if (!client) {
    console.error('Cannot send message - WebSocket client not initialized');
    return false;
  }
  
  if (!client.active) {
    console.error('Cannot send message - WebSocket not connected');
    return false;
  }
  
  // Additional check to ensure we're actually connected
  if (!client.connected) {
    console.error('Cannot send message - WebSocket client reports not connected');
    return false;
  }
  
  let destination = '/app/chat.send';
  if (message.type === 'delete') destination = '/app/chat.delete';
  else if (message.type === 'typing') destination = '/app/chat.typing';
  else if (message.id && message.type === 'text') destination = '/app/chat.edit';
  
  console.log('Sending message to', destination, ':', message);
  console.log('WebSocket connection state:', {
    active: client.active,
    connected: client.connected,
    state: client.state
  });
  
  try {
    client.publish({ destination, body: JSON.stringify(message) });
    console.log('Message published successfully');
    return true;
  } catch (error) {
    console.error('Failed to send WebSocket message:', error);
    return false;
  }
}

export function disconnectSocket(){
  if (client) {
    try {
      console.log('Disconnecting WebSocket...');
      client.deactivate();
      client = null;
    } catch (e) {
      console.error('Error disconnecting WebSocket:', e);
    }
  }
}

export function getConnectionStatus() {
  if (!client) return 'disconnected';
  if (client.active && client.connected) return 'connected';
  if (client.active) return 'connecting';
  return 'disconnected';
}

export function isWebSocketConnected() {
  return client && client.active && client.connected;
}
