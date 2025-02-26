/**
 * OIDC Client Configurations
 * 
 * This file contains the configuration for all client applications that use Project A as an OIDC provider.
 * To add a new client, simply add a new entry to the clients array with the appropriate configuration.
 */

const clients = [
  {
    client_id: 'project-b',
    client_secret: 'project-b-secret',
    redirect_uris: ['http://localhost:3002/callback', 'http://localhost:3012/callback'],
    post_logout_redirect_uris: ['http://localhost:3002/', 'http://localhost:3012/'],
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
  },
  {
    client_id: 'project-c',
    client_secret: 'project-c-secret',
    redirect_uris: ['http://localhost:3003/callback', 'http://localhost:3013/callback'],
    post_logout_redirect_uris: ['http://localhost:3003/', 'http://localhost:3013/'],
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
  }
  // Add more clients as needed
];

export default clients;