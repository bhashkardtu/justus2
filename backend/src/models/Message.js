import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true
  },
  receiverId: {
    type: String,
    required: true
  },
  conversationId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'audio', 'document', 'call'],
    default: 'text'
  },
  content: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Reply to message feature
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  deleted: {
    type: Boolean,
    default: false
  },
  // Read receipts
  delivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'messages'
});

const Message = mongoose.model('Message', messageSchema);

export default Message;
