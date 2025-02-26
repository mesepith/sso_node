import React, { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    // First check if we have a session in Project B
    checkProjectBSession();
    
    // Add storage event listener for logout synchronization
    window.addEventListener('storage', handleStorageEvent);
    
    // Check localStorage on mount for existing logout flag
    if (localStorage.getItem('projectA_logout') === 'true') {
      console.log('Found existing logout flag - logging out from Project B');
      setUser(null);
      localStorage.removeItem('projectA_logout');
    }
    
    // Set up polling to check Project B session status
    const intervalId = setInterval(checkProjectBSessionStatus, 5000);
    
    // Cleanup listeners and intervals on component unmount
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(intervalId);
    };
  }, []);
  
  // Handle logout events from localStorage (cross-tab communication)
  const handleStorageEvent = (event) => {
    if (event.key === 'projectA_logout' && event.newValue === 'true') {
      console.log('Detected logout from Project A - logging out from Project B');
      setUser(null);
      
      // Clear Project B session via API
      fetch('http://localhost:3002/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      }).catch(error => {
        console.error('Error clearing Project B session:', error);
      });
    }
  };
  
  // Periodically check if Project B session is still valid
  const checkProjectBSessionStatus = async () => {
    if (!user) return; // No need to check if already logged out
    
    try {
      // Check if Project A session is still valid
      const response = await fetch('http://localhost:3001/api/auth/status', {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (!data.isLoggedIn && user) {
        console.log('Detected Project A session expired - logging out from Project B');
        setUser(null);
        
        // Clear Project B session
        fetch('http://localhost:3002/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        }).catch(error => {
          console.error('Error clearing Project B session:', error);
        });
      }
    } catch (error) {
      console.error('Error checking Project A session status:', error);
    }
  };

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
      
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        alert('Popup was blocked by the browser. Please allow popups for this site.');
        return;
      }
      
      // Setup message listener for the popup response
      window.addEventListener('message', handleAuthMessage);
      
      // Function to handle messages from the popup
      function handleAuthMessage(event) {
        // Validate the origin in a real application
        console.log('Received message from popup:', event.data);
        
        // Handle the AUTH_SUCCESS message containing user data
        if (event.data && event.data.type === 'AUTH_SUCCESS') {
          // Update user state
          setUser(event.data.user);
          setShowLoginModal(false);
          
          // Create a session in project B
          createSessionInProjectB(event.data.user);
          
          // Remove the event listener once we get a response
          window.removeEventListener('message', handleAuthMessage);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };
  
  // Function to create a session in Project B
  const createSessionInProjectB = async (user) => {
    try {
      // Call the verification endpoint to create a session
      const response = await fetch('http://localhost:3002/api/auth/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user: user
        }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!data.success) {
        console.error('Failed to create session in Project B');
        setUser(null);
      }
    } catch (error) {
      console.error('Error creating session:', error);
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