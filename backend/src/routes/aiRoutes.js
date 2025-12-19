import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { smartSearch, enhanceTranscription, analyzeTone } from '../controllers/aiController.js';

const router = express.Router();

// All AI routes require authentication
router.use(authenticateJWT);

// Smart search endpoint
router.post('/search', smartSearch);

// Transcription enhancement endpoint
router.post('/transcribe/enhance', enhanceTranscription);

// Tone analysis endpoint
router.post('/analyze-tone', analyzeTone);

export default router;
