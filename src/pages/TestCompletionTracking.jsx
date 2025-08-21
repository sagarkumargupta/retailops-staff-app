import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function TestCompletionTracking() {
  const { profile, getStoresForFiltering } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [tests, setTests] = useState([]);
  const [staff, setStaff] = useState([]);
  const [testResponses, setTestResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState('');

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStores(),
        loadTests(),
        loadStaff()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStores = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'stores'));
      let storesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter stores based on user role
      const userStores = getStoresForFiltering();
      if (userStores.length > 0) {
        storesData = storesData.filter(store => userStores.includes(store.id));
      }

      setStores(storesData);
      if (storesData.length > 0 && !selectedStore) {
        setSelectedStore(storesData[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      setStores([]);
    }
  };

  const loadTests = async () => {
    try {
      const testsSnap = await getDocs(collection(db, 'tests'));
      let testsList = testsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter tests based on user role
      if (profile?.role === 'MANAGER') {
        testsList = testsList.filter(test => 
          test.createdBy === profile.email || 
          (test.assignees && test.assignees.includes(profile.email))
        );
      }

      setTests(testsList);
    } catch (error) {
      console.error('Error loading tests:', error);
      setTests([]);
    }
  };

  const loadStaff = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      let staffData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.role === 'STAFF' && user.assignedStore === selectedStore);

      setStaff(staffData);
    } catch (error) {
      console.error('Error loading staff:', error);
      setStaff([]);
    }
  };

  const loadTestResponses = async () => {
    if (!selectedTest) {
      setTestResponses([]);
      return;
    }

    try {
      // Load from test_results collection (where TestExecution saves responses)
      const responsesSnap = await getDocs(collection(db, 'test_results'));
      let responses = responsesSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(response => response.testId === selectedTest);

      // Also try alternative collection names for backward compatibility
      if (responses.length === 0) {
        const altResponsesSnap = await getDocs(collection(db, 'testResponses'));
        responses = altResponsesSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(response => response.testId === selectedTest);
      }

      if (responses.length === 0) {
        const altResponsesSnap2 = await getDocs(collection(db, 'test_responses'));
        responses = altResponsesSnap2.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(response => response.testId === selectedTest);
      }

      console.log('Loaded test responses:', responses);
      setTestResponses(responses);
    } catch (error) {
      console.error('Error loading test responses:', error);
      setTestResponses([]);
    }
  };

  useEffect(() => {
    if (selectedStore) {
      loadStaff();
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedTest) {
      loadTestResponses();
    }
  }, [selectedTest]);

  const getAssignedStaffForTest = (test) => {
    if (!test) return [];

    if (test.targetAudience === 'all_staff') {
      return staff;
    } else if (test.targetAudience === 'location' && test.assignedStores) {
      return staff.filter(s => test.assignedStores.includes(s.assignedStore));
    } else if (test.targetAudience === 'individual' && test.assignees) {
      return staff.filter(s => test.assignees.includes(s.email));
    }

    return [];
  };

  const getTestCompletionStatus = (test) => {
    if (!test) return { completed: [], notCompleted: [] };

    const assignedStaff = getAssignedStaffForTest(test);
    const completedStaffEmails = testResponses
      .filter(response => response.testId === test.id)
      .map(response => response.userId || response.staffEmail); // Support both field names

    const completed = assignedStaff.filter(staff => 
      completedStaffEmails.includes(staff.email)
    );
    const notCompleted = assignedStaff.filter(staff => 
      !completedStaffEmails.includes(staff.email)
    );

    return { completed, notCompleted };
  };

  const getStaffByStore = (storeId) => {
    return staff.filter(s => s.assignedStore === storeId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading test completion tracking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Test Completion Tracking</h1>
          <p className="mt-2 text-gray-600">
            Track which staff have completed their assigned tests
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Store</label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a store</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.brand} — {store.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Test</label>
              <select
                value={selectedTest}
                onChange={(e) => setSelectedTest(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a test</option>
                {tests.map(test => (
                  <option key={test.id} value={test.id}>
                    {test.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Test Completion Overview */}
        {selectedTest && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Completion Overview</h2>
            {(() => {
              const test = tests.find(t => t.id === selectedTest);
              const { completed, notCompleted } = getTestCompletionStatus(test);
              const totalAssigned = completed.length + notCompleted.length;
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-green-600">Completed</p>
                        <p className="text-2xl font-semibold text-green-900">{completed.length}</p>
                        <p className="text-xs text-green-500">of {totalAssigned} assigned</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-red-600">Not Completed</p>
                        <p className="text-2xl font-semibold text-red-900">{notCompleted.length}</p>
                        <p className="text-xs text-red-500">need to be reminded</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-blue-600">Completion Rate</p>
                        <p className="text-2xl font-semibold text-blue-900">
                          {totalAssigned > 0 ? Math.round((completed.length / totalAssigned) * 100) : 0}%
                        </p>
                        <p className="text-xs text-blue-500">overall progress</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Staff Completion Details */}
        {selectedTest && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Staff Completion Details</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    const test = tests.find(t => t.id === selectedTest);
                    const { completed, notCompleted } = getTestCompletionStatus(test);
                    const allStaff = [...completed, ...notCompleted];

                                         return allStaff.map((staffMember) => {
                       const response = testResponses.find(r => 
                         r.testId === selectedTest && (r.userId === staffMember.email || r.staffEmail === staffMember.email)
                       );
                       const hasCompleted = response !== undefined;

                      return (
                        <tr key={staffMember.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-sm font-medium text-gray-700">
                                    {staffMember.name?.charAt(0)?.toUpperCase() || 'S'}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {staffMember.name || staffMember.displayName || 'Unknown'}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {staffMember.role || 'Staff'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {staffMember.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              hasCompleted 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {hasCompleted ? 'Completed' : 'Not Completed'}
                            </span>
                          </td>
                                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                             {hasCompleted && response?.completedAt 
                               ? new Date(response.completedAt.toDate()).toLocaleDateString()
                               : '—'
                             }
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                             {hasCompleted && response?.percentage 
                               ? `${response.percentage}%`
                               : hasCompleted && response?.score 
                               ? `${response.score}%`
                               : '—'
                             }
                           </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {!hasCompleted && (
                              <button className="text-blue-600 hover:text-blue-900">
                                Send Reminder
                              </button>
                            )}
                            {hasCompleted && (
                              <button className="text-green-600 hover:text-green-900">
                                View Details
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
              {(() => {
                const test = tests.find(t => t.id === selectedTest);
                const { completed, notCompleted } = getTestCompletionStatus(test);
                const allStaff = [...completed, ...notCompleted];
                
                if (allStaff.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No staff assigned</h3>
                      <p className="mt-1 text-sm text-gray-500">This test has no staff assigned to it.</p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        )}

        {/* All Tests Overview */}
        {!selectedTest && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">All Tests Overview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Staff</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tests.map((test) => {
                    const { completed, notCompleted } = getTestCompletionStatus(test);
                    const totalAssigned = completed.length + notCompleted.length;
                    const completionRate = totalAssigned > 0 ? Math.round((completed.length / totalAssigned) * 100) : 0;

                    return (
                      <tr key={test.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{test.title}</div>
                            <div className="text-sm text-gray-500">{test.description}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {totalAssigned}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="text-green-600 font-medium">{completed.length}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="text-red-600 font-medium">{notCompleted.length}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${completionRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-900">{completionRate}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => setSelectedTest(test.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {tests.length === 0 && (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No tests found</h3>
                  <p className="mt-1 text-sm text-gray-500">Create some tests to start tracking completion.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
