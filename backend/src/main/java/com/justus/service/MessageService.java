package com.justus.service;

import com.justus.dto.MessageDTO;
import com.justus.model.Message;
import com.justus.model.User;
import com.justus.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Service
public class MessageService {
    
    @Autowired
    private UserRepository userRepository;
    
    public MessageDTO convertToDTO(Message message) {
        MessageDTO dto = new MessageDTO(message);
        
        // If message exists in database but doesn't have delivered flag set,
        // consider it delivered (for backward compatibility)
        if (message.getId() != null && !dto.isDelivered()) {
            dto.setDelivered(true);
            dto.setDeliveredAt(message.getTimestamp() != null ? message.getTimestamp() : java.time.Instant.now());
        }
        
        // Fetch sender information
        if (message.getSenderId() != null) {
            User sender = userRepository.findById(message.getSenderId()).orElse(null);
            if (sender != null) {
                dto.setSenderUsername(sender.getUsername());
                dto.setSenderDisplayName(sender.getDisplayName());
            }
        }
        
        return dto;
    }
    
    public List<MessageDTO> convertToDTOs(List<Message> messages) {
        // Get all unique sender IDs
        List<String> senderIds = messages.stream()
            .map(Message::getSenderId)
            .distinct()
            .collect(Collectors.toList());
        
        // Fetch all users in batch for efficiency
        Iterable<User> usersIterable = userRepository.findAllById(senderIds);
        Map<String, User> userMap = StreamSupport.stream(usersIterable.spliterator(), false)
            .collect(Collectors.toMap(User::getId, user -> user));
        
        // Convert messages to DTOs
        return messages.stream()
            .map(message -> {
                MessageDTO dto = new MessageDTO(message);
                
                // If message exists in database but doesn't have delivered flag set,
                // consider it delivered (for backward compatibility)
                if (message.getId() != null && !dto.isDelivered()) {
                    dto.setDelivered(true);
                    dto.setDeliveredAt(message.getTimestamp() != null ? message.getTimestamp() : java.time.Instant.now());
                }
                
                User sender = userMap.get(message.getSenderId());
                if (sender != null) {
                    dto.setSenderUsername(sender.getUsername());
                    dto.setSenderDisplayName(sender.getDisplayName());
                }
                return dto;
            })
            .collect(Collectors.toList());
    }
}
