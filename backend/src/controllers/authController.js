import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import { generateToken } from '../utils/jwtUtil.js';
import { sendVerificationEmail } from '../services/emailService.js';

// Helper to generate 6-digit code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const register = async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    
    console.log(`Registration attempt for user: ${username}`);
    
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if username or email exists
    const existingUser = await User.findOne({ 
      $or: [{ username: username.trim() }, { email: email.trim().toLowerCase() }] 
    });
    
    if (existingUser) {
      if (existingUser.username === username.trim()) {
        return res.status(409).json({ message: 'Username already exists' });
      }
      return res.status(409).json({ message: 'Email already registered' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    const inviteCode = crypto.randomBytes(4).toString('hex');
    
    const user = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      displayName: displayName || username.trim(),
      passwordHash,
      verificationCode,
      verificationCodeExpires,
      isVerified: false,
      inviteCode,
      contacts: []
    });
    
    const saved = await user.save();
    
    // Send email
    await sendVerificationEmail(saved.email, saved.displayName, verificationCode);

    // Send System Message with Invite Link
    const systemId = '000000000000000000000000';
    const userId = saved._id.toString();
    
    // Create conversation with System
    const key = systemId < userId ? `${systemId}:${userId}` : `${userId}:${systemId}`;
    let conversation = await Conversation.findOne({ key });
    if (!conversation) {
      conversation = new Conversation({
        participantA: systemId < userId ? systemId : userId,
        participantB: systemId < userId ? userId : systemId,
        key
      });
      await conversation.save();
    }

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/connect/${inviteCode}`;
    const systemMessage = new Message({
      senderId: systemId,
      receiverId: userId,
      conversationId: conversation._id,
      type: 'text',
      content: `Welcome to JustUs!\n\nHere is your unique invite link to connect with others:\n${inviteLink}\n\nHow to connect with someone:\n1) Ask your friend to share their 8-character invite code or link.\n2) Click the Contacts button (person-with-plus icon) in the chat header.\n3) Enter their invite code in the Add Contact box and press Add.\n\nTip: Your own invite link is above — share it to let others connect with you.`,
      timestamp: new Date()
    });
    await systemMessage.save();
    
    res.status(201).json({
      message: 'Registration successful. Please check your email for verification code.',
      userId: saved._id,
      email: saved.email,
      requiresVerification: true
    });
    
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({
      message: `Registration failed: ${error.message}`
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }
    
    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    
    if (user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({ message: 'Verification code expired' });
    }
    
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();
    
    // Auto login after verification
    const token = generateToken(user._id.toString(), user.username);
    
    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      path: '/'
    });
    
    res.json({
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('Verification error:', error.message);
    res.status(500).json({ message: 'Verification failed' });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }
    
    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    
    await sendVerificationEmail(user.email, user.displayName, verificationCode);
    
    res.json({ message: 'Verification code resent' });
    
  } catch (error) {
    console.error('Resend error:', error.message);
    res.status(500).json({ message: 'Failed to resend code' });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body; // username can be email or username
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username/Email and password are required' });
    }
    
    // Allow login with email or username
    const user = await User.findOne({
      $or: [{ username: username.trim() }, { email: username.trim().toLowerCase() }]
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    if (!user.isVerified) {
      return res.status(403).json({ 
        message: 'Please verify your email first',
        requiresVerification: true,
        email: user.email
      });
    }

    // Generate invite code if missing (migration for existing users)
    if (!user.inviteCode) {
      user.inviteCode = crypto.randomBytes(4).toString('hex');
      await user.save();
    }
    
    const token = generateToken(user._id.toString(), user.username);
    
    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      path: '/'
    });
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Login failed' });
  }
};

export const logout = async (req, res) => {
  try {
    // Clear the auth cookie
    res.cookie('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
      sameSite: 'lax',
      path: '/'
    });
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error.message);
    res.status(500).json({
      message: `Logout failed: ${error.message}`
    });
  }
};

export const connectUser = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const currentUserId = req.userId; // From middleware

    if (!inviteCode) {
      return res.status(400).json({ message: 'Invite code is required' });
    }

    const targetUser = await User.findOne({ inviteCode });
    if (!targetUser) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    if (targetUser._id.toString() === currentUserId) {
      return res.status(400).json({ message: 'You cannot connect with yourself' });
    }

    const currentUser = await User.findById(currentUserId);

    // Check if already connected
    if (currentUser.contacts.some(c => c.toString() === targetUser._id.toString())) {
      return res.status(200).json({ message: 'Already connected', user: {
        id: targetUser._id,
        username: targetUser.username,
        displayName: targetUser.displayName
      }});
    }

    // Add to contacts (bidirectional)
    currentUser.contacts.push(targetUser._id);
    targetUser.contacts.push(currentUser._id);

    await currentUser.save();
    await targetUser.save();

    res.json({ 
      message: 'Connected successfully',
      user: {
        id: targetUser._id,
        username: targetUser.username,
        displayName: targetUser.displayName
      }
    });

  } catch (error) {
    console.error('Connect error:', error);
    res.status(500).json({ message: 'Failed to connect' });
  }
};

export const getUsers = async (req, res) => {
  try {
    // Only return contacts + System User
    const currentUser = await User.findById(req.userId).populate('contacts', 'username displayName _id');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const contacts = currentUser.contacts.map(user => ({
      id: user._id,
      username: user.username,
      displayName: user.displayName
    }));

    const systemUser = {
      id: '000000000000000000000000',
      username: 'system',
      displayName: 'JustUs System'
    };
    
    res.json([systemUser, ...contacts]);
  } catch (error) {
    console.error('Get users error:', error.message);
    res.status(500).json({
      message: `Failed to get users: ${error.message}`
    });
  }
};
