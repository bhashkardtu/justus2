import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { smartSearch, enhanceTranscription, analyzeTone, translateText } from '../controllers/aiController.js';

const router = express.Router();

// All AI routes require authentication
router.use(authenticateJWT);

// Smart search endpoint
router.post('/search', smartSearch);

// Transcription enhancement endpoint
router.post('/transcribe/enhance', enhanceTranscription);

// Tone analysis endpoint
router.post('/analyze-tone', analyzeTone);

// Translation endpoint
router.post('/translate', translateText);

export default router;
