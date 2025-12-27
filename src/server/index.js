// Re-export core functionality
export { OAuthClient } from '../core/client.js';
export { OAuthError, InvalidConfigError, TokenError, NetworkError } from '../core/errors.js';
export { generateRandomString, generatePKCEChallenge } from '../core/pkce.js';
export { buildAuthorizationUrl } from '../core/urls.js';
export { parseTokenResponse, isTokenExpired, decodeJWT, validateTokenStructure } from '../core/tokens.js';

// Export server client
export { ServerOAuthClient, default } from './client.js';

// Export server flows
export {
  getTokenFromCode,
  refreshToken,
  getUserByToken,
  verifyToken,
  revokeToken,
  parseToken
} from './flows.js';

// Convenience exports
export async function createOAuthClient(config) {
  return new ServerOAuthClient(config);
}