import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Provider } from 'oidc-provider';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3011',
  credentials: true
}));

// Basic configuration for the OIDC Provider
const oidcConfig = {
  clients: [{
    client_id: 'project-b',
    client_secret: 'project-b-secret',
    redirect_uris: ['http://localhost:3002/callback'],
    post_logout_redirect_uris: ['http://localhost:3002/'],
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
  }],
  cookies: {
    keys: ['some-secret-key'],
  },
  pkce: {
    required: () => false,
  },
  features: {
    devInteractions: { enabled: false },
  },
};

// Initialize OIDC Provider
const oidc = new Provider('http://localhost:3001', oidcConfig);

// Mount OIDC Provider
app.use('/oidc', oidc.callback());

// Simple user data for demonstration purposes
const users = [
  {
    id: '1',
    username: 'user',
    password: 'password', // In production, use hashed passwords
  }
];

// Simple session store for demo
const sessions = new Map();

// Check user login status endpoint
app.get('/api/auth/status', (req, res) => {
  // Check for session cookie
  const sessionId = req.cookies.sessionId;
  
  if (sessionId && sessions.has(sessionId)) {
    // Session exists, user is logged in
    const user = sessions.get(sessionId);
    res.json({ 
      isLoggedIn: true,
      user: user
    });
  } else {
    // No valid session, user is not logged in
    res.json({ 
      isLoggedIn: false 
    });
  }
});

// Login endpoint (simplified for demo)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    // Create a simple session ID
    const sessionId = Math.random().toString(36).substring(2, 15);
    
    // Store session
    sessions.set(sessionId, { id: user.id, username: user.username });
    
    // Set session cookie
    res.cookie('sessionId', sessionId, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    res.json({ 
      success: true, 
      user: { id: user.id, username: user.username }
    });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.cookies.sessionId;
  
  if (sessionId) {
    // Remove session
    sessions.delete(sessionId);
    
    // Clear cookie
    res.clearCookie('sessionId');
  }
  
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Project A server running on port ${PORT}`);
});