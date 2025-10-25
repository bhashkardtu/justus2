import { useState } from 'react';
import { getAuthenticatedApi } from '../services/api';
import { sendSocketMessage } from '../services/socket';

export default function useImageUpload({ userId, otherUserId, conversationId, setMessages }) {
  const [uploading, setUploading] = useState(false);

  const uploadImage = () => {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf'; // Accept images and PDFs
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Determine file type
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      
      if (!isPdf && !isImage) {
        alert('Please select an image or PDF file');
        return;
      }
      
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        if (conversationId) fd.append('conversationId', conversationId);
        
        const authenticatedApi = getAuthenticatedApi();
        const res = await authenticatedApi.post('/api/media/upload', fd, { 
          headers: { 'Content-Type': 'multipart/form-data' } 
        });
        
        const id = res.data.id;
        const url = `/api/media/file/${id}`;

        const tempMessage = {
          id: 'temp-file-' + Date.now(),
          type: isPdf ? 'document' : 'image',
          content: url,
          senderId: userId,
          receiverId: otherUserId,
          conversationId,
          timestamp: new Date().toISOString(),
          temporary: true,
          metadata: isPdf ? { filename: file.name, fileType: 'pdf' } : undefined
        };
        setMessages(prev => [...prev, tempMessage]);

        const success = sendSocketMessage({ 
          receiverId: otherUserId || 'other', 
          type: isPdf ? 'document' : 'image', 
          content: url, 
          conversationId, 
          senderId: userId,
          metadata: isPdf ? { filename: file.name, fileType: 'pdf' } : undefined
        });
        
        if (!success) {
          try {
            await authenticatedApi.post('/api/chat/messages', { 
              type: isPdf ? 'document' : 'image', 
              content: url, 
              receiverId: otherUserId, 
              conversationId,
              metadata: isPdf ? { filename: file.name, fileType: 'pdf' } : undefined
            });
          } catch (apiError) {
            setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
            alert('Failed to send file. Please try again.');
          }
        }
      } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload file: ' + (error.response?.data?.message || error.message));
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  return { uploading, uploadImage };
}
