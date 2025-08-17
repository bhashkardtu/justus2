package com.justus.repository;

import com.justus.model.Conversation;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ConversationRepository extends MongoRepository<Conversation, String> {
    Conversation findByKey(String key);
}
