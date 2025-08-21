import React from 'react';
import { clearAllData } from '../utils/clearAllData';
import { ensureAdminUserExists } from '../utils/createAdminUser';

export default function DataCleanup() {
  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      await clearAllData();
      alert('All data cleared successfully!');
    }
  };

  const handleEnsureAdmin = async () => {
    try {
      await ensureAdminUserExists();
      alert('Super Admin user ensured successfully!');
    } catch (error) {
      console.error('Error ensuring admin user:', error);
      alert('Error ensuring admin user. Check console for details.');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Data Management</h1>
      
      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Super Admin Setup</h2>
          <p className="text-gray-600 mb-3">
            Ensure the Super Admin user exists with correct permissions.
          </p>
          <button
            onClick={handleEnsureAdmin}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Ensure Super Admin User
          </button>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Data Cleanup</h2>
          <p className="text-gray-600 mb-3">
            Clear all data except the Super Admin user. Use with caution!
          </p>
          <button
            onClick={handleClearData}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
}
