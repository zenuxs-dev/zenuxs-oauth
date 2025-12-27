import { OAuthClient } from '../core/client.js';
import { OAuthError } from '../core/errors.js';
import BrowserStorage from './storage.js';
import { handleRedirectFlow, createPopupFlow } from './flows.js';

export class BrowserOAuthClient extends OAuthClient {
  constructor(config = {}) {
    super(config);
    
    // Browser-specific configuration
    this.browserConfig = {
      storageType: config.storage || 'sessionStorage',
      storagePrefix: config.storagePrefix || 'zenux_oauth_',
      autoRefresh: config.autoRefresh !== false,
      refreshThreshold: config.refreshThreshold || 300,
      popupWidth: config.popupWidth || 600,
      popupHeight: config.popupHeight || 700,
      debug: config.debug || false,
      fetch: config.fetch || window.fetch.bind(window),
      ...config
    };
    
    // Initialize storage
    this.storage = new BrowserStorage({
      type: this.browserConfig.storageType,
      prefix: this.browserConfig.storagePrefix
    });
    
    // Initialize auto-refresh
    this.refreshInterval = null;
    if (this.browserConfig.autoRefresh) {
      this.setupAutoRefresh();
    }
  }

  async login(options = {}) {
    const {
      redirect = true,
      popup = false,
      silent = false,
      onSuccess,
      onError,
      ...loginOptions
    } = options;

    try {
      // Get authorization URL
      const authData = await this.getAuthorizationUrl(loginOptions);
      
      // Store state and code verifier
      this.storage.set('state', authData.state);
      if (authData.codeVerifier) {
        this.storage.set('code_verifier', authData.codeVerifier);
      }

      if (popup) {
        return createPopupFlow(this, {
          storage: this.storage,
          popupOptions: {
            width: this.browserConfig.popupWidth,
            height: this.browserConfig.popupHeight,
            ...options.popupOptions
          },
          onSuccess,
          onError
        });
      } else if (silent) {
        throw new OAuthError('Silent flow not yet implemented', 'NOT_IMPLEMENTED');
      } else if (redirect) {
        // Simple redirect
        window.location.href = authData.url;
        return null;
      } else {
        // Return URL for manual handling
        return authData.url;
      }
    } catch (error) {
      if (onError) onError(error);
      throw error;
    }
  }

  async handleCallback(options = {}) {
    const { onSuccess, onError } = options;
    
    return handleRedirectFlow(this, {
      storage: this.storage,
      onSuccess,
      onError
    });
  }

  getTokens() {
    const tokensStr = this.storage.get('tokens');
    if (!tokensStr) return null;
    
    try {
      return JSON.parse(tokensStr);
    } catch (error) {
      this.storage.remove('tokens');
      return null;
    }
  }

  isAuthenticated() {
    const tokens = this.getTokens();
    return !!(tokens && tokens.access_token && !this.isTokenExpired(tokens));
  }

  isTokenExpired(tokens = null) {
    const targetTokens = tokens || this.getTokens();
    if (!targetTokens) return true;
    
    return this.constructor.isTokenExpired(targetTokens, this.browserConfig.refreshThreshold);
  }

  async refreshTokens() {
    const tokens = this.getTokens();
    if (!tokens?.refresh_token) {
      throw new OAuthError('No refresh token available', 'NO_REFRESH_TOKEN');
    }

    const refreshRequest = await this.refreshToken(tokens.refresh_token);
    const response = await this.browserConfig.fetch(refreshRequest.url, {
      method: refreshRequest.method,
      headers: refreshRequest.headers,
      body: refreshRequest.body
    });

    if (!response.ok) {
      throw new OAuthError('Token refresh failed', 'TOKEN_REFRESH_FAILED', {
        status: response.status
      });
    }

    const tokenData = await response.json();
    const newTokens = this.constructor.parseTokenResponse(tokenData);
    
    // Preserve refresh token if not returned
    if (!newTokens.refresh_token && tokens.refresh_token) {
      newTokens.refresh_token = tokens.refresh_token;
    }

    this.storage.set('tokens', JSON.stringify(newTokens));
    return newTokens;
  }

  async getUserInfo() {
    const tokens = this.getTokens();
    if (!tokens?.access_token) {
      throw new OAuthError('No access token available', 'NO_ACCESS_TOKEN');
    }

    const userInfoRequest = await this.getUserInfoRequest(tokens.access_token);
    const response = await this.browserConfig.fetch(userInfoRequest.url, {
      method: userInfoRequest.method,
      headers: userInfoRequest.headers
    });

    if (!response.ok) {
      throw new OAuthError('UserInfo request failed', 'USERINFO_FAILED', {
        status: response.status
      });
    }

    return response.json();
  }

  async logout(options = {}) {
    const { revokeTokens = false, clearStorage = true } = options;
    const tokens = this.getTokens();

    if (revokeTokens && tokens) {
      try {
        if (tokens.access_token) {
          const revokeRequest = await this.revokeToken(tokens.access_token, 'access_token');
          await this.browserConfig.fetch(revokeRequest.url, {
            method: revokeRequest.method,
            headers: revokeRequest.headers,
            body: revokeRequest.body
          });
        }
        if (tokens.refresh_token) {
          const revokeRequest = await this.revokeToken(tokens.refresh_token, 'refresh_token');
          await this.browserConfig.fetch(revokeRequest.url, {
            method: revokeRequest.method,
            headers: revokeRequest.headers,
            body: revokeRequest.body
          });
        }
      } catch (error) {
        console.warn('Token revocation failed:', error);
      }
    }

    if (clearStorage) {
      this.storage.clear();
    }

    return true;
  }

  getAuthenticatedFetch() {
    return async (url, options = {}) => {
      // Check if token needs refresh
      if (this.isTokenExpired()) {
        await this.refreshTokens();
      }

      const tokens = this.getTokens();
      if (!tokens?.access_token) {
        throw new OAuthError('No access token available', 'NO_ACCESS_TOKEN');
      }

      const headers = {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json',
        ...options.headers
      };

      return this.browserConfig.fetch(url, { ...options, headers });
    };
  }

  setupAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      if (this.isTokenExpired()) {
        this.refreshTokens().catch(error => {
          console.warn('Auto-refresh failed:', error);
        });
      }
    }, 60000);
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

export default BrowserOAuthClient;