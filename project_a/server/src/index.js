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
    redirect_uris: ['http://localhost:3002/callback', 'http://localhost:3012/callback'],
    post_logout_redirect_uris: ['http://localhost:3002/', 'http://localhost:3012/'],
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
  }],
  cookies: {
    keys: ['some-secret-key'],
  },
  pkce: {
    required: () => false,
  },
  // We will handle custom interaction flows
  features: {
    devInteractions: { enabled: true }, // Enable for now for debugging
  },
  claims: {
    openid: ['sub'],
    profile: ['name', 'username'],
  },
  findAccount: async (ctx, id) => {
    // This would normally look up a real user account
    return {
      accountId: id,
      async claims() {
        return { sub: id, name: 'User', username: 'user' };
      },
    };
  },
};

// Initialize OIDC Provider
const oidc = new Provider('http://localhost:3001', oidcConfig);

// Handle custom interaction routes
app.get('/interaction/:uid', async (req, res) => {
  try {
    const details = await oidc.interactionDetails(req, res);
    console.log('Interaction details:', details);
    
    // For this demo, automatically login the user and consent
    const result = {
      login: {
        accountId: '1',
      },
      consent: {
        rejectedScopes: [],
        rejectedClaims: [],
      },
    };
    
    await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
  } catch (err) {
    console.error('Interaction error:', err);
    res.status(500).json({ error: 'Failed to process interaction' });
  }
});

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
app.post('/api/auth/logout', async (req, res) => {
  const sessionId = req.cookies.sessionId;
  
  if (sessionId) {
    // Remove session
    sessions.delete(sessionId);
    
    // Clear cookie
    res.clearCookie('sessionId');
  }
  
  // Also notify Project B about the logout
  try {
    // Make a request to Project B's logout endpoint
    console.log('Sending logout notification to Project B');
    const logoutResponse = await axios.post('http://localhost:3002/api/auth/logout-from-project-a', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Project B logout response:', logoutResponse.data);
  } catch (error) {
    console.error('Error notifying Project B about logout:', error.message);
    // Try with different port in case the server is running on a different port
    try {
      await axios.post('http://localhost:3012/api/auth/logout-from-project-a', {}, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (innerError) {
      console.error('Second attempt to notify Project B failed:', innerError.message);
    }
  }
  
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Project A server running on port ${PORT}`);
});