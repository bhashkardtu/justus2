import express from 'express';
import { register, login, logout, getUsers, verifyEmail, resendVerification, connectUser, uploadAvatar, getAvatar, avatarUploadMiddleware } from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/resend-verification', authLimiter, resendVerification);
router.post('/logout', logout);
router.get('/users', authenticateJWT, getUsers);
router.post('/connect', authenticateJWT, connectUser);
router.post('/avatar/upload', authenticateJWT, avatarUploadMiddleware, uploadAvatar);
router.get('/avatar/:fileId', getAvatar);

export default router;
