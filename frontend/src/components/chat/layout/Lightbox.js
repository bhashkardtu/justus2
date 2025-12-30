import React from 'react';
import ReactDOM from 'react-dom';

export default function Lightbox({ lightbox, onClose }) {
    if (!lightbox.visible || !lightbox.url) return null;

    return ReactDOM.createPortal(
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                zIndex: 10001,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={onClose}
        >
            <style>
                {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}
            </style>

            {/* Download button */}
            {(lightbox.type === 'image' || lightbox.type === 'video' || lightbox.type === 'document') && (
                <button
                    onClick={async (e) => {
                        e.stopPropagation();
                        try {
                            const link = document.createElement('a');
                            link.href = lightbox.url;

                            // Determine filename
                            let filename = lightbox.filename;
                            if (!filename) {
                                const timestamp = Date.now();
                                if (lightbox.type === 'image') filename = `image-${timestamp}.jpg`;
                                else if (lightbox.type === 'video') filename = `video-${timestamp}.mp4`;
                                else if (lightbox.type === 'document') filename = `document-${timestamp}.pdf`;
                            }

                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        } catch (error) {
                            console.error('Download failed:', error);
                        }
                    }}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '70px', // Position to the left of close button
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        fontSize: '20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                    title="Download"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </button>
            )}

            {/* Close button */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    fontSize: '24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
                ×
            </button>

            {/* Content */}
            <div
                style={{
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    overflow: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {lightbox.type === 'image' && (
                    <img
                        src={lightbox.url}
                        alt="Full size"
                        style={{
                            maxWidth: '100%',
                            maxHeight: '90vh',
                            objectFit: 'contain',
                            borderRadius: '8px',
                        }}
                    />
                )}
                {lightbox.type === 'video' && (
                    <video
                        controls
                        autoPlay
                        src={lightbox.url}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '90vh',
                            borderRadius: '8px',
                            background: '#000',
                        }}
                    />
                )}
                {lightbox.type === 'document' && (
                    <iframe
                        src={lightbox.url}
                        title="Document viewer"
                        style={{
                            width: '90vw',
                            height: '90vh',
                            border: 'none',
                            borderRadius: '8px',
                            background: '#fff',
                        }}
                    />
                )}
            </div>
        </div>,
        document.body
    );
}
