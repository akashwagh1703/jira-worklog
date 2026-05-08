import { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { testConnection } from '../../services/jiraService';
import { PROXY_URL } from '../../config/constants';

const JiraConfig = () => {
  const { jiraConfig, saveJiraConfig, setIsConnected } = useConfig();
  const [config, setConfig] = useState(jiraConfig);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');

  const handleTest = async () => {
    setTesting(true);
    setMessage('');
    const result = await testConnection(config);
    setTesting(false);
    
    if (result.success) {
      setMessage('Connection successful!');
      setIsConnected(true);
    } else {
      setMessage(`Connection failed: ${result.error}`);
      setIsConnected(false);
    }
  };

  const handleSave = () => {
    saveJiraConfig(config);
    setMessage('Configuration saved successfully!');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Jira Configuration</h2>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-yellow-800">
          ⚠️ Jira credentials are stored locally in the browser. This system is intended for internal corporate use only.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-800 mb-2">
          ℹ️ <strong>CORS Issue?</strong> Run the local proxy server to fix connection errors.
        </p>
        <p className="text-xs text-blue-700">
          Run: <code className="bg-blue-100 px-2 py-1 rounded">npm run proxy</code> in a separate terminal
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Jira Base URL</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder="https://your-domain.atlassian.net"
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={config.email}
            onChange={(e) => setConfig({ ...config, email: e.target.value })}
            placeholder="your-email@company.com"
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">API Token</label>
          <input
            type="password"
            value={config.apiToken}
            onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
            placeholder="Your Jira API Token"
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Default Project Key</label>
          <input
            type="text"
            value={config.projectKey}
            onChange={(e) => setConfig({ ...config, projectKey: e.target.value })}
            placeholder="PROJ"
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Board ID</label>
          <input
            type="text"
            value={config.boardId}
            onChange={(e) => setConfig({ ...config, boardId: e.target.value })}
            placeholder="123"
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
          <input
            type="checkbox"
            id="useCorsProxy"
            checked={config.useCorsProxy}
            onChange={(e) => setConfig({ ...config, useCorsProxy: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-600"
          />
          <label htmlFor="useCorsProxy" className="text-sm font-medium text-gray-700">
            Use CORS Proxy (Enable if getting CORS errors)
          </label>
        </div>

        {config.useCorsProxy && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Proxy URL</label>
            <select
              value={config.proxyUrl}
              onChange={(e) => setConfig({ ...config, proxyUrl: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value={PROXY_URL}>PHP Proxy (Recommended)</option>
              <option value="http://localhost:3001/proxy">Node Proxy (Run: npm run proxy)</option>
              <option value="https://corsproxy.io/?">corsproxy.io</option>
              <option value="https://api.allorigins.win/raw?url=">allorigins.win</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Select a CORS proxy service</p>
          </div>
        )}
      </div>

      {message && (
        <div className={`mt-4 p-4 rounded-xl ${
          message.includes('successful') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={handleTest}
          disabled={testing}
          className="px-6 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
};

export default JiraConfig;
