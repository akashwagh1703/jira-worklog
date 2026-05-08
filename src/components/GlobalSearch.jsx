import { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { fetchIssues } from '../services/jiraService';

const GlobalSearch = () => {
  const { jiraConfig, currentUser } = useConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (searchQuery) => {
    setQuery(searchQuery);
    
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const jql = `text ~ "${searchQuery}*" OR summary ~ "${searchQuery}*" OR key = "${searchQuery.toUpperCase()}" ORDER BY updated DESC`;
    const result = await fetchIssues(currentUser, jiraConfig, '', jql);
    
    if (result.success && result.data) {
      let filteredResults = result.data.slice(0, 10);
      
      if (currentUser.userType === 'employee') {
        filteredResults = result.data.filter(issue => {
          const assigneeEmail = issue?.fields?.assignee?.emailAddress;
          return assigneeEmail && assigneeEmail.toLowerCase() === currentUser.email.toLowerCase();
        }).slice(0, 10);
      }
      
      setResults(filteredResults);
    }
    
    setLoading(false);
  };

  const openJiraIssue = (issueKey) => {
    const baseUrl = currentUser.userType === 'employee' ? currentUser.jiraCredentials.baseUrl : jiraConfig.baseUrl;
    window.open(`${baseUrl}/browse/${issueKey}`, '_blank');
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        data-search-trigger
        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="text-sm">Search</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search issues by key, summary, or description..."
                  className="flex-1 outline-none text-gray-800"
                  autoFocus
                />
                <button onClick={() => { setIsOpen(false); setQuery(''); setResults([]); }} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Searching...</div>
              ) : results.length === 0 && query.length >= 2 ? (
                <div className="p-8 text-center text-gray-500">No results found</div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">Type to search issues...</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {results.map((issue, idx) => (
                    <button
                      key={idx}
                      onClick={() => openJiraIssue(issue.key)}
                      className="w-full p-4 hover:bg-gray-50 text-left transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {issue.key}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{issue.fields.summary}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              issue.fields.status?.name === 'Done' ? 'bg-green-100 text-green-800' :
                              issue.fields.status?.name === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {issue.fields.status?.name}
                            </span>
                            <span className="text-xs text-gray-500">{issue.fields.project?.name}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalSearch;
