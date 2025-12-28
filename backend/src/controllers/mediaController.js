import mongoose from 'mongoose';
import multer from 'multer';
import { GridFsStorage } from 'multer-gridfs-storage';
import Conversation from '../models/Conversation.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/justus';

// Create GridFS storage that reuses the existing connection
const storage = new GridFsStorage({
  db: mongoose.connection,
  file: (req, file) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('GridFS: Preparing to store file:', file.originalname);
    }
    return {
      filename: file.originalname,
      bucketName: 'fs',
      metadata: {
        conversationId: req.body.conversationId || req.query.conversationId
      }
    };
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Allowed MIME types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types are images, videos, audio, PDF, and documents.`), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Middleware export
export const uploadMiddleware = upload.single('file');

export const uploadFile = (req, res) => {
  try {
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('=== FILE UPLOAD SUCCESS ===');
      console.log('File ID:', req.file.id.toString());
      console.log('Filename:', req.file.filename);
    }

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

    if (process.env.NODE_ENV !== 'production') {
      console.log('=== FILE RETRIEVAL REQUEST ===');
      console.log('File ID:', id);
    }

    if (!req.userId) {
      console.log('MediaController: No authentication found, returning 401');
      return res.status(401).json({ message: 'Authentication required' });
    }

    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'fs' });

    // Find the file
    const filesCollection = db.collection('fs.files');

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('MediaController: Invalid ObjectId format:', id);
      return res.status(400).json({ message: 'Invalid file ID format' });
    }

    const file = await filesCollection.findOne({ _id: new mongoose.Types.ObjectId(id) });

    if (!file) {
      console.log('MediaController: File not found with ID:', id);
      return res.status(404).json({ message: 'File not found' });
    }

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

    // Stream the file
    console.log('MediaController: Returning file:', file.filename);

    // Set CORS headers for cross-origin resource access (needed for CSS backgrounds, canvas, etc.)
    const origin = req.headers.origin;
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Credentials', 'true');
    }

    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(id));
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      console.error('Stream error:', error);
      res.status(500).json({ message: 'Error streaming file' });
    });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ message: error.message });
  }
};
