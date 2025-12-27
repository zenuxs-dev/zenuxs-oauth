import { OAuthClient as CoreOAuthClient } from '../core/client.js';
import { OAuthError } from '../core/errors.js';
import { generateRandomString, generatePKCEChallenge } from '../core/pkce.js';
import { buildAuthorizationUrl } from '../core/urls.js';
import { parseTokenResponse, isTokenExpired, decodeJWT, validateTokenStructure } from '../core/tokens.js';
import { createFetchFunction } from './utils.js';

// Re-export core functionality
export { CoreOAuthClient as OAuthClient }; // Export as OAuthClient
export { OAuthError } from '../core/errors.js';
export { generateRandomString, generatePKCEChallenge } from '../core/pkce.js';
export { buildAuthorizationUrl } from '../core/urls.js';
export { parseTokenResponse, isTokenExpired, decodeJWT, validateTokenStructure } from '../core/tokens.js';

/**
 * Server-side OAuth client with no browser dependencies
 */
export class ServerOAuthClient extends CoreOAuthClient {
  constructor(config = {}) {
    super(config);
    this.serverConfig = config;
  }

  async getFetch() {
    return await createFetchFunction(this.serverConfig.fetch);
  }

  async exchangeCodeForTokens(code, codeVerifier, options = {}) {
    const fetchImpl = await this.getFetch();
    const tokenRequest = await super.exchangeCodeForTokens(code, codeVerifier, options);
    
    const response = await fetchImpl(tokenRequest.url, {
      method: tokenRequest.method,
      headers: tokenRequest.headers,
      body: tokenRequest.body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OAuthError(
        `Token exchange failed: ${response.status}`,
        'TOKEN_EXCHANGE_FAILED',
        { status: response.status, response: errorText }
      );
    }

    const tokenData = await response.json();
    return parseTokenResponse(tokenData);
  }

  async refreshToken(refreshToken, options = {}) {
    const fetchImpl = await this.getFetch();
    const refreshRequest = await super.refreshToken(refreshToken, options);
    
    const response = await fetchImpl(refreshRequest.url, {
      method: refreshRequest.method,
      headers: refreshRequest.headers,
      body: refreshRequest.body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OAuthError(
        `Token refresh failed: ${response.status}`,
        'TOKEN_REFRESH_FAILED',
        { status: response.status, response: errorText }
      );
    }

    const tokenData = await response.json();
    return parseTokenResponse(tokenData);
  }

  async revokeToken(token, tokenTypeHint = 'access_token', options = {}) {
    const fetchImpl = await this.getFetch();
    const revokeRequest = await super.revokeToken(token, tokenTypeHint, options);
    
    const response = await fetchImpl(revokeRequest.url, {
      method: revokeRequest.method,
      headers: revokeRequest.headers,
      body: revokeRequest.body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OAuthError(
        `Token revocation failed: ${response.status}`,
        'REVOKE_FAILED',
        { status: response.status, response: errorText }
      );
    }

    return true;
  }

  async getUserInfo(accessToken, options = {}) {
    const fetchImpl = await this.getFetch();
    const userInfoRequest = await super.getUserInfoRequest(accessToken, options);
    
    const response = await fetchImpl(userInfoRequest.url, {
      method: userInfoRequest.method,
      headers: userInfoRequest.headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OAuthError(
        `UserInfo request failed: ${response.status}`,
        'USERINFO_FAILED',
        { status: response.status, response: errorText }
      );
    }

    return response.json();
  }

  async verifyToken(accessToken, options = {}) {
    // Simple JWT verification (no network call)
    const decoded = decodeJWT(accessToken);
    if (!decoded) {
      throw new OAuthError('Invalid JWT format', 'INVALID_JWT');
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      throw new OAuthError('Token expired', 'TOKEN_EXPIRED');
    }

    return decoded;
  }

  async parseToken(accessToken, options = {}) {
    const decoded = decodeJWT(accessToken);
    if (!decoded) {
      throw new OAuthError('Invalid JWT format', 'INVALID_JWT');
    }

    // Validate required claims
    const requiredClaims = options.requiredClaims || ['sub', 'exp'];
    const missingClaims = requiredClaims.filter(claim => !decoded[claim]);
    
    if (missingClaims.length > 0) {
      throw new OAuthError(
        `Missing required claims: ${missingClaims.join(', ')}`,
        'MISSING_CLAIMS',
        { missingClaims }
      );
    }

    return decoded;
  }
}

export default ServerOAuthClient;