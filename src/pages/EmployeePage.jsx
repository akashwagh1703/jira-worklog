import { useEffect, useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { fetchEmployees } from '../services/jiraService';
import EmployeeTable from '../components/employee/EmployeeTable';
import EmployeeReportModal from '../components/employee/EmployeeReportModal';

// Phase 2: discovery is delegated to the service layer (backend or fallback).
// A 90-day window keeps us focused on currently-active employees.
const DEFAULT_LOOKBACK_DAYS = 90;

const EmployeePage = () => {
  const { jiraConfig, currentUser } = useConfig();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cached, setCached] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    const ready =
      (currentUser.userType === 'employee' && currentUser.jiraCredentials) ||
      (currentUser.userType === 'management' && jiraConfig.baseUrl && jiraConfig.email && jiraConfig.apiToken) ||
      currentUser.userType === 'management';
    if (ready) {
      loadEmployees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jiraConfig, currentUser]);

  const loadEmployees = async () => {
    setLoading(true);
    setError(null);
    setCached(false);

    const result = await fetchEmployees(currentUser, jiraConfig, DEFAULT_LOOKBACK_DAYS);

    if (!result.success) {
      setError(result.error || 'Failed to load employees from Jira');
      setEmployees([]);
      setLoading(false);
      return;
    }

    // Normalise to the shape EmployeeTable expects: { name }
    const list = (result.data || []).map((u) => ({
      name: u.displayName || u.name,
      email: u.emailAddress || u.email || '',
      accountId: u.accountId || null,
      avatar: u.avatar || null,
    }));

    setEmployees(list);
    setCached(result.cached === true);
    setLoading(false);
  };

  const handleViewReport = (employee) => {
    setSelectedEmployee(employee);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Employees</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading
              ? 'Discovering employees from Jira…'
              : `${employees.length} active in the last ${DEFAULT_LOOKBACK_DAYS} days${cached ? ' (cached)' : ''}`}
          </p>
        </div>
        <button
          onClick={loadEmployees}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      <EmployeeTable
        employees={employees}
        onViewReport={handleViewReport}
      />

      {selectedEmployee && (
        <EmployeeReportModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
};

export default EmployeePage;
