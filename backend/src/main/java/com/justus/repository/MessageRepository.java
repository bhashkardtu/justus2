package com.justus.repository;

import com.justus.model.Message;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface MessageRepository extends MongoRepository<Message, String> {
    List<Message> findBySenderIdOrReceiverIdOrderByTimestampAsc(String senderId, String receiverId);
    List<Message> findByConversationIdOrderByTimestampAsc(String conversationId);
    List<Message> findByConversationIdAndDeletedFalseOrderByTimestampAsc(String conversationId);
    List<Message> findByConversationIdAndReceiverIdAndReadFalse(String conversationId, String receiverId);
}
