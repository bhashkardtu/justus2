import { useEffect, useRef, useState } from 'react';
import { getAuthenticatedApi } from '../services/api';
import { sendSocketMessage } from '../services/socket';
import aiService from '../services/aiService';

export default function useVoiceMessage({ userId, otherUserId, conversationId, setMessages }) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const recognitionRef = useRef(null);
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef(''); // Add ref to track latest transcript

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
            console.log('[VoiceMessage] Speech recognized (final):', transcript);
          } else {
            interimTranscript += transcript;
            console.log('[VoiceMessage] Speech recognized (interim):', transcript);
          }
        }

        const combined = finalTranscript + interimTranscript;
        setTranscript(combined);
        transcriptRef.current = combined; // Keep ref in sync
        console.log('[VoiceMessage] Current transcript:', combined);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    if (!navigator.mediaDevices) {
      alert('Voice recording is not supported in your browser.');
      return;
    }
    try {
      setRecording(true);
      setTranscript('');
      transcriptRef.current = ''; // Reset ref too
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      // Start audio recording
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      
      // Start speech recognition
      if (recognitionRef.current) {
        console.log('[VoiceMessage] Starting speech recognition...');
        recognitionRef.current.start();
      } else {
        console.warn('[VoiceMessage] ⚠️ Speech Recognition not available!');
        console.warn('Translation will not work without transcript.');
        console.warn('Use Chrome or Edge browser for Speech Recognition support.');
      }
      
      mr.onstop = async () => {
        // Stop speech recognition
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }

        // Use ref to get latest transcript value
        const capturedTranscript = transcriptRef.current.trim();
        console.log('[VoiceMessage] Recording stopped. Transcript:', capturedTranscript || '(empty)');

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Enhance transcription with AI if available
        let finalTranscript = capturedTranscript;
        let translatedTranscript = '';
        let targetLanguage = 'en';
        
        if (finalTranscript) {
          console.log('[VoiceTranslation] Starting transcript processing:', finalTranscript);
          setTranscribing(true);
          try {
            console.log('[VoiceTranslation] Enhancing transcript...');
            const enhanced = await aiService.enhanceTranscription(finalTranscript);
            if (enhanced.improved) {
              finalTranscript = enhanced.enhanced;
              console.log('[VoiceTranslation] ✓ Transcript enhanced:', finalTranscript);
            } else {
              console.log('[VoiceTranslation] No enhancement needed');
            }

            // Get receiver's preferred language
            try {
              const authenticatedApi = getAuthenticatedApi();
              const receiverRes = await authenticatedApi.get(`/api/auth/user/${otherUserId}`);
              targetLanguage = receiverRes.data?.preferredLanguage || 'en';
              console.log('[VoiceTranslation] Receiver preferred language:', targetLanguage);
            } catch (err) {
              console.warn('[VoiceTranslation] Could not fetch receiver language, defaulting to English:', err.message);
            }

            console.log('[VoiceTranslation] Translating to', targetLanguage, '...');
            const translation = await aiService.translateText(finalTranscript, 'auto', targetLanguage);
            if (translation?.translated) {
              translatedTranscript = translation.translated;
              console.log('[VoiceTranslation] ✓ Translation successful:', translatedTranscript);
            } else {
              console.log('[VoiceTranslation] ✗ Translation failed or empty result');
            }
          } catch (error) {
            console.error('[VoiceTranslation] ✗ AI enhancement/translation failed:', error);
          }
          setTranscribing(false);
        } else {
          console.log('[VoiceTranslation] No transcript to process');
          console.warn('[VoiceMessage] ⚠️ Speech recognition did not capture any text!');
          console.warn('[VoiceMessage] Possible reasons:');
          console.warn('  1. Browser does not support Speech Recognition (use Chrome/Edge)');
          console.warn('  2. Microphone did not pick up audio clearly');
          console.warn('  3. Recognition language mismatch');
          console.warn('  4. Recording was too short');
        }

        const fd = new FormData();
        fd.append('file', blob, 'voice.webm');
        if (conversationId) fd.append('conversationId', conversationId);
        try {
          const authenticatedApi = getAuthenticatedApi();
          const res = await authenticatedApi.post('/api/media/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          const id = res.data.id;
          const url = `/api/media/file/${id}`;
          const tempMessage = {
            id: 'temp-audio-' + Date.now(),
            type: 'audio',
            content: url,
            senderId: userId,
            receiverId: otherUserId,
            conversationId,
            timestamp: new Date().toISOString(),
            temporary: true,
            metadata: finalTranscript ? { transcript: finalTranscript, translatedTranscript: translatedTranscript || undefined } : null
          };
          console.log('[VoiceTranslation] Message metadata:', tempMessage.metadata);
          setMessages(prev => [...prev, tempMessage]);
          const success = sendSocketMessage({ 
            receiverId: otherUserId || 'other', 
            type: 'audio', 
            content: url, 
            conversationId, 
            senderId: userId,
            metadata: finalTranscript ? { transcript: finalTranscript, translatedTranscript: translatedTranscript || undefined } : null
          });
          if (!success) {
            try {
              await authenticatedApi.post('/api/chat/messages', { 
                type: 'audio', 
                content: url, 
                receiverId: otherUserId, 
                conversationId,
                metadata: finalTranscript ? { 
                  transcript: finalTranscript, 
                  translatedTranscript: translatedTranscript || undefined,
                  targetLanguage: targetLanguage || 'en'
                } : null
              });
            } catch (apiError) {
              setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
              alert('Failed to send audio message. Please try again.');
            }
          }
        } catch (error) {
          console.error('Voice upload failed:', error);
          alert('Failed to send voice message. Please try again.');
        }
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
        setRecording(false);
        setTranscript('');
      };
      mr.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to access microphone. Please check your permissions.');
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  return { 
    recording, 
    startRecording, 
    stopRecording, 
    transcript: transcript.trim(),
    transcribing 
  };
}
