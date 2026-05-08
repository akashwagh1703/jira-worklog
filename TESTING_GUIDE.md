# Testing Guide - Dual Authentication System

## Prerequisites
1. Start the development server: `npm run dev`
2. Ensure PHP proxy is running at: `http://localhost/jira-api/proxy.php`
3. Have Jira credentials ready for employee testing

---

## Test 1: Management Login

### Steps:
1. Open `http://localhost:5173/login`
2. Click **Management** tab
3. Enter credentials:
   - Email: `admin@company.com`
   - Password: `admin123`
4. Click **Login**

### Expected Results:
✅ Redirected to Dashboard
✅ Navbar shows: `admin@company.com` with `management - admin`
✅ Purple badge showing "admin"
✅ Settings menu is accessible

---

## Test 2: Manager Login

### Steps:
1. Logout (click Logout button)
2. Login with:
   - Email: `manager@company.com`
   - Password: `manager123`

### Expected Results:
✅ Redirected to Dashboard
✅ Navbar shows: `manager@company.com` with `management - manager`
✅ Blue badge showing "manager"
✅ Settings menu is NOT accessible (shows "You need admin access")

---

## Test 3: Admin - Add Management User

### Steps:
1. Login as admin (admin@company.com / admin123)
2. Go to **Settings** page
3. Scroll to **Management Users** section
4. Click **+ Add User**
5. Fill form:
   - Name: `Test Manager`
   - Email: `test@company.com`
   - Password: `test123`
   - Role: `Manager`
6. Click **Add User**

### Expected Results:
✅ Success message appears
✅ New user appears in the table
✅ User is saved to localStorage

---

## Test 4: Admin - Delete Management User

### Steps:
1. In Management Users table, find the test user
2. Click **Delete** button
3. Confirm deletion

### Expected Results:
✅ Confirmation dialog appears
✅ User is removed from table
✅ Success message appears

---

## Test 5: Employee Login with Jira

### Steps:
1. Logout
2. Click **Employee** tab
3. Enter your Jira credentials:
   - Jira Base URL: `https://your-domain.atlassian.net`
   - Jira Email: `your-jira-email@company.com`
   - API Token: `your-jira-api-token`
4. Click **Login**

### Expected Results:
✅ Shows "Validating..." during authentication
✅ If valid: Redirected to Dashboard
✅ If invalid: Error message appears
✅ Navbar shows employee email with `employee - employee`
✅ Green badge showing "employee"

---

## Test 6: Employee Data Filtering

### Steps:
1. Login as employee (with Jira credentials)
2. Navigate to **Dashboard**
3. Navigate to **Employees** page
4. Navigate to **Management Report** page
5. Navigate to **Projects** page

### Expected Results:
✅ Dashboard: Shows only employee's assigned tasks
✅ Employees: Shows only employee's own data
✅ Management Report: Shows only employee's tasks
✅ Projects: Shows only projects with employee's tasks

---

## Test 7: Management Data Access

### Steps:
1. Logout
2. Login as manager (manager@company.com / manager123)
3. Admin must have configured Jira in Settings first
4. Navigate to all pages

### Expected Results:
✅ Dashboard: Shows all tasks from Jira
✅ Employees: Shows all employees
✅ Management Report: Shows all employees with full data
✅ Projects: Shows all projects

---

## Test 8: Admin Jira Configuration

### Steps:
1. Login as admin
2. Go to **Settings**
3. Configure Jira:
   - Jira Base URL: `https://your-domain.atlassian.net`
   - Email: `admin-jira-email@company.com`
   - API Token: `admin-jira-api-token`
   - Enable "Use CORS Proxy"
   - Select "PHP Proxy (Recommended - XAMPP)"
4. Click **Test Connection**
5. Click **Save Configuration**

### Expected Results:
✅ Test Connection shows "Connection successful!"
✅ Configuration saved message appears
✅ Management users can now access Jira data

---

## Test 9: Logout Functionality

### Steps:
1. Login as any user
2. Click **Logout** button in navbar

