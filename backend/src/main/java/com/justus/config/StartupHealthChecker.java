package com.justus.config;

import com.mongodb.client.MongoDatabase;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Component;

@Component
public class StartupHealthChecker implements ApplicationRunner {
    private final Logger logger = LoggerFactory.getLogger(StartupHealthChecker.class);

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private GridFsTemplate gridFsTemplate;

    @Override
    public void run(ApplicationArguments args) {
        logger.info("Running StartupHealthChecker...");
        try {
            MongoDatabase db = mongoTemplate.getDb();
            Document ping = new Document("ping", 1);
            Document res = db.runCommand(ping);
            logger.info("MongoDB ping response: {}", res.toJson());

            long files = db.getCollection("fs.files").countDocuments();
            logger.info("GridFS fs.files document count: {}", files);
        } catch (Exception e) {
            logger.error("Startup health check failed: {}", e.getMessage(), e);
        }
    }
}
