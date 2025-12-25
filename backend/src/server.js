import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { configureSocketIO } from './websocket/socketHandler.js';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import configRoutes from './routes/configRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import botRoutes from './routes/botRoutes.js';
import ttsRoutes from './routes/ttsRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import path from 'path';
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('trust proxy', 1);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://unmetered-mountainously-torri.ngrok-free.dev'
];

console.log('Allowed CORS Origins:', allowedOrigins);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for WebSocket compatibility
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow cross-origin image loading
}));

// CORS configuration with function to handle dynamic origins
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
}));

// Compression middleware
app.use(compression());

// Middleware with size limits for security
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Get NODE_ENV
const NODE_ENV = process.env.NODE_ENV || 'development';

// Request logging in development
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Apply rate limiting to all API routes (skip in development)
if (NODE_ENV === 'production') {
  app.use('/api/', apiLimiter);
  console.log('✓ Rate limiting enabled for production');
} else {
  console.log('⚠ Rate limiting disabled for development');
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/config', configRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/tts', ttsRoutes);



// Serve frontend build
app.use(express.static(path.join(__dirname, "..", "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "build", "index.html"));
});




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
const PORT = process.env.PORT || 5000;

console.log(`Starting server in ${NODE_ENV} mode...`);
console.log("CONNECTION STRING FOR MONGO :  ",MONGODB_URI);

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000
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
