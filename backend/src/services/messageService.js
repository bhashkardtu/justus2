import User from '../models/User.js';

export class MessageService {
  async convertToDTO(message) {
    const dto = {
      id: message._id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      conversationId: message.conversationId,
      type: message.type,
      content: message.content,
      timestamp: message.timestamp,
      edited: message.edited,
      editedAt: message.editedAt,
      deleted: message.deleted,
      delivered: message.delivered,
      deliveredAt: message.deliveredAt,
      read: message.read,
      readAt: message.readAt
    };
    
    // If message exists in database but doesn't have delivered flag set,
    // consider it delivered (for backward compatibility)
    if (message._id && !dto.delivered) {
      dto.delivered = true;
      dto.deliveredAt = message.timestamp || new Date();
    }
    
    // Fetch sender information
    if (message.senderId) {
      const sender = await User.findById(message.senderId);
      if (sender) {
        dto.senderUsername = sender.username;
        dto.senderDisplayName = sender.displayName;
      }
    }
    
    return dto;
  }
  
  async convertToDTOs(messages) {
    // Get all unique sender IDs
    const senderIds = [...new Set(messages.map(msg => msg.senderId))];
    
    // Fetch all users in batch for efficiency
    const users = await User.find({ _id: { $in: senderIds } });
    const userMap = new Map(users.map(user => [user._id.toString(), user]));
    
    // Convert messages to DTOs
    return messages.map(message => {
      const dto = {
        id: message._id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        conversationId: message.conversationId,
        type: message.type,
        content: message.content,
        timestamp: message.timestamp,
        edited: message.edited,
        editedAt: message.editedAt,
        deleted: message.deleted,
        delivered: message.delivered,
        deliveredAt: message.deliveredAt,
        read: message.read,
        readAt: message.readAt
      };
      
      // If message exists in database but doesn't have delivered flag set,
      // consider it delivered (for backward compatibility)
      if (message._id && !dto.delivered) {
        dto.delivered = true;
        dto.deliveredAt = message.timestamp || new Date();
      }
      
      const sender = userMap.get(message.senderId);
      if (sender) {
        dto.senderUsername = sender.username;
        dto.senderDisplayName = sender.displayName;
      }
      
      return dto;
    });
  }
}

export default new MessageService();
