import { useState } from 'react';
import { useNotification } from '../context/NotificationContext';

const QuickWorklogEntry = ({ jiraConfig, currentUser, onSuccess }) => {
  const { showSuccess, showError } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    issueKey: '',
    timeSpent: '',
    comment: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const config = currentUser.userType === 'employee' ? currentUser.jiraCredentials : jiraConfig;
      const url = config.useCorsProxy 
        ? config.proxyUrl 
        : `${config.baseUrl}/rest/api/3/issue/${formData.issueKey}/worklog`;

      const auth = btoa(`${config.email}:${config.apiToken}`);
      const headers = {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      };

      const body = {
        timeSpent: formData.timeSpent,
        comment: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: formData.comment
            }]
          }]
        }
      };

      const requestOptions = config.useCorsProxy ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        })
      } : {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      };

      const response = await fetch(config.useCorsProxy ? config.proxyUrl : url, requestOptions);
      
      if (response.ok) {
        setFormData({ issueKey: '', timeSpent: '', comment: '' });
        setIsOpen(false);
        showSuccess('Worklog added successfully!');
        if (onSuccess) onSuccess();
      } else {
        setError('Failed to add worklog. Check issue key and try again.');
        showError('Failed to add worklog');
      }
    } catch (err) {
      setError('Error adding worklog: ' + err.message);
      showError('Error adding worklog');
    }
    
    setLoading(false);
  };

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
      >
        + Quick Log
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Add Work Log</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Issue Key</label>
                <input
                  type="text"
                  value={formData.issueKey}
                  onChange={(e) => setFormData({ ...formData, issueKey: e.target.value })}
                  placeholder="e.g., PROJ-123"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Spent</label>
                <input
                  type="text"
                  value={formData.timeSpent}
                  onChange={(e) => setFormData({ ...formData, timeSpent: e.target.value })}
                  placeholder="e.g., 2h 30m"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Comment</label>
                <textarea
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  placeholder="What did you work on?"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-800 p-3 rounded-xl text-sm">{error}</div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickWorklogEntry;
