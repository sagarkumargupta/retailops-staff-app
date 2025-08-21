import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { filterAssignedItems } from '../utils/assignmentUtils';

const MyTests = () => {
  const { profile } = useUserProfile();
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, completed, passed, failed

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTests(),
        loadResults()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTests = async () => {
    try {
      if (!profile?.email) {
        console.log('Profile not loaded yet, skipping tests load');
        return;
      }
      
      let q;
      if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN') {
        q = query(collection(db, 'tests'), orderBy('createdAt', 'desc'));
      } else {
        // For staff and managers, load tests based on their assignment
        q = query(collection(db, 'tests'), orderBy('createdAt', 'desc'));
      }

      const snapshot = await getDocs(q);
      let testsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter tests based on user assignment using unified utility
      if (profile?.role !== 'SUPER_ADMIN' && profile?.role !== 'ADMIN') {
        console.log('Filtering tests for user:', {
          role: profile?.role,
          email: profile?.email,
          assignedStore: profile?.assignedStore,
          totalTests: testsData.length
        });

        testsData = filterAssignedItems(testsData, profile);
        console.log('Filtered tests count:', testsData.length);
      }

      setTests(testsData);
    } catch (error) {
      console.error('Error loading tests with orderBy:', error);
      
      // Enhanced fallback: handle both index errors and other errors
      try {
        console.log('Falling back to client-side sorting for tests');
        const q = query(collection(db, 'tests'));
        
        const snapshot = await getDocs(q);
        let testsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter tests based on user assignment using unified utility
        if (profile?.role !== 'SUPER_ADMIN' && profile?.role !== 'ADMIN') {
          testsData = filterAssignedItems(testsData, profile);
        }
        
        // Sort client-side
        testsData = testsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB - dateA;
        });
        
        setTests(testsData);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        setTests([]);
      }
    }
  };

  const loadResults = async () => {
    try {
      // Check if profile and email exist before making the query
      if (!profile?.email) {
        console.log('Profile or email not available, skipping results load');
        setResults([]);
        return;
      }

      // Try the full query first (with orderBy)
      const q = query(
        collection(db, 'test_results'),
        where('userId', '==', profile.email),
        orderBy('completedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const resultsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setResults(resultsData);
    } catch (error) {
      console.error('Error loading results with orderBy:', error);
      
      // If index error, try without orderBy and sort client-side
      if (error.message.includes('requires an index')) {
        try {
          console.log('Falling back to client-side sorting for test results');
          const q = query(
            collection(db, 'test_results'),
            where('userId', '==', profile.email)
          );
          
          const snapshot = await getDocs(q);
          let resultsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Sort client-side
          resultsData = resultsData.sort((a, b) => {
            const dateA = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt);
            const dateB = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt);
            return dateB - dateA;
          });
          
          setResults(resultsData);
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
          setResults([]);
        }
      } else {
        console.error('Non-index error:', error);
        setResults([]);
      }
    }
  };

  const getTestStatus = (test) => {
    const result = results.find(r => r.testId === test.id);
    if (!result) return 'pending';
    return result.passed ? 'passed' : 'failed';
  };

  const getTestResult = (test) => {
    return results.find(r => r.testId === test.id);
  };

  const getFilteredTests = () => {
    return tests.filter(test => {
      const status = getTestStatus(test);
      switch (filter) {
        case 'pending':
          return status === 'pending';
        case 'completed':
          return status === 'passed' || status === 'failed';
        case 'passed':
          return status === 'passed';
        case 'failed':
          return status === 'failed';
        default:
          return true;
      }
    });
  };

  const getTestStats = () => {
    const total = tests.length;
    const completed = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const pending = total - completed;
    const passRate = completed > 0 ? Math.round((passed / completed) * 100) : 0;

    return { total, completed, passed, failed, pending, passRate };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your tests...</p>
        </div>
      </div>
    );
  }

  const stats = getTestStats();
  const filteredTests = getFilteredTests();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Tests</h1>
          <p className="mt-2 text-gray-600">
            View and take your assigned tests
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Tests</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Passed</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.passed}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Failed</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.failed}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pass Rate</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.passRate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'all', label: 'All Tests', count: stats.total },
                { key: 'pending', label: 'Pending', count: stats.pending },
                { key: 'completed', label: 'Completed', count: stats.completed },
                { key: 'passed', label: 'Passed', count: stats.passed },
                { key: 'failed', label: 'Failed', count: stats.failed }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    filter === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tests List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Test Modules</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difficulty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Limit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTests.map((test) => {
                  const status = getTestStatus(test);
                  const result = getTestResult(test);
                  
                  return (
                    <tr key={test.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{test.title}</div>
                          <div className="text-sm text-gray-500">{test.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          test.category === 'sales' ? 'bg-blue-100 text-blue-800' :
                          test.category === 'product' ? 'bg-green-100 text-green-800' :
                          test.category === 'customer' ? 'bg-purple-100 text-purple-800' :
                          test.category === 'store' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {test.category === 'sales' ? 'Sales & Calculations' :
                           test.category === 'product' ? 'Product Knowledge' :
                           test.category === 'customer' ? 'Customer Experience' :
                           test.category === 'store' ? 'Store Operations' :
                           'General Knowledge'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          test.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                          test.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {test.difficulty === 'easy' ? 'Easy' :
                           test.difficulty === 'medium' ? 'Medium' : 'Hard'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {test.timeLimit || 30} min
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          status === 'passed' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {status === 'pending' ? 'Pending' :
                           status === 'passed' ? 'Passed' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result ? `${result.score}/${result.totalPoints} (${result.percentage}%)` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {status === 'pending' ? (
                          <Link
                            to={`/test-execution/${test.id}`}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Take Test
                          </Link>
                        ) : (
                          <div className="flex space-x-2">
                            <Link
                              to={`/test-execution/${test.id}`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Retake
                            </Link>
                            <span className="text-gray-400">|</span>
                            <span className="text-gray-500">
                              {result?.completedAt ? new Date(result.completedAt.toDate()).toLocaleDateString() : '-'}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredTests.length === 0 && (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No tests found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filter === 'all' ? 'You have no assigned tests.' : `No ${filter} tests found.`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Test History */}
        {results.length > 0 && (
          <div className="mt-8">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Test History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Taken</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.slice(0, 10).map((result) => (
                      <tr key={result.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{result.testTitle}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {result.score}/{result.totalPoints} ({result.percentage}%)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            result.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {result.passed ? 'Passed' : 'Failed'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {Math.floor(result.timeTaken / 60)}:{(result.timeTaken % 60).toString().padStart(2, '0')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {result.completedAt ? new Date(result.completedAt.toDate()).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTests;
