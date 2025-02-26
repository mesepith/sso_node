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
          
          console.log('Sending auth success to opener:', data.user);
          
          // Close the popup after a short delay to ensure the message is sent
          setTimeout(() => {
            window.close();
          }, 500);
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
      console.log('Logging out from Project A');
      
      // Signal to other tabs/windows that logout occurred BEFORE making the API call
      // This ensures Project B gets the notification even if the API call is slow
      localStorage.setItem('projectA_logout', 'true');
      
      // Now perform the actual logout
      await fetch('http://localhost:3001/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      setUser(null);
      
      // Client-side notifications should not be necessary since the 
      // server-side notification system is properly handling the logout
      // But for the sake of being thorough, we'll keep this as a backup
      
      // Attempt to notify Project B
      try {
        const response = await fetch('http://localhost:3002/api/auth/logout-from-project-a', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          mode: 'cors'
        });
        console.log('Directly notified Project B about logout:', response.status);
      } catch (projectBError) {
        console.log('Project B notification handled by server');
      }
      
      // Attempt to notify Project C
      try {
        const response = await fetch('http://localhost:3003/api/auth/logout-from-project-a', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          mode: 'cors'
        });
        console.log('Directly notified Project C about logout:', response.status);
      } catch (projectCError) {
        console.log('Project C notification handled by server');
      }
      
      // Reset the flag after a longer delay to ensure it's picked up
      setTimeout(() => {
        localStorage.removeItem('projectA_logout');
      }, 3000);
      
      console.log('Logout completed');
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