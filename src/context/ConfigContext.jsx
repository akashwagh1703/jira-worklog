import { createContext, useContext, useState, useEffect } from 'react';
import { PROXY_URL } from '../config/constants';

const ConfigContext = createContext();

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider = ({ children }) => {
  const [jiraConfig, setJiraConfig] = useState({
    baseUrl: '',
    email: '',
    apiToken: '',
    projectKey: '',
    boardId: '',
    useCorsProxy: false,
    proxyUrl: PROXY_URL
  });

  const [fieldMapping, setFieldMapping] = useState({
    workCompleted: 'status',
    workHours: 'worklog',
    qualityScore: 'defectType',
    employee: 'assignee',
    project: 'project'
  });

  const [userRole, setUserRole] = useState('manager');
  const [isConnected, setIsConnected] = useState(false);

  // Management users list
  const [managementUsers, setManagementUsers] = useState([
    { email: 'admin@company.com', password: 'admin123', role: 'admin', name: 'Admin User' },
    { email: 'manager@company.com', password: 'manager123', role: 'manager', name: 'Manager User' }
  ]);

  // Current logged-in user
  const [currentUser, setCurrentUser] = useState({
    email: '',
    role: '',
    userType: '', // 'employee' or 'management'
    jiraCredentials: null, // only for employees
    rememberMe: false
  });

  // Dark mode
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem('jiraConfig');
    const savedMapping = localStorage.getItem('fieldMapping');
    const savedRole = localStorage.getItem('userRole');
    const savedManagementUsers = localStorage.getItem('managementUsers');
    const savedCurrentUser = localStorage.getItem('currentUser');
    const savedDarkMode = localStorage.getItem('darkMode');

    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      // Migrate old localhost URLs to production
      if (parsed.proxyUrl && parsed.proxyUrl.includes('localhost')) {
        parsed.proxyUrl = PROXY_URL;
      }
      // Migrate HTTP to HTTPS
      // http://dev.famrut.com,  http://localhost/jira-api
      if (parsed.proxyUrl && parsed.proxyUrl.startsWith('http://dev.famrut.com')) {
        parsed.proxyUrl = parsed.proxyUrl.replace('http://', 'https://');
      }

      setJiraConfig({ 
        ...parsed, 
        useCorsProxy: parsed.useCorsProxy || false,
        proxyUrl: parsed.proxyUrl || PROXY_URL
      });
      // Save migrated config
      localStorage.setItem('jiraConfig', JSON.stringify(parsed));
    }
    if (savedMapping) setFieldMapping(JSON.parse(savedMapping));
    if (savedRole) setUserRole(savedRole);
    if (savedManagementUsers) setManagementUsers(JSON.parse(savedManagementUsers));
    if (savedCurrentUser) {
      const user = JSON.parse(savedCurrentUser);
      // Migrate employee credentials
      if (user.jiraCredentials && user.jiraCredentials.proxyUrl) {
        if (user.jiraCredentials.proxyUrl.includes('localhost')) {
          user.jiraCredentials.proxyUrl = PROXY_URL;
        }
        // Migrate HTTP to HTTPS
        // http://localhost, http://dev.famrut.com
        if (user.jiraCredentials.proxyUrl.startsWith('http://dev.famrut.com')) {
          user.jiraCredentials.proxyUrl = user.jiraCredentials.proxyUrl.replace('http://', 'https://');
        }
        localStorage.setItem('currentUser', JSON.stringify(user));
      }
      setCurrentUser(user);
    }
    if (savedDarkMode) {
      const isDark = JSON.parse(savedDarkMode);
      setDarkMode(isDark);
      if (isDark) document.documentElement.classList.add('dark');
    }
  }, []);

  const saveJiraConfig = (config) => {
    setJiraConfig(config);
    localStorage.setItem('jiraConfig', JSON.stringify(config));
  };

  const saveFieldMapping = (mapping) => {
    setFieldMapping(mapping);
    localStorage.setItem('fieldMapping', JSON.stringify(mapping));
  };

  const saveUserRole = (role) => {
    setUserRole(role);
    localStorage.setItem('userRole', role);
  };

  const saveManagementUsers = (users) => {
    setManagementUsers(users);
    localStorage.setItem('managementUsers', JSON.stringify(users));
  };

  const addManagementUser = (user) => {
    const updatedUsers = [...managementUsers, user];
    saveManagementUsers(updatedUsers);
  };

  const deleteManagementUser = (email) => {
    const updatedUsers = managementUsers.filter(u => u.email !== email);
    saveManagementUsers(updatedUsers);
  };

  const saveCurrentUser = (user) => {
    setCurrentUser(user);
    setUserRole(user.role);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const clearCurrentUser = () => {
    const rememberMe = currentUser.rememberMe;
    if (!rememberMe) {
      setCurrentUser({ email: '', role: '', userType: '', jiraCredentials: null, rememberMe: false });
      localStorage.removeItem('currentUser');
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', JSON.stringify(newMode));
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <ConfigContext.Provider value={{
      jiraConfig,
      fieldMapping,
      userRole,
      isConnected,
      managementUsers,
      currentUser,
      darkMode,
      setIsConnected,
      saveJiraConfig,
      saveFieldMapping,
      saveUserRole,
      saveManagementUsers,
      addManagementUser,
      deleteManagementUser,
      saveCurrentUser,
      clearCurrentUser,
      toggleDarkMode
    }}>
      {children}
    </ConfigContext.Provider>
  );
};
