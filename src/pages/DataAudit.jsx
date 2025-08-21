import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { 
  generateConsistencyReport, 
  standardizeAssignmentData, 
  removeDuplicates,
  cleanCollectionData 
} from '../utils/dataConsistencyUtils';

export default function DataAudit() {
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState(false);
  const [auditReport, setAuditReport] = useState(null);
  const [collections, setCollections] = useState({});
  const [selectedCollections, setSelectedCollections] = useState([
    'users', 'stores', 'tasks', 'trainings', 'tests', 'customers'
  ]);

  useEffect(() => {
    if (profile && (profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN')) {
      loadCollections();
    }
  }, [profile]);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const collectionsToLoad = [
        'users', 'stores', 'tasks', 'trainings', 'tests', 
        'customers', 'attendance', 'leave_requests', 'salary_requests',
        'other_expenses', 'rokar', 'training_completions', 'test_results'
      ];

      const loadedCollections = {};
      
      for (const collectionName of collectionsToLoad) {
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          loadedCollections[collectionName] = items;
        } catch (error) {
          console.error(`Error loading ${collectionName}:`, error);
          loadedCollections[collectionName] = [];
        }
      }

      setCollections(loadedCollections);
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAudit = async () => {
    setLoading(true);
    try {
      const filteredCollections = {};
      selectedCollections.forEach(name => {
        if (collections[name]) {
          filteredCollections[name] = collections[name];
        }
      });

      const report = generateConsistencyReport(filteredCollections);
      setAuditReport(report);
    } catch (error) {
      console.error('Error running audit:', error);
    } finally {
      setLoading(false);
    }
  };

  const fixAssignmentInconsistencies = async () => {
    setLoading(true);
    try {
      const fixedCollections = {};
      
      Object.entries(collections).forEach(([name, items]) => {
        if (selectedCollections.includes(name)) {
          // Standardize assignment data
          const standardized = items.map(item => standardizeAssignmentData(item));
          
          // Remove duplicates
          const deduplicated = removeDuplicates(standardized, 'id');
          
          // Clean data
          const cleaned = cleanCollectionData(deduplicated, name.slice(0, -1));
          
          fixedCollections[name] = cleaned;
        }
      });

      setCollections(fixedCollections);
      
      // Run audit again with fixed data
      const report = generateConsistencyReport(fixedCollections);
      setAuditReport(report);
      
      alert('Assignment inconsistencies have been fixed!');
    } catch (error) {
      console.error('Error fixing inconsistencies:', error);
      alert('Error fixing inconsistencies: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!auditReport) return;
    
    const blob = new Blob([JSON.stringify(auditReport, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-audit-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!profile || (profile.role !== 'SUPER_ADMIN' && profile.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only administrators can access the data audit.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Data Consistency Audit</h1>
        <div className="flex space-x-2">
          <button
            onClick={loadCollections}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Reload Data'}
          </button>
          <button
            onClick={runAudit}
            disabled={loading || Object.keys(collections).length === 0}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Run Audit'}
          </button>
          {auditReport && (
            <button
              onClick={downloadReport}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              Download Report
            </button>
          )}
        </div>
      </div>

      {/* Collection Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Select Collections to Audit</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.keys(collections).map(collectionName => (
            <label key={collectionName} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedCollections.includes(collectionName)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedCollections([...selectedCollections, collectionName]);
                  } else {
                    setSelectedCollections(selectedCollections.filter(c => c !== collectionName));
                  }
                }}
                className="rounded"
              />
              <span className="text-sm">
                {collectionName} ({collections[collectionName]?.length || 0})
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Collection Summary */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Collection Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(collections).map(([name, items]) => (
            <div key={name} className="bg-gray-50 p-4 rounded">
              <div className="text-lg font-semibold text-blue-600">{items.length}</div>
              <div className="text-sm text-gray-600 capitalize">{name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fix Assignment Issues */}
      {auditReport && auditReport.inconsistencies.count > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-4">
            Assignment Inconsistencies Found
          </h3>
          <p className="text-yellow-700 mb-4">
            {auditReport.inconsistencies.count} inconsistencies detected. 
            Click the button below to automatically fix assignment-related issues.
          </p>
          <button
            onClick={fixAssignmentInconsistencies}
            disabled={loading}
            className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50"
          >
            {loading ? 'Fixing...' : 'Fix Assignment Issues'}
          </button>
        </div>
      )}

      {/* Audit Report */}
      {auditReport && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Audit Report</h3>
          
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-lg font-semibold text-blue-600">
                {auditReport.summary.totalCollections}
              </div>
              <div className="text-sm text-gray-600">Collections</div>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <div className="text-lg font-semibold text-green-600">
                {auditReport.summary.totalItems}
              </div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
            <div className="bg-red-50 p-4 rounded">
              <div className="text-lg font-semibold text-red-600">
                {auditReport.summary.inconsistencies}
              </div>
              <div className="text-sm text-gray-600">Inconsistencies</div>
            </div>
            <div className="bg-purple-50 p-4 rounded">
              <div className="text-lg font-semibold text-purple-600">
                {new Date(auditReport.timestamp).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Generated</div>
            </div>
          </div>

          {/* Collection Details */}
          <div className="space-y-4">
            {Object.entries(auditReport.collections).map(([name, report]) => (
              <div key={name} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold capitalize">{name}</h4>
                  <div className="text-sm text-gray-500">
                    {report.validItems}/{report.count} valid
                  </div>
                </div>
                
                {report.errors.length > 0 && (
                  <div className="bg-red-50 p-3 rounded">
                    <div className="text-sm font-medium text-red-800 mb-2">
                      {report.errors.length} errors found:
                    </div>
                    <div className="space-y-1">
                      {report.errors.slice(0, 3).map((error, index) => (
                        <div key={index} className="text-xs text-red-700">
                          • {error.itemId}: {error.errors.join(', ')}
                        </div>
                      ))}
                      {report.errors.length > 3 && (
                        <div className="text-xs text-red-700">
                          ... and {report.errors.length - 3} more errors
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Inconsistencies */}
          {auditReport.inconsistencies.inconsistencies.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold text-red-800 mb-3">Data Inconsistencies</h4>
              <div className="space-y-2">
                {auditReport.inconsistencies.inconsistencies.map((inconsistency, index) => (
                  <div key={index} className="bg-red-50 p-3 rounded border border-red-200">
                    <div className="text-sm font-medium text-red-800">
                      {inconsistency.type.replace('_', ' ').toUpperCase()}
                    </div>
                    <div className="text-xs text-red-700">
                      {inconsistency.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-center">Processing...</p>
          </div>
        </div>
      )}
    </div>
  );
}
