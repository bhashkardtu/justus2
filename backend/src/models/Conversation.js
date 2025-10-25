import mongoose from 'mongoose';

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
  }
}, {
  timestamps: true,
  collection: 'conversations'
});

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
