import React, { useEffect, useState } from 'react';
import { loadAuthenticatedMedia } from '../../../utils/mediaLoader';

export default function VideoMessage({ message, mine }) {
    const [videoUrl, setVideoUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const loadVideo = async () => {
            // If temporary (local blob) or already a full URL, use it directly (if public)
            // But we are using authorized media loader for secure access
            if (!message.content) return;

            if (message.temporary) {
                setVideoUrl(message.content);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(false);
                const urlParts = message.content.split('/');
                const mediaId = urlParts[urlParts.length - 1].split('?')[0];
                const authenticatedBlobUrl = await loadAuthenticatedMedia(message.content, mediaId);
                setVideoUrl(authenticatedBlobUrl);
                setLoading(false);
            } catch (error) {
                console.error('Failed to load authenticated video:', error);
                setError(true);
                setLoading(false);
            }
        };

        loadVideo();
    }, [message.content, message.temporary]);

    if (error) {
        return (
            <div className="space-y-2">
                <div className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    <div className="flex items-center justify-center h-32 text-gray-500 p-4">
                        <div className="text-center">
                            <p className="text-xs mb-2 font-medium">Video failed to load</p>
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
                    <div className="flex items-center justify-center h-48 w-64 text-gray-500">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="ml-3 text-sm font-medium">Loading video...</span>
                    </div>
                </div>
            ) : (
                <div className="relative rounded-lg overflow-hidden max-w-xs md:max-w-sm">
                    <video
                        controls
                        src={videoUrl}
                        className="w-full rounded-lg shadow-md bg-black"
                        onError={() => setError(true)}
                    />
                    {message.metadata?.filename && (
                        <div className="absolute top-2 left-2 right-2 flex justify-between pointer-events-none">
                            <div className="text-xs text-white/90 bg-black/40 px-2 py-1 rounded truncate max-w-[80%]">
                                {message.metadata.filename}
                            </div>
                        </div>
                    )}

                    {message.temporary && (
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center backdrop-blur-[1px] pointer-events-none">
                            <div className="w-8 h-8 border-2 border-white/80 border-t-transparent rounded-full animate-spin mb-2"></div>
                            {message.metadata?.progress !== undefined && message.metadata.progress < 100 && (
                                <span className="text-white text-xs font-medium shadow-sm drop-shadow-md">
                                    {message.metadata.progress}%
                                </span>
                            )}
                            {message.metadata?.progress !== undefined && message.metadata.progress < 100 && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                                    <div
                                        className="h-full bg-green-500 transition-all duration-300"
                                        style={{ width: `${message.metadata.progress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {message.metadata?.caption && (
                <div className="text-sm mt-1 mb-1 px-1 break-words">
                    {message.metadata.caption}
                </div>
            )}
        </div>
    );
}
