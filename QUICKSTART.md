# Quick Start Guide

## Fix CORS Error - 3 Simple Steps

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start the Proxy Server
Open a **new terminal** and run:
```bash
npm run proxy
```

You should see:
```
✅ CORS Proxy running on http://localhost:3001
```

Keep this terminal running.

### Step 3: Start the App
Open **another terminal** and run:
```bash
npm run dev
```

Open browser: `http://localhost:5173`

### Step 4: Configure Jira
1. Switch to **Admin View** (top-right)
2. Go to **Settings**
3. Check ✅ **"Use CORS Proxy"**
4. Select **"Local Proxy"** from dropdown
5. Fill in your Jira details:
   - Base URL: `https://esds.atlassian.net`
   - Email: `your-email@esds.co.in`
   - API Token: (generate from Jira)
   - Project Key: `YOUR_PROJECT`
6. Click **"Test Connection"**
7. Click **"Save Configuration"**

## Done! 🎉

Your app should now connect to Jira without CORS errors.

---

## Alternative: Browser Extension (No Proxy Needed)

1. Install **"CORS Unblock"** Chrome extension
2. Enable the extension
3. **Uncheck** "Use CORS Proxy" in Settings
4. Test connection

---

## Troubleshooting

**Proxy not starting?**
- Make sure port 3001 is not in use
- Run: `npm install` first

**Still getting CORS error?**
- Verify proxy is running (`npm run proxy`)
- Check "Use CORS Proxy" is enabled in Settings
- Select "Local Proxy" from dropdown
