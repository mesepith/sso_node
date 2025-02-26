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
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
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

// Check user login status endpoint
app.get('/api/auth/status', (req, res) => {
  // In a real app, verify user session/token
  // For demo purposes, always return "logged in"
  res.json({ 
    isLoggedIn: true,
    user: { id: '1', username: 'user' }
  });
});

// Login endpoint (simplified for demo)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    // In production, use proper session management or JWT
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
  // In production, invalidate user session/token
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Project A server running on port ${PORT}`);
});