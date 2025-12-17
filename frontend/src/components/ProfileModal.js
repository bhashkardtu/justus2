import React, { useState, useRef } from 'react';
import { uploadAvatar, getAvatarUrl } from '../services/avatarService';

export default function ProfileModal({ show, onClose, user, onAvatarUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  if (!show) return null;

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target.result);
    reader.readAsDataURL(file);

    // Upload immediately
    handleUpload(file);
  };

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const result = await uploadAvatar(file);
      console.log('[profile] Avatar uploaded:', result);
      
      // Update parent with new avatar URL
      if (onAvatarUpdate) {
        onAvatarUpdate(result.avatarUrl);
      }

      // Show immediate preview using the returned URL
      setPreviewUrl(getAvatarUrl(result.avatarUrl));
      alert('Profile picture updated successfully!');
    } catch (error) {
      console.error('[profile] Upload failed:', error);
      alert('Failed to upload profile picture: ' + (error.response?.data?.message || error.message));
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const currentAvatarUrl = previewUrl || getAvatarUrl(user?.avatarUrl) || `https://ui-avatars.com/api/?name=${user?.displayName || user?.username || 'User'}&size=200`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 animate-in zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Profile Settings</h3>
          <p className="text-gray-500 text-sm">Manage your profile picture and information</p>
        </div>

        {/* Avatar Preview */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-4">
            <img
              src={currentAvatarUrl}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border-4 border-indigo-200 shadow-lg"
            />
            {uploading && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            {uploading ? 'Uploading...' : 'Change Profile Picture'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <p className="text-xs text-gray-500 mt-2">JPG, PNG or GIF • Max 5MB</p>
        </div>

        {/* User Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Display Name</label>
            <p className="text-gray-900 font-medium">{user?.displayName || 'N/A'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Username</label>
            <p className="text-gray-900 font-medium">{user?.username || 'N/A'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Email</label>
            <p className="text-gray-900 font-medium">{user?.email || 'N/A'}</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl transition-colors duration-200 font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}
