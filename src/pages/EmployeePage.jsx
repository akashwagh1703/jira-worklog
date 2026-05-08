import { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import EmployeeTable from '../components/employee/EmployeeTable';
import EmployeeReportModal from '../components/employee/EmployeeReportModal';

const EMPLOYEES = [
  'Akash Wagh',
  'Minakshi Aher',
  'Gauri Birari',
  'Kavita Patil',
  'Bhushan Lambole',
  'Kalpesh Mandawade',
  'Manoj mali',
  'Ishwar Bendre',
  'Pranav Shukla',
  'Rohit Patil',
  'Neha Tiwari'
];

const EmployeePage = () => {
  const { currentUser } = useConfig();
  const [employees] = useState(EMPLOYEES.map(name => ({ name })));
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const handleViewReport = (employee) => {
    setSelectedEmployee(employee);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Employees</h1>
      </div>

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
