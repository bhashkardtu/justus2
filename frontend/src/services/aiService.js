import { getAuthenticatedApi } from './api';

class AIService {
  /**
   * Smart search through messages
   * @param {string} query - Natural language query
   * @param {string} conversationId - Optional conversation ID to limit search
   */
  async smartSearch(query, conversationId = null) {
    try {
      const api = getAuthenticatedApi();
      const response = await api.post('/api/ai/search', {
        query,
        conversationId
      });
      return response.data;
    } catch (error) {
      console.error('Smart search failed:', error);
      throw error;
    }
  }

  /**
   * Enhance voice transcription with AI
   * @param {string} transcript - Raw transcript from speech-to-text
   * @param {string} context - Optional conversation context
   */
  async enhanceTranscription(transcript, context = '') {
    try {
      const api = getAuthenticatedApi();
      const response = await api.post('/api/ai/transcribe/enhance', {
        transcript,
        context
      });
      return response.data;
    } catch (error) {
      console.error('Transcription enhancement failed:', error);
      // Return original transcript on error
      return { enhanced: transcript, improved: false, error: error.message };
    }
  }

  /**
   * Analyze message tone
   * @param {string} message - Message text
   */
  async analyzeTone(message) {
    try {
      const api = getAuthenticatedApi();
      const response = await api.post('/api/ai/analyze-tone', {
        message
      });
      return response.data;
    } catch (error) {
      console.error('Tone analysis failed:', error);
      return { tone: 'neutral', confidence: 0, warning: null };
    }
  }
}

export default new AIService();
