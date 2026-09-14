# Zenuxs OAuth — Social Providers Guide

> [!CRITICAL]
> ## ⚠️ STRICT RULE FOR DEVELOPERS & AI AGENTS: USE INBUILT SDK FUNCTIONS ONLY
> **DO NOT write manual HTTP requests, raw fetch/axios calls, or custom OAuth endpoints** to Discord, Google, GitHub, or Zenuxs internal APIs. Direct API calls are broken and unsupported.
>
> **ALWAYS use the SDK built-in methods:**
> - Request proper Zenuxs scopes: `openid profile email discord:profile discord:guilds discord:join_server:<target>`
> - Fetch user profile & social claims: `await oauth.getUserInfo()`
> - Use the provider helper objects: `oauth.discord()`, `oauth.github()`, `oauth.google()`, etc.


Each social provider is accessed through `oauth.<provider>()` and returns a helper object you can use to fetch profile data, interact with the provider's API, and listen for events.

All methods are async and return Promises.

---

## Table of Contents

1. [Discord](#1-discord-oauthdiscord)
2. [GitHub](#2-github-oauthgithub)
3. [Google](#3-google-oauthgoogle)
4. [Twitter / X](#4-twitter--x-oauthx-or-oauthtwitter)
5. [LinkedIn](#5-linkedin-oauthlinkedin)
6. [Facebook](#6-facebook-oauthfacebook)
7. [Instagram](#7-instagram-oauthinstagram)
8. [YouTube](#8-youtube-oauthyoutube)
9. [Error Handling](#error-handling)
10. [Rate Limiting](#rate-limiting)
11. [Testing](#testing)

---

## 1. Discord (`oauth.discord()`)

### Required Zenuxs OAuth Scopes
```text
openid profile email discord:profile discord:guilds discord:join_server:<target>
```

- `discord` or `discord:profile`: Grants access to user Discord ID, username, discriminator, avatar, and email.
- `discord:guilds`: Grants access to the list of Discord servers the user belongs to (`userInfo.discord_guilds`).
- `discord:join_server:<target>`: **Automatically adds the user to your Discord server** upon authorization approval (e.g. `discord:join_server:1289796285678882847` or `discord:join_server:https://discord.gg/your-invite`). Zero manual Discord API code needed!

> [!TIP]
> **Getting Discord Profile Data:** The most reliable way to get user profile data is via `await oauth.getUserInfo()`:
> ```javascript
> const userInfo = await oauth.getUserInfo();
> console.log(userInfo.discord); // { id: "12345", username: "player1", avatar: "...", email: "..." }
> console.log(userInfo.discord_guilds); // [{ id: "987", name: "Gaming Server", ... }]
> console.log(userInfo.discord_join_server); // true
> ```

### Methods

#### `getProfile()`
Fetch the authenticated user's Discord profile.

| Field       | Type   | Description            |
|-------------|--------|------------------------|
| `id`        | string | Discord user ID        |
| `username`  | string | Username (e.g. `player1`) |
| `avatar`    | string | Avatar hash            |
| `email`     | string | Email address          |

```js
const profile = await discord.getProfile();
// { id: "12345", username: "player1", avatar: "hash", email: "player@mail.com" }
```

#### `getGuilds()`
Fetch the list of servers the user is in.

Returns an array of guild objects:

| Field   | Type    | Description              |
|---------|---------|--------------------------|
| `id`    | string  | Guild ID                 |
| `name`  | string  | Server name              |
| `icon`  | string  | Icon hash                |
| `owner` | boolean | Whether user owns server |

```js
const guilds = await discord.getGuilds();
// [{ id: "987", name: "Gaming Server", icon: "hash", owner: false }]
```

#### `sendMessage(channelId, message)`
Send a message to a specific Discord channel.

| Parameter   | Type   | Description              |
|-------------|--------|--------------------------|
| `channelId` | string | Discord channel ID       |
| `message`   | string | Message content          |

```js
const msg = await discord.sendMessage("888", "Hello world");
// { id: "msg_id", content: "Hello world", channel_id: "888" }
```

### Events

```js
discord.on('profile_fetched', (data) => console.log('Profile:', data));
discord.on('guilds_fetched',  (data) => console.log('Guilds:', data));
discord.on('message_sent',    (data) => console.log('Message:', data));
```

---

## 2. GitHub (`oauth.github()`)

### Required Zenuxs OAuth Scopes
```text
openid profile email github:profile github:repos github:commit
```

- `github` or `github:profile`: Access GitHub profile details (`userInfo.github`).
- `github:repos`: Access user repository list (`userInfo.github_repos`).
- `github:commit`: Commit capabilities.

> [!TIP]
> **Getting GitHub Profile Data:**
> ```javascript
> const userInfo = await oauth.getUserInfo();
> console.log(userInfo.github); // { login: "octocat", id: 1, avatar_url: "...", name: "Monalisa" }
> ```

### Methods

#### `getProfile()`
Fetch the authenticated user's GitHub profile.

```js
const profile = await github.getProfile();
// { login: "octocat", id: 1, avatar_url: "...", name: "Monalisa" }
```

#### `getRepos()`
Fetch the user's public and private repositories.

Returns an array of repo objects:

| Field      | Type    | Description              |
|------------|---------|--------------------------|
| `id`       | number  | Repository ID            |
| `name`     | string  | Repository name          |
| `full_name`| string  | Full name (owner/repo)   |
| `private`  | boolean | Visibility               |

```js
const repos = await github.getRepos();
// [{ id: 1296269, name: "Hello-World", full_name: "octocat/Hello-World", private: false }]
```

#### `createIssue(repoName, { title, body })`
Open a new issue on a repository.

| Parameter  | Type   | Description                             |
|------------|--------|-----------------------------------------|
| `repoName` | string | Full repo name, e.g. `"octocat/Hello-World"` |
| `title`    | string | Issue title                             |
| `body`     | string | Issue body (optional)                   |

```js
const issue = await github.createIssue("octocat/Hello-World", {
  title: "Found a bug",
  body: "Description of the bug"
});
// { id: 1, number: 1347, title: "Found a bug", state: "open" }
```

### Events

```js
github.on('profile_fetched', (data) => console.log('Profile:', data));
github.on('repos_fetched',   (data) => console.log('Repos:', data));
github.on('issue_created',   (data) => console.log('Issue:', data));
```

---

## 3. Google (`oauth.google()`)

### Required Zenuxs OAuth Scopes
```text
openid profile email google:profile
```

- `google` or `google:profile`: Access Google user ID, email, name, and profile picture (`userInfo.google`).

> [!TIP]
> **Getting Google Profile Data:**
> ```javascript
> const userInfo = await oauth.getUserInfo();
> console.log(userInfo.google); // { id: "104...", email: "user@gmail.com", name: "John Doe", avatar: "..." }
> ```

### Methods

#### `getProfile()`
Fetch the Google user's profile and email.

```js
const profile = await google.getProfile();
// { id: "104", email: "user@gmail.com", verified_email: true, name: "John Doe", picture: "..." }
```

#### `getDriveFiles()`
List files in the user's Google Drive.

```js
const files = await google.getDriveFiles();
// { files: [{ id: "1A2B", name: "Document.pdf", mimeType: "application/pdf" }] }
```

#### `sendEmail({ to, subject, body })`
Send an email on behalf of the user.

| Parameter | Type   | Description    |
|-----------|--------|----------------|
| `to`      | string | Recipient email|
| `subject` | string | Email subject  |
| `body`    | string | Email body     |

```js
const result = await google.sendEmail({
  to: "friend@example.com",
  subject: "Hello",
  body: "This is a test email"
});
// { id: "msg_123", threadId: "thread_123" }
```

### Events

```js
google.on('profile_fetched', (data) => console.log('Profile:', data));
google.on('files_fetched',   (data) => console.log('Files:', data));
google.on('email_sent',      (data) => console.log('Email:', data));
```

---

## 4. Twitter / X (`oauth.x()` or `oauth.twitter()`)

### Required OAuth Scopes
```
tweet.read tweet.write users.read offline.access like.write
```

### Methods

#### `getProfile()`
Fetch the user's Twitter profile.

```js
const profile = await x.getProfile();
// { data: { id: "2244994945", name: "Twitter Dev", username: "TwitterDev" } }
```

#### `getTweets()`
Fetch the user's recent tweets (last 10).

```js
const tweets = await x.getTweets();
// { data: [{ id: "123", text: "Hello Twitter!" }] }
```

#### `createTweet(text)`
Publish a new tweet.

| Parameter | Type   | Description  |
|-----------|--------|--------------|
| `text`    | string | Tweet content|

```js
const tweet = await x.createTweet("Publishing via API!");
// { data: { id: "123", text: "Publishing via API!" } }
```

#### `likeTweet(tweetId)`
Like a specific tweet by ID.

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `tweetId` | string | Tweet ID    |

```js
const result = await x.likeTweet("123");
// { data: { liked: true } }
```

### Events

```js
x.on('profile_fetched', (data) => console.log('Profile:', data));
x.on('tweets_fetched',  (data) => console.log('Tweets:', data));
x.on('tweet_created',   (data) => console.log('Tweet:', data));
x.on('tweet_liked',     (data) => console.log('Liked:', data));
```

---

## 5. LinkedIn (`oauth.linkedin()`)

### Required OAuth Scopes
```
openid profile email w_member_social r_basicprofile
```

### Methods

#### `getProfile()`
Fetch the user's LinkedIn profile.

```js
const profile = await linkedin.getProfile();
// { sub: "urn:li:person:123", name: "Jane Doe", email: "jane@example.com", picture: "..." }
```

#### `getConnections()`
Fetch the user's first-degree LinkedIn connections.

```js
const connections = await linkedin.getConnections();
// { elements: [{ firstName: { localized: { en_US: "Bob" } }, lastName: { localized: { en_US: "Smith" } } }] }
```

#### `createPost(content)`
Publish a post/share on the user's LinkedIn feed.

| Parameter | Type   | Description    |
|-----------|--------|----------------|
| `content` | string | Post text/body |

```js
const post = await linkedin.createPost("Excited to share our new feature!");
// { id: "urn:li:share:12345" }
```

### Events

```js
linkedin.on('profile_fetched',    (data) => console.log('Profile:', data));
linkedin.on('connections_fetched',(data) => console.log('Connections:', data));
linkedin.on('post_created',       (data) => console.log('Post:', data));
```

---

## 6. Facebook (`oauth.facebook()`)

### Required OAuth Scopes
```
email public_profile pages_show_list pages_manage_posts pages_read_engagement
```

### Methods

#### `getProfile()`
Fetch the user's Facebook profile.

```js
const profile = await facebook.getProfile();
// { id: "12345678", name: "Mark Zuckerberg", email: "mark@fb.com" }
```

#### `getPages()`
List Facebook Pages managed by the user.

```js
const pages = await facebook.getPages();
// { data: [{ id: "page_id", name: "My Business Page", access_token: "..." }] }
```

#### `createPost(pageId, content)`
Publish a post to a specific Facebook Page.

| Parameter | Type   | Description           |
|-----------|--------|-----------------------|
| `pageId`  | string | Facebook Page ID      |
| `content` | string | Post content          |

```js
const post = await facebook.createPost("page_id", "Hello from our page!");
// { id: "page_id_post_id" }
```

### Events

```js
facebook.on('profile_fetched', (data) => console.log('Profile:', data));
facebook.on('pages_fetched',   (data) => console.log('Pages:', data));
facebook.on('post_created',    (data) => console.log('Post:', data));
```

---

## 7. Instagram (`oauth.instagram()`)

### Required OAuth Scopes
```
instagram_basic instagram_content_publish
```

### Methods

#### `getProfile()`
Fetch the user's Instagram Business/Creator profile.

```js
const profile = await instagram.getProfile();
// { id: "178414", username: "ig_user", account_type: "BUSINESS" }
```

#### `getMedia()`
Fetch recent photos and videos.

```js
const media = await instagram.getMedia();
// { data: [{ id: "1789", caption: "Sunset", media_type: "IMAGE", media_url: "..." }] }
```

#### `publishMedia(mediaUrl, caption)`
Publish a photo or video to the user's feed.

| Parameter | Type   | Description          |
|-----------|--------|----------------------|
| `mediaUrl`| string | Public URL of media  |
| `caption` | string | Caption for the post |

```js
const result = await instagram.publishMedia("https://example.com/photo.jpg", "My caption");
// { id: "1789_media_id" }
```

### Events

```js
instagram.on('profile_fetched', (data) => console.log('Profile:', data));
instagram.on('media_fetched',   (data) => console.log('Media:', data));
instagram.on('media_published', (data) => console.log('Published:', data));
```

---

## 8. YouTube (`oauth.youtube()`)

### Required OAuth Scopes
```
openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube
```

### Methods

#### `getProfile()`
Fetch the user's YouTube channel profile and statistics.

```js
const profile = await youtube.getProfile();
// { kind: "youtube#channelListResponse", items: [{ id: "UC...", snippet: { title: "My Channel" }, statistics: { viewCount: "1000" } }] }
```

#### `getChannels()`
List the user's YouTube channels with content details.

```js
const channels = await youtube.getChannels();
// [{ id: "UC_x5XG1OV2P6uZZ5FSM9Ttw", snippet: { title: "Google Developers" }, contentDetails: {...} }]
```

#### `getVideos(channelId)`
Fetch recent videos from a specific channel (ordered by date).

| Parameter   | Type   | Description        |
|-------------|--------|--------------------|
| `channelId` | string | YouTube channel ID |

```js
const videos = await youtube.getVideos("UC_x5XG1OV2P6uZZ5FSM9Ttw");
// [{ id: { videoId: "Ks-_Mh1QhMc" }, snippet: { title: "Test Video" } }]
```

#### `likeVideo(videoId)`
Like a specific YouTube video by ID.

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `videoId` | string | YouTube video ID |

```js
const result = await youtube.likeVideo("Ks-_Mh1QhMc");
// {}  (204 No Content on success)
```

### Events

```js
youtube.on('profile_fetched', (data) => console.log('Profile:', data));
youtube.on('channels_fetched',(data) => console.log('Channels:', data));
youtube.on('videos_fetched',  (data) => console.log('Videos:', data));
youtube.on('video_liked',     (data) => console.log('Liked:', data));
```

---

## Error Handling

All provider methods return rejected Promises on failure. Catch errors to handle them:

```js
try {
  const profile = await discord.getProfile();
} catch (err) {
  if (err.message.includes('401')) {
    // Token expired — re-authenticate
    await oauth.login();
  } else if (err.message.includes('403')) {
    // Missing permissions — check OAuth scopes
    console.error('Insufficient permissions');
  } else {
    console.error('API error:', err.message);
  }
}
```

### Common error codes

| HTTP Code | Meaning                    | What to do                           |
|-----------|----------------------------|--------------------------------------|
| 401       | Unauthorized / token expired | Re-authenticate the user             |
| 403       | Forbidden / missing scope  | Request additional OAuth scopes      |
| 404       | Resource not found         | Check the ID or URL passed           |
| 429       | Rate limited               | Wait and retry after some time       |
| 500       | Provider server error      | Retry later                          |

---

## Rate Limiting

Each provider enforces its own rate limits. The SDK does not add additional limits, but the backend proxy routes apply basic rate limiting to prevent abuse:

| Route                   | Limit           | Window   |
|-------------------------|-----------------|----------|
| All `/:provider/login`  | 20 requests     | 15 min   |
| All `/:provider/callback` | 30 requests   | 15 min   |

If you hit a rate limit, the API returns `429 Too Many Requests`. Wait before retrying.

---

## Testing

The providers can be tested in a local environment:

1. Start the backend server with the required OAuth credentials configured in `.env`
2. Use the test login page at `/testlogin.html`
3. For serverside testing, run the Express example:
   ```bash
   node exmaples/node/express-same-route.js
   ```
4. Check the browser examples in `exmaples/browser/`

### Mock mode

When a provider action is called that the backend does not explicitly handle, it falls back to a mock response. You will see `isMock: true` in the returned data. This is useful during development to verify the flow without hitting real provider APIs.
