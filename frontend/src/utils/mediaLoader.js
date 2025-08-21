// Utility for loading media files with authentication
import api, { getAuthenticatedApi } from '../services/api';

const mediaCache = new Map();

export const loadAuthenticatedMedia = async (mediaUrl, mediaId) => {
  // Check if we already have this media cached
  if (mediaCache.has(mediaId)) {
    return mediaCache.get(mediaId);
  }

  try {
    console.log('Loading authenticated media:', mediaUrl);
    
    // Convert to relative URL for the API call to ensure headers are included
    let apiUrl = mediaUrl;
    if (mediaUrl.startsWith('http://justus-9hwt.onrender.com')) {
      apiUrl = mediaUrl.replace('http://justus-9hwt.onrender.com', '');
    }
    
    console.log('Using API URL:', apiUrl);
    
    // Ensure we have a token before making the request
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    // Use regular api instance (it will include credentials/cookies automatically)
    const response = await api.get(apiUrl, {
      responseType: 'blob',
      timeout: 15000, // Increased timeout to 15 seconds
      headers: {
        'Accept': 'image/*,audio/*,*/*',
        'Authorization': `Bearer ${token}` // Explicitly include token
      }
    });
    
    // Create a blob URL that can be used by img/audio tags
    const blob = response.data;
    const blobUrl = URL.createObjectURL(blob);
    
    // Cache the blob URL
    mediaCache.set(mediaId, blobUrl);
    
    console.log('Successfully loaded and cached media:', mediaId, blobUrl);
    return blobUrl;
  } catch (error) {
    console.error('Failed to load authenticated media:', error);
    console.error('Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      config: error.config
    });
    throw error;
  }
};

export const revokeMediaUrl = (mediaId) => {
  const blobUrl = mediaCache.get(mediaId);
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    mediaCache.delete(mediaId);
  }
};

export const clearMediaCache = () => {
  mediaCache.forEach((blobUrl) => {
    URL.revokeObjectURL(blobUrl);
  });
  mediaCache.clear();
};
