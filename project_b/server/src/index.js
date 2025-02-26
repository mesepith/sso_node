import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Issuer, generators } from 'openid-client';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3012',
  credentials: true
}));

// Store for auth state
const authStates = new Map();

// Store for user sessions
const sessions = new Map();

// Initialize OIDC client
let oidcClient = null;

async function initializeOidcClient() {
  try {
    const projectAIssuer = await Issuer.discover('http://localhost:3001/oidc');
    
    oidcClient = new projectAIssuer.Client({
      client_id: 'project-b',
      client_secret: 'project-b-secret',
      redirect_uris: ['http://localhost:3002/callback'],
      post_logout_redirect_uris: ['http://localhost:3002/'],
      response_types: ['code'],
    });
    
    console.log('OIDC client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OIDC client:', error);
  }
}

// Initialize OIDC client on startup
initializeOidcClient();

// Silent authentication endpoint
app.get('/api/silent-auth', async (req, res) => {
  try {
    // Forward cookies from the client to Project A to check if user is already logged in
    const cookies = req.headers.cookie;
    
    // Check with Project A if the user is already logged in
    const response = await axios.get('http://localhost:3001/api/auth/status', {
      headers: {
        Cookie: cookies || ''  // Forward cookies to maintain session
      }
    });
    
    if (response.data.isLoggedIn) {
      // User is already logged in to Project A
      res.json({ 
        isLoggedIn: true,
        user: response.data.user
      });
    } else {
      // User is not logged in to Project A
      res.json({ isLoggedIn: false });
    }
  } catch (error) {
    console.error('Silent auth error:', error);
    res.status(500).json({ error: 'Failed to perform silent authentication' });
  }
});

// Initiate login
app.get('/api/auth/login', (req, res) => {
  if (!oidcClient) {
    return res.status(500).json({ error: 'OIDC client not initialized' });
  }

  const state = generators.state();
  const nonce = generators.nonce();
  
  // Store state for validation when the user returns
  authStates.set(state, { nonce });
  
  const authUrl = oidcClient.authorizationUrl({
    scope: 'openid profile email',
    state,
    nonce,
  });
  
  res.json({ authUrl });
});

// OIDC callback
app.get('/api/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!authStates.has(state)) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    const { nonce } = authStates.get(state);
    authStates.delete(state);
    
    const tokenSet = await oidcClient.callback('http://localhost:3002/callback', { code, state }, { nonce });
    
    // In a real app, store the token securely and create a session
    res.json({ 
      success: true,
      user: tokenSet.claims()
    });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Verify token endpoint
app.post('/api/auth/verify-token', (req, res) => {
  const { token, user } = req.body;
  
  // In a real app, verify the token with Project A
  // For this demo, we'll create a session for the user
  if (user) {
    // Create a session ID
    const sessionId = Math.random().toString(36).substring(2, 15);
    
    // Store the user in our session store
    sessions.set(sessionId, user);
    
    // Set session cookie
    res.cookie('projectB_sessionId', sessionId, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    res.json({ success: true, user: user });
  } else {
    res.status(400).json({ success: false, message: 'User data required' });
  }
});

// Check auth status endpoint for Project B
app.get('/api/auth/status', (req, res) => {
  // Check for session cookie
  const sessionId = req.cookies.projectB_sessionId;
  
  if (sessionId && sessions.has(sessionId)) {
    // Session exists, user is logged in to Project B
    const user = sessions.get(sessionId);
    res.json({ 
      isLoggedIn: true,
      user: user
    });
  } else {
    // No valid session, user is not logged in to Project B
    res.json({ 
      isLoggedIn: false 
    });
  }
});

// Logout endpoint
app.post('/api/auth/logout', async (req, res) => {
  // Get session ID from cookies
  const sessionId = req.cookies.projectB_sessionId;
  
  if (sessionId) {
    // Remove session
    sessions.delete(sessionId);
    
    // Clear cookie
    res.clearCookie('projectB_sessionId');
  }
  
  // Also logout from Project A
  try {
    const cookies = req.headers.cookie;
    await axios.post('http://localhost:3001/api/auth/logout', {}, {
      headers: {
        Cookie: cookies || ''
      }
    });
  } catch (error) {
    console.error('Error logging out from Project A:', error);
  }
  
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Project B server running on port ${PORT}`);
});