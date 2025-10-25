import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { generateToken } from '../utils/jwtUtil.js';

export const register = async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    
    console.log(`Registration attempt for user: ${username}`);
    
    const count = await User.countDocuments();
    console.log(`Current user count: ${count}`);
    
    if (count >= 2) {
      return res.status(400).json({
        message: 'Registration closed: only two users allowed'
      });
    }
    
    if (!username || username.trim() === '') {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    if (!password || password.trim() === '') {
      return res.status(400).json({ message: 'Password is required' });
    }
    
    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) {
      return res.status(409).json({ message: 'Username already exists' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const user = new User({
      username: username.trim(),
      displayName: displayName || username.trim(),
      passwordHash
    });
    
    const saved = await user.save();
    console.log(`User registered successfully: ${saved.username} with ID: ${saved._id}`);
    
    const token = generateToken(saved._id.toString(), saved.username);
    
    // Set HTTP-only cookie for authentication
    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
      path: '/'
    });
    
    res.json({
      token,
      user: {
        id: saved._id,
        username: saved.username,
        displayName: saved.displayName
      }
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({
      message: `Registration failed: ${error.message}`
    });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`Login attempt for user: ${username}`);
    
    if (!username || username.trim() === '') {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    if (!password || password.trim() === '') {
      return res.status(400).json({ message: 'Password is required' });
    }
    
    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    const token = generateToken(user._id.toString(), user.username);
    
    // Set HTTP-only cookie for authentication
    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
      path: '/'
    });
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({
      message: `Login failed: ${error.message}`
    });
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

export const getUsers = async (req, res) => {
  try {
    const users = await User.find({}, { passwordHash: 0 });
    const userList = users.map(user => ({
      id: user._id,
      username: user.username,
      displayName: user.displayName
    }));
    res.json(userList);
  } catch (error) {
    console.error('Get users error:', error.message);
    res.status(500).json({
      message: `Failed to get users: ${error.message}`
    });
  }
};
