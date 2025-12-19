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
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(finalTranscript + interimTranscript);
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
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      // Start audio recording
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      
      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
      
      mr.onstop = async () => {
        // Stop speech recognition
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Enhance transcription with AI if available
        let finalTranscript = transcript.trim();
        if (finalTranscript) {
          setTranscribing(true);
          try {
            const enhanced = await aiService.enhanceTranscription(finalTranscript);
            if (enhanced.improved) {
              finalTranscript = enhanced.enhanced;
              console.log('Transcription enhanced by AI');
            }
          } catch (error) {
            console.error('AI enhancement failed, using original:', error);
          }
          setTranscribing(false);
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
            metadata: finalTranscript ? { transcript: finalTranscript } : null
          };
          setMessages(prev => [...prev, tempMessage]);
          const success = sendSocketMessage({ 
            receiverId: otherUserId || 'other', 
            type: 'audio', 
            content: url, 
            conversationId, 
            senderId: userId,
            metadata: finalTranscript ? { transcript: finalTranscript } : null
          });
          if (!success) {
            try {
              await authenticatedApi.post('/api/chat/messages', { 
                type: 'audio', 
                content: url, 
                receiverId: otherUserId, 
                conversationId,
                metadata: finalTranscript ? { transcript: finalTranscript } : null
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
