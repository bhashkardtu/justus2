import express from 'express';
import {
  getMessages,
  sendMessage,
  getOrCreateConversation,
  markMessagesAsRead,
  createTestMessage,
  getAllMessages,
  getAllConversations
} from '../controllers/chatController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.get('/messages', authenticateJWT, getMessages);
router.post('/messages', authenticateJWT, sendMessage);
router.post('/conversation', authenticateJWT, getOrCreateConversation);
router.post('/messages/mark-read', authenticateJWT, markMessagesAsRead);

// Debug routes (consider removing in production)
router.get('/debug/create-test-message', createTestMessage);
router.get('/debug/messages', getAllMessages);
router.get('/debug/conversations', getAllConversations);

export default router;
