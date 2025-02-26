import React, { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    // First check if we have a session in Project B
    checkProjectBSession();
  }, []);

  // Check if we're already logged in to Project B
  const checkProjectBSession = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/auth/status', {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.isLoggedIn) {
        // We have a session in Project B
        setUser(data.user);
        setShowLoginModal(false);
        setLoading(false);
      } else {
        // No session in Project B, try silent auth with Project A
        checkSilentAuth();
      }
    } catch (error) {
      console.error('Project B session check error:', error);
      checkSilentAuth();
    }
  };

  // Function to check if user is already logged in Project A
  const checkSilentAuth = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/silent-auth', {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.isLoggedIn) {
        // User is logged in to Project A, create a session in Project B
        const verifyResponse = await fetch('http://localhost:3002/api/auth/verify-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            token: 'token-from-silent-auth',
            user: data.user
          }),
          credentials: 'include'
        });
        
        const verifyData = await verifyResponse.json();
        
        if (verifyData.success) {
          setUser(data.user);
          setShowLoginModal(false);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Silent auth error:', error);
      setLoading(false);
    }
  };

  // Function to open login popup
  const handleLoginClick = async () => {
    try {
      // Get the authentication URL from the backend
      const response = await fetch('http://localhost:3002/api/auth/login', {
        credentials: 'include'
      });
      const data = await response.json();
      
      // Open the authentication URL in a popup window
      const popup = window.open(
        data.authUrl,
        'Login',
        'width=500,height=600,left=100,top=100'
      );
      
      // Setup message listener for the popup response
      window.addEventListener('message', handleAuthMessage);
      
      // Function to handle messages from the popup
      function handleAuthMessage(event) {
        // Validate the origin in a real application
        
        if (event.data && event.data.type === 'AUTH_SUCCESS') {
          setUser(event.data.user);
          setShowLoginModal(false);
          
          // Verify the token with the backend
          verifyToken(event.data.user);
          
          // Remove the event listener once we get a response
          window.removeEventListener('message', handleAuthMessage);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  // Function to verify the token with the backend
  const verifyToken = async (user) => {
    try {
      const response = await fetch('http://localhost:3002/api/auth/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          token: 'token-from-auth-response',
          user: user
        }),
        credentials: 'include'
      });

      const data = await response.json();
      if (!data.success) {
        setUser(null);
      }
    } catch (error) {
      console.error('Token verification error:', error);
    }
  };

  // Function to handle logout
  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3002/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1>Project B</h1>
      
      {user ? (
        <div>
          <p>Welcome, {user.username}!</p>
          <p>You are logged in to Project B via Project A (SSO).</p>
          <button 
            onClick={handleLogout}
            style={{ padding: '10px 15px', backgroundColor: '#f44336', color: 'white', border: 'none' }}
          >
            Logout
          </button>
        </div>
      ) : (
        <div>
          <p>You are not logged in.</p>
          <button 
            onClick={() => setShowLoginModal(true)}
            style={{ padding: '10px 15px', backgroundColor: '#2196F3', color: 'white', border: 'none' }}
          >
            Login with Project A
          </button>
        </div>
      )}
      
      {/* Login Modal */}
      {showLoginModal && !user && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '5px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h2>Login to Project B</h2>
            <p>To access Project B, you need to login with your Project A account.</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button 
                onClick={() => setShowLoginModal(false)}
                style={{ padding: '10px 15px', backgroundColor: '#ccc', border: 'none' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleLoginClick}
                style={{ padding: '10px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none' }}
              >
                Login with Project A
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;