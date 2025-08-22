package com.justus.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.mongodb.client.gridfs.model.GridFSFile;
import org.bson.Document;
import com.justus.repository.ConversationRepository;
import com.justus.model.Conversation;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
// static import helpers
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

@RestController
@RequestMapping("/api/media")
public class MediaController {

    @Autowired
    private GridFsTemplate gridFsTemplate;

    @Autowired
    private ConversationRepository conversationRepository;

    @PostMapping("/upload")
    public Map<String,String> upload(@RequestParam("file") MultipartFile file, @RequestParam(value = "conversationId", required = false) String conversationId) throws IOException {
        Document meta = new Document();
        if (conversationId != null) meta.append("conversationId", conversationId);
        Object id = gridFsTemplate.store(file.getInputStream(), file.getOriginalFilename(), file.getContentType(), meta);
        Map<String,String> res = new HashMap<>();
        res.put("id", id.toString());
        res.put("filename", file.getOriginalFilename());
        res.put("contentType", file.getContentType());
        return res;
    }

    @GetMapping("/file/{id}")
    public ResponseEntity<InputStreamResource> getFile(@PathVariable String id) throws IOException {
        System.out.println("MediaController: Accessing file with ID: " + id);
        
        // Authentication is now handled by the JwtFilter (supports both header and cookie auth)
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        
        System.out.println("MediaController: Authentication object: " + (auth != null ? auth.getClass().getSimpleName() : "null"));
        System.out.println("MediaController: Principal: " + (auth != null ? auth.getPrincipal() : "null"));
        
        if (auth == null || auth.getPrincipal() == null) {
            System.out.println("MediaController: No authentication found, returning 401");
            return ResponseEntity.status(401).build();
        }

        GridFSFile file = gridFsTemplate.findOne(query(where("_id").is(id)));
        if (file == null) {
            System.out.println("MediaController: File not found with ID: " + id);
            return ResponseEntity.notFound().build();
        }
        
        // Check conversation membership if metadata present
        org.bson.Document metadata = file.getMetadata();
        if (metadata != null && metadata.getString("conversationId") != null) {
            String convId = metadata.getString("conversationId");
            System.out.println("MediaController: File belongs to conversation: " + convId);
            
            Conversation c = conversationRepository.findById(convId).orElse(null);
            String userId = (String) auth.getPrincipal();
            System.out.println("MediaController: Current user ID: " + userId);
            
            if (c == null) {
                System.out.println("MediaController: Conversation not found: " + convId);
                return ResponseEntity.status(403).build();
            }
            
            System.out.println("MediaController: Conversation participants: " + c.getParticipantA() + ", " + c.getParticipantB());
            
            if (!userId.equals(c.getParticipantA()) && !userId.equals(c.getParticipantB())) {
                System.out.println("MediaController: User " + userId + " is not a participant in conversation " + convId);
                return ResponseEntity.status(403).build();
            }
            
            System.out.println("MediaController: Access granted for user " + userId + " to file " + id);
        } else {
            System.out.println("MediaController: No conversation metadata found, allowing access");
        }
        
        GridFsResource resource = gridFsTemplate.getResource(file);
        System.out.println("MediaController: Returning file: " + resource.getFilename());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(resource.getContentType()))
                .body(new InputStreamResource(resource.getInputStream()));
    }
}

