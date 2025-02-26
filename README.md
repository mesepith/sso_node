# SSO Implementation with Node.js

This project demonstrates SSO (Single Sign-On) authentication between two applications using OpenID Connect (OIDC).

## Project Structure

- **Project A**: Acts as an OIDC Provider (identity provider)
  - Frontend: React.js (port 3000)
  - Backend: Node.js with Express (port 3001)

- **Project B**: Acts as an OIDC Client (service provider)
  - Frontend: React.js (port 4000)
  - Backend: Node.js with Express (port 3002)

## Authentication Flow

1. **Silent Authentication**:
   - When a user visits Project B, it automatically checks if they're already logged into Project A
   - If logged in, user is automatically logged into Project B

2. **Login with Popup Window**:
   - If not logged in, Project B displays a login modal
   - Clicking "Login with Project A" opens a popup with Project A's login page
   - After successful login, the auth token is sent back to Project B via window.postMessage()

3. **Logout Handling**:
   - Logging out from either project logs the user out of both applications

## Setup Instructions

### Project A (OIDC Provider)

1. Navigate to the project directory:
   ```
   cd project_a
   ```

2. Install dependencies for both client and server:
   ```
   cd client && npm install
   cd ../server && npm install
   ```

3. Create .env files from the examples:
   ```
   cp server/.env.example server/.env
   ```

4. Start the server:
   ```
   cd server && npm run dev
   ```

5. Start the client (in a new terminal):
   ```
   cd client && npm start
   ```

### Project B (OIDC Client)

1. Navigate to the project directory:
   ```
   cd project_b
   ```

2. Install dependencies for both client and server:
   ```
   cd client && npm install
   cd ../server && npm install
   ```

3. Create .env files from the examples:
   ```
   cp server/.env.example server/.env
   ```

4. Start the server:
   ```
   cd server && npm run dev
   ```

5. Start the client (in a new terminal):
   ```
   cd client && npm start
   ```

## Default Login Credentials

- Username: user
- Password: password

## Implementation Notes

- Project A implements the OIDC Provider using the 'oidc-provider' library
- Project B acts as an OIDC Client using the 'openid-client' library
- Authentication tokens are passed between windows using window.postMessage()
- In a production environment, additional security measures should be implemented

## Testing the SSO Flow

1. Open Project B in your browser (http://localhost:4000)
2. Click "Login with Project A"
3. Log in with the provided credentials in the popup window
4. After successful login, you'll be logged into Project B automatically
5. Open Project A in another tab (http://localhost:3000) - you should already be logged in

## Security Considerations

This is a demonstration implementation. For production use, consider:

- Using secure HTTP-only cookies
- Implementing CSRF protection
- Adding proper token validation and expiration
- Securing the window.postMessage() implementation with origin validation
- Managing proper session logout across applications