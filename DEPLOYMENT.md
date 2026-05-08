# 🚀 Deployment Guide - Employee Performance Dashboard

## 📋 Pre-Deployment Checklist

- [ ] All features tested locally
- [ ] CORS proxy working
- [ ] Jira connection successful
- [ ] All pages loading correctly
- [ ] No console errors
- [ ] Build command runs successfully

---

## 🏗️ Build the Project

Before deploying, create a production build:

```bash
npm run build
```

This creates a `dist` folder with optimized files.

---

## 🌐 Deployment Options

### Option 1: Vercel (Recommended - Easiest) ⭐

**Why Vercel?**
- ✅ Free hosting
- ✅ Automatic HTTPS
- ✅ Fast CDN
- ✅ Easy deployment
- ✅ GitHub integration

**Steps:**

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```
   - Follow prompts
   - Select "Yes" for project setup
   - Use default settings

4. **Production Deploy**
   ```bash
   vercel --prod
   ```

**Alternative: Deploy via GitHub**
1. Push code to GitHub
2. Go to https://vercel.com
3. Click "Import Project"
4. Select your GitHub repository
5. Click "Deploy"

**Your app will be live at:** `https://your-project.vercel.app`

---

### Option 2: Netlify (Great Alternative)

**Why Netlify?**
- ✅ Free hosting
- ✅ Drag-and-drop deployment
- ✅ Automatic HTTPS
- ✅ Form handling
- ✅ Serverless functions

**Steps:**

**Method A: Drag & Drop**
1. Run `npm run build`
2. Go to https://app.netlify.com/drop
3. Drag the `dist` folder
4. Done!

**Method B: CLI**
1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login**
   ```bash
   netlify login
   ```

3. **Deploy**
   ```bash
   netlify deploy
   ```
   - Select "Create & configure a new site"
   - Publish directory: `dist`

4. **Production Deploy**
   ```bash
   netlify deploy --prod
   ```

**Your app will be live at:** `https://your-project.netlify.app`

---

### Option 3: GitHub Pages (Free)

**Why GitHub Pages?**
- ✅ Free hosting
- ✅ Direct from GitHub
- ✅ Simple setup

**Steps:**

1. **Install gh-pages**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Update package.json**
   Add these lines:
   ```json
   {
     "homepage": "https://yourusername.github.io/your-repo-name",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. **Deploy**
   ```bash
   npm run deploy
   ```

4. **Enable GitHub Pages**
   - Go to your repo → Settings → Pages
   - Source: `gh-pages` branch
   - Save

**Your app will be live at:** `https://yourusername.github.io/your-repo-name`

---

### Option 4: AWS S3 + CloudFront (Enterprise)

**Why AWS?**
- ✅ Scalable
- ✅ Enterprise-grade
- ✅ Full control
- ✅ Custom domain support

**Steps:**

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Create S3 Bucket**
   - Go to AWS S3 Console
   - Create bucket (e.g., `employee-dashboard`)
   - Enable static website hosting
   - Set index.html as index document

3. **Upload Files**
   - Upload all files from `dist` folder
   - Set permissions to public read

4. **Configure CloudFront (Optional)**
   - Create CloudFront distribution
   - Point to S3 bucket
   - Enable HTTPS

5. **Deploy via CLI**
   ```bash
   aws s3 sync dist/ s3://your-bucket-name --delete
   ```

**Your app will be live at:** `http://your-bucket.s3-website-region.amazonaws.com`

---

### Option 5: Azure Static Web Apps

**Why Azure?**
- ✅ Free tier available
- ✅ Enterprise integration
- ✅ Microsoft ecosystem

**Steps:**

1. **Install Azure CLI**
   ```bash
   npm install -g @azure/static-web-apps-cli
   ```

2. **Login**
   ```bash
   az login
   ```

3. **Create Static Web App**
   - Go to Azure Portal
   - Create "Static Web App"
   - Connect to GitHub
   - Build settings:
     - App location: `/`
     - Output location: `dist`

4. **Deploy**
   - Push to GitHub
   - Automatic deployment via GitHub Actions

**Your app will be live at:** `https://your-app.azurestaticapps.net`

---

### Option 6: Internal Server (Corporate)

**For internal corporate use:**

**Option A: Docker Container**

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npm run build
   
   FROM nginx:alpine
   COPY --from=0 /app/dist /usr/share/nginx/html
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. **Build & Run**
   ```bash
   docker build -t employee-dashboard .
   docker run -p 80:80 employee-dashboard
   ```

