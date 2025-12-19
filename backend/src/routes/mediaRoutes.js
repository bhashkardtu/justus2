import express from 'express';
import { uploadFile, uploadMiddleware, getFile } from '../controllers/mediaController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

// Middleware to handle token from query parameter as fallback (for ngrok/tunnels)
const tokenFromQuery = (req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

router.post('/upload', authenticateJWT, uploadMiddleware, uploadFile);
router.get('/file/:id', tokenFromQuery, authenticateJWT, getFile);

export default router;
