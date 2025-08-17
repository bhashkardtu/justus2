package com.justus.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mongodb.client.MongoDatabase;
import org.bson.Document;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private GridFsTemplate gridFsTemplate;

    @GetMapping
    public ResponseEntity<?> health() {
        try {
            MongoDatabase db = mongoTemplate.getDb();
            Document ping = new Document("ping", 1);
            Document res = db.runCommand(ping);
            long files = db.getCollection("fs.files").countDocuments();
            return ResponseEntity.ok().body(Document.parse("{" +
                    "\"mongo\": \"ok\"," +
                    "\"ping\": \"" + res.toJson().replace("\"","\\\"") + "\"," +
                    "\"gridfsFiles\": " + files + "}"));
        } catch (Exception e) {
            return ResponseEntity.status(503).body(Document.parse("{\"error\": \"" + e.getMessage().replace("\"","\\\"") + "\"}"));
        }
    }
}
