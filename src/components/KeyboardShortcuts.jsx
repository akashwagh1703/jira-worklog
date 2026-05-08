import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataCache } from '../utils/dataCache';

const KeyboardShortcuts = () => {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e) => {
      // Check if Ctrl/Cmd is pressed
      const modifier = e.ctrlKey || e.metaKey;
      
      if (modifier && e.key === 'k') {
        e.preventDefault();
        // Trigger global search
        document.querySelector('[data-search-trigger]')?.click();
      }
      
      if (modifier && e.key === 'h') {
        e.preventDefault();
        navigate('/');
      }
      
      if (modifier && e.key === 'l') {
        e.preventDefault();
        navigate('/my-logs');
      }
      
      if (modifier && e.key === 'p') {
        e.preventDefault();
        navigate('/preferences');
      }
      
      if (modifier && e.key === 'r') {
        e.preventDefault();
        dataCache.clear();
        window.location.reload();
      }
      
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowHelp(true);
      }
      
      if (e.key === 'Escape') {
        setShowHelp(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  if (!showHelp) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Keyboard Shortcuts</h3>
          <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Search</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl + K</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Go to Dashboard</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl + H</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Go to My Logs</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl + L</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Go to Preferences</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl + P</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Refresh & Clear Cache</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl + R</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Show this help</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">?</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Close dialog</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Esc</kbd>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcuts;
