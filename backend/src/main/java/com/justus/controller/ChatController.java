package com.justus.controller;

import com.justus.dto.MessageDTO;
import com.justus.model.Message;
import com.justus.model.Conversation;
import com.justus.repository.MessageRepository;
import com.justus.repository.ConversationRepository;
import com.justus.service.MessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private ConversationRepository conversationRepository;
    
    @Autowired
    private MessageService messageService;
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @GetMapping("/messages")
    public List<MessageDTO> getMessages(Authentication auth, @RequestParam(value = "conversationId", required = false) String conversationId) {
        String userId = (String) auth.getPrincipal();
        System.out.println("=== LOADING MESSAGES ===");
        System.out.println("User ID: " + userId);
        System.out.println("Conversation ID: " + conversationId);
        if (conversationId != null) {
            Conversation c = conversationRepository.findById(conversationId).orElse(null);
            if (c == null) {
                System.out.println("Conversation not found: " + conversationId);
                return List.of();
            }
            System.out.println("Conversation participants: " + c.getParticipantA() + " and " + c.getParticipantB());
            if (!userId.equals(c.getParticipantA()) && !userId.equals(c.getParticipantB())) {
                System.out.println("User not participant in conversation");
                return List.of();
            }
            List<Message> messages = messageRepository.findByConversationIdOrderByTimestampAsc(conversationId);
            System.out.println("Found " + messages.size() + " messages in conversation");
            for (Message msg : messages) {
                System.out.println("Message: id=" + msg.getId() + ", sender=" + msg.getSenderId() + ", receiver=" + msg.getReceiverId() + ", type=" + msg.getType() + ", content=" + msg.getContent());
            }
            return messageService.convertToDTOs(messages);
        }
        List<Message> messages = messageRepository.findBySenderIdOrReceiverIdOrderByTimestampAsc(userId, userId);
        System.out.println("Found " + messages.size() + " messages for user");
        for (Message msg : messages) {
            System.out.println("Message: id=" + msg.getId() + ", sender=" + msg.getSenderId() + ", receiver=" + msg.getReceiverId() + ", type=" + msg.getType() + ", content=" + msg.getContent());
        }
        return messageService.convertToDTOs(messages);
    }

    @PostMapping("/messages")
    public Message sendMessage(@RequestBody Message m, Authentication auth) {
        String userId = (String) auth.getPrincipal();
        m.setSenderId(userId);
        m.setTimestamp(Instant.now());
        // ensure conversation exists
        if (m.getConversationId() == null && m.getReceiverId() != null) {
            String a = userId;
            String b = m.getReceiverId();
            String key = a.compareTo(b) <= 0 ? a+":"+b : b+":"+a;
            Conversation c = conversationRepository.findByKey(key);
            if (c == null) {
                c = new Conversation();
                c.setParticipantA(a);
                c.setParticipantB(b);
                c.setKey(key);
                c = conversationRepository.save(c);
            }
            m.setConversationId(c.getId());
        }
        return messageRepository.save(m);
    }

    @GetMapping("/debug/create-test-message")
    public String createTestMessage() {
        System.out.println("=== CREATING TEST MESSAGE ===");
        
        // Create a test message from bkb to aditya
        Message testMessage = new Message();
        testMessage.setSenderId("689f7595ef133a08d0922eb8"); // bkb
        testMessage.setReceiverId("689f7c82d7f2234bb27bb1de"); // aditya
        testMessage.setConversationId("689f7c82d7f2234bb27bb1df"); // existing conversation
        testMessage.setContent("This is a test message from bkb to aditya");
        testMessage.setType("text");
        testMessage.setTimestamp(Instant.now());
        testMessage.setEdited(false);
        testMessage.setDeleted(false);
        
        Message saved = messageRepository.save(testMessage);
        System.out.println("Created test message with ID: " + saved.getId());
        
        return "Test message created with ID: " + saved.getId();
    }

    @GetMapping("/debug/messages")
    public List<Message> getAllMessages() {
        System.out.println("=== DEBUG: GET ALL MESSAGES ===");
        List<Message> messages = messageRepository.findAll();
        System.out.println("Found " + messages.size() + " messages");
        for (Message msg : messages) {
            System.out.println("Message ID: " + msg.getId() + ", Content: " + msg.getContent() + 
                             ", Sender: " + msg.getSenderId() + ", Receiver: " + msg.getReceiverId());
        }
        return messages;
    }

    @GetMapping("/debug/conversations")
    public List<Conversation> getAllConversations() {
        System.out.println("=== DEBUG: GET ALL CONVERSATIONS ===");
        List<Conversation> conversations = conversationRepository.findAll();
        System.out.println("Found " + conversations.size() + " conversations");
        for (Conversation conv : conversations) {
            System.out.println("Conversation ID: " + conv.getId() + ", Key: " + conv.getKey() + 
                             ", Participants: " + conv.getParticipantA() + " <-> " + conv.getParticipantB());
        }
        return conversations;
    }

    @PostMapping("/conversation")
    public Conversation getOrCreateConversation(@RequestParam("other") String other, Authentication auth) {
        if (auth == null) {
            throw new SecurityException("Authentication is required");
        }
        
        String userId = (String) auth.getPrincipal();
        System.out.println("Getting/creating conversation between " + userId + " and " + other);
        
        String a = userId;
        String b = other;
        String key = a.compareTo(b) <= 0 ? a+":"+b : b+":"+a;
        
        Conversation c = conversationRepository.findByKey(key);
        if (c == null) {
            System.out.println("Creating new conversation");
            c = new Conversation();
            c.setParticipantA(a);
            c.setParticipantB(b);
            c.setKey(key);
            c = conversationRepository.save(c);
            System.out.println("Created conversation with ID: " + c.getId());
        } else {
            System.out.println("Found existing conversation: " + c.getId());
        }
        return c;
    }
    
    @PostMapping("/messages/mark-read")
    public void markMessagesAsRead(@RequestBody Map<String, String> request, Authentication auth) {
        String userId = (String) auth.getPrincipal();
        String conversationId = request.get("conversationId");
        
        if (conversationId == null) {
            throw new IllegalArgumentException("conversationId is required");
        }
        
        System.out.println("Marking messages as read for user " + userId + " in conversation " + conversationId);
        
        // Find all unread messages in this conversation where the user is the receiver
        List<Message> unreadMessages = messageRepository.findByConversationIdAndReceiverIdAndReadFalse(conversationId, userId);
        
        if (!unreadMessages.isEmpty()) {
            // Mark all as read
            Instant readTime = Instant.now();
            for (Message message : unreadMessages) {
                message.setRead(true);
                message.setReadAt(readTime);
            }
            
            // Save all messages
            List<Message> savedMessages = messageRepository.saveAll(unreadMessages);
            System.out.println("Marked " + savedMessages.size() + " messages as read");
            
            // Notify senders about read receipts via WebSocket
            for (Message message : savedMessages) {
                MessageDTO messageDTO = messageService.convertToDTO(message);
                messagingTemplate.convertAndSend("/topic/user/" + message.getSenderId(), 
                    Map.of("type", "MESSAGE_READ", "message", messageDTO));
            }
        }
    }
}
