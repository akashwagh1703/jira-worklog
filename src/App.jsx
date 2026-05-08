import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ConfigProvider } from './context/ConfigContext';
import { NotificationProvider } from './context/NotificationContext';
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

const ProtectedRoute = ({ children }) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  return isLoggedIn ? children : <Navigate to="/login" />;
};

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true');
  }, []);

  return (
    <ErrorBoundary>
      <ConfigProvider>
        <NotificationProvider>
          <OfflineDetector />
          <BrowserRouter basename="/famrut-team-logs/logs">
            <KeyboardShortcuts />
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
                      <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                  </main>
                </div>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
