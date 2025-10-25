// Utility for loading media files with authentication
import api, { getAuthenticatedApi } from '../services/api';

const mediaCache = new Map();

export const loadAuthenticatedMedia = async (mediaUrl, mediaId) => {
  // Check if we already have this media cached
  if (mediaCache.has(mediaId)) {
    console.log('MediaLoader: Using cached media for ID:', mediaId);
    return mediaCache.get(mediaId);
  }

  try {
    console.log('Loading authenticated media:', mediaUrl);
    
    // Convert to relative URL for the API call to ensure headers are included
    let apiUrl = mediaUrl;
    if (mediaUrl.startsWith('http://localhost:8080')) {
      apiUrl = mediaUrl.replace('http://localhost:8080', '');
    }
    
    console.log('Using API URL:', apiUrl);
    
    // Ensure we have a token before making the request
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('MediaLoader: No authentication token available');
      throw new Error('No authentication token available');
    }
    
    console.log('MediaLoader: Making authenticated request with token:', token.substring(0, 20) + '...');
    
    // Use regular api instance (it will include credentials/cookies automatically)
    const response = await api.get(apiUrl, {
      responseType: 'blob',
      timeout: 15000, // Increased timeout to 15 seconds
      headers: {
        'Accept': 'image/*,audio/*,*/*',
        'Authorization': `Bearer ${token}` // Explicitly include token
      }
    });
    
    console.log('MediaLoader: Response status:', response.status);
    console.log('MediaLoader: Response headers:', response.headers);
    
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
      config: error.config,
      message: error.message
    });
    
    // Log the specific error for debugging
    if (error.response?.status === 401) {
      console.error('MediaLoader: Authentication failed - token may be invalid or expired');
    } else if (error.response?.status === 403) {
      console.error('MediaLoader: Access forbidden - user may not be authorized for this media');
    } else if (error.response?.status === 404) {
      console.error('MediaLoader: Media file not found');
    }
    
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
