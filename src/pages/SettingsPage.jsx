import { useConfig } from '../context/ConfigContext';
import JiraConfig from '../components/settings/JiraConfig';
import FieldMapping from '../components/settings/FieldMapping';
import ManagementUsers from '../components/settings/ManagementUsers';

const SettingsPage = () => {
  const { userRole } = useConfig();

  if (userRole !== 'admin') {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <p className="text-gray-600">You need admin access to view settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Settings</h1>
      <JiraConfig />
      <ManagementUsers />
      <FieldMapping />
    </div>
  );
};

export default SettingsPage;
