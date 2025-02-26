require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Issuer, generators } = require('openid-client');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Store for auth state
const authStates = new Map();

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
    // In a real implementation, this would check with Project A if the user is already logged in
    const response = await axios.get('http://localhost:3001/api/auth/status');
    
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
  const { token } = req.body;
  
  // In a real app, verify the token with Project A
  // For demo, just return success
  res.json({ success: true, user: { id: '1', username: 'user' } });
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  // In a real app, invalidate the user's session and redirect to Project A logout
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Project B server running on port ${PORT}`);
});