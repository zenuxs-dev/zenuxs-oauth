# 🔐 Zenuxs OAuth

> Universal OAuth 2.0 + PKCE Client for Modern Applications


[![npm version](https://img.shields.io/npm/v/zenuxs-oauth.svg)](https://www.npmjs.com/package/zenuxs-oauth)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/zenuxs-oauth)](https://bundlephobia.com/package/zenuxs-oauth)
[![Downloads](https://img.shields.io/npm/dm/zenuxs-oauth.svg)](https://www.npmjs.com/package/zenuxs-oauth)

A comprehensive, production-ready OAuth 2.0 + PKCE client library that works seamlessly across **Browser**, **Node.js**, **React Native**, and **Web Workers**. Built with security, developer experience, and universal compatibility in mind.

---

## 🚀 Why Zenuxs OAuth?

### Universal Platform Support
Unlike most OAuth libraries that lock you into a specific environment, Zenuxs OAuth works everywhere:
- ✅ **Browser** (Chrome, Firefox, Safari, Edge)
- ✅ **Node.js** (Server-side authentication)
- ✅ **React Native** (iOS & Android)
- ✅ **Web Workers** (Background authentication)

### Enterprise-Grade Security
- 🔒 **PKCE (RFC 7636)** - Protection against authorization code interception
- 🛡️ **CSRF Protection** - Built-in state parameter validation
- 🔐 **Secure Token Storage** - Flexible storage options (Memory, Session, Local)
- ⚡ **Automatic Token Refresh** - Seamless token renewal before expiration
- 🚫 **Token Revocation** - Properly invalidate tokens on logout

### Developer-First Experience
- 📦 **Zero Dependencies** - Lightweight and fast
- 🎯 **TypeScript Support** - Full type definitions included
- 🔌 **Multiple Auth Flows** - Redirect, Popup, and Manual flows
- 📡 **Event System** - React to authentication state changes
- 🎨 **Framework Agnostic** - Works with React, Vue, Angular, Svelte, or vanilla JS
- 📚 **Comprehensive Documentation** - Clear examples and API reference

---

## 📦 Installation

### Browser (CDN)
```html
<script src="https://unpkg.com/zenuxs-oauth@4.2.0/dist/zenux-oauth.min.js"></script>
```

### NPM / Yarn
```bash
npm install zenuxs-oauth
# or
yarn add zenuxs-oauth
```

### ES6 Module
```javascript
import ZenuxOAuth from 'zenuxs-oauth';
```

### CommonJS
```javascript
const ZenuxOAuth = require('zenuxs-oauth');
```

---

## 🎯 Quick Start

### Browser - Popup Flow
```javascript
const oauth = new ZenuxOAuth({
    clientId: "your-client-id",
    redirectUri: window.location.origin + "/callback.html",
    scopes: "openid profile email",
    storage: "sessionStorage"
});

// Login with popup
async function login() {
    try {
        const tokens = await oauth.login({ popup: true });
        console.log("Logged in!", tokens);
    } catch (error) {
        console.error("Login failed:", error);
    }
}

// Get user info
async function getUserInfo() {
    const user = await oauth.getUserInfo();
    console.log("User:", user);
}

// Logout
async function logout() {
    await oauth.logout({ revokeTokens: true });
}

// Optional: Fetch provider metadata (OIDC discovery)
async function getProviderMetadata() {
    const metadata = await oauth.getDiscoveryDocument();
    console.log('OIDC metadata:', metadata);
}

// Optional: Fetch JWKS for token validation
async function getJwkSet() {
    const jwks = await oauth.getJwks();
    console.log('JWKS:', jwks);
}

// Optional: Fetch client info (public client metadata)
async function getClientInfo() {
    const clientInfo = await oauth.getClientInfo('your-client-id');
    console.log('Client info:', clientInfo);
}
```

### Node.js - Server-Side
```javascript
const ZenuxOAuth = require('zenuxs-oauth');

const oauth = new ZenuxOAuth({
    clientId: process.env.CLIENT_ID,
    redirectUri: "https://yourapp.com/callback",
    scopes: "openid profile email",
    storage: "memory",
    fetchFunction: require('node-fetch')
});

// Express.js route
app.get('/auth/login', async (req, res) => {
    const authData = await oauth.login();
    req.session.state = authData.state;
    req.session.codeVerifier = authData.codeVerifier;
    res.redirect(authData.url);
});

app.get('/auth/callback', async (req, res) => {
    const tokens = await oauth.handleCallback(req.url);
    req.session.tokens = tokens;
    res.redirect('/dashboard');
});
```

### React Native
```javascript
import ZenuxOAuth from 'zenuxs-oauth';
import { Linking } from 'react-native';

const oauth = new ZenuxOAuth({
    clientId: "your-client-id",
    redirectUri: "myapp://callback",
    scopes: "openid profile email",
    storage: "memory"
});

async function login() {
    const authData = await oauth.login();
    await Linking.openURL(authData.url);
    
    // Listen for callback
    Linking.addEventListener('url', async (event) => {
        if (event.url.startsWith('myapp://callback')) {
            const tokens = await oauth.handleCallback(event.url);
            console.log("Tokens:", tokens);
        }
    });
}
```

---

## 🎨 Features Overview

### 🌐 Multiple Authentication Flows

#### 1. Redirect Flow (Traditional)
```javascript
// Redirects the entire page
oauth.login();
```

#### 2. Popup Flow (Modern)
```javascript
// Opens authentication in a popup window
const tokens = await oauth.login({ 
    popup: true,
    popupWidth: 600,
    popupHeight: 700
});
```

#### 3. Manual Flow (Non-Browser)
```javascript
// Get authorization URL for manual handling
const authData = await oauth.login();
console.log("Redirect user to:", authData.url);
// Handle callback manually with authData.state and authData.codeVerifier
```

### 🔄 Automatic Token Refresh
```javascript
const oauth = new ZenuxOAuth({
    clientId: "your-client-id",
    autoRefresh: true,           // Enable auto-refresh
    refreshThreshold: 300        // Refresh 5 minutes before expiry
});

// Listen to refresh events
oauth.on('tokenRefresh', (newTokens) => {
    console.log("Tokens automatically refreshed!");
});
```

## 🧩 Supported Scopes (Zenuxs)
Zenuxs exposes a standard set of OpenID Connect + social scopes. The SDK will request them exactly as passed via `scopes`.

### 🔑 Full Scope List
- `openid` (required for ID tokens)
- `profile` (returns: `name`, `preferred_username`, `given_name`, `family_name`, `picture`, `updated_at`)
- `email` (returns: `email`, `email_verified`)
- `discord` / `discord:profile` (returns: `discord.id`, `discord.username`, `discord.discriminator`, `discord.avatar`, `discord.email`)
- `discord:guilds` (returns: `discord_guilds`)
- `discord:join_server` (returns: `discord_join_server` boolean)
- `github` / `github:profile` (returns: `github.id`, `github.username`, `github.name`, `github.avatar`, `github.email`, `github.bio`, `github.public_repos`)
- `github:repos` (returns: `github_repos`)
- `github:commit` (returns: `github_commit` boolean)

### 📌 Access the list programmatically
```js
console.log(ZenuxOAuth.supportedScopes);
```

> ✅ Tip: Use `scopes: 'openid profile email'` for most standard OpenID Connect flows.

### 📡 Event Hooks
Zenuxs OAuth emits a few useful lifecycle events. Use `on()` to subscribe:

```javascript
// When the login URL is generated (before redirect/popup)
oauth.on('loginRequest', (authData) => {
    console.log('Login started (redirect/popup URL):', authData.url);
});

// When login completes successfully
oauth.on('login', (tokens) => {
    console.log('Logged in! Tokens:', tokens);
});

// When tokens are refreshed
oauth.on('tokenRefresh', (newTokens) => {
    console.log('Tokens refreshed', newTokens);
});

// When token is found expired and refresh is about to happen
oauth.on('tokenExpired', () => {
    console.log('Token is expired; refreshing...');
});

// When user logs out
oauth.on('logout', () => {
    console.log('Logged out');
});

// Global error handler
oauth.on('error', (error) => {
    console.error('OAuth error:', error);
});

// State value has changed (used for CSRF protection)
oauth.on('stateChange', (change) => {
    console.log('State changed:', change);
});
```

###  Flexible Storage Options
```javascript
// Session Storage (default) - survives page reload, cleared on tab close
storage: "sessionStorage"

// Local Storage - persists across browser sessions
storage: "localStorage"

// Memory Storage - cleared on page reload (best for Node.js/React Native)
storage: "memory"

// Custom prefix for storage keys
storagePrefix: "myapp_auth_"
```

### 🔍 Token Management
```javascript
// Check authentication status
if (oauth.isAuthenticated()) {
    console.log("User is authenticated");
}

// Get current tokens
const tokens = oauth.getTokens();

// Check if token is expired
if (oauth.isTokenExpired()) {
    await oauth.refreshTokens();
}

// Manually refresh tokens
const newTokens = await oauth.refreshTokens();

// Revoke specific token
await oauth.revokeToken(tokens.access_token, 'access_token');

// Revoke all tokens on logout
await oauth.logout({ revokeTokens: true });
```

### 👤 User Information
```javascript
// Get user profile from userinfo endpoint
const user = await oauth.getUserInfo();
console.log(user.name, user.email, user.picture);

// Multiple userinfo endpoints supported
const oauth = new ZenuxOAuth({
    clientId: "your-client-id",
    userinfoEndpoint: "/oauth/userinfo"  // or custom endpoint
});
```


### 🎯 Authenticated Fetch
```javascript
// Get pre-configured fetch with automatic token injection
const authFetch = oauth.getAuthenticatedFetch();

// Use it like regular fetch
const response = await authFetch('https://api.yourapp.com/protected', {
    method: 'GET'
});

// Automatically adds Authorization header and handles token refresh
```

---

## 🔧 Advanced Configuration

### Complete Configuration Object
```javascript
const oauth = new ZenuxOAuth({
    // Required
    clientId: "your-client-id",
    
    // Server Configuration
    // authServer is fixed to https://api.auth.zenuxs.in
    authorizeEndpoint: "/oauth/authorize",
    tokenEndpoint: "/oauth/token",
    userinfoEndpoint: "/oauth/userinfo",
    revokeEndpoint: "/oauth/revoke",
    introspectEndpoint: "/oauth/introspect",
    
    // OAuth Parameters
    redirectUri: window.location.origin + "/callback.html",
    scopes: "openid profile email offline_access",
    responseType: "code",
    
    // Security
    usePKCE: true,              // Enable PKCE
    useCSRF: true,              // Enable CSRF protection (browser only)
    validateState: true,         // Validate state parameter
    
    // Storage
    storage: "sessionStorage",   // sessionStorage | localStorage | memory
    storagePrefix: "zenux_oauth_",
    
    // Token Management
    autoRefresh: true,           // Enable automatic token refresh
    refreshThreshold: 300,       // Refresh 5 minutes before expiry
    
    // UI Configuration (Browser only)
    popupWidth: 600,
    popupHeight: 700,
    popupFeatures: "toolbar=no,location=no,status=no,menubar=no",
    
    // Lifecycle Callbacks
    onBeforeLogin: (config) => {
        console.log("About to login");
    },
    onAfterLogin: (tokens) => {
        console.log("Login successful");
    },
    onBeforeLogout: () => {
        console.log("About to logout");
    },
    onAfterLogout: () => {
        console.log("Logout complete");
    },
    
    // Additional Parameters
    extraAuthParams: {
        prompt: "login",
        display: "popup"
    },
    extraTokenParams: {
        client_secret: "secret"  // Only for confidential clients
    },
    
    // Environment
    environment: "browser",      // Auto-detected: browser | node | react-native | worker
    fetchFunction: fetch,        // Custom fetch implementation
    debug: true                  // Enable debug logging
});
```

---

## 🎭 Framework Integration Examples

### React Hook
```javascript
import { useState, useEffect } from 'react';
import ZenuxOAuth from 'zenuxs-oauth';

function useZenuxAuth(config) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [oauth] = useState(() => new ZenuxOAuth(config));

    useEffect(() => {
        setIsAuthenticated(oauth.isAuthenticated());
        
        oauth.on('login', async (tokens) => {
            setIsAuthenticated(true);
            const userInfo = await oauth.getUserInfo();
            setUser(userInfo);
        });

        oauth.on('logout', () => {
            setIsAuthenticated(false);
            setUser(null);
        });

        setLoading(false);

        return () => {
            oauth.off('login');
            oauth.off('logout');
        };
    }, [oauth]);

    return {
        isAuthenticated,
        user,
        loading,
        login: (options) => oauth.login(options),
        logout: (options) => oauth.logout(options),
        getTokens: () => oauth.getTokens()
    };
}

// Usage in component
function App() {
    const { isAuthenticated, user, loading, login, logout } = useZenuxAuth({
        clientId: "your-client-id",
        redirectUri: window.location.origin + "/callback.html",
        scopes: "openid profile email"
    });

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            {isAuthenticated ? (
                <div>
                    <h1>Welcome, {user?.name}!</h1>
                    <button onClick={() => logout({ revokeTokens: true })}>
                        Logout
                    </button>
                </div>
            ) : (
                <button onClick={() => login({ popup: true })}>
                    Login with Zenuxs
                </button>
            )}
        </div>
    );
}
```

### Vue 3 Composable
```javascript
import { ref, onMounted, onUnmounted } from 'vue';
import ZenuxOAuth from 'zenuxs-oauth';

export function useZenuxAuth(config) {
    const isAuthenticated = ref(false);
    const user = ref(null);
    const loading = ref(true);
    
    let oauth;

    onMounted(() => {
        oauth = new ZenuxOAuth(config);
        isAuthenticated.value = oauth.isAuthenticated();
        
        oauth.on('login', async (tokens) => {
            isAuthenticated.value = true;
            user.value = await oauth.getUserInfo();
        });

        oauth.on('logout', () => {
            isAuthenticated.value = false;
            user.value = null;
        });

        loading.value = false;
    });

    onUnmounted(() => {
        if (oauth) {
            oauth.off('login');
            oauth.off('logout');
        }
    });

    return {
        isAuthenticated,
        user,
        loading,
        login: (options) => oauth.login(options),
        logout: (options) => oauth.logout(options)
    };
}
```

### Angular Service
```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import ZenuxOAuth from 'zenuxs-oauth';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private oauth: any;
    private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    private userSubject = new BehaviorSubject<any>(null);

    public isAuthenticated$: Observable<boolean> = this.isAuthenticatedSubject.asObservable();
    public user$: Observable<any> = this.userSubject.asObservable();

    constructor() {
        this.oauth = new ZenuxOAuth({
            clientId: 'your-client-id',
            redirectUri: window.location.origin + '/callback.html',
            scopes: 'openid profile email'
        });

        this.isAuthenticatedSubject.next(this.oauth.isAuthenticated());

        this.oauth.on('login', async (tokens: any) => {
            this.isAuthenticatedSubject.next(true);
            const user = await this.oauth.getUserInfo();
            this.userSubject.next(user);
        });

        this.oauth.on('logout', () => {
            this.isAuthenticatedSubject.next(false);
            this.userSubject.next(null);
        });
    }

    async login(options?: any): Promise<void> {
        await this.oauth.login(options);
    }

    async logout(options?: any): Promise<void> {
        await this.oauth.logout(options);
    }

    getTokens() {
        return this.oauth.getTokens();
    }
}
```

---

## 📊 Comparison with Other OAuth Libraries

| Feature | Zenuxs OAuth | Auth0-SPA | Firebase Auth | Hello.js | OAuth2-Client |
|---------|--------------|-----------|---------------|----------|---------------|
| **Universal Support** | ✅ All platforms | ❌ Browser only | ⚠️ Limited | ❌ Browser only | ⚠️ Node only |
| **PKCE Support** | ✅ Built-in | ✅ Yes | ✅ Yes | ❌ No | ⚠️ Manual |
| **Popup Flow** | ✅ Native | ✅ Yes | ❌ No | ✅ Yes | ❌ No |
| **Auto Token Refresh** | ✅ Configurable | ✅ Yes | ✅ Yes | ❌ No | ⚠️ Manual |
| **Event System** | ✅ Comprehensive | ⚠️ Limited | ✅ Good | ❌ No | ❌ No |
| **Zero Dependencies** | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ❌ No |
| **TypeScript** | ✅ Full support | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Bundle Size** | 🟢 ~15KB | 🟡 ~50KB | 🔴 ~150KB | 🟢 ~10KB | 🟡 ~30KB |
| **React Native** | ✅ Native | ❌ No | ✅ Separate pkg | ❌ No | ❌ No |
| **Web Workers** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Custom Storage** | ✅ Flexible | ⚠️ Limited | ❌ Fixed | ❌ Fixed | ⚠️ Limited |
| **Token Revocation** | ✅ Built-in | ✅ Yes | ⚠️ Limited | ❌ No | ⚠️ Manual |
| **Session Export** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Learning Curve** | 🟢 Low | 🟡 Medium | 🟡 Medium | 🟢 Low | 🔴 High |
| **Provider Lock-in** | ✅ None | 🔴 Auth0 only | 🔴 Firebase only | ⚠️ Multiple | ✅ None |
| **License** | ✅ MIT | ✅ MIT | ⚠️ Proprietary | ✅ MIT | ✅ MIT |

### Key Advantages

#### 🎯 **Zenuxs OAuth** stands out with:
1. **True Universal Support** - One library for browser, Node.js, React Native, and Web Workers
2. **Zero Dependencies** - No bloat, just pure OAuth functionality
3. **Developer Experience** - Intuitive API with comprehensive events
4. **Flexibility** - Works with any OAuth 2.0 provider, not locked to a specific service
5. **Modern Architecture** - Built with PKCE, CSRF protection, and auto-refresh from the ground up
6. **Session Portability** - Export/import sessions for cross-device authentication
7. **Lightweight** - Only ~15KB minified + gzipped

---

## 🔒 Security Best Practices

### 1. Always Use PKCE
```javascript
const oauth = new ZenuxOAuth({
    clientId: "your-client-id",
    usePKCE: true  // Always enabled by default
});
```

### 2. Enable CSRF Protection
```javascript
const oauth = new ZenuxOAuth({
    clientId: "your-client-id",
    useCSRF: true,      // Browser only
    validateState: true  // Verify state parameter
});
```

### 3. Use Secure Storage
```javascript
// For web apps: Use sessionStorage (cleared on tab close)
storage: "sessionStorage"

// For SPAs with persistence: Use localStorage with caution
storage: "localStorage"

// For server-side: Always use memory storage
storage: "memory"
```

### 4. Revoke Tokens on Logout
```javascript
await oauth.logout({ 
    revokeTokens: true  // Properly invalidate tokens
});
```

### 5. Handle Token Refresh Gracefully
```javascript
oauth.on('tokenRefresh', (newTokens) => {
    // Update your application state
    updateAuthState(newTokens);
});

oauth.on('error', async (error) => {
    if (error.code === 'TOKEN_REFRESH_FAILED') {
        // Force re-login if refresh fails
        await oauth.logout();
        redirectToLogin();
    }
});
```

### 6. Implement Timeout for Popups
```javascript
try {
    const tokens = await oauth.login({ 
        popup: true,
        timeout: 300000  // 5 minutes timeout
    });
} catch (error) {
    if (error.code === 'LOGIN_TIMEOUT') {
        console.log('Login took too long');
    }
}
```

---

## 🐛 Error Handling

### Error Codes Reference
```javascript
try {
    await oauth.login({ popup: true });
} catch (error) {
    switch (error.code) {
        case 'INVALID_CONFIG':
            // Configuration validation failed
            break;
        case 'FETCH_UNAVAILABLE':
            // Fetch API not available
            break;
        case 'POPUP_BLOCKED':
            // Browser blocked popup window
            alert('Please allow popups for this site');
            break;
        case 'AUTH_CANCELLED':
            // User closed popup or cancelled authentication
            console.log('User cancelled login');
            break;
        case 'LOGIN_TIMEOUT':
            // Login process exceeded timeout
            console.log('Login timeout');
            break;
        case 'STATE_MISMATCH':
            // CSRF protection: state parameter mismatch
            console.error('Security error detected');
            break;
        case 'NO_AUTH_CODE':
            // Authorization code not received
            break;
        case 'TOKEN_EXCHANGE_FAILED':
            // Failed to exchange code for tokens
            break;
        case 'TOKEN_REFRESH_FAILED':
            // Failed to refresh access token
            await oauth.logout();
            break;
        case 'NO_REFRESH_TOKEN':
            // No refresh token available
            break;
        case 'NO_ACCESS_TOKEN':
            // No access token available
            break;
        case 'USERINFO_FAILED':
            // Failed to fetch user information
            break;
        case 'REVOKE_FAILED':
            // Token revocation failed
            break;
        case 'INTROSPECT_FAILED':
            // Token introspection failed
            break;
        default:
            console.error('Unknown error:', error);
    }
}
```

### Custom Error Handling
```javascript
// Global error handler
oauth.on('error', (error) => {
    console.error('OAuth Error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        environment: error.environment,
        timestamp: error.timestamp
    });
    
    // Send to error tracking service
    trackError(error);
});
```

---

## 📚 API Reference

### Constructor
```javascript
new ZenuxOAuth(config)
```

### Methods

#### Authentication
- `login(options?)` - Start OAuth flow
- `handleCallback(url)` - Process OAuth callback
- `logout(options?)` - Logout user

#### Token Management
- `getTokens()` - Get current tokens
- `isAuthenticated()` - Check authentication status
- `isTokenExpired()` - Check if token is expired
- `refreshTokens()` - Manually refresh tokens
- `revokeToken(token, tokenType)` - Revoke specific token

#### User Information
- `getUserInfo()` - Fetch user profile
- `introspectToken(token?)` - Validate token

#### Session Management
- `getSessionState()` - Get current session state
- `exportSession()` - Export session data
- `importSession(data)` - Import session data

#### Events
- `on(event, handler)` - Add event listener
- `off(event, handler)` - Remove event listener

#### Utilities
- `getAuthenticatedFetch()` - Get authenticated fetch function
- `updateConfig(config)` - Update configuration
- `destroy()` - Cleanup resources

### Static Methods
- `ZenuxOAuth.create(config)` - Create new instance
- `ZenuxOAuth.getInstance(config)` - Get singleton instance
- `ZenuxOAuth.destroyInstance()` - Destroy singleton
- `ZenuxOAuth.createCallbackHandler(config)` - Create callback handler

---

## 🧪 Testing

### Unit Testing with Jest
```javascript
import ZenuxOAuth from 'zenuxs-oauth';

describe('ZenuxOAuth', () => {
    let oauth;

    beforeEach(() => {
        oauth = new ZenuxOAuth({
            clientId: 'test-client-id',
            storage: 'memory'
        });
    });

    afterEach(() => {
        oauth.destroy();
    });

    test('should initialize correctly', () => {
        expect(oauth).toBeDefined();
        expect(oauth.isAuthenticated()).toBe(false);
    });

    test('should handle login flow', async () => {
        const authData = await oauth.login();
        expect(authData).toHaveProperty('url');
        expect(authData).toHaveProperty('state');
        expect(authData).toHaveProperty('codeVerifier');
    });

    test('should emit login event on successful authentication', (done) => {
        oauth.on('login', (tokens) => {
            expect(tokens).toHaveProperty('access_token');
            done();
        });

        // Simulate login...
    });
});
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone repository
git clone https://github.com/developers-rs5/zenuxs-oauth.git
cd zenuxs-oauth

# Install dependencies
npm install

# Run tests
npm test

# Build library
npm run build

# Run examples
npm run dev
```

---

## 📄 License

MIT License © 2025 Zenuxs Team

Developed by **Rishabh Sharma (rs)**

---

## 🔗 Links

- **Documentation**: [https://docs.zenuxs.in](https://docs.zenuxs.in)
- **GitHub**: [https://github.com/developers-rs5/zenuxs-oauth](https://github.com/developers-rs5/zenuxs-oauth)
- **NPM**: [https://www.npmjs.com/package/zenuxs-oauth](https://www.npmjs.com/package/zenuxs-oauth)
- **Discord**: [https://discord.zenuxs.in](https://discord.zenuxs.in)
- **Issues**: [https://github.com/developers-rs5/zenuxs-oauth/issues](https://github.com/developers-rs5/zenuxs-oauth/issues)

---

## 💬 Support

Need help? We're here for you:

- 📚 **Documentation**: Check our [comprehensive docs](https://docs.zenuxs.in)
- 💬 **Discord**: Join our [community server](https://discord.zenuxs.in)
- 🐛 **Issues**: Report bugs on [GitHub](https://github.com/developers-rs5/zenuxs-oauth/issues)
- 📧 **Email**: support@zenuxs.in

---

## 🎉 Acknowledgments

Special thanks to all contributors and the OAuth 2.0 community for making secure authentication accessible to everyone.

---

**Made with ❤️ by the Zenuxs Team**
