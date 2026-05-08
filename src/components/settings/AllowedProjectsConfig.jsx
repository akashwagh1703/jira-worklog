import { useState } from 'react';
import {
  getAllowedProjects,
  setAllowedProjects,
  resetAllowedProjects,
  DEFAULT_ALLOWED_PROJECTS,
} from '../../config/scope';

const AllowedProjectsConfig = () => {
  const [projects, setProjects] = useState(getAllowedProjects());
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');

  const persist = (next) => {
    setAllowedProjects(next);
    setProjects(next);
  };

  const handleAdd = () => {
    const value = draft.trim();
    if (!value) return;
    if (projects.includes(value)) {
      setMessage(`"${value}" is already in the list.`);
      return;
    }
    persist([...projects, value]);
    setDraft('');
    setMessage(`Added "${value}". Reload data on each page to see the new scope.`);
  };

  const handleRemove = (key) => {
    persist(projects.filter((p) => p !== key));
    setMessage(`Removed "${key}".`);
  };

  const handleReset = () => {
    resetAllowedProjects();
    setProjects(DEFAULT_ALLOWED_PROJECTS);
    setMessage('Reset to default project list.');
  };

  const handleClear = () => {
    persist([]);
    setMessage('Cleared all restrictions — dashboard will show every project the user has access to.');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Allowed Projects</h2>
      <p className="text-sm text-gray-500 mb-6">
        Restrict every dashboard, report and team view to this list of Jira project names. Leave the list empty to show <span className="font-medium">all</span> projects the logged-in user has access to. (Phase&nbsp;2 will move this to a per-manager scope stored in the backend.)
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Project name as it appears in Jira (e.g. FAMRUT or 'My Project')"
          className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Add
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-900">
          No restrictions configured. The dashboard will fetch <span className="font-medium">every project</span> visible to the logged-in user. For large Jira instances this may be slow.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
          {projects.map((project) => (
            <li key={project} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-800">{project}</span>
              <button
                type="button"
                onClick={() => handleRemove(project)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3 mt-6">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50"
        >
          Reset to defaults
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50"
        >
          Clear all (show every project)
        </button>
      </div>

      {message && (
        <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-xl text-sm">
          {message}
        </div>
      )}
    </div>
  );
};

export default AllowedProjectsConfig;
