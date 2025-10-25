import { useEffect, useRef, useState } from 'react';
import { getAuthenticatedApi } from '../services/api';
import { sendSocketMessage } from '../services/socket';

export default function useVoiceMessage({ userId, otherUserId, conversationId, setMessages }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);

  const startRecording = async () => {
    if (!navigator.mediaDevices) {
      alert('Voice recording is not supported in your browser.');
      return;
    }
    try {
      setRecording(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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
            temporary: true
          };
          setMessages(prev => [...prev, tempMessage]);
          const success = sendSocketMessage({ receiverId: otherUserId || 'other', type: 'audio', content: url, conversationId, senderId: userId });
          if (!success) {
            try {
              await authenticatedApi.post('/api/chat/messages', { type: 'audio', content: url, receiverId: otherUserId, conversationId });
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
  }, []);

  return { recording, startRecording, stopRecording };
}
