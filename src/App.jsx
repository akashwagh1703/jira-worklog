import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { ConfigProvider } from './context/ConfigContext';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { APP_ROUTER_BASENAME } from './config/constants';
import ErrorBoundary from './components/ErrorBoundary';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import OfflineDetector from './components/OfflineDetector';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import DashboardPage from './pages/DashboardPage';
import EmployeePage from './pages/EmployeePage';
import ManagementReportPage from './pages/ManagementReportPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import MyLogsPage from './pages/MyLogsPage';
import MyProjectsPage from './pages/MyProjectsPage';
import ProjectsPage from './pages/ProjectsPage';
import TeamOverviewPage from './pages/TeamOverviewPage';
import ResourceAllocationPage from './pages/ResourceAllocationPage';
import CustomReportBuilderPage from './pages/CustomReportBuilderPage';
import UserPreferencesPage from './pages/UserPreferencesPage';
import AdminUsersPage from './pages/AdminUsersPage';

const ProtectedRoute = ({ children }) => {
  const { loading, authenticated } = useAuth();
  const location = useLocation();

  // While we're checking the server session, accept the legacy localStorage flag
  // so users who logged in via the legacy form aren't bounced to /login.
  if (loading) {
    const legacy = localStorage.getItem('isLoggedIn') === 'true';
    if (legacy) return children;
    return null;
  }

  if (authenticated) return children;

  // Fallback: legacy login still works without server session.
  if (localStorage.getItem('isLoggedIn') === 'true') return children;

  const next = location.pathname + location.search;
  return <Navigate to="/login" replace state={{ from: next }} />;
};

function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <div className="min-h-screen bg-gray-50">
            <Sidebar onToggle={setSidebarCollapsed} />
            <Navbar sidebarCollapsed={sidebarCollapsed} />
            <main className={`${sidebarCollapsed ? 'ml-20' : 'ml-64'} mt-16 p-4 md:p-6 transition-all duration-300`}>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/my-logs" element={<MyLogsPage />} />
                <Route path="/my-projects" element={<MyProjectsPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/employees" element={<EmployeePage />} />
                <Route path="/team-overview" element={<TeamOverviewPage />} />
                <Route path="/resource-allocation" element={<ResourceAllocationPage />} />
                <Route path="/custom-reports" element={<CustomReportBuilderPage />} />
                <Route path="/preferences" element={<UserPreferencesPage />} />
                <Route path="/management-report" element={<ManagementReportPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ConfigProvider>
        <AuthProvider>
          <NotificationProvider>
            <OfflineDetector />
            <BrowserRouter basename={APP_ROUTER_BASENAME}>
              <KeyboardShortcuts />
              <AppShell />
            </BrowserRouter>
          </NotificationProvider>
        </AuthProvider>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
