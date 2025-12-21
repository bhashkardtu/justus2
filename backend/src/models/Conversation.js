import mongoose from 'mongoose';

// Per-user wallpaper preferences for a conversation
const wallpaperSettingSchema = new mongoose.Schema({
  sourceType: {
    type: String,
    enum: ['preset', 'custom', 'none'],
    default: 'none'
  },
  presetKey: {
    type: String,
    default: 'aurora'
  },
  imageUrl: {
    type: String,
    default: ''
  },
  blur: {
    type: Number,
    default: 6,
    min: 0,
    max: 48
  },
  opacity: {
    type: Number,
    default: 0.9,
    min: 0,
    max: 1
  }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  participantA: {
    type: String,
    required: true
  },
  participantB: {
    type: String,
    required: true
  },
  key: {
    type: String,
    required: true,
    unique: true
  },
  // Map keyed by userId storing that user's wallpaper preference for this conversation
  wallpapers: {
    type: Map,
    of: wallpaperSettingSchema,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'conversations'
});

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
