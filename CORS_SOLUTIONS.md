# CORS Error Solutions

## Problem
Browsers block direct API calls from frontend applications to Jira's API due to CORS (Cross-Origin Resource Sharing) policy.

## Solutions

### Option 1: Use CORS Proxy (Implemented) ✅

**For Development/Testing:**
1. Go to Settings page
2. Enable "Use CORS Proxy" checkbox
3. Test connection

**Public CORS Proxies:**
- `https://cors-anywhere.herokuapp.com/` (requires temporary access request)
- `https://corsproxy.io/?`
- `https://api.allorigins.win/raw?url=`

**To use a different proxy**, edit `src/services/jiraService.js`:
```javascript
const getProxiedUrl = (url, useCorsProxy) => {
  if (useCorsProxy) {
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  }
  return url;
};
```

### Option 2: Browser Extension (Recommended for Development)

Install a CORS extension:
- **Chrome/Edge**: "CORS Unblock" or "Allow CORS"
- **Firefox**: "CORS Everywhere"

Steps:
1. Install extension
2. Enable it
3. Disable "Use CORS Proxy" in Settings
4. Refresh the page

### Option 3: Run Your Own CORS Proxy (Production)

**Simple Node.js Proxy:**

Create `cors-proxy.js`:
```javascript
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors());

app.use('/jira', createProxyMiddleware({
  target: 'https://esds.atlassian.net',
  changeOrigin: true,
  pathRewrite: { '^/jira': '' }
}));

app.listen(3001, () => console.log('Proxy running on port 3001'));
```

Then update `baseUrl` in settings to: `http://localhost:3001/jira`

### Option 4: Chrome with Disabled Security (Development Only)

**Windows:**
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --disable-web-security --user-data-dir="C:\chrome-dev"
```

**Mac:**
```bash
open -na Google\ Chrome --args --disable-web-security --user-data-dir=/tmp/chrome-dev
```

**Linux:**
```bash
google-chrome --disable-web-security --user-data-dir=/tmp/chrome-dev
```

⚠️ **Warning**: Only use for development. Never browse other sites with this.

### Option 5: Deploy with Backend Proxy (Production)

For production, deploy a simple backend:

**Netlify Functions / Vercel Serverless:**
```javascript
// api/jira-proxy.js
export default async function handler(req, res) {
  const { url, ...options } = req.body;
  const response = await fetch(url, options);
  const data = await response.json();
  res.json(data);
}
```

## Recommended Approach

**Development**: Use Browser Extension (Option 2)
**Production**: Deploy your own CORS proxy (Option 3 or 5)

## Current Implementation

The app now includes a "Use CORS Proxy" toggle in Settings that routes requests through `cors-anywhere.herokuapp.com`. 

**Note**: You may need to visit https://cors-anywhere.herokuapp.com/corsdemo and request temporary access first.
