import { OAuthError, InvalidConfigError, TokenError } from './errors.js';
import { buildAuthorizationUrl, buildTokenUrl, buildUserInfoUrl } from './urls.js';
import { generateRandomString, generatePKCEChallenge } from './pkce.js';
import { parseTokenResponse, isTokenExpired, decodeJWT, validateTokenStructure } from './tokens.js';

/**
 * Base OAuth client with zero environment dependencies
 * Pure logic only - no DOM, no fetch, no storage
 */
export class OAuthClient {
  constructor(config = {}) {
    this.config = this.validateConfig(config);
    this.session = {
      codeVerifier: null,
      state: null,
      nonce: null
    };
  }

  validateConfig(config) {
    const errors = [];
    
    if (!config.clientId) errors.push('clientId is required');
    if (!config.authServer) errors.push('authServer is required');
    if (config.redirectUri && !this.isValidUrl(config.redirectUri)) {
      errors.push('redirectUri must be a valid URL');
    }
    
    if (errors.length > 0) {
      throw new InvalidConfigError(`Invalid configuration: ${errors.join(', ')}`);
    }
    
    return {
      clientId: config.clientId,
      authServer: config.authServer.endsWith('/') 
        ? config.authServer.slice(0, -1) 
        : config.authServer,
      redirectUri: config.redirectUri,
      scopes: config.scopes || 'openid profile email',
      authorizeEndpoint: config.authorizeEndpoint || '/oauth/authorize',
      tokenEndpoint: config.tokenEndpoint || '/oauth/token',
      userinfoEndpoint: config.userinfoEndpoint || '/oauth/userinfo',
      discoveryEndpoint: config.discoveryEndpoint || '/oauth/.well-known/openid-configuration',
      jwksEndpoint: config.jwksEndpoint || '/oauth/.well-known/jwks.json',
      clientInfoEndpoint: config.clientInfoEndpoint || '/oauth/client',
      revokeEndpoint: config.revokeEndpoint || '/oauth/revoke',
      usePKCE: config.usePKCE !== false,
      extraAuthParams: config.extraAuthParams || {},
      extraTokenParams: config.extraTokenParams || {},
      ...config,
      authServer: 'https://api.auth.zenuxs.in'
    };
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  async getAuthorizationUrl(options = {}) {
    const {
      redirectUri = this.config.redirectUri,
      scopes = this.config.scopes,
      extraParams = {}
    } = options;

    // Generate PKCE challenge if enabled
    let codeChallenge, codeVerifier;
    if (this.config.usePKCE) {
      const pkce = await generatePKCEChallenge();
      codeChallenge = pkce.codeChallenge;
      codeVerifier = pkce.codeVerifier;
      this.session.codeVerifier = codeVerifier;
    }

    // Generate state and nonce
    const state = generateRandomString(32);
    const nonce = generateRandomString(32);
    
    this.session.state = state;
    this.session.nonce = nonce;

    // Build authorization URL
    const url = buildAuthorizationUrl({
      authServer: this.config.authServer,
      authorizeEndpoint: this.config.authorizeEndpoint,
      clientId: this.config.clientId,
      redirectUri,
      scopes,
      state,
      nonce,
      codeChallenge,
      extraParams: {
        ...this.config.extraAuthParams,
        ...extraParams
      }
    });

    return {
      url,
      state,
      nonce,
      codeVerifier
    };
  }

  async exchangeCodeForTokens(code, codeVerifier, options = {}) {
    const {
      redirectUri = this.config.redirectUri,
      extraParams = {}
    } = options;

    const tokenUrl = buildTokenUrl({
      authServer: this.config.authServer,
      tokenEndpoint: this.config.tokenEndpoint
    });

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.config.clientId,
      ...this.config.extraTokenParams,
      ...extraParams
    });

    if (this.config.usePKCE && codeVerifier) {
      body.append('code_verifier', codeVerifier);
    }

    // Note: fetch is not called here - must be implemented by environment-specific client
    return {
      url: tokenUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    };
  }

  async refreshToken(refreshToken, options = {}) {
    const { extraParams = {} } = options;

    const tokenUrl = buildTokenUrl({
      authServer: this.config.authServer,
      tokenEndpoint: this.config.tokenEndpoint
    });

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      ...this.config.extraTokenParams,
      ...extraParams
    });

    return {
      url: tokenUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    };
  }

  async revokeToken(token, tokenTypeHint = 'access_token', options = {}) {
    const { extraParams = {} } = options;

    const revokeUrl = new URL(
      this.config.revokeEndpoint || '/oauth/revoke',
      this.config.authServer
    ).toString();

    const body = new URLSearchParams({
      token,
      token_type_hint: tokenTypeHint,
      client_id: this.config.clientId,
      ...extraParams
    });

    return {
      url: revokeUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    };
  }

  async getUserInfoRequest(accessToken, options = {}) {
    const { extraParams = {} } = options;

    const userInfoUrl = buildUserInfoUrl({
      authServer: this.config.authServer,
      userinfoEndpoint: this.config.userinfoEndpoint
    });

    return {
      url: userInfoUrl,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        ...extraParams
      }
    };
  }

  async getDiscoveryRequest(options = {}) {
    const discoveryUrl = buildDiscoveryUrl({
      authServer: this.config.authServer,
      discoveryEndpoint: this.config.discoveryEndpoint
    });

    return {
      url: discoveryUrl,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.extraHeaders || {})
      }
    };
  }

  async getJwksRequest(options = {}) {
    const jwksUrl = buildJwksUrl({
      authServer: this.config.authServer,
      jwksEndpoint: this.config.jwksEndpoint
    });

    return {
      url: jwksUrl,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.extraHeaders || {})
      }
    };
  }

  async getClientInfoRequest(clientId, options = {}) {
    if (!clientId) {
      throw new OAuthError('clientId is required for client info', 'MISSING_CLIENT_ID');
    }

    const clientInfoUrl = buildClientInfoUrl({
      authServer: this.config.authServer,
      clientInfoEndpoint: this.config.clientInfoEndpoint,
      clientId
    });

    return {
      url: clientInfoUrl,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.extraHeaders || {})
      }
    };
  }

  // Static utility methods
  static parseTokenResponse = parseTokenResponse;
  static isTokenExpired = isTokenExpired;
  static decodeJWT = decodeJWT;
  static validateTokenStructure = validateTokenStructure;
}

export default OAuthClient;