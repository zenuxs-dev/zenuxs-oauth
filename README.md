# Zenuxs OAuth

Universal OAuth 2.0 + PKCE client for Zenuxs auth.

Works seamlessly in browsers, Node.js, React, Next.js, React Native, and hybrid applications with one simple API:

```js
const oauth = new ZenuxOAuth({ clientId: 'your-client-id' });
```

---

> [!CRITICAL]
> ## ⚠️ STRICT RULE FOR DEVELOPERS & AI AGENTS: USE INBUILT SDK FUNCTIONS ONLY
> **DO NOT write manual HTTP requests, raw `fetch`/`axios` calls, or custom OAuth endpoints** (e.g. manually constructing `/oauth/authorize` URLs, calculating manual SHA-256 PKCE challenges, manual `/oauth/token` calls, or calling Discord/GitHub member join APIs directly).
>
> Direct API calls **DO NOT WORK**, bypass required token signatures, break PKCE/state verification, and are completely unsupported.
>
> **ALWAYS use the SDK's built-in methods:**
> - **Login**: `await oauth.login({ mode: 'redirect' })` or `await oauth.login({ mode: 'popup' })`
> - **Tag UI**: `<zenuxs-auth>` custom element
> - **Backend Callback & Code Exchange**: `await oauth.handleCallback({ request })` or `await oauth.exchangeCodeForTokens(code, { clientSecret, redirectUri })`
> - **User Profile & Social Data**: `await oauth.getUserInfo()`
> - **Authenticated Requests**: `oauth.getAuthenticatedFetch()`
> - **Token Management**: `oauth.getTokens()`, `oauth.refreshTokens()`, `oauth.logout()`

---

## 3 Supported Authentication Modes

Zenuxs OAuth supports exactly **3 clean, reliable modes**:

1. **`<zenuxs-auth>` Custom Element** — Drop-in HTML tag for an inline, persistent authentication box (HTML, React, Next.js, Vue).
2. **`redirect` Mode** — Full-page standard OAuth 2.0 redirect. Recommended default for standard web apps and server-side routes.
3. **`popup` Mode** — Clean popup window that opens the auth flow and closes automatically on success, returning tokens to the parent page.

*(Note: The auth server is hardcoded internally to `https://api.auth.zenuxs.in` — you do not need to specify `authServer`).*

---

## Installation

```bash
npm install zenuxs-oauth
```

Browser CDN:

```html
<script src="https://unpkg.com/zenuxs-oauth@7/dist/zenux-oauth.min.js"></script>
```

---

## Mode 1: `<zenuxs-auth>` Tag (Recommended for UI)

The simplest way to add authentication to any webpage. Drop the tag anywhere in your HTML:

```html
<script src="https://unpkg.com/zenuxs-oauth@7/dist/zenux-oauth.min.js"></script>

<zenuxs-auth
  client-id="your-client-id"
  redirect-uri="https://your-app.com/callback"
  scope="openid profile email discord:profile"
  theme="dark"
  height="540px"
></zenuxs-auth>

<script>
  document.querySelector('zenuxs-auth').addEventListener('success', (e) => {
    console.log('Logged in successfully!', e.detail);
    // e.detail contains access_token, id_token, etc.
  });
</script>
```

### Tag Attributes

| Attribute | Required | Default | Description |
| --- | --- | --- | --- |
| `client-id` | **Yes** | - | OAuth client ID |
| `redirect-uri` | No | current page | OAuth redirect URI |
| `scope` | No | `openid profile email` | Requested OAuth scopes (space-separated) |
| `theme` | No | `auto` | `auto`, `light`, or `dark` |
| `height` | No | `540px` | Height of the auth UI container |
| `width` | No | `100%` | Width of the auth UI container |
| `redirect-url` | No | `/` | Where to navigate after successful auth |
| `redirect-delay` | No | `1` | Seconds to wait before navigating (default 1s) |
| `auto-redirect` | No | `true` | Set to `false` to handle redirect in JavaScript |

### Tag Events

| Event | Detail | Description |
| --- | --- | --- |
| `success` | `{ access_token, id_token, ... }` | Fired when user completes authentication |
| `error` | `{ message, code, ... }` | Fired on error |
| `redirect` | `{ targetUrl, delay, result }` | Fired right before auto-redirect navigation |

---

### React / Next.js Component Example

```jsx
import React, { useEffect, useRef } from 'react';
import 'zenuxs-oauth'; // Registers <zenuxs-auth> custom element

export default function LoginPage() {
  const authRef = useRef(null);

  useEffect(() => {
    const el = authRef.current;
    if (!el) return;

    const onSuccess = (e) => {
      console.log('Authenticated tokens:', e.detail);
    };

    const onError = (e) => {
      console.error('Auth error:', e.detail);
    };

    el.addEventListener('success', onSuccess);
    el.addEventListener('error', onError);

    return () => {
      el.removeEventListener('success', onSuccess);
      el.removeEventListener('error', onError);
    };
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: '40px auto' }}>
      <zenuxs-auth
        ref={authRef}
        client-id="your-client-id"
        redirect-uri="https://your-app.com/dashboard"
        scope="openid profile email discord:profile"
        theme="dark"
        height="540px"
      />
    </div>
  );
}
```

---

## Mode 2: `redirect` Mode (Programmatic Full Page)

In `redirect` mode, the SDK redirects the user's browser to the Zenuxs authentication page. Upon successful sign-in, Zenuxs redirects back to your `redirectUri` with the authorization code.

```javascript
import ZenuxOAuth from 'zenuxs-oauth';

const oauth = new ZenuxOAuth({
  clientId: 'your-client-id',
  redirectUri: 'https://your-app.com/callback',
  scopes: 'openid profile email discord:profile'
});

// 1. Trigger login redirect
await oauth.login({ mode: 'redirect' });

// 2. On your callback page (https://your-app.com/callback):
await oauth.init(); // automatically parses URL, exchanges code, and stores tokens

// 3. Retrieve user profile
const userInfo = await oauth.getUserInfo();
console.log('User:', userInfo);
```

---

## Mode 3: `popup` Mode (Clean Modal Window)

Opens a popup window without navigating the user away from your current page. Once completed, the popup closes automatically and returns tokens to your application:

```javascript
import ZenuxOAuth from 'zenuxs-oauth';

const oauth = new ZenuxOAuth({
  clientId: 'your-client-id',
  scopes: 'openid profile email discord:profile'
});

try {
  const tokens = await oauth.login({ mode: 'popup' });
  console.log('Authenticated via popup:', tokens);

  const userInfo = await oauth.getUserInfo();
  console.log('User profile:', userInfo);
} catch (error) {
  console.error('Popup sign-in failed or closed:', error.message);
}
```

---

## Supported Scopes & Discord Server Auto-Join

Zenuxs OAuth scopes control what user information and permissions are granted:

### Identity Scopes
| Scope | Claims Returned in `getUserInfo()` | Description |
| --- | --- | --- |
| `openid` | `sub` | Unique Zenuxs user identifier |
| `profile` | `name`, `preferred_username`, `given_name`, `family_name`, `picture` | Name, username, and avatar URL |
| `email` | `email`, `email_verified` | Primary email and verification status |
| `number` | `phone`, `phone_verified` | Verified phone number |

### Social Scopes
| Scope | Claims Returned | Description |
| --- | --- | --- |
| `discord` or `discord:profile` | `discord: { id, username, discriminator, avatar, email }` | Connected Discord account details |
| `discord:guilds` | `discord_guilds: [...]` | List of Discord servers the user is in |
| `discord:join_server:<target>` | `discord_join_server: true` | **Automatically joins user to your Discord server** |
| `github` or `github:profile` | `github: { id, username, name, avatar, email, bio, public_repos }` | Connected GitHub account profile |
| `github:repos` | `github_repos: [...]` | List of user's GitHub repositories |
| `github:commit` | `github_commit: true` | Commit permissions |
| `google` or `google:profile` | `google: { id, email, name, avatar }` | Connected Google account info |

### How `discord:join_server` Works
Pass your **Discord Guild ID** (or invite link) directly in the scope string:

```text
discord:join_server:1289796285678882847
```
*(or `discord:join_server:https://discord.gg/your-invite`)*

```javascript
const oauth = new ZenuxOAuth({
  clientId: 'your-client-id',
  scopes: 'openid profile email discord:profile discord:join_server:1289796285678882847'
});
```

> [!TIP]
> **Zero Extra Code Required:** When `discord:join_server:<target>` is present, the **Zenuxs server automatically adds the user to your Discord server** as soon as they authorize the OAuth prompt. You do **not** need to make manual calls to Discord's API with user tokens!
>
> *(Note: The Discord bot configured in Zenuxs must already be in the target server with "Create Instant Invite" permission).*

---

## Fetching User Data with `getUserInfo()`

Always use `oauth.getUserInfo()` to retrieve profile and social account data. Do **not** call raw APIs manually.

