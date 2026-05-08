# Employee Performance & Reporting Dashboard

A fully frontend-only, highly configurable Employee Performance Dashboard that fetches data directly from Jira REST API.

## Features

- ✅ No backend required - runs entirely in the browser
- ✅ Direct Jira REST API integration
- ✅ PHP CORS proxy included
- ✅ Fully configurable from UI
- ✅ Non-technical user friendly
- ✅ Clean corporate design (no gradients)
- ✅ Role-based views (Admin, Manager, Employee)
- ✅ Real-time data fetching
- ✅ Local storage for configuration

## Tech Stack

- React (JavaScript)
- Vite
- Tailwind CSS
- Axios
- Recharts
- React Router
- Context API
- PHP (CORS Proxy)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PHP 7.4+ (for CORS proxy)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the PHP proxy (in one terminal):
```bash
npm run php-proxy
```

3. Start the development server (in another terminal):
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Configuration

1. Switch to **Admin View** using the role selector in the top-right
2. Navigate to **Settings** page
3. Enable **"Use CORS Proxy"**
4. Select **"PHP Proxy"** from dropdown
5. Configure your Jira connection:
   - Jira Base URL (e.g., https://your-domain.atlassian.net)
   - Email
   - API Token (generate from Jira)
   - Default Project Key
   - Board ID
6. Click **Test Connection** to verify
7. Click **Save Configuration**

## Usage

### Dashboard
- View KPIs: Total Work Completed, Delivery Rate, Quality Score, Work Hours
- Filter by date range and project
- View charts and trends

### Employees
- View employee performance table
- Search and filter employees
- Click "View Report" for detailed employee analytics

### Projects
- View project completion status
- Monitor risk levels
- Track active contributors

### Management Report
- Comprehensive employee performance analysis
- Date-wise filtering
- Clickable metrics for detailed breakdown
- Performance charts and graphs
- Export to CSV
- Print reports

### Settings (Admin Only)
- Configure Jira connection
- Map Jira fields to dashboard metrics
- Select CORS proxy (PHP/Node/Public)
- No code changes required

## CORS Proxy Options

### Option 1: PHP Proxy (Recommended)
```bash
npm run php-proxy
```
Runs on: `http://localhost:8000/proxy.php`

### Option 2: Node.js Proxy
```bash
npm run proxy
```
Runs on: `http://localhost:3001/proxy`

### Option 3: Browser Extension
Install "CORS Unblock" extension for Chrome/Edge

## Deployment

See [PHP_DEPLOYMENT.md](./PHP_DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy:
1. Build: `npm run build`
2. Upload `dist` folder to your PHP hosting
3. Upload `api` folder
4. Update proxy URL in Settings

## Security Notice

⚠️ Jira credentials are stored locally in the browser. This system is intended for internal corporate use only.

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## License

Internal Corporate Use Only
