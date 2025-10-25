import React, { useEffect, useRef, useState } from 'react';
import { loadAuthenticatedMedia } from '../utils/mediaLoader';

export default function AudioMessage({ message, mine }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const loadAudio = async () => {
      if (!message.content || message.temporary) {
        setAudioUrl(message.content);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);
        const urlParts = message.content.split('/');
        const mediaId = urlParts[urlParts.length - 1].split('?')[0];
        const authenticatedBlobUrl = await loadAuthenticatedMedia(message.content, mediaId);
        setAudioUrl(authenticatedBlobUrl);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load authenticated audio:', error);
        setError(true);
        setLoading(false);
      }
    };
    loadAudio();
  }, [message.content, message.temporary]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    const handleError = () => { console.error('Audio playback error'); setError(true); };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play(); setIsPlaying(true); }
  };

  const handleProgressClick = (e) => {
    const audio = audioRef.current;
    if (!audio || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="flex items-center space-x-3 py-2">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${mine ? 'bg-red-500' : 'bg-red-200'}`}>
          <svg className={`w-6 h-6 ${mine ? 'text-white' : 'text-red-600'}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`p-4 rounded-xl ${mine ? 'bg-red-100' : 'bg-red-50'} border border-red-200`}>
            <p className="text-sm text-red-600 mb-3 font-medium">🎵 Voice message failed to load</p>
            <button 
              className="px-4 py-2 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
              onClick={() => {
                const token = localStorage.getItem('token');
                if (token) {
                  const url = new URL(message.content);
                  url.searchParams.set('token', token);
                  window.open(url.toString(), '_blank');
                }
              }}
            >
              📥 Download Audio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 py-2">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${mine ? 'bg-indigo-500' : 'bg-gray-200'}`}>
        <svg className={`w-6 h-6 ${mine ? 'text-white' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4z" />
          <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5H10.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div className={`p-4 rounded-xl ${mine ? 'bg-indigo-100/80' : 'bg-gray-100/80'} border border-gray-200/50 backdrop-blur-sm`}>
          {loading ? (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-gray-600 font-medium">Loading voice message...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <button
                onClick={togglePlayPause}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg ${mine ? 'bg-indigo-500 hover:bg-indigo-600 text-white' : 'bg-white hover:bg-gray-50 text-indigo-500 border border-gray-200'}`}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div className="flex-1 h-2 bg-gray-300 rounded-full cursor-pointer relative overflow-hidden" onClick={handleProgressClick}>
                    <div className={`h-full rounded-full transition-all duration-150 ${mine ? 'bg-indigo-500' : 'bg-indigo-400'}`} style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }} />
                    {isPlaying && (
                      <div className={`absolute inset-0 rounded-full ${mine ? 'bg-indigo-300' : 'bg-indigo-200'} animate-pulse opacity-30`} />
                    )}
                  </div>
                  <div className={`text-xs font-medium tabular-nums ${mine ? 'text-indigo-700' : 'text-gray-600'}`}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>
                <div className={`mt-2 text-xs font-medium ${mine ? 'text-indigo-600' : 'text-gray-500'}`}>
                  🎵 Voice Message
                  {isPlaying && <span className="ml-2 animate-pulse">● Playing</span>}
                </div>
              </div>
            </div>
          )}

          {audioUrl && (
            <audio ref={audioRef} src={audioUrl} preload="metadata" style={{ display: 'none' }} />
          )}
        </div>
      </div>

      {message.temporary && (
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin opacity-60"></div>
          <span className="text-xs opacity-60 font-medium">Sending...</span>
        </div>
      )}
    </div>
  );
}
