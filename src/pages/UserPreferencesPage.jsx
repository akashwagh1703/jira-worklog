import { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { useNotification } from '../context/NotificationContext';

const UserPreferencesPage = () => {
  const { currentUser, darkMode, toggleDarkMode } = useConfig();
  const { showSuccess } = useNotification();
  const [preferences, setPreferences] = useState({
    defaultDateRange: 'thisMonth',
    itemsPerPage: 20,
    autoRefresh: false,
    refreshInterval: 5,
    notifications: true,
    emailReports: false,
    reportFrequency: 'weekly',
    theme: 'light'
  });

  useEffect(() => {
    const saved = localStorage.getItem('userPreferences');
    if (saved) {
      setPreferences(JSON.parse(saved));
    }
  }, []);

  const savePreferences = () => {
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
    showSuccess('Preferences saved successfully!');
  };

  const resetPreferences = () => {
    const defaults = {
      defaultDateRange: 'thisMonth',
      itemsPerPage: 20,
      autoRefresh: false,
      refreshInterval: 5,
      notifications: true,
      emailReports: false,
      reportFrequency: 'weekly',
      theme: 'light'
    };
    setPreferences(defaults);
    localStorage.setItem('userPreferences', JSON.stringify(defaults));
    showSuccess('Preferences reset to defaults');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">User Preferences</h1>
        <p className="text-sm text-gray-500 mt-1">Customize your experience</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Display Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleDarkMode}
                  className={`flex-1 px-4 py-2 rounded-xl transition-colors ${
                    !darkMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={toggleDarkMode}
                  className={`flex-1 px-4 py-2 rounded-xl transition-colors ${
                    darkMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Date Range</label>
              <select
                value={preferences.defaultDateRange}
                onChange={(e) => setPreferences({ ...preferences, defaultDateRange: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="today">Today</option>
                <option value="thisWeek">This Week</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Items Per Page</label>
              <select
                value={preferences.itemsPerPage}
                onChange={(e) => setPreferences({ ...preferences, itemsPerPage: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Data Refresh</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Auto Refresh</p>
                <p className="text-xs text-gray-500">Automatically refresh data</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.autoRefresh}
                  onChange={(e) => setPreferences({ ...preferences, autoRefresh: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {preferences.autoRefresh && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Refresh Interval (minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={preferences.refreshInterval}
                  onChange={(e) => setPreferences({ ...preferences, refreshInterval: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Notifications</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Enable Notifications</p>
                <p className="text-xs text-gray-500">Show toast notifications</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.notifications}
                  onChange={(e) => setPreferences({ ...preferences, notifications: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Email Reports</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Email Reports</p>
                <p className="text-xs text-gray-500">Receive reports via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.emailReports}
                  onChange={(e) => setPreferences({ ...preferences, emailReports: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {preferences.emailReports && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                <select
                  value={preferences.reportFrequency}
                  onChange={(e) => setPreferences({ ...preferences, reportFrequency: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="text-base font-medium text-gray-800">{currentUser.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Role</p>
            <p className="text-base font-medium text-gray-800 capitalize">{currentUser.role}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">User Type</p>
            <p className="text-base font-medium text-gray-800 capitalize">{currentUser.userType}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={savePreferences}
          className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Save Preferences
        </button>
        <button
          onClick={resetPreferences}
          className="px-6 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default UserPreferencesPage;