```javascript
const userInfo = await oauth.getUserInfo();

// Standard profile
console.log(userInfo.sub);      // "673f8a9b..."
console.log(userInfo.name);     // "Alex Smith"
console.log(userInfo.email);    // "alex@example.com"

// Discord data (when discord:profile scope is requested)
if (userInfo.discord) {
  console.log(userInfo.discord.id);          // Discord Snowflake ID
  console.log(userInfo.discord.username);    // Discord username
  console.log(userInfo.discord.avatar);      // Discord avatar CDN URL
  console.log(userInfo.discord.email);       // Discord email
}

// Discord Guilds (when discord:guilds scope is requested)
if (userInfo.discord_guilds) {
  console.log(userInfo.discord_guilds);      // Array of Discord guilds
}
```

> [!IMPORTANT]
> **Token Clarification**: `tokens.access_token` returned by Zenuxs OAuth is a **Zenuxs OAuth access token** (JWT / RS256) used with `getUserInfo()` or your backend API. It is **not** a raw Discord or GitHub access token and should not be sent directly to `discord.com/api`.

---

## Backend / Node.js & Express Usage

For confidential backend servers (Node.js, Express, Next.js API routes), keep your `clientSecret` secure in environment variables:

```javascript
const express = require('express');
const ZenuxOAuth = require('zenuxs-oauth');

const app = express();

const oauth = new ZenuxOAuth({
  clientId: process.env.ZENUX_CLIENT_ID,
  clientSecret: process.env.ZENUX_CLIENT_SECRET, // Confidential secret (server-side only)
  redirectUri: 'https://your-domain.com/auth/callback',
  scopes: 'openid profile email discord:profile discord:join_server:1289796285678882847'
});

// 1. Step 1: Initiate OAuth Login
app.get('/auth/login', async (req, res) => {
  const authData = await oauth.login({ mode: 'manual' });
  res.redirect(authData.url);
});

// 2. Step 2: Handle OAuth Callback using built-in handleCallback
app.get('/auth/callback', async (req, res) => {
  try {
    const tokens = await oauth.handleCallback({ request: req });
    // tokens contains: { access_token, token_type, expires_in, refresh_token, id_token }

    // Fetch user profile using built-in method
    const userInfo = await oauth.getUserInfo();
    console.log('Logged in user:', userInfo.name, userInfo.discord?.username);

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Callback failed:', error.message);
    res.redirect('/login?error=' + encodeURIComponent(error.message));
  }
});
```

---

## SDK Configuration Options

```javascript
const oauth = new ZenuxOAuth({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret', // Backend only! Never in frontend!
  redirectUri: 'https://your-app.com/callback',
  scopes: 'openid profile email discord:profile',
  theme: 'dark', // 'auto', 'light', or 'dark'
  usePKCE: true, // Defaults to true (S256 PKCE)
  validateState: true,
  autoRefresh: true, // Automatically refreshes expired tokens
  debug: false
});
```

### Options Reference

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `clientId` | **Yes** | - | OAuth Application Client ID from Zenuxs Dashboard |
| `clientSecret` | No (Required for server) | `null` | Confidential secret for backend token exchange. Keep secret! |
| `redirectUri` | No | current page | Redirect URI matching your Zenuxs application registration |
| `scopes` / `scope` | No | `openid profile email` | Requested OAuth scopes (space-separated) |
| `theme` | No | `auto` | Theme for UI elements (`auto`, `light`, `dark`) |
| `usePKCE` | No | `true` | Enables PKCE (S256). Highly recommended. |
| `validateState` | No | `true` | Validates CSRF state parameter |
| `autoRefresh` | No | `false` | Automatically refreshes access tokens before expiration |
| `debug` | No | `false` | Enables internal debug logging |

---

## Built-In Methods Summary

Always use these built-in methods. Do not make direct HTTP requests:

- `await oauth.login(options)`: Initiates login using `'redirect'` or `'popup'` mode.
- `await oauth.init()`: Auto-detects callback parameters in current URL and finishes code exchange.
- `await oauth.handleCallback({ request })`: Backend helper to exchange code for tokens.
- `await oauth.exchangeCodeForTokens(code, options)`: Explicit code exchange helper.
- `await oauth.getUserInfo()`: Fetches user profile and requested social claims.
- `await oauth.refreshTokens()`: Refreshes access token using stored refresh token.
- `oauth.getTokens()`: Returns currently stored session tokens.
- `oauth.isAuthenticated()`: Returns `true` if a valid non-expired access token exists.
- `oauth.getAuthenticatedFetch()`: Returns a `fetch` wrapper that automatically injects the `Authorization: Bearer <token>` header.
- `oauth.logout()`: Clears local session and stored tokens.

---

## License

MIT
