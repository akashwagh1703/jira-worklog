# 🚀 PHP Deployment Guide

## 📋 What You Have

- **Frontend**: React app (in `dist` folder after build)
- **Backend**: PHP CORS proxy (`api/proxy.php`)

---

## 🌐 Deployment Options for PHP

### Option 1: Shared Hosting (cPanel) ⭐ Easiest

**Providers:**
- Hostinger ($2/month)
- Bluehost ($3/month)
- GoDaddy
- SiteGround
- Any cPanel hosting

**Steps:**

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Upload files via FTP/cPanel File Manager**
   - Upload all files from `dist` folder to `public_html/`
   - Upload `api` folder to `public_html/api/`
   - Upload `.htaccess` to `public_html/`

3. **Set permissions**
   - `api/proxy.php` → 755

4. **Update app settings**
   - Go to your deployed app
   - Settings → Use CORS Proxy
   - Proxy URL: `https://yourdomain.com/api/proxy.php`

**Your app is live at:** `https://yourdomain.com`

---

### Option 2: VPS/Cloud Server (DigitalOcean, AWS, Azure)

**Requirements:**
- Ubuntu/CentOS server
- Apache/Nginx
- PHP 7.4+
- SSL certificate

**Steps:**

1. **Install LAMP Stack**
   ```bash
   sudo apt update
   sudo apt install apache2 php libapache2-mod-php php-curl php-json
   ```

2. **Enable Apache modules**
   ```bash
   sudo a2enmod rewrite
   sudo a2enmod headers
   sudo systemctl restart apache2
   ```

3. **Upload files**
   ```bash
   # Build locally
   npm run build
   
   # Upload to server
   scp -r dist/* user@server:/var/www/html/
   scp -r api user@server:/var/www/html/
   ```

4. **Configure Apache**
   ```bash
   sudo nano /etc/apache2/sites-available/000-default.conf
   ```
   
   Add:
   ```apache
   <Directory /var/www/html>
       Options Indexes FollowSymLinks
       AllowOverride All
       Require all granted
   </Directory>
   ```

5. **Restart Apache**
   ```bash
   sudo systemctl restart apache2
   ```

**Your app is live at:** `http://your-server-ip`

---

### Option 3: Internal Corporate Server (IIS/Windows)

**For Windows Server with IIS:**

1. **Install PHP on IIS**
   - Download PHP from php.net
   - Install using Web Platform Installer
   - Enable PHP in IIS

2. **Build the project**
   ```bash
   npm run build
   ```

3. **Copy files**
   - Copy `dist` folder contents to `C:\inetpub\wwwroot\dashboard\`
   - Copy `api` folder to `C:\inetpub\wwwroot\dashboard\api\`

4. **Configure IIS**
   - Create new website
   - Point to dashboard folder
   - Enable PHP handler

5. **Create web.config**
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <configuration>
       <system.webServer>
           <rewrite>
               <rules>
                   <rule name="React Routes" stopProcessing="true">
                       <match url=".*" />
                       <conditions logicalGrouping="MatchAll">
                           <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                           <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                       </conditions>
                       <action type="Rewrite" url="/" />
                   </rule>
               </rules>
           </rewrite>
       </system.webServer>
   </configuration>
   ```

**Your app is live at:** `http://internal-server/dashboard`

---

### Option 4: XAMPP/WAMP (Local Testing)

**For local development/testing:**

1. **Install XAMPP**
   - Download from apachefriends.org
   - Install and start Apache

2. **Build the project**
   ```bash
   npm run build
   ```

3. **Copy files**
   - Copy `dist` contents to `C:\xampp\htdocs\dashboard\`
   - Copy `api` folder to `C:\xampp\htdocs\dashboard\api\`

4. **Access**
   - Open: `http://localhost/dashboard`

---

## 🔧 Configuration After Deployment

### Update Proxy URL in App:

1. Open your deployed app
2. Go to **Settings** (Admin View)
3. Enable **"Use CORS Proxy"**
4. Set Proxy URL to:
   - Shared Hosting: `https://yourdomain.com/api/proxy.php`
   - VPS: `http://your-ip/api/proxy.php`
   - Internal: `http://internal-server/dashboard/api/proxy.php`
5. Click **"Test Connection"**
6. Click **"Save Configuration"**

---

## 📁 File Structure on Server

```
public_html/  (or /var/www/html/)
├── index.html
├── assets/
│   ├── index-xxx.js
│   └── index-xxx.css
├── api/
│   └── proxy.php
└── .htaccess
```

---

## 🔒 Security Best Practices

### 1. Restrict Proxy Access

Edit `api/proxy.php`:
```php
<?php
// Add at the top
$allowed_domains = ['yourdomain.com', 'www.yourdomain.com'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (!in_array(parse_url($origin, PHP_URL_HOST), $allowed_domains)) {
    http_response_code(403);
    exit('Forbidden');
}
// ... rest of code
```

### 2. Rate Limiting

Add to `api/proxy.php`:
```php
<?php
session_start();
$max_requests = 100;
$time_window = 3600; // 1 hour

if (!isset($_SESSION['requests'])) {
    $_SESSION['requests'] = [];
}

$_SESSION['requests'][] = time();
$_SESSION['requests'] = array_filter($_SESSION['requests'], function($time) use ($time_window) {
    return $time > (time() - $time_window);
});

if (count($_SESSION['requests']) > $max_requests) {
    http_response_code(429);
    exit('Too many requests');
}
// ... rest of code
```

### 3. HTTPS Only

Add to `.htaccess`:
```apache
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

---

## 🚀 Quick Deploy Commands

### Shared Hosting (cPanel):
1. Build: `npm run build`
2. Upload `dist` folder contents via File Manager
3. Upload `api` folder
4. Done!

### VPS (Ubuntu):
```bash
# Build locally
npm run build

# Upload to server
scp -r dist/* user@server:/var/www/html/
scp -r api user@server:/var/www/html/

# Set permissions
ssh user@server "chmod 755 /var/www/html/api/proxy.php"
```

---

## 📊 Recommended Hosting Providers

| Provider | Cost | Ease | PHP Support | Best For |
|----------|------|------|-------------|----------|
| **Hostinger** | $2/mo | ⭐⭐⭐⭐⭐ | ✅ | Budget |
| **Bluehost** | $3/mo | ⭐⭐⭐⭐⭐ | ✅ | Beginners |
| **DigitalOcean** | $5/mo | ⭐⭐⭐ | ✅ | Developers |
| **AWS Lightsail** | $5/mo | ⭐⭐⭐ | ✅ | Scalable |
| **Internal Server** | Free | ⭐⭐ | ✅ | Corporate |

---

## ✅ Deployment Checklist

- [ ] Build project: `npm run build`
- [ ] Upload `dist` folder contents
- [ ] Upload `api` folder
- [ ] Upload `.htaccess`
- [ ] Set file permissions (755 for PHP)
- [ ] Test proxy: `https://yourdomain.com/api/proxy.php`
- [ ] Update proxy URL in app Settings
- [ ] Test Jira connection
- [ ] Share URL with team

---

## 🎉 You're Ready!

**Easiest Option: Shared Hosting**
1. Buy hosting ($2-3/month)
2. Upload files via cPanel
3. Update proxy URL in Settings
4. Done!

Your dashboard is live! 🚀
