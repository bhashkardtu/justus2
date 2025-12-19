import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  constructor() {
    this.genAI = null;
    this.initialized = false;
  }

  // Lazy initialization - only initialize when methods are called
  _initialize() {
    if (this.initialized) {
      return this.genAI !== null;
    }

    this.initialized = true;
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️  GEMINI_API_KEY not set. AI features will be disabled.');
      this.genAI = null;
      return false;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      console.log('✓ Gemini AI Service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI:', error.message);
      this.genAI = null;
      return false;
    }
  }

  get enabled() {
    return this._initialize();
  }

  /**
   * Smart Search: Semantic search through messages with natural language
   * @param {string} query - Natural language query (e.g., "when did we discuss vacation?")
   * @param {Array} messages - Array of message objects
   * @returns {Promise<Object>} - { results: Array, summary: string }
   */
  async smartSearch(query, messages) {
    if (!this.enabled) {
      throw new Error('Gemini API not configured');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Validate and filter messages
      const validMessages = messages
        .filter(msg => msg && msg.content && typeof msg.content === 'string' && msg.content.trim().length > 0)
        .slice(-100); // Last 100 valid messages

      if (validMessages.length === 0) {
        return {
          results: [],
          summary: 'No valid text messages found to search.',
          totalFound: 0,
          query
        };
      }

      // Prepare conversation context (limit to avoid token limits)
      const messageContext = validMessages
        .map((msg, idx) => {
          const sender = msg.senderName || msg.senderId || 'Unknown';
          const content = msg.content.substring(0, 500); // Limit message length
          const date = msg.timestamp ? new Date(msg.timestamp).toLocaleDateString() : 'Unknown date';
          return `[${idx}] ${sender}: ${content} (${date})`;
        })
        .join('\n');

      const prompt = `You are a smart search assistant analyzing a chat conversation.

User Query: "${query}"

Conversation History:
${messageContext}

Task:
1. Identify which messages are relevant to the query
2. Return ONLY the message indices (numbers in brackets) that match, separated by commas
3. After the indices, add "SUMMARY:" followed by a brief summary of findings

Format your response exactly like this:
INDICES: 5,12,45,67
SUMMARY: The conversation about vacation was discussed on March 15th and April 2nd. Plans include going to Hawaii in June.

If no relevant messages found, return:
INDICES: none
SUMMARY: No relevant messages found for this query.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      // Parse response
      const indicesMatch = response.match(/INDICES:\s*(.+)/);
      const summaryMatch = response.match(/SUMMARY:\s*(.+)/s);

      const indicesStr = indicesMatch ? indicesMatch[1].trim() : 'none';
      const summary = summaryMatch ? summaryMatch[1].trim() : 'No summary available';

      let results = [];
      if (indicesStr !== 'none') {
        const indices = indicesStr.split(',').map(i => parseInt(i.trim())).filter(i => !isNaN(i));
        results = indices
          .filter(idx => idx >= 0 && idx < validMessages.length)
          .map(idx => validMessages[idx])
          .filter(msg => msg); // Remove any undefined entries
      }

      return {
        results,
        summary,
        totalFound: results.length,
        query
      };
    } catch (error) {
      console.error('Smart search error:', error);
      throw new Error(`Smart search failed: ${error.message}`);
    }
  }

  /**
   * Enhance transcription: Improve punctuation, grammar, and formatting
   * @param {string} rawTranscript - Raw transcript from speech-to-text
   * @param {string} context - Optional conversation context
   * @returns {Promise<string>} - Enhanced transcript
   */
  async enhanceTranscription(rawTranscript, context = '') {
    if (!this.enabled) {
      return rawTranscript; // Return as-is if AI disabled
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `You are an expert transcription editor. Improve the following voice message transcript by:
1. Adding proper punctuation (periods, commas, question marks, etc.)
2. Fixing capitalization
3. Correcting obvious speech-to-text errors
4. Maintaining the original meaning and tone
5. Keeping it natural and conversational

${context ? `Conversation Context: ${context}` : ''}

Raw Transcript:
"${rawTranscript}"

Return ONLY the improved transcript, nothing else. Do not add explanations or quotes.`;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Transcription enhancement error:', error);
      return rawTranscript; // Fallback to original
    }
  }

  /**
   * Analyze message tone before sending
   * @param {string} message - Message text
   * @returns {Promise<Object>} - { tone: string, confidence: number, warning: string|null }
   */
  async analyzeTone(message) {
    if (!this.enabled) {
      return { tone: 'neutral', confidence: 0, warning: null };
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Analyze the tone of this message. Respond in exactly this format:

TONE: [friendly/neutral/professional/angry/sarcastic/sad/excited]
CONFIDENCE: [0-100]
WARNING: [warning message if tone might be problematic, or "none"]

Message: "${message}"`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const toneMatch = response.match(/TONE:\s*(\w+)/);
      const confidenceMatch = response.match(/CONFIDENCE:\s*(\d+)/);
      const warningMatch = response.match(/WARNING:\s*(.+)/);

      return {
        tone: toneMatch ? toneMatch[1] : 'neutral',
        confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 50,
        warning: warningMatch && warningMatch[1] !== 'none' ? warningMatch[1] : null
      };
    } catch (error) {
      console.error('Tone analysis error:', error);
      return { tone: 'neutral', confidence: 0, warning: null };
    }
  }
}

export default new GeminiService();
