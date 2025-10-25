import express from 'express';
import { uploadFile, uploadMiddleware, getFile } from '../controllers/mediaController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.post('/upload', authenticateJWT, uploadMiddleware, uploadFile);
router.get('/file/:id', authenticateJWT, getFile);

export default router;
