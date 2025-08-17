package com.justus.websocket;

import com.justus.dto.MessageDTO;
import com.justus.model.Message;
import com.justus.repository.MessageRepository;
import com.justus.service.MessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.Instant;
import java.util.Map;

@Controller
public class SocketController {
    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    @Autowired
    private MessageRepository messageRepository;
    @Autowired
    private com.justus.repository.ConversationRepository conversationRepository;
    @Autowired
    private MessageService messageService;

    @MessageMapping("/chat.send")
    public void sendMessage(@Payload Message incoming, SimpMessageHeaderAccessor headerAccessor){
        System.out.println("=== WEBSOCKET MESSAGE RECEIVED ===");
        System.out.println("Incoming message: " + incoming.getContent());
        System.out.println("Sender ID from payload: " + incoming.getSenderId());
        System.out.println("Receiver ID: " + incoming.getReceiverId());
        System.out.println("Conversation ID: " + incoming.getConversationId());
        
        Object principal = headerAccessor.getUser();
        String userId = null;
        if (principal != null) {
            // Extract just the user ID from the principal, not the entire authentication object
            if (principal instanceof java.security.Principal) {
                userId = ((java.security.Principal) principal).getName();
            } else {
                userId = principal.toString();
            }
        }
        if (userId == null) userId = incoming.getSenderId();
        
        System.out.println("Resolved user ID: " + userId);
        
        // Additional safety check
        if (userId == null) {
            System.err.println("No user ID found in WebSocket message");
            return;
        }

        Message m = new Message();
        m.setSenderId(userId);
        m.setReceiverId(incoming.getReceiverId());
        // attach or create conversation
        if (incoming.getConversationId() != null) {
            System.out.println("Using existing conversation: " + incoming.getConversationId());
            m.setConversationId(incoming.getConversationId());
        } else if (incoming.getReceiverId() != null && !incoming.getReceiverId().isEmpty()) {
            String a = userId;
            String b = incoming.getReceiverId();
            String key = a.compareTo(b) <= 0 ? a+":"+b : b+":"+a;
            System.out.println("Creating/finding conversation with key: " + key);
            com.justus.model.Conversation c = conversationRepository.findByKey(key);
            if (c == null) {
                System.out.println("Creating new conversation");
                c = new com.justus.model.Conversation();
                c.setParticipantA(a);
                c.setParticipantB(b);
                c.setKey(key);
                c = conversationRepository.save(c);
                System.out.println("Saved new conversation with ID: " + c.getId());
            } else {
                System.out.println("Found existing conversation: " + c.getId());
            }
            m.setConversationId(c.getId());
        }
        m.setType(incoming.getType());
        m.setContent(incoming.getContent());
        m.setTimestamp(Instant.now());
        
        // Mark as delivered immediately when sent
        m.setDelivered(true);
        m.setDeliveredAt(Instant.now());

        System.out.println("Saving message to database...");
        Message saved = messageRepository.save(m);
        System.out.println("Message saved with ID: " + saved.getId());
        
        // Convert to DTO with user information
        MessageDTO messageDTO = messageService.convertToDTO(saved);
        
        // Send to both sender and receiver
        System.out.println("Broadcasting message to sender: /topic/user/" + userId);
        messagingTemplate.convertAndSend("/topic/user/" + userId, messageDTO);
        
        System.out.println("Broadcasting message to receiver: /topic/user/" + incoming.getReceiverId());
        messagingTemplate.convertAndSend("/topic/user/" + incoming.getReceiverId(), messageDTO);
        
        System.out.println("=== MESSAGE PROCESSING COMPLETE ===");
    }

    @MessageMapping("/chat.edit")
    public void editMessage(@Payload Message incoming){
        Message existing = messageRepository.findById(incoming.getId()).orElse(null);
        if (existing == null) return;
        existing.setContent(incoming.getContent());
        existing.setEdited(true);
        existing.setEditedAt(Instant.now());
        Message saved = messageRepository.save(existing);
        MessageDTO messageDTO = messageService.convertToDTO(saved);
        messagingTemplate.convertAndSend("/topic/messages.edited", messageDTO);
    }

    @MessageMapping("/chat.delete")
    public void deleteMessage(@Payload Message incoming){
        Message existing = messageRepository.findById(incoming.getId()).orElse(null);
        if (existing == null) return;
        existing.setDeleted(true);
        Message saved = messageRepository.save(existing);
        MessageDTO messageDTO = messageService.convertToDTO(saved);
        messagingTemplate.convertAndSend("/topic/messages.deleted", messageDTO);
    }

    @MessageMapping("/chat.typing")
    public void typing(@Payload Map<String,String> payload, SimpMessageHeaderAccessor headerAccessor){
        // payload: { receiverId }
        String user = null;
        if (headerAccessor.getUser() != null) {
            // Extract just the user ID from the principal, not the entire authentication object
            Object principal = headerAccessor.getUser();
            if (principal instanceof java.security.Principal) {
                user = ((java.security.Principal) principal).getName();
            } else if (principal != null) {
                user = principal.toString();
            }
        }
        if (user == null) user = payload.get("user");
        String receiverId = payload.get("receiverId");
        
        // Safety checks
        if (user == null || receiverId == null) {
            System.err.println("Missing user or receiverId in typing message");
            return;
        }
        
        messagingTemplate.convertAndSendToUser(receiverId, "/queue/typing", Map.of("user", user));
    }

    @MessageMapping("/chat.read")
    public void markAsRead(@Payload Map<String,String> payload, SimpMessageHeaderAccessor headerAccessor){
        String messageId = payload.get("messageId");
        Object principal = headerAccessor.getUser();
        String userId = null;
        
        if (principal != null) {
            if (principal instanceof java.security.Principal) {
                userId = ((java.security.Principal) principal).getName();
            } else if (principal != null) {
                userId = principal.toString();
            }
        }
        
        if (messageId == null || userId == null) {
            System.err.println("Missing messageId or userId in read message");
            return;
        }
        
        // Find and update the message
        Message message = messageRepository.findById(messageId).orElse(null);
        if (message == null) {
            System.err.println("Message not found: " + messageId);
            return;
        }
        
        // Only mark as read if the current user is the receiver
        if (!userId.equals(message.getReceiverId())) {
            System.err.println("User " + userId + " is not authorized to mark message " + messageId + " as read");
            return;
        }
        
        // Mark as read
        message.setRead(true);
        message.setReadAt(Instant.now());
        Message savedMessage = messageRepository.save(message);
        
        // Convert to DTO and notify the sender about read receipt
        MessageDTO messageDTO = messageService.convertToDTO(savedMessage);
        messagingTemplate.convertAndSend("/topic/user/" + message.getSenderId(), 
            Map.of("type", "MESSAGE_READ", "message", messageDTO));
    }
}
