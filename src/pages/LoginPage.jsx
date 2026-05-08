import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { testConnection } from '../services/jiraService';
import { ssoLoginRedirect } from '../services/authService';
import { PROXY_URL, APP_NAME, APP_TAGLINE } from '../config/constants';

const ERROR_MESSAGES = {
  sso_disabled:           'SSO sign-in is currently disabled. Please use the Local login tab.',
  sso_not_configured:     'SSO is enabled but not yet configured by IT. Please use the Local login tab.',
  bad_state:              'Sign-in attempt expired or was tampered with. Please try again.',
  token_exchange_failed:  'The identity provider rejected the sign-in. Please try again.',
  userinfo_failed:        "We couldn't read your profile from the identity provider.",
  no_email:               'Your account has no email address — sign-in cannot continue.',
  domain_not_allowed:     'Your email domain is not authorised for this dashboard.',
  idp_access_denied:      'You denied access at the identity provider.',
};

const LoginPage = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { managementUsers, saveCurrentUser } = useConfig();
  const auth      = useAuth();

  const params = new URLSearchParams(location.search);
  const initialError = params.get('error');

  const [tab, setTab] = useState('sso'); // 'sso' | 'management' | 'employee'
  const [managementCreds, setManagementCreds] = useState({ email: '', password: '', rememberMe: false });
  const [employeeCreds,   setEmployeeCreds]   = useState({ baseUrl: 'https://esds.atlassian.net', email: '', apiToken: '', rememberMe: false });
  const [error,   setError]   = useState(initialError ? (ERROR_MESSAGES[initialError] || `Sign-in error: ${initialError}`) : '');
  const [loading, setLoading] = useState(false);

  // If SSO is enabled+configured we default to it. Otherwise show legacy.
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.oidcEnabled || !auth.oidcConfigured) {
      // Fall back to whichever legacy form is most useful.
      setTab('management');
    } else {
      setTab('sso');
    }
  }, [auth.loading, auth.oidcEnabled, auth.oidcConfigured]);

  // Already logged in? Bounce home (or to the route they were trying to reach).
  useEffect(() => {
    if (!auth.loading && auth.authenticated) {
      const next = location.state?.from || '/';
      navigate(next, { replace: true });
    }
  }, [auth.loading, auth.authenticated, navigate, location.state]);

  const handleSso = () => {
    const next = location.state?.from || '/';
    ssoLoginRedirect(next);
  };

  const handleManagementLogin = (e) => {
    e.preventDefault();
    setError('');
    const user = managementUsers.find(
      (u) => u.email.toLowerCase() === managementCreds.email.toLowerCase()
          && u.password === managementCreds.password
    );
    if (!user) {
      setError('Invalid email or password');
      return;
    }
    saveCurrentUser({
      email:           user.email,
      role:            user.role,
      userType:        'management',
      jiraCredentials: null,
      rememberMe:      managementCreds.rememberMe,
    });
    localStorage.setItem('isLoggedIn', 'true');
    navigate('/');
  };

  const handleEmployeeLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const config = {
      baseUrl:      employeeCreds.baseUrl,
      email:        employeeCreds.email.toLowerCase(),
      apiToken:     employeeCreds.apiToken,
      useCorsProxy: true,
      proxyUrl:     PROXY_URL,
    };

    const result = await testConnection(config);
    setLoading(false);

    if (!result.success) {
      setError(`Jira authentication failed: ${result.error}`);
      return;
    }
    saveCurrentUser({
      email:           employeeCreds.email.toLowerCase(),
      role:            'employee',
      userType:        'employee',
      jiraCredentials: config,
      rememberMe:      employeeCreds.rememberMe,
    });
    localStorage.setItem('isLoggedIn', 'true');
    navigate('/');
  };

  const ssoReady = auth.oidcEnabled && auth.oidcConfigured;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-800">{APP_NAME}</h1>
          <p className="text-sm text-gray-500 mt-2">{APP_TAGLINE}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <button
            type="button"
            onClick={() => setTab('sso')}
            className={`px-3 py-2 rounded-xl text-sm transition-colors ${
              tab === 'sso' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Single Sign-On
          </button>
          <button
            type="button"
            onClick={() => setTab('management')}
            className={`px-3 py-2 rounded-xl text-sm transition-colors ${
              tab === 'management' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Local
          </button>
          <button
            type="button"
            onClick={() => setTab('employee')}
            className={`px-3 py-2 rounded-xl text-sm transition-colors ${
              tab === 'employee' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Jira Token
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-800 p-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {tab === 'sso' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleSso}
              disabled={!ssoReady}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              {ssoReady ? 'Sign in with ESDS SSO' : 'SSO not yet configured'}
            </button>
            {!ssoReady && (
              <p className="text-xs text-gray-500 text-center">
                Ask your administrator to wire up the IdP credentials, then come back here.
                In the meantime, use one of the other login methods.
              </p>
            )}
            {ssoReady && (
              <p className="text-xs text-gray-500 text-center">
                You'll be redirected to your corporate identity provider to sign in.
              </p>
            )}
          </div>
        )}

        {tab === 'management' && (
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
            <label className="flex items-center text-sm text-gray-600">
              <input
                type="checkbox"
                checked={managementCreds.rememberMe}
                onChange={(e) => setManagementCreds({ ...managementCreds, rememberMe: e.target.checked })}
                className="w-4 h-4 mr-2 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              Remember me
            </label>
            <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
              Login
            </button>
          </form>
        )}

        {tab === 'employee' && (
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
                placeholder="your-email@esds.co.in"
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
            <label className="flex items-center text-sm text-gray-600">
              <input
                type="checkbox"
                checked={employeeCreds.rememberMe}
                onChange={(e) => setEmployeeCreds({ ...employeeCreds, rememberMe: e.target.checked })}
                className="w-4 h-4 mr-2 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              Remember me
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Validating...' : 'Login'}
            </button>
            <div className="mt-4 p-4 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-800 font-medium mb-2">How to generate API token:</p>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>
                  Go to{' '}
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium hover:text-blue-900"
                  >
                    Atlassian Account Settings
                  </a>
                </li>
                <li>Click "Create API token"</li>
                <li>Give it a label (e.g., "Worklog Dashboard")</li>
                <li>Copy the token and paste it above</li>
              </ol>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
