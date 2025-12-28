import { verifyToken } from '../utils/jwtUtil.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import messageService from '../services/messageService.js';
import CryptoService from '../services/cryptoService.js';
import User from '../models/User.js';
import botService from '../services/botService.js';
import geminiService from '../services/geminiService.js';
import mongoose from 'mongoose';

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

    // Broadcast user online status to all connected users
    socket.broadcast.emit('user:status', {
      userId: socket.userId,
      username: socket.username,
      status: 'online'
    });

    // Handle key exchange for E2EE
    socket.on('crypto.exchange-key', async (data) => {
      try {
        const { receiverId, publicKey } = data;
        const userId = socket.userId;

        console.log(`Key exchange: ${userId} -> ${receiverId}`);

        // Store/update user's public key
        await User.updateOne(
          { _id: userId },
          { publicKey },
          { upsert: false }
        );

        // Send requester's public key to the other user
        io.to(`user:${receiverId}`).emit('crypto.key-offer', {
          userId,
          username: socket.username,
          publicKey
        });

        socket.emit('crypto.key-sent');
      } catch (error) {
        console.error('Error handling crypto.exchange-key:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Handle chat.send with encryption support
    socket.on('chat.send', async (incoming) => {
      try {
        console.log('=== WEBSOCKET MESSAGE RECEIVED ===');
        console.log('Incoming message (encrypted):', !!incoming.ciphertext);
        console.log('Sender ID from socket:', socket.userId);
        console.log('Receiver ID:', incoming.receiverId);
        console.log('Conversation ID:', incoming.conversationId);

        const userId = socket.userId;

        const messageData = {
          senderId: userId,
          receiverId: incoming.receiverId,
          type: incoming.type,
          content: incoming.ciphertext || incoming.content,  // Use encrypted content if provided
          encryptionNonce: incoming.nonce || null,  // Store nonce for decryption
          metadata: incoming.metadata || null,
          replyTo: incoming.replyTo || null,
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

        // Translation process moved to async block after broadcasting
        const textForTranslation = incoming.plaintext || (!incoming.ciphertext ? incoming.content : null);

        console.log('Saving message to database...');
        const message = new Message(messageData);
        const saved = await message.save();
        console.log('Message saved with ID:', saved._id);

        // Populate replyTo if exists
        if (saved.replyTo) {
          await saved.populate('replyTo', 'senderId type content metadata timestamp');
        }

        // Convert to DTO with user information
        const messageDTO = await messageService.convertToDTO(saved);

        console.log('[Backend] Broadcasting DTO:', {
          id: messageDTO.id,
          translatedText: messageDTO.translatedText,
          translatedLanguage: messageDTO.translatedLanguage
        });

        // Send to both sender and receiver
        console.log('Broadcasting message to sender: user:' + userId);
        io.to(`user:${userId}`).emit('message', messageDTO);

        console.log('Broadcasting message to receiver: user:' + incoming.receiverId);
        io.to(`user:${incoming.receiverId}`).emit('message', messageDTO);

        console.log('=== MESSAGE PROCESSING COMPLETE ===');

        // Async Translation for Text
        if (textForTranslation && incoming.type === 'text') {
          (async () => {
            try {
              console.log('[Backend] Starting async translation...');
              // Create a copy of messageData to avoid mutation issues if any
              const translationResult = await messageService.processMessageTranslation({ ...messageData }, textForTranslation);

              if (translationResult.translatedText) {
                console.log('Async translation completed, updating message:', saved._id);

                // Update DB with translation
                // We explicitly set showOriginal: true by default so receiver sees original first
                const updatedMsg = await Message.findByIdAndUpdate(
                  saved._id,
                  {
                    translatedText: translationResult.translatedText,
                    translatedLanguage: translationResult.translatedLanguage,
                    originalLanguage: translationResult.originalLanguage,
                    showOriginal: true
                  },
                  { new: true }
                );

                // Broadcast update
                const updatedDTO = await messageService.convertToDTO(updatedMsg);

                // Use 'message.updated' event
                io.to(`user:${userId}`).emit('message.updated', updatedDTO);
                io.to(`user:${incoming.receiverId}`).emit('message.updated', updatedDTO);
              } else {
                console.log('[Backend] No translation needed (same language or failed)');
              }
            } catch (err) {
              console.error('Async translation failed:', err);
            }
          })();
        }

        // Async Processing for Audio (Transcription + Translation)
        if (incoming.type === 'audio' && incoming.content) {
          (async () => {
            try {
              console.log('[Backend] Starting async audio processing...');

              // Extract file ID from URL (e.g., http://host/api/media/files/<id>)
              const urlParts = incoming.content.split('/');
              const fileId = urlParts[urlParts.length - 1].split('?')[0];

              if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
                console.error('[Backend] Invalid file ID for audio processing:', fileId);
                return;
              }

              // Retrieve file from GridFS
              const db = mongoose.connection.db;
              const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'fs' });

              const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
              const chunks = [];

              downloadStream.on('data', (chunk) => chunks.push(chunk));

              downloadStream.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                const filesCollection = db.collection('fs.files');
                const fileDoc = await filesCollection.findOne({ _id: new mongoose.Types.ObjectId(fileId) });
                const mimeType = fileDoc?.contentType || 'audio/webm'; // Default to webm if unknown

                // 1. Transcribe Audio
                const transcript = await geminiService.transcribeAudio(buffer, mimeType);

                if (transcript) {
                  console.log('[Backend] Transcription success:', transcript.substring(0, 30) + '...');

                  // 2. Translate Transcript (if languages differ)
                  const translationResult = await messageService.processMessageTranslation(
                    { ...messageData, senderId: userId, receiverId: incoming.receiverId },
                    transcript
                  );

                  // 3. Update Message Metadata
                  const updateData = {
                    'metadata.transcript': transcript,
                  };

                  if (translationResult.translatedText) {
                    updateData['metadata.translatedTranscript'] = translationResult.translatedText;
                    updateData['metadata.targetLanguage'] = translationResult.translatedLanguage;
                  }

                  const updatedMsg = await Message.findByIdAndUpdate(
                    saved._id,
                    { $set: updateData },
                    { new: true }
                  );

                  // 4. Emit Update
                  const updatedDTO = await messageService.convertToDTO(updatedMsg);
                  io.to(`user:${userId}`).emit('message.updated', updatedDTO);
                  io.to(`user:${incoming.receiverId}`).emit('message.updated', updatedDTO);

                  console.log('[Backend] Audio processing complete. Transcript length:', transcript.length);
                } else {
                  console.log('[Backend] Transcription returned empty result');
                }
              });

              downloadStream.on('error', (err) => {
                console.error('[Backend] Error reading audio file stream:', err);
              });

            } catch (err) {
              console.error('[Backend] Async audio processing failed:', err);
            }
          })();
        }

        // Check if this is a bot command
        if (incoming.content && botService.isBotCommand(incoming.content)) {
          console.log('Bot command detected, processing...');
          handleBotMessage(io, socket, incoming, saved);
        }

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
        const username = socket.username;
        const { receiverId } = payload;

        if (!receiverId) {
          console.error('Missing receiverId in typing message');
          return;
        }

        // Emit typing event with sender info
        io.to(`user:${receiverId}`).emit('typing', {
          senderId: userId,
          username: username,
          type: 'typing'
        });

        console.log(`Typing event: ${username} (${userId}) -> ${receiverId}`);
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

      // Broadcast user offline status to all connected users
      socket.broadcast.emit('user:status', {
        userId: socket.userId,
        username: socket.username,
        status: 'offline'
      });
    });
  });
};

