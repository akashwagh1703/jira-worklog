import { useState } from 'react';

const AdvancedFilters = ({ onApply, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState({
    assignee: '',
    reporter: '',
    labels: '',
    components: '',
    fixVersions: '',
    issueType: '',
    resolution: '',
    createdAfter: '',
    createdBefore: '',
    updatedAfter: '',
    updatedBefore: ''
  });

  const handleApply = () => {
    onApply(filters);
    setIsOpen(false);
  };

  const handleClear = () => {
    const cleared = {
      assignee: '',
      reporter: '',
      labels: '',
      components: '',
      fixVersions: '',
      issueType: '',
      resolution: '',
      createdAfter: '',
      createdBefore: '',
      updatedAfter: '',
      updatedBefore: ''
    };
    setFilters(cleared);
    onClear();
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Advanced Filters
        {activeFiltersCount > 0 && (
          <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs">{activeFiltersCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-800">Advanced Filters</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assignee</label>
                  <input
                    type="text"
                    value={filters.assignee}
                    onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}
                    placeholder="Email or name"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reporter</label>
                  <input
                    type="text"
                    value={filters.reporter}
                    onChange={(e) => setFilters({ ...filters, reporter: e.target.value })}
                    placeholder="Email or name"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Issue Type</label>
                  <select
                    value={filters.issueType}
                    onChange={(e) => setFilters({ ...filters, issueType: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">All Types</option>
                    <option value="Bug">Bug</option>
                    <option value="Task">Task</option>
                    <option value="Story">Story</option>
                    <option value="Epic">Epic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Resolution</label>
                  <select
                    value={filters.resolution}
                    onChange={(e) => setFilters({ ...filters, resolution: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">All</option>
                    <option value="Done">Done</option>
                    <option value="Won't Do">Won't Do</option>
                    <option value="Duplicate">Duplicate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Created After</label>
                  <input
                    type="date"
                    value={filters.createdAfter}
                    onChange={(e) => setFilters({ ...filters, createdAfter: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Created Before</label>
                  <input
                    type="date"
                    value={filters.createdBefore}
                    onChange={(e) => setFilters({ ...filters, createdBefore: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Labels</label>
                  <input
                    type="text"
                    value={filters.labels}
                    onChange={(e) => setFilters({ ...filters, labels: e.target.value })}
                    placeholder="Comma separated"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Components</label>
                  <input
                    type="text"
                    value={filters.components}
                    onChange={(e) => setFilters({ ...filters, components: e.target.value })}
                    placeholder="Comma separated"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
              >
                Clear All
              </button>
              <button
                onClick={handleApply}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdvancedFilters;
