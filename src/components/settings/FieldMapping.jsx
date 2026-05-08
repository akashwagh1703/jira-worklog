import { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';

const FieldMapping = () => {
  const { fieldMapping, saveFieldMapping } = useConfig();
  const [mapping, setMapping] = useState(fieldMapping);
  const [message, setMessage] = useState('');

  const handleSave = () => {
    saveFieldMapping(mapping);
    setMessage('Field mapping saved successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Field Mapping</h2>
      
      <p className="text-sm text-gray-600 mb-6">
        Configure how data from Jira maps to the dashboard metrics. This allows you to customize the system without changing code.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Work Completed</label>
          <select
            value={mapping.workCompleted}
            onChange={(e) => setMapping({ ...mapping, workCompleted: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="status">Status Field</option>
            <option value="resolution">Resolution Field</option>
            <option value="custom">Custom Field</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Maps to: Number of completed work items</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Work Hours</label>
          <select
            value={mapping.workHours}
            onChange={(e) => setMapping({ ...mapping, workHours: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="worklog">Worklog Field</option>
            <option value="timetracking">Time Tracking</option>
            <option value="custom">Custom Field</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Maps to: Total hours logged</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Quality Score</label>
          <select
            value={mapping.qualityScore}
            onChange={(e) => setMapping({ ...mapping, qualityScore: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="defectType">Defect Type</option>
            <option value="bugCount">Bug Count</option>
            <option value="custom">Custom Field</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Maps to: Percentage based on defects</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
          <select
            value={mapping.employee}
            onChange={(e) => setMapping({ ...mapping, employee: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="assignee">Assignee Field</option>
            <option value="reporter">Reporter Field</option>
            <option value="custom">Custom Field</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Maps to: Employee identification</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
          <select
            value={mapping.project}
            onChange={(e) => setMapping({ ...mapping, project: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="project">Project Field</option>
            <option value="component">Component Field</option>
            <option value="custom">Custom Field</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Maps to: Project grouping</p>
        </div>
      </div>

      {message && (
        <div className="mt-4 p-4 rounded-xl bg-green-50 text-green-800">
          {message}
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Save Mapping
        </button>
      </div>
    </div>
  );
};

export default FieldMapping;
