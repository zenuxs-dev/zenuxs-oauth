export { BrowserOAuthClient as OAuthClient, default } from './client.js';
export { BrowserStorage } from './storage.js';
export { handleRedirectFlow, createPopupFlow, createSilentFlow } from './flows.js';
export { getCurrentUrl, redirectTo, createPopup, parseUrlParams, cleanupUrl } from './utils.js';
export { OAuthError, InvalidConfigError, TokenError, NetworkError } from '../core/errors.js';
export { generateRandomString, generatePKCEChallenge } from '../core/pkce.js';
export { buildAuthorizationUrl, buildTokenUrl, buildUserInfoUrl, buildDiscoveryUrl, buildJwksUrl, buildClientInfoUrl, parseCallbackUrl } from '../core/urls.js';
export { parseTokenResponse, isTokenExpired, decodeJWT, validateTokenStructure } from '../core/tokens.js';

// Convenience exports for automatic flows
export async function createOAuthClient(config) {
  return new BrowserOAuthClient(config);
}

export async function login(config, options = {}) {
  const client = new BrowserOAuthClient(config);
  return client.login(options);
}

export async function handleCallback(config, options = {}) {
  const client = new BrowserOAuthClient(config);
  return client.handleCallback(options);
}

export async function getAuthorizationUrl(config, options = {}) {
  const client = new BrowserOAuthClient(config);
  return client.getAuthorizationUrl(options);
}