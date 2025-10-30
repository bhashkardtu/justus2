import mongoose from 'mongoose';
import multer from 'multer';
import { GridFsStorage } from 'multer-gridfs-storage';
import Conversation from '../models/Conversation.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/justus';

// Create GridFS storage
const storage = new GridFsStorage({
  url: MONGODB_URI,
  options: { useNewUrlParser: true, useUnifiedTopology: true },
  file: (req, file) => {
    return {
      filename: file.originalname,
      bucketName: 'fs',
      metadata: {
        conversationId: req.body.conversationId || req.query.conversationId
      }
    };
  }
});

const upload = multer({ storage });

// Middleware export
export const uploadMiddleware = upload.single('file');

export const uploadFile = (req, res) => {
  try {
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    console.log('File uploaded successfully:', req.file);
    res.json({
      id: req.file.id.toString(),
      filename: req.file.filename,
      contentType: req.file.contentType
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getFile = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('MediaController: Accessing file with ID:', id);
    console.log('MediaController: User ID:', req.userId);
    
    if (!req.userId) {
      console.log('MediaController: No authentication found, returning 401');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'fs' });
    
    // Find the file
    const filesCollection = db.collection('fs.files');
    const file = await filesCollection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    
    if (!file) {
      console.log('MediaController: File not found with ID:', id);
      return res.status(404).json({ message: 'File not found' });
    }
    
    console.log('MediaController: File found:', file.filename, 'Type:', file.contentType);
    
    // Check conversation membership if metadata present
    if (file.metadata && file.metadata.conversationId) {
      const convId = file.metadata.conversationId;
      console.log('MediaController: File belongs to conversation:', convId);
      
      const conversation = await Conversation.findById(convId);
      console.log('MediaController: Current user ID:', req.userId);
      
      if (!conversation) {
        console.log('MediaController: Conversation not found:', convId);
        return res.status(403).json({ message: 'Access denied' });
      }
      
      console.log('MediaController: Conversation participants:', conversation.participantA, ',', conversation.participantB);
      
      if (req.userId !== conversation.participantA && req.userId !== conversation.participantB) {
        console.log('MediaController: User', req.userId, 'is not a participant in conversation', convId);
        return res.status(403).json({ message: 'Access denied' });
      }
      
      console.log('MediaController: Access granted for user', req.userId, 'to file', id);
    } else {
      console.log('MediaController: No conversation metadata found, allowing access');
    }
    
    // Set proper headers for PDF and other documents
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    res.set('Content-Length', file.length);
    
    // Stream the file
    console.log('MediaController: Streaming file:', file.filename, 'Size:', file.length);
    
    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(id));
    
    downloadStream.on('error', (error) => {
      console.error('MediaController: Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming file' });
      }
    });
    
    downloadStream.pipe(res);
  } catch (error) {
    console.error('MediaController: Get file error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};