### Expected Results:
✅ Redirected to login page
✅ Session cleared from localStorage
✅ Cannot access protected routes without login

---

## Test 10: Protected Routes

### Steps:
1. Logout (or open in incognito)
2. Try to access: `http://localhost:5173/`
3. Try to access: `http://localhost:5173/employees`

### Expected Results:
✅ Automatically redirected to `/login`
✅ Cannot access any page without authentication

---

## Test 11: Persistence After Refresh

### Steps:
1. Login as any user
2. Navigate to Dashboard
3. Refresh the page (F5)

### Expected Results:
✅ User remains logged in
✅ User data persists
✅ Dashboard loads with correct data

---

## Test 12: Invalid Credentials

### Steps:
1. **Management Login:**
   - Email: `wrong@company.com`
   - Password: `wrong123`
   - Click Login

2. **Employee Login:**
   - Jira Base URL: `https://invalid.atlassian.net`
   - Email: `wrong@company.com`
   - API Token: `invalid-token`
   - Click Login

### Expected Results:
✅ Management: "Invalid email or password" error
✅ Employee: "Jira authentication failed" error
✅ User stays on login page

---

## Test 13: Duplicate Management User

### Steps:
1. Login as admin
2. Go to Settings > Management Users
3. Try to add user with existing email (e.g., `admin@company.com`)

### Expected Results:
✅ Error message: "User with this email already exists"
✅ User is not added

---

## Test 14: Role-Based Settings Access

### Steps:
1. Login as employee
2. Try to access Settings page
3. Logout and login as manager
4. Try to access Settings page
5. Logout and login as admin
6. Access Settings page

### Expected Results:
✅ Employee: "You need admin access to view settings"
✅ Manager: "You need admin access to view settings"
✅ Admin: Full access to all settings

---

## Test 15: Data Refresh

### Steps:
1. Login as management user
2. Go to Dashboard
3. Click **Refresh Data** button
4. Go to Management Report
5. Click **Refresh** button

### Expected Results:
✅ Loading state appears
✅ Data is fetched from Jira
✅ Updated data is displayed
✅ No errors in console

---

## Browser Console Checks

Open browser console (F12) and verify:
- ✅ No JavaScript errors
- ✅ localStorage contains:
  - `jiraConfig`
  - `managementUsers`
  - `currentUser`
  - `isLoggedIn`

---

## localStorage Verification

Open DevTools > Application > Local Storage and check:

```javascript
// After management login
currentUser: {
  email: "admin@company.com",
  role: "admin",
  userType: "management",
  jiraCredentials: null
}

// After employee login
currentUser: {
  email: "employee@company.com",
  role: "employee",
  userType: "employee",
  jiraCredentials: {
    baseUrl: "https://...",
    email: "...",
    apiToken: "...",
    useCorsProxy: true,
    proxyUrl: "http://localhost/jira-api/proxy.php"
  }
}
```

---

## Common Issues & Solutions

### Issue 1: CORS Error
**Solution:** Ensure PHP proxy is running at `http://localhost/jira-api/proxy.php`

### Issue 2: "Not Connected" in Navbar
**Solution:** Admin must configure Jira in Settings first (for management users)

### Issue 3: No Data Showing
**Solution:** 
- Check Jira credentials are correct
- Verify proxy is running
- Check browser console for errors

### Issue 4: Employee Sees All Data
**Solution:** Check email filtering logic - should filter by `assignee.emailAddress`

---

## Success Criteria

✅ All 15 tests pass
✅ No console errors
✅ Data filtering works correctly
✅ Authentication works for both types
✅ Logout clears session properly
✅ Protected routes work
✅ Management users can be added/deleted
✅ Settings accessible only to admin

---

## Next Steps After Testing

If all tests pass:
1. ✅ System is ready for production
2. ✅ Update README with new login instructions
3. ✅ Document management user setup process
4. ✅ Create user guide for employees vs management

If tests fail:
1. Note which test failed
2. Check browser console for errors
3. Verify localStorage data
4. Report issues for fixing
