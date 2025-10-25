import { verifyToken } from '../utils/jwtUtil.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import messageService from '../services/messageService.js';

export const configureSocketIO = (io) => {
  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    try {
      // Try to get token from handshake auth
      let token = socket.handshake.auth.token;
      
      // If not in auth, try query params
      if (!token) {
        token = socket.handshake.query.token;
      }
      
      // If not in query, try headers
      if (!token) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }
      
      if (!token) {
        console.log('WebSocket connection rejected: No token provided');
        return next(new Error('Authentication required'));
      }
      
      const decoded = verifyToken(token);
      if (!decoded) {
        console.log('WebSocket connection rejected: Invalid token');
        return next(new Error('Invalid token'));
      }
      
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      console.log(`WebSocket authenticated for user: ${socket.userId}`);
      next();
    } catch (error) {
      console.log('WebSocket authentication error:', error.message);
      next(new Error('Authentication failed'));
    }
  });
  
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);
    
    // Join user-specific room
    socket.join(`user:${socket.userId}`);
    
    // Handle chat.send
    socket.on('chat.send', async (incoming) => {
      try {
        console.log('=== WEBSOCKET MESSAGE RECEIVED ===');
        console.log('Incoming message:', incoming.content);
        console.log('Sender ID from socket:', socket.userId);
        console.log('Receiver ID:', incoming.receiverId);
        console.log('Conversation ID:', incoming.conversationId);
        
        const userId = socket.userId;
        
        const messageData = {
          senderId: userId,
          receiverId: incoming.receiverId,
          type: incoming.type,
          content: incoming.content,
          metadata: incoming.metadata || null,
          timestamp: new Date(),
          delivered: true,
          deliveredAt: new Date()
        };
        
        // Attach or create conversation
        if (incoming.conversationId) {
          console.log('Using existing conversation:', incoming.conversationId);
          messageData.conversationId = incoming.conversationId;
        } else if (incoming.receiverId) {
          const a = userId;
          const b = incoming.receiverId;
          const key = a <= b ? `${a}:${b}` : `${b}:${a}`;
          console.log('Creating/finding conversation with key:', key);
          
          let conversation = await Conversation.findOne({ key });
          if (!conversation) {
            console.log('Creating new conversation');
            conversation = new Conversation({
              participantA: a,
              participantB: b,
              key
            });
            conversation = await conversation.save();
            console.log('Saved new conversation with ID:', conversation._id);
          } else {
            console.log('Found existing conversation:', conversation._id);
          }
          messageData.conversationId = conversation._id.toString();
        }
        
        console.log('Saving message to database...');
        const message = new Message(messageData);
        const saved = await message.save();
        console.log('Message saved with ID:', saved._id);
        
        // Convert to DTO with user information
        const messageDTO = await messageService.convertToDTO(saved);
        
        // Send to both sender and receiver
        console.log('Broadcasting message to sender: user:' + userId);
        io.to(`user:${userId}`).emit('message', messageDTO);
        
        console.log('Broadcasting message to receiver: user:' + incoming.receiverId);
        io.to(`user:${incoming.receiverId}`).emit('message', messageDTO);
        
        console.log('=== MESSAGE PROCESSING COMPLETE ===');
      } catch (error) {
        console.error('Error handling chat.send:', error);
        socket.emit('error', { message: error.message });
      }
    });
    
    // Handle chat.edit
    socket.on('chat.edit', async (incoming) => {
      try {
        const message = await Message.findById(incoming.id);
        if (!message) return;
        
        message.content = incoming.content;
        message.edited = true;
        message.editedAt = new Date();
        
        const saved = await message.save();
        const messageDTO = await messageService.convertToDTO(saved);
        
        io.emit('messages.edited', messageDTO);
      } catch (error) {
        console.error('Error handling chat.edit:', error);
        socket.emit('error', { message: error.message });
      }
    });
    
    // Handle chat.delete
    socket.on('chat.delete', async (incoming) => {
      try {
        const message = await Message.findById(incoming.id);
        if (!message) return;
        
        message.deleted = true;
        const saved = await message.save();
        const messageDTO = await messageService.convertToDTO(saved);
        
        io.emit('messages.deleted', messageDTO);
      } catch (error) {
        console.error('Error handling chat.delete:', error);
        socket.emit('error', { message: error.message });
      }
    });
    
    // Handle chat.typing
    socket.on('chat.typing', (payload) => {
      try {
        const userId = socket.userId;
        const { receiverId } = payload;
        
        if (!receiverId) {
          console.error('Missing receiverId in typing message');
          return;
        }
        
        io.to(`user:${receiverId}`).emit('typing', { user: userId });
      } catch (error) {
        console.error('Error handling chat.typing:', error);
      }
    });
    
    // Handle chat.read
    socket.on('chat.read', async (payload) => {
      try {
        const { messageId } = payload;
        const userId = socket.userId;
        
        if (!messageId || !userId) {
          console.error('Missing messageId or userId in read message');
          return;
        }
        
        const message = await Message.findById(messageId);
        if (!message) {
          console.error('Message not found:', messageId);
          return;
        }
        
        // Only mark as read if the current user is the receiver
        if (userId !== message.receiverId) {
          console.error('User', userId, 'is not authorized to mark message', messageId, 'as read');
          return;
        }
        
        // Mark as read
        message.read = true;
        message.readAt = new Date();
        const savedMessage = await message.save();
        
        // Convert to DTO and notify the sender about read receipt
        const messageDTO = await messageService.convertToDTO(savedMessage);
        io.to(`user:${message.senderId}`).emit('MESSAGE_READ', {
          type: 'MESSAGE_READ',
          message: messageDTO
        });
      } catch (error) {
        console.error('Error handling chat.read:', error);
      }
    });
    
    // Handle voice call signaling
    socket.on('call.offer', (data) => {
      try {
        console.log('Call offer from', socket.userId, 'to', data.receiverId);
        io.to(`user:${data.receiverId}`).emit('call.offer', {
          senderId: socket.userId,
          callerName: socket.username,
          offer: data.offer
        });
      } catch (error) {
        console.error('Error handling call.offer:', error);
      }
    });

    socket.on('call.answer', (data) => {
      try {
        console.log('Call answer from', socket.userId, 'to', data.receiverId);
        io.to(`user:${data.receiverId}`).emit('call.answer', {
          senderId: socket.userId,
          answer: data.answer
        });
      } catch (error) {
        console.error('Error handling call.answer:', error);
      }
    });

    socket.on('call.ice-candidate', (data) => {
      try {
        io.to(`user:${data.receiverId}`).emit('call.ice-candidate', {
          senderId: socket.userId,
          candidate: data.candidate
        });
      } catch (error) {
        console.error('Error handling call.ice-candidate:', error);
      }
    });

    socket.on('call.reject', (data) => {
      try {
        console.log('Call rejected by', socket.userId);
        io.to(`user:${data.receiverId}`).emit('call.reject', {
          senderId: socket.userId
        });
      } catch (error) {
        console.error('Error handling call.reject:', error);
      }
    });

    socket.on('call.end', (data) => {
      try {
        console.log('Call ended by', socket.userId);
        io.to(`user:${data.receiverId}`).emit('call.end', {
          senderId: socket.userId
        });
      } catch (error) {
        console.error('Error handling call.end:', error);
      }
    });
    
    // Handle video call signaling
    socket.on('video-call.offer', (data) => {
      try {
        console.log('Video call offer from', socket.userId, 'to', data.receiverId);
        io.to(`user:${data.receiverId}`).emit('video-call.offer', {
          senderId: socket.userId,
          callerName: socket.username,
          offer: data.offer
        });
      } catch (error) {
        console.error('Error handling video-call.offer:', error);
      }
    });

    socket.on('video-call.answer', (data) => {
      try {
        console.log('Video call answer from', socket.userId, 'to', data.receiverId);
        io.to(`user:${data.receiverId}`).emit('video-call.answer', {
          senderId: socket.userId,
          answer: data.answer
        });
      } catch (error) {
        console.error('Error handling video-call.answer:', error);
      }
    });

    socket.on('video-call.ice-candidate', (data) => {
      try {
        io.to(`user:${data.receiverId}`).emit('video-call.ice-candidate', {
          senderId: socket.userId,
          candidate: data.candidate
        });
      } catch (error) {
        console.error('Error handling video-call.ice-candidate:', error);
      }
    });

    socket.on('video-call.reject', (data) => {
      try {
        console.log('Video call rejected by', socket.userId);
        io.to(`user:${data.receiverId}`).emit('video-call.reject', {
          senderId: socket.userId
        });
      } catch (error) {
        console.error('Error handling video-call.reject:', error);
      }
    });

    socket.on('video-call.end', (data) => {
      try {
        console.log('Video call ended by', socket.userId);
        io.to(`user:${data.receiverId}`).emit('video-call.end', {
          senderId: socket.userId
        });
      } catch (error) {
        console.error('Error handling video-call.end:', error);
      }
    });
    
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
};
