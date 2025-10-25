import React, { useEffect, useState } from 'react';
import { loadAuthenticatedMedia } from '../utils/mediaLoader';

export default function ImageMessage({ message, mine }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      if (!message.content || message.temporary) {
        setImageUrl(message.content);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);
        const urlParts = message.content.split('/');
        const mediaId = urlParts[urlParts.length - 1].split('?')[0];
        const authenticatedBlobUrl = await loadAuthenticatedMedia(message.content, mediaId);
        setImageUrl(authenticatedBlobUrl);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load authenticated image:', error);
        setError(true);
        setLoading(false);
      }
    };

    loadImage();
  }, [message.content, message.temporary]);

  if (error) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
          <div className="flex items-center justify-center h-32 text-gray-500 p-4">
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-xs mb-2 font-medium">Image failed to load</p>
              <button 
                className="px-3 py-1 bg-indigo-500 text-white text-xs rounded-lg hover:bg-indigo-600 transition-colors"
                onClick={() => { setError(false); setLoading(true); }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
          <div className="flex items-center justify-center h-32 text-gray-500">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-sm font-medium">Loading image...</span>
          </div>
        </div>
      ) : (
        <div className="relative rounded-lg overflow-hidden">
          <img 
            src={imageUrl}
            alt="Shared image"
            className="max-w-xs rounded-lg cursor-pointer transition-all duration-300 hover:scale-105 shadow-md"
            onClick={() => window.open(imageUrl, '_blank')}
            onError={() => setError(true)}
          />
        </div>
      )}

      {message.temporary && (
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60"></div>
          <span className="text-xs opacity-60">Sending...</span>
        </div>
      )}
    </div>
  );
}
