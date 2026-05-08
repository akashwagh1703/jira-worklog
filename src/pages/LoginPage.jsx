import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { testConnection } from '../services/jiraService';
import { PROXY_URL } from '../config/constants';

const LoginPage = () => {
  const navigate = useNavigate();
  const { managementUsers, saveCurrentUser } = useConfig();
  const [loginType, setLoginType] = useState('management'); // 'management' or 'employee'
  const [managementCreds, setManagementCreds] = useState({ email: '', password: '', rememberMe: false });
  const [employeeCreds, setEmployeeCreds] = useState({ baseUrl: 'https://esds.atlassian.net', email: '', apiToken: '', rememberMe: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleManagementLogin = (e) => {
    e.preventDefault();
    setError('');

    const user = managementUsers.find(
      u => u.email.toLowerCase() === managementCreds.email.toLowerCase() && 
           u.password === managementCreds.password
    );

    if (user) {
      saveCurrentUser({
        email: user.email,
        role: user.role,
        userType: 'management',
        jiraCredentials: null,
        rememberMe: managementCreds.rememberMe
      });
      localStorage.setItem('isLoggedIn', 'true');
      navigate('/');
    } else {
      setError('Invalid email or password');
    }
  };

  const handleEmployeeLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate with Jira API
    const config = {
      baseUrl: employeeCreds.baseUrl,
      email: employeeCreds.email.toLowerCase(), // Normalize to lowercase
      apiToken: employeeCreds.apiToken,
      useCorsProxy: true,
      proxyUrl: PROXY_URL
    };

    const result = await testConnection(config);
    setLoading(false);

    if (result.success) {
      saveCurrentUser({
        email: employeeCreds.email.toLowerCase(), // Normalize to lowercase
        role: 'employee',
        userType: 'employee',
        jiraCredentials: config,
        rememberMe: employeeCreds.rememberMe
      });
      localStorage.setItem('isLoggedIn', 'true');
      navigate('/');
    } else {
      setError(`Jira authentication failed: ${result.error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-800">Famrut Team Logs</h1>
          <p className="text-sm text-gray-500 mt-2">Employee Analytics Dashboard</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setLoginType('management')}
            className={`flex-1 px-4 py-2 rounded-xl transition-colors ${
              loginType === 'management' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Management
          </button>
          <button
            type="button"
            onClick={() => setLoginType('employee')}
            className={`flex-1 px-4 py-2 rounded-xl transition-colors ${
              loginType === 'employee' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Employee
          </button>
        </div>

        {loginType === 'management' ? (
          <form onSubmit={handleManagementLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={managementCreds.email}
                onChange={(e) => setManagementCreds({ ...managementCreds, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={managementCreds.password}
                onChange={(e) => setManagementCreds({ ...managementCreds, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-800 p-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMeManagement"
                checked={managementCreds.rememberMe}
                onChange={(e) => setManagementCreds({ ...managementCreds, rememberMe: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="rememberMeManagement" className="ml-2 text-sm text-gray-600">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
              Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmployeeLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Jira Base URL</label>
              <input
                type="url"
                value={employeeCreds.baseUrl}
                onChange={(e) => setEmployeeCreds({ ...employeeCreds, baseUrl: e.target.value })}
                placeholder="https://esds.atlassian.net"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Jira Email</label>
              <input
                type="email"
                value={employeeCreds.email}
                onChange={(e) => setEmployeeCreds({ ...employeeCreds, email: e.target.value })}
                placeholder="your-email@company.com"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">API Token</label>
              <input
                type="password"
                value={employeeCreds.apiToken}
                onChange={(e) => setEmployeeCreds({ ...employeeCreds, apiToken: e.target.value })}
                placeholder="Your Jira API Token"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-800 p-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMeEmployee"
                checked={employeeCreds.rememberMe}
                onChange={(e) => setEmployeeCreds({ ...employeeCreds, rememberMe: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="rememberMeEmployee" className="ml-2 text-sm text-gray-600">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
              {loading ? 'Validating...' : 'Login'}
            </button>

            <div className="mt-4 p-4 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-800 font-medium mb-2">How to generate API token:</p>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>Go to <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-blue-900">Atlassian Account Settings</a></li>
                <li>Click "Create API token"</li>
                <li>Give it a label (e.g., "Team Logs")</li>
                <li>Copy the token and paste it above</li>
                <li>Use your Jira email: <span className="font-medium">your-email@esds.co.in</span></li>
              </ol>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
