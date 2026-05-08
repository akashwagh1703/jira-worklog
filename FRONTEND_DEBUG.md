# Frontend Debug Guide

## Common Issues & Solutions

### Issue 1: No Data Displayed for Employee

**Symptoms:**
- Employee logs in successfully
- Dashboard shows 0 items
- My Projects shows "No projects found"
- My Logs shows "No work logs found"

**Debug Steps:**

1. **Open Browser Console (F12)**
   - Go to Console tab
   - Look for these logs:
   ```
   Total issues fetched: X
   Current user email: your-email@esds.co.in
   User type: employee
   Issue assignee email: gauri.birari@esds.co.in
   Filtered issues for employee: X
   ```

2. **Check localStorage**
   - Go to Application tab → Local Storage
   - Check `currentUser`:
   ```json
   {
     "email": "gauri.birari@esds.co.in",
     "role": "employee",
     "userType": "employee",
     "jiraCredentials": {
       "baseUrl": "https://esds.atlassian.net",
       "email": "gauri.birari@esds.co.in",
       "apiToken": "your-token",
       "useCorsProxy": true,
       "proxyUrl": "http://localhost/jira-api/proxy.php"
     }
   }
   ```

3. **Check Network Tab**
   - Go to Network tab
   - Look for requests to `proxy.php`
   - Check if they return 200 status
   - Check response data

**Possible Causes:**

### A. Email Mismatch
- Login email: `gauri.birari@esds.co.in`
- Jira assignee email: `Gauri.Birari@esds.co.in` (different case)
- **Solution:** Code now uses case-insensitive comparison

### B. No Issues Assigned
- Employee has no issues assigned in Jira
- **Check:** Console should show "Filtered issues for employee: 0"
- **Solution:** Assign some issues to the employee in Jira

### C. CORS/Proxy Error
- PHP proxy not running
- **Check:** Network tab shows failed requests
- **Solution:** Ensure `http://localhost/jira-api/proxy.php` is accessible

### D. API Response Structure
- Jira API returns different structure
- **Check:** Console shows errors about undefined properties
- **Solution:** Verify API response matches expected structure

---

## Issue 2: Filters Not Working

**Symptoms:**
- Changing filters doesn't update the table
- Data disappears when applying filters

**Debug Steps:**
1. Open Console
2. Change a filter
3. Look for errors

**Solution:** Already fixed with proper useEffect dependencies

---

## Issue 3: My Logs Taking Too Long

**Symptoms:**
- Page shows "Loading..." for a long time
- Eventually loads or times out

**Cause:** Fetching worklogs sequentially for many issues

**Solution:** Already optimized with parallel requests (Promise.all)

---

## Issue 4: Login Fails

**Symptoms:**
- "Jira authentication failed" error
- Cannot login as employee

**Debug Steps:**
1. Check credentials are correct
2. Check Jira base URL: `https://esds.atlassian.net`
3. Check API token is valid
4. Check proxy is running

**Test Proxy:**
```bash
# Open in browser:
http://localhost/jira-api/proxy.php
```

Should show: "Method not allowed" (this is correct - it only accepts POST)

---

## Quick Diagnostic Commands

### 1. Check if data is being fetched:
```javascript
// In browser console:
localStorage.getItem('currentUser')
```

### 2. Check Jira config:
```javascript
// In browser console:
localStorage.getItem('jiraConfig')
```

### 3. Clear all data and start fresh:
```javascript
// In browser console:
localStorage.clear()
location.reload()
```

---

## Expected Console Output (Working System)

### Employee Login:
```
Total issues fetched: 100
Current user email: gauri.birari@esds.co.in
User type: employee
Issue assignee email: gauri.birari@esds.co.in
Issue assignee email: pooja.mande@esds.co.in
Issue assignee email: gauri.birari@esds.co.in
Filtered issues for employee: 25
```

### My Projects:
```
MyProjects - Total issues: 100
MyProjects - User email: gauri.birari@esds.co.in
MyProjects - Filtered issues: 25
```

### My Logs:
```
MyLogs - Total issues: 100
MyLogs - User email: gauri.birari@esds.co.in
MyLogs - Filtered issues: 25
MyLogs - Total worklogs: 45
```

---

## If Still Not Working

**Share these details:**

1. **Console Output:**
   - Copy all console logs
   - Include any errors (red text)

2. **Network Tab:**
   - Find the proxy.php request
   - Right-click → Copy → Copy as cURL
   - Share the response

3. **localStorage:**
   - Copy `currentUser` value
   - Copy `jiraConfig` value

4. **Specific Error:**
   - What page?
   - What action triggers it?
   - What's the exact error message?

---

## Test Checklist

- [ ] PHP proxy running at `http://localhost/jira-api/proxy.php`
- [ ] Employee can login with Jira credentials
- [ ] Console shows "Total issues fetched: X" (X > 0)
- [ ] Console shows "Filtered issues for employee: X" (X > 0)
- [ ] Dashboard displays data
- [ ] My Projects displays data
- [ ] My Logs displays data
- [ ] Filters work on My Logs page
- [ ] No errors in console (red text)
- [ ] Network requests return 200 status