**Option B: Traditional Server (IIS/Apache/Nginx)**

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Copy `dist` folder to server**
   - IIS: `C:\inetpub\wwwroot\dashboard`
   - Apache: `/var/www/html/dashboard`
   - Nginx: `/usr/share/nginx/html/dashboard`

3. **Configure server**
   - Set document root to `dist` folder
   - Enable SPA routing (redirect all to index.html)

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /usr/share/nginx/html/dashboard;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 🔧 Post-Deployment Configuration

### 1. **Update CORS Proxy**

Since you're using a local CORS proxy, you need to deploy it separately:

**Option A: Deploy Proxy to Vercel/Netlify**

Create `api/proxy.js`:
```javascript
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, headers } = req.body;
  
  try {
    const response = await fetch(url, { headers });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

**Option B: Use Public CORS Proxy**
- Update Settings in deployed app
- Use: `https://corsproxy.io/?`

**Option C: Browser Extension**
- Instruct users to install "CORS Unblock" extension

### 2. **Environment Variables**

For production, use environment variables:

Create `.env.production`:
```
VITE_CORS_PROXY_URL=https://your-proxy.vercel.app/api/proxy
```

Update `jiraService.js` to use:
```javascript
const proxyUrl = import.meta.env.VITE_CORS_PROXY_URL || 'http://localhost:3001/proxy';
```

### 3. **Custom Domain (Optional)**

**Vercel:**
```bash
vercel domains add yourdomain.com
```

**Netlify:**
- Go to Domain Settings
- Add custom domain
- Update DNS records

---

## 📊 Recommended Deployment Strategy

### For Your Use Case (Internal Corporate):

**Best Option: Vercel + Serverless Proxy**

1. **Deploy Frontend to Vercel**
   ```bash
   vercel --prod
   ```

2. **Deploy CORS Proxy as Serverless Function**
   - Create `api/proxy.js` in your project
   - Vercel automatically deploys it

3. **Update Settings**
   - In deployed app, go to Settings
   - Update proxy URL to: `https://your-app.vercel.app/api/proxy`

**Benefits:**
- ✅ Free hosting
- ✅ HTTPS included
- ✅ Fast deployment
- ✅ Easy updates
- ✅ No server maintenance

---

## 🔒 Security Considerations

### For Production:

1. **Never commit sensitive data**
   - Add `.env` to `.gitignore`
   - Use environment variables

2. **Restrict Access**
   - Use Vercel/Netlify password protection
   - Or deploy behind corporate VPN

3. **HTTPS Only**
   - All platforms provide free HTTPS
   - Never use HTTP in production

4. **API Token Security**
   - Tokens stored in browser localStorage
   - Consider backend proxy for token management

---

## 🚀 Quick Deploy Commands

### Fastest Deployment (Vercel):
```bash
# One-time setup
npm install -g vercel

# Deploy
vercel --prod
```

### Alternative (Netlify):
```bash
# One-time setup
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

---

## 📱 Access Your Deployed App

After deployment, you'll get a URL like:
- Vercel: `https://employee-dashboard.vercel.app`
- Netlify: `https://employee-dashboard.netlify.app`
- GitHub Pages: `https://username.github.io/repo-name`

Share this URL with your management team!

---

## 🔄 Continuous Deployment

### Auto-deploy on Git Push:

**Vercel:**
1. Connect GitHub repo
2. Every push to `main` auto-deploys

**Netlify:**
1. Connect GitHub repo
2. Configure build settings
3. Auto-deploy on push

**GitHub Actions:**
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## 📞 Support & Troubleshooting

### Common Issues:

**1. Blank page after deployment**
- Check browser console for errors
- Verify base URL in `vite.config.js`
- Check routing configuration

**2. CORS errors in production**
- Deploy CORS proxy
- Update proxy URL in Settings
- Or use browser extension

**3. 404 on refresh**
- Configure SPA routing
- Add `_redirects` file (Netlify)
- Add `vercel.json` (Vercel)

**Vercel SPA Config (`vercel.json`):**
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Netlify SPA Config (`public/_redirects`):**
```
/*    /index.html   200
```

---

## ✅ Deployment Checklist

- [ ] Build succeeds locally
- [ ] All features work in production build
- [ ] CORS proxy configured
- [ ] Environment variables set
- [ ] Custom domain configured (if needed)
- [ ] HTTPS enabled
- [ ] SPA routing configured
- [ ] Team has access URL
- [ ] Documentation updated

---

## 🎉 You're Ready to Deploy!

**Recommended Quick Start:**
```bash
npm run build
vercel --prod
```

That's it! Your dashboard is live! 🚀
