package com.justus.dto;

import com.justus.model.Message;
import java.time.Instant;

public class MessageDTO {
    private String id;
    private String senderId;
    private String senderUsername;
    private String senderDisplayName;
    private String receiverId;
    private String conversationId;
    private String type;
    private String content;
    private Instant timestamp;
    private boolean edited;
    private Instant editedAt;
    private boolean deleted;
    
    // Read receipts
    private boolean delivered;
    private Instant deliveredAt;
    private boolean read;
    private Instant readAt;

    // Default constructor
    public MessageDTO() {}

    // Constructor from Message
    public MessageDTO(Message message) {
        this.id = message.getId();
        this.senderId = message.getSenderId();
        this.receiverId = message.getReceiverId();
        this.conversationId = message.getConversationId();
        this.type = message.getType();
        this.content = message.getContent();
        this.timestamp = message.getTimestamp();
        this.edited = message.isEdited();
        this.editedAt = message.getEditedAt();
        this.deleted = message.isDeleted();
        this.delivered = message.isDelivered();
        this.deliveredAt = message.getDeliveredAt();
        this.read = message.isRead();
        this.readAt = message.getReadAt();
    }

    // Getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }
    
    public String getSenderUsername() { return senderUsername; }
    public void setSenderUsername(String senderUsername) { this.senderUsername = senderUsername; }
    
    public String getSenderDisplayName() { return senderDisplayName; }
    public void setSenderDisplayName(String senderDisplayName) { this.senderDisplayName = senderDisplayName; }
    
    public String getReceiverId() { return receiverId; }
    public void setReceiverId(String receiverId) { this.receiverId = receiverId; }
    
    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
    
    public boolean isEdited() { return edited; }
    public void setEdited(boolean edited) { this.edited = edited; }
    
    public Instant getEditedAt() { return editedAt; }
    public void setEditedAt(Instant editedAt) { this.editedAt = editedAt; }
    
    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }
    
    public boolean isDelivered() { return delivered; }
    public void setDelivered(boolean delivered) { this.delivered = delivered; }
    
    public Instant getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(Instant deliveredAt) { this.deliveredAt = deliveredAt; }
    
    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
    
    public Instant getReadAt() { return readAt; }
    public void setReadAt(Instant readAt) { this.readAt = readAt; }
}
