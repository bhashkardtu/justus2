// Utility for loading media files with authentication
import api, { getAuthenticatedApi } from '../services/api';

const mediaCache = new Map();

// For images - returns blob URL for <img> tags
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
    if (mediaUrl.startsWith('http://localhost:5000')) {
      apiUrl = mediaUrl.replace('http://localhost:5000', '');
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

// For PDFs and documents - downloads or opens in new tab
export const loadAuthenticatedDocument = async (documentUrl, mimeType = 'application/pdf', isPreview = false, filename = 'document.pdf') => {
  try {
    console.log('Loading authenticated document:', documentUrl);
    
    // Get the backend API URL
    const apiURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    
    // Convert to full URL if needed
    let fullUrl = documentUrl;
    if (!documentUrl.startsWith('http')) {
      fullUrl = `${apiURL}${documentUrl}`;
    }
    
    console.log('Fetching from:', fullUrl);
    
    // Get authentication token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token available');
    }

    // Fetch with authentication
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': mimeType
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to load document: ${response.status} ${response.statusText}`);
    }

    // Get file as blob
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    if (isPreview) {
      // Open in new tab
      const newWindow = window.open(blobUrl, '_blank');
      if (!newWindow) {
        alert('Please allow popups to view the file');
      }
      
      // Clean up after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 60000); // Revoke after 1 minute
    } else {
      // Trigger download
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up blob URL after download
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    }
  } catch (error) {
    console.error('Error loading document:', error);
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
