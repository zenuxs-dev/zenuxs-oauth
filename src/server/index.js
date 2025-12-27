// Server-specific exports
export { default as ServerOAuthClient } from './client.js';
export { OAuthError, InvalidConfigError, TokenError, NetworkError } from '../core/errors.js';
export { generateRandomString, generatePKCEChallenge } from '../core/pkce.js';
export { buildAuthorizationUrl } from '../core/urls.js';
export { parseTokenResponse, isTokenExpired, decodeJWT, validateTokenStructure } from '../core/tokens.js';

// Export server flows
export {
  getTokenFromCode,
  refreshToken,
  getUserByToken,
  verifyToken,
  revokeToken,
  parseToken
} from './flows.js';

// Convenience function
export async function createOAuthClient(config) {
  const client = new ServerOAuthClient(config);
  return client;
}

// Default export - KEEP THIS
export default ServerOAuthClient;