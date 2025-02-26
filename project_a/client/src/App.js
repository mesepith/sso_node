import React, { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if the user is logged in on component mount
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/status', {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.isLoggedIn) {
        setUser(data.user);
      } else {
        setUser(null);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Auth status check error:', error);
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const username = event.target.username.value;
    const password = event.target.password.value;

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        
        // Check if this login is from a popup window
        if (window.opener && window.opener !== window) {
          // Send the authentication token back to the opener
          window.opener.postMessage({
            type: 'AUTH_SUCCESS',
            user: data.user
          }, '*');
          // Close the popup
          window.close();
        }
      } else {
        alert('Login failed: ' + data.message);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('An error occurred during login');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3001/api/auth/logout', {
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
      <h1>Project A</h1>
      
      {user ? (
        <div>
          <p>Welcome, {user.username}!</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <div>
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '10px' }}>
              <label htmlFor="username">Username:</label>
              <input 
                type="text" 
                id="username" 
                name="username" 
                defaultValue="user"
                style={{ display: 'block', width: '100%', padding: '8px' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label htmlFor="password">Password:</label>
              <input 
                type="password" 
                id="password" 
                name="password"
                defaultValue="password"
                style={{ display: 'block', width: '100%', padding: '8px' }}
              />
            </div>
            <button 
              type="submit"
              style={{ padding: '10px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none' }}
            >
              Login
            </button>
          </form>
        </div>
      )}
      
      {/* Add a message listener for receiving messages from other windows */}
      <script dangerouslySetInnerHTML={{
        __html: `
          window.addEventListener('message', (event) => {
            // Validate the origin in a real application
            if (event.data && event.data.type === 'AUTH_REQUEST') {
              // Send the current authentication state back
              event.source.postMessage({
                type: 'AUTH_RESPONSE',
                isLoggedIn: ${!!user},
                user: ${JSON.stringify(user)}
              }, event.origin);
            }
          });
        `
      }} />
    </div>
  );
}

export default App;