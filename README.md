<div align="center">

# JustUs

### A Secure, Private Two-Person Chat Application

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0+-green.svg)](https://www.mongodb.com/)

**JustUs** is a feature-rich, end-to-end encrypted chat application designed for secure, private communication. Built with modern web technologies and security best practices, it uses invite codes to connect users.

[Features](#features) • [Tech Stack](#tech-stack) • [Getting Started](#getting-started) • [Documentation](#documentation) • [Security](#security)

</div>

---

## Overview

JustUs is a production-ready chat application that prioritizes privacy and security while offering modern communication features. Whether you're looking for secure messaging, voice translation, or AI-powered assistance, JustUs provides a comprehensive solution for private communication with your contacts.

## Features

### Security & Privacy
- **End-to-End Encryption (E2EE)**: All messages are encrypted using TweetNaCl (NaCl cryptography)
- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **Invite-Based Connections**: Connect with others using unique 8-character invite codes
- **Email Verification**: Required email verification for all new accounts
- **Rate Limiting**: Protection against brute force and DDoS attacks
- **Security Headers**: Helmet.js integration for enhanced HTTP security

### Communication
- **Real-time Messaging**: Instant message delivery using Socket.IO
- **Media Sharing**: Upload and share images, videos, and files via GridFS
- **Video Calls**: Built-in WebRTC video calling capabilities
- **Voice Messages**: Record and send voice messages
- **Message History**: Persistent message storage with MongoDB

### AI-Powered Features
- **AI Chat Assistant**: Integrated Gemini AI for intelligent responses
- **Voice Translation**: Real-time voice message translation
- **Smart Responses**: Context-aware AI suggestions
- **Text-to-Speech**: Google Cloud TTS integration

### User Experience
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Real-time Typing Indicators**: See when the other person is typing
- **Online/Offline Status**: Real-time presence detection
- **Message Reactions**: Express yourself with emoji reactions
- **Dark Mode Support**: Eye-friendly interface options

## Tech Stack

### Frontend
- **React 18.2** - Modern UI library
- **Socket.IO Client** - Real-time bidirectional communication
- **Axios** - HTTP client for API requests
- **Tailwind CSS** - Utility-first CSS framework
- **TweetNaCl** - Cryptographic library for E2EE

### Backend
- **Node.js 18+** - JavaScript runtime
- **Express.js** - Web application framework
- **Socket.IO** - WebSocket server
- **MongoDB & Mongoose** - Database and ODM
- **JWT** - Secure authentication tokens
- **Multer & GridFS** - File upload and storage
- **Helmet** - Security middleware
- **Express Rate Limit** - API rate limiting

### AI & Cloud Services
- **Google Generative AI (Gemini)** - AI chat capabilities
- **Google Cloud Text-to-Speech** - Voice synthesis
- **Translation APIs** - Voice message translation

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)
- **MongoDB** (v7.0 or higher)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/justus.git
   cd justus
   ```

2. **Set up MongoDB**
   
   Ensure MongoDB is running locally:
   ```bash
   # Start MongoDB service
   mongod
   ```
   
   Default connection: `mongodb://localhost:27017`

3. **Configure Backend**
   
   Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```
   
   Create a `.env` file in the `backend` directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/justus
   JWT_SECRET=your_secure_jwt_secret_key_here
   JWT_EXPIRE=7d
   
   # Google Cloud API Keys (optional, for AI features)
   GOOGLE_API_KEY=your_google_api_key
   GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
   
   # Client URL for CORS
   CLIENT_URL=http://localhost:3000
   ```

4. **Configure Frontend**
   
   Navigate to the frontend directory and install dependencies:
   ```bash
   cd ../frontend
   npm install
   ```
   
   Create a `.env` file in the `frontend` directory:
   ```env
   REACT_APP_API_URL=http://localhost:5000
   REACT_APP_SOCKET_URL=http://localhost:5000
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   npm run dev
   ```
   The backend will run on `http://localhost:5000`

2. **Start the Frontend Development Server**
   ```bash
   cd frontend
   npm start
   ```
   The frontend will run on `http://localhost:3000`

3. **Access the Application**
   
   Open your browser and navigate to `http://localhost:3000`

## Usage

### First-Time Setup

1. **Register Account**: Create an account with email verification
2. **Get Your Invite Code**: After registration, you'll receive a unique 8-character invite code
3. **Connect with Others**: Share your invite code or enter someone else's code to connect
4. **Start Chatting**: All messages are automatically end-to-end encrypted

### Key Features Usage

- **Send Messages**: Type in the message box and press Enter or click Send
- **Upload Media**: Click the attachment icon to share images, videos, or files
- **Video Call**: Click the video camera icon to start a video call
- **AI Assistant**: Use the AI bot integration for smart responses
- **Voice Messages**: Hold the microphone button to record voice messages

## Project Structure

```
justus/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── server.js       # Main server file
│   │   ├── models/         # Mongoose models
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Custom middleware
│   │   └── utils/          # Utility functions
│   ├── package.json
│   └── .env
│
├── frontend/               # React frontend
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   ├── components/    # React components
│   │   ├── services/      # API services
│   │   └── utils/         # Utility functions
│   ├── public/
│   ├── package.json
│   └── .env
│
├── docs/                   # Additional documentation
├── README.md
└── LICENSE
```

## Security

JustUs implements multiple layers of security:

### Encryption
- **E2EE**: Messages encrypted client-side using TweetNaCl
- **Key Exchange**: Secure key exchange protocol
- **Transport Security**: HTTPS in production

### Authentication
- **JWT Tokens**: Secure, stateless authentication
- **Password Hashing**: bcrypt with salt rounds
- **Session Management**: Secure token refresh mechanism

### API Security
- **Rate Limiting**: Prevents brute force attacks
- **CORS**: Configured for specific origins
- **Helmet.js**: Security headers protection
- **Input Validation**: Sanitization of user inputs

For detailed security information, see [SECURITY.md](SECURITY.md)

## Documentation

Additional documentation is available in the repository:

- [Quick Start Guide](QUICK_START.md) - Get up and running quickly
- [E2EE Implementation](E2EE_IMPLEMENTATION_SUMMARY.md) - Encryption details
- [AI Features Guide](AI_FEATURES_QUICK_START.md) - AI integration
- [Bot Integration](BOT_INTEGRATION_GUIDE.md) - Chatbot setup
- [Video Call Feature](VIDEO_CALL_FEATURE.md) - Video calling setup
- [Database Setup](DATABASE_SETUP.md) - MongoDB configuration
- [Deployment Guide](VERCEL_RENDER_DEPLOYMENT.md) - Production deployment
- [Pre-Production Checklist](PRE_PRODUCTION_CHECKLIST.md) - Launch preparation

## Deployment

### Production Build

**Frontend:**
```bash
cd frontend
npm run build
```

**Backend:**
```bash
cd backend
npm start
```

### Deployment Platforms

JustUs can be deployed to various platforms:
- **Frontend**: Vercel, Netlify, or any static hosting
- **Backend**: Render, Heroku, AWS, or DigitalOcean
- **Database**: MongoDB Atlas (recommended for production)

See [VERCEL_RENDER_DEPLOYMENT.md](VERCEL_RENDER_DEPLOYMENT.md) for detailed deployment instructions.

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- TweetNaCl for cryptographic primitives
- Socket.IO for real-time communication
- Google Cloud for AI services
- MongoDB for database solutions

## Contact

For questions or support, please open an issue in the GitHub repository.

---

<div align="center">

**Built for secure, private communication**

[⬆ Back to Top](#justus)

</div>