/**
 * Handle bot messages - process and respond to bot commands
 */
async function handleBotMessage(io, socket, incoming, userMessage) {
  try {
    const userId = socket.userId;
    const conversationId = userMessage.conversationId;

    console.log('Processing bot command:', incoming.content);

    // Get recent conversation context
    const recentMessages = await Message.find({ conversationId })
      .sort({ timestamp: -1 })
      .limit(10)
      .select('senderId content timestamp isBot')
      .lean();

    const context = {
      recentMessages: recentMessages.reverse().map(msg => ({
        sender: msg.isBot ? 'Bot' : 'User',
        text: msg.content,
        timestamp: msg.timestamp
      })),
      userId,
      conversationId
    };

    // Process through bot service
    const botResponse = await botService.handleBotMessage(incoming.content, context);

    if (botResponse.success && botResponse.response) {
      // Create bot message
      const botMessageData = {
        senderId: 'bot',
        receiverId: userId,
        conversationId: conversationId,
        type: 'text',
        content: botResponse.response,
        isBot: true,
        timestamp: new Date(),
        delivered: true,
        deliveredAt: new Date()
      };

      const botMessage = new Message(botMessageData);
      const savedBotMessage = await botMessage.save();

      // Convert to DTO
      const botMessageDTO = await messageService.convertToDTO(savedBotMessage);

      // Emit bot response to user
      console.log('Sending bot response to user:', userId);
      io.to(`user:${userId}`).emit('message', botMessageDTO);

      // Also emit to the receiver if this is a group conversation
      if (incoming.receiverId && incoming.receiverId !== userId) {
        io.to(`user:${incoming.receiverId}`).emit('message', botMessageDTO);
      }
    } else {
      console.error('Bot service error:', botResponse.error);
      // Send error message as bot response
      const errorMessage = new Message({
        senderId: 'bot',
        receiverId: userId,
        conversationId: conversationId,
        type: 'text',
        content: botResponse.response || 'Sorry, I encountered an error.',
        isBot: true,
        timestamp: new Date()
      });

      const saved = await errorMessage.save();
      const dto = await messageService.convertToDTO(saved);
      io.to(`user:${userId}`).emit('message', dto);
    }
  } catch (error) {
    console.error('Error in handleBotMessage:', error);
    // Don't emit error to avoid disrupting user experience
  }
}

