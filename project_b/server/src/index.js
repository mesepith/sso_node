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
  origin: function(origin, callback) {
    // Allow requests from Project B frontend and Project A frontend
    const allowedOrigins = [
      'http://localhost:3012', // Project B frontend
      'http://localhost:3011', // Project A frontend
      'http://localhost:3013'  // Project C frontend
    ];
    
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
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
      redirect_uris: ['http://localhost:3002/callback', 'http://localhost:3012/callback'],
      post_logout_redirect_uris: ['http://localhost:3002/', 'http://localhost:3012/'],
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
  
  // Instead of using OIDC for this demo, let's simplify and use Project A's login page directly
  const authUrl = 'http://localhost:3011';
  
  // Save state for later verification
  authStates.set(state, { nonce });
  
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
    
    const tokenSet = await oidcClient.callback('http://localhost:3012/callback', { code, state }, { nonce });
    
    // Get user claims from the token
    const claims = tokenSet.claims();
    console.log('Received claims:', claims);
    
    // Create a session for the user
    const sessionId = Math.random().toString(36).substring(2, 15);
    const userData = { 
      id: claims.sub || '1',
      username: claims.username || 'user' 
    };
    
    // Store the user in our session store
    sessions.set(sessionId, userData);
    
    // Set session cookie
    res.cookie('projectB_sessionId', sessionId, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    // In a real app, store the token securely and create a session
    res.json({ 
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Handle OIDC callback from popup window
app.get('/callback', (req, res) => {
  // Render a simple HTML page that sends the auth result back to the opener
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Successful</title>
      <script>
        // Get the code and state from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        // Send message to opener window
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'AUTH_CODE', 
            code, 
            state 
          }, '*');
          
          // Close the popup
          window.close();
        } else {
          document.body.innerHTML = '<h3>Authentication successful. You can close this window.</h3>';
        }
      </script>
    </head>
    <body>
      <h3>Authentication successful. Please wait...</h3>
    </body>
    </html>
  `);
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
    
    // Set a timeout for the request to avoid hang
    await axios.post('http://localhost:3001/api/auth/logout', {}, {
      headers: {
        Cookie: cookies || ''
      },
      timeout: 3000, // 3 second timeout
      validateStatus: function (status) {
        return status >= 200 && status < 600; // Accept any status code to prevent exceptions
      }
    });
    
    console.log('Successfully logged out from Project A');
  } catch (error) {
    console.error('Error logging out from Project A:', error.message);
    // Continue with local logout regardless of Project A's response
  }
  
  res.json({ success: true });
});

// Endpoint for Project A to trigger logout in Project B
app.post('/api/auth/logout-from-project-a', (req, res) => {
  console.log('Received logout request from Project A');
  
  // Clear all sessions (in a real app, you would only clear sessions for the specific user)
  sessions.clear();
  
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Project B server running on port ${PORT}`);
});