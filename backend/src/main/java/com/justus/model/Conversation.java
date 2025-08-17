package com.justus.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "conversations")
public class Conversation {
    @Id
    private String id;
    private String participantA;
    private String participantB;
    private String key; // deterministic key like minId:maxId

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getParticipantA() { return participantA; }
    public void setParticipantA(String participantA) { this.participantA = participantA; }
    public String getParticipantB() { return participantB; }
    public void setParticipantB(String participantB) { this.participantB = participantB; }
    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
}
