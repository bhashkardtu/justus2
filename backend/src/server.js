import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { configureSocketIO } from './websocket/socketHandler.js';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/health', healthRoutes);

// Error handler
app.use(errorHandler);

// Socket.IO configuration
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

configureSocketIO(io);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/justus';
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`Starting server in ${NODE_ENV} mode...`);

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('✓ Connected to MongoDB');
  
  // Health check on startup
  try {
    const adminDb = mongoose.connection.db.admin();
    const pingResult = await adminDb.ping();
    console.log('✓ MongoDB ping successful:', pingResult);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`✓ Available collections: ${collections.map(c => c.name).join(', ')}`);
    
    // Check GridFS files
    const filesCollection = mongoose.connection.db.collection('fs.files');
    const fileCount = await filesCollection.countDocuments();
    console.log(`✓ GridFS files count: ${fileCount}`);
  } catch (error) {
    console.error('✗ Startup health check failed:', error.message);
  }
  
  // Start server
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ Server is running on port ${PORT}`);
    console.log(`✓ Environment: ${NODE_ENV}`);
    console.log(`✓ Allowed Origins: ${allowedOrigins.join(', ')}`);
  });
})
.catch(err => {
  console.error('✗ MongoDB connection error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
  await mongoose.connection.close();
  process.exit(0);
});
