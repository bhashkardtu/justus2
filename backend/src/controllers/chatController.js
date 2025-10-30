import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import messageService from '../services/messageService.js';

export const getMessages = async (req, res) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.query;
    
    console.log('=== LOADING MESSAGES ===');
    console.log('User ID:', userId);
    console.log('Conversation ID:', conversationId);
    
    if (conversationId) {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        console.log('Conversation not found:', conversationId);
        return res.json([]);
      }
      
      console.log('Conversation participants:', conversation.participantA, 'and', conversation.participantB);
      
      if (userId !== conversation.participantA && userId !== conversation.participantB) {
        console.log('User not participant in conversation');
        return res.json([]);
      }
      
      const messages = await Message.find({
        conversationId,
        deleted: false
      })
      .populate('replyTo', 'senderId type content metadata timestamp')
      .sort({ timestamp: 1 });
      
      console.log(`Found ${messages.length} non-deleted messages in conversation`);
      messages.forEach(msg => {
        console.log(`Message: id=${msg._id}, sender=${msg.senderId}, receiver=${msg.receiverId}, type=${msg.type}, content=${msg.content}`);
      });
      
      const dtos = await messageService.convertToDTOs(messages);
      return res.json(dtos);
    }
    
    const messages = await Message.find({
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    }).sort({ timestamp: 1 });
    
    console.log(`Found ${messages.length} messages for user`);
    messages.forEach(msg => {
      console.log(`Message: id=${msg._id}, sender=${msg.senderId}, receiver=${msg.receiverId}, type=${msg.type}, content=${msg.content}`);
    });
    
    const dtos = await messageService.convertToDTOs(messages);
    res.json(dtos);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const messageData = req.body;
    
    messageData.senderId = userId;
    messageData.timestamp = new Date();
    
    // Ensure conversation exists
    if (!messageData.conversationId && messageData.receiverId) {
      const a = userId;
      const b = messageData.receiverId;
      const key = a <= b ? `${a}:${b}` : `${b}:${a}`;
      
      let conversation = await Conversation.findOne({ key });
      if (!conversation) {
        conversation = new Conversation({
          participantA: a,
          participantB: b,
          key
        });
        conversation = await conversation.save();
      }
      messageData.conversationId = conversation._id.toString();
    }
    
    const message = new Message(messageData);
    const saved = await message.save();
    res.json(saved);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getOrCreateConversation = async (req, res) => {
  try {
    const userId = req.userId;
    const { other } = req.query;
    
    console.log(`Getting/creating conversation between ${userId} and ${other}`);
    
    // Validate inputs
    if (!userId) {
      console.error('userId is missing from request');
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    if (!other) {
      console.error('other parameter is missing from query');
      return res.status(400).json({ message: 'Other user ID is required' });
    }
    
    if (userId === other) {
      console.error('Cannot create conversation with self');
      return res.status(400).json({ message: 'Cannot create conversation with yourself' });
    }
    
    const a = userId;
    const b = other;
    const key = a <= b ? `${a}:${b}` : `${b}:${a}`;
    
    console.log('Conversation key:', key);
    
    let conversation = await Conversation.findOne({ key });
    if (!conversation) {
      console.log('Creating new conversation');
      conversation = new Conversation({
        participantA: a,
        participantB: b,
        key
      });
      conversation = await conversation.save();
      console.log('Created conversation with ID:', conversation._id);
    } else {
      console.log('Found existing conversation:', conversation._id);
    }
    
    // Transform response to include both _id and id for compatibility
    const response = {
      _id: conversation._id,
      id: conversation._id.toString(),
      participantA: conversation.participantA,
      participantB: conversation.participantB,
      key: conversation.key,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    };
    
    res.json(response);
  } catch (error) {
    console.error('Get/create conversation error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: error.message, error: error.toString() });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }
    
    console.log(`Marking messages as read for user ${userId} in conversation ${conversationId}`);
    
    // Find all unread messages in this conversation where the user is the receiver
    const unreadMessages = await Message.find({
      conversationId,
      receiverId: userId,
      read: false
    });
    
    if (unreadMessages.length > 0) {
      const readTime = new Date();
      
      // Mark all as read
      await Message.updateMany(
        {
          conversationId,
          receiverId: userId,
          read: false
        },
        {
          $set: {
            read: true,
            readAt: readTime
          }
        }
      );
      
      console.log(`Marked ${unreadMessages.length} messages as read`);
      
      // Note: WebSocket notifications will be sent from the socket handler
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Debug endpoints
export const createTestMessage = async (req, res) => {
  console.log('=== CREATING TEST MESSAGE ===');
  
  const testMessage = new Message({
    senderId: '689f7595ef133a08d0922eb8', // bkb
    receiverId: '689f7c82d7f2234bb27bb1de', // aditya
    conversationId: '689f7c82d7f2234bb27bb1df', // existing conversation
    content: 'This is a test message from bkb to aditya',
    type: 'text',
    timestamp: new Date(),
    edited: false,
    deleted: false
  });
  
  const saved = await testMessage.save();
  console.log('Created test message with ID:', saved._id);
  
  res.send(`Test message created with ID: ${saved._id}`);
};

export const getAllMessages = async (req, res) => {
  console.log('=== DEBUG: GET ALL MESSAGES ===');
  const messages = await Message.find({});
  console.log(`Found ${messages.length} messages`);
  messages.forEach(msg => {
    console.log(`Message ID: ${msg._id}, Content: ${msg.content}, Sender: ${msg.senderId}, Receiver: ${msg.receiverId}`);
  });
  res.json(messages);
};

export const getAllConversations = async (req, res) => {
  console.log('=== DEBUG: GET ALL CONVERSATIONS ===');
  const conversations = await Conversation.find({});
  console.log(`Found ${conversations.length} conversations`);
  conversations.forEach(conv => {
    console.log(`Conversation ID: ${conv._id}, Key: ${conv.key}, Participants: ${conv.participantA} <-> ${conv.participantB}`);
  });
  res.json(conversations);
};
