import { useConfig } from '../../context/ConfigContext';
import { useNavigate } from 'react-router-dom';
import GlobalSearch from '../GlobalSearch';

const Navbar = ({ sidebarCollapsed }) => {
  const { currentUser, isConnected, clearCurrentUser, darkMode, toggleDarkMode } = useConfig();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearCurrentUser();
    localStorage.removeItem('isLoggedIn');
    navigate('/login');
  };

  return (
    <div 
      className="bg-white border-b border-gray-200 h-16 fixed top-0 right-0 z-10 transition-all duration-300 md:left-auto left-0" 
      style={{ left: sidebarCollapsed ? '5rem' : '16rem' }}
    >
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 animate-fade-in">
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}></div>
            <span className="text-xs md:text-sm text-gray-600 hidden sm:inline">
              {isConnected ? 'Connected to Jira' : 'Not Connected'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <GlobalSearch />
          <button
            onClick={toggleDarkMode}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors hidden md:block"
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {darkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-gray-800">{currentUser.email}</p>
              <p className="text-xs text-gray-500 capitalize">{currentUser.userType} - {currentUser.role}</p>
            </div>
            <span className={`px-3 py-1 rounded-lg text-xs font-medium hidden sm:inline ${
              currentUser.role === 'admin' ? 'bg-purple-100 text-purple-800' :
              currentUser.role === 'manager' ? 'bg-blue-100 text-blue-800' :
              'bg-green-100 text-green-800'
            }`}>
              {currentUser.role}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 md:px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
