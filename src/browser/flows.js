import { OAuthError } from '../core/errors.js';
import { parseCallbackUrl } from '../core/urls.js';
import { createPopup, createHiddenIframe } from './utils.js';

export async function handleRedirectFlow(client, options = {}) {
  const { storage, onSuccess, onError } = options;
  
  try {
    // Parse callback URL
    const currentUrl = window.location.href;
    const { code, state, error, errorDescription } = parseCallbackUrl(currentUrl);
    
    if (error) {
      throw new OAuthError(
        errorDescription || error,
        'OAUTH_ERROR',
        { error, errorDescription }
      );
    }
    
    if (!code) {
      throw new OAuthError('No authorization code received', 'NO_AUTH_CODE');
    }
    
    // Validate state
    const storedState = storage.get('state');
    if (state !== storedState) {
      throw new OAuthError('State parameter mismatch', 'STATE_MISMATCH');
    }
    
    // Get code verifier
    const codeVerifier = storage.get('code_verifier');
    
    // Exchange code for tokens
    const tokenRequest = await client.exchangeCodeForTokens(code, codeVerifier);
    const response = await fetch(tokenRequest.url, {
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
    const tokens = client.constructor.parseTokenResponse(tokenData);
    
    // Clean up storage
    storage.remove('state');
    storage.remove('code_verifier');
    storage.remove('nonce');
    
    // Clean up URL
    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Store tokens
    storage.set('tokens', JSON.stringify(tokens));
    
    if (onSuccess) {
      onSuccess(tokens);
    }
    
    return tokens;
  } catch (error) {
    // Clean up on error
    storage.remove('state');
    storage.remove('code_verifier');
    storage.remove('nonce');
    
    if (onError) {
      onError(error);
    }
    
    throw error;
  }
}

export function createPopupFlow(client, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      storage,
      popupOptions = {},
      timeout = 300000, // 5 minutes
      onSuccess,
      onError
    } = options;

    let popup = null;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('message', messageHandler);
      if (popup && !popup.closed) {
        popup.close();
      }
    };

    const messageHandler = async (event) => {
      if (event.data?.type === 'zenux_oauth_success') {
        cleanup();
        
        const tokens = event.data.tokens;
        storage.set('tokens', JSON.stringify(tokens));
        
        if (onSuccess) {
          onSuccess(tokens);
        }
        
        resolve(tokens);
      } else if (event.data?.type === 'zenux_oauth_error') {
        cleanup();
        
        const error = new OAuthError(
          event.data.error,
          event.data.code || 'POPUP_ERROR',
          event.data.details
        );
        
        if (onError) {
          onError(error);
        }
        
        reject(error);
      }
    };

    const checkClosed = setInterval(() => {
      if (popup && popup.closed) {
        cleanup();
        clearInterval(checkClosed);
        reject(new OAuthError('Popup closed by user', 'POPUP_CLOSED'));
      }
    }, 1000);

    // Start authorization flow
    client.getAuthorizationUrl().then(({ url, state, codeVerifier }) => {
      storage.set('state', state);
      if (codeVerifier) {
        storage.set('code_verifier', codeVerifier);
      }
      
      popup = createPopup(url, popupOptions);
      if (!popup) {
        cleanup();
        clearInterval(checkClosed);
        reject(new OAuthError('Popup blocked by browser', 'POPUP_BLOCKED'));
        return;
      }
      
      window.addEventListener('message', messageHandler);
      
      timeoutId = setTimeout(() => {
        cleanup();
        clearInterval(checkClosed);
        reject(new OAuthError('Popup timeout', 'POPUP_TIMEOUT'));
      }, timeout);
    }).catch(reject);
  });
}

export function createSilentFlow(client, options = {}) {
  return new Promise((resolve, reject) => {
    const { storage, iframeOptions = {}, timeout = 60000 } = options;
    
    client.getAuthorizationUrl().then(({ url, state, codeVerifier }) => {
      storage.set('state', state);
      if (codeVerifier) {
        storage.set('code_verifier', codeVerifier);
      }
      
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      
      let timeoutId = null;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        window.removeEventListener('message', messageHandler);
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      };
      
      const messageHandler = (event) => {
        if (event.data?.type === 'zenux_oauth_success') {
          cleanup();
          const tokens = event.data.tokens;
          storage.set('tokens', JSON.stringify(tokens));
          resolve(tokens);
        } else if (event.data?.type === 'zenux_oauth_error') {
          cleanup();
          reject(new OAuthError(event.data.error, 'SILENT_ERROR'));
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new OAuthError('Silent flow timeout', 'SILENT_TIMEOUT'));
      }, timeout);
    }).catch(reject);
  });
}