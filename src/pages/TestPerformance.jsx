import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

const TestPerformance = () => {
  const { profile } = useUserProfile();
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30'); // 7, 30, 90 days
  const [selectedTest, setSelectedTest] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState('all');

  useEffect(() => {
    loadData();
  }, [profile, selectedPeriod, selectedTest, selectedStaff]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTests(),
        loadResults(),
        loadStaff()
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
        console.log('Profile or email not available, skipping tests load');
        setTests([]);
        return;
      }

      // Load all tests and filter on client side
      const testsSnap = await getDocs(collection(db, 'tests'));
      let testsData = testsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Loaded tests:', {
        totalTests: testsData.length,
        sampleTest: testsData[0],
        userRole: profile.role,
        userEmail: profile.email
      });
      
      // Filter based on user role
      if (profile.role === 'STAFF') {
        console.log('Filtering tests for STAFF role - showing assigned tests');
        const beforeStaffFilter = testsData.length;
        testsData = testsData.filter(test => 
          test.assignees && test.assignees.includes(profile.email) ||
          test.targetAudience === 'all_staff' ||
          (test.targetAudience === 'location' && test.assignedStores && 
           test.assignedStores.includes(profile.assignedStore))
        );
        console.log('After staff filter:', {
          before: beforeStaffFilter,
          after: testsData.length,
          removed: beforeStaffFilter - testsData.length
        });
      } else if (profile.role === 'MANAGER') {
        console.log('Filtering tests for MANAGER role');
        const beforeManagerFilter = testsData.length;
        testsData = testsData.filter(test => 
          test.createdBy === profile.email || 
          (test.assignees && test.assignees.includes(profile.email)) ||
          test.targetAudience === 'all_managers' ||
          (test.targetAudience === 'location' && test.assignedStores && 
           test.assignedStores.some(storeId => 
             profile.stores && profile.stores[storeId] === true ||
             profile.assignedStore === storeId
           ))
        );
        console.log('After manager filter:', {
          before: beforeManagerFilter,
          after: testsData.length,
          removed: beforeManagerFilter - testsData.length,
          createdByUser: testsData.filter(t => t.createdBy === profile.email).length,
          assignedToUser: testsData.filter(t => t.assignees && t.assignees.includes(profile.email)).length
        });
      }
      // For admins, show all tests (no filtering needed)
      
      // Sort by creation date (newest first)
      testsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      setTests(testsData);
    } catch (error) {
      console.error('Error loading tests:', error);
      setTests([]);
    }
  };

  const loadResults = async () => {
    try {
      console.log('Starting to load test results...');
      console.log('Current profile:', {
        email: profile?.email,
        role: profile?.role,
        stores: profile?.stores,
        assignedStore: profile?.assignedStore
      });

      const q = query(
        collection(db, 'test_results'),
        orderBy('completedAt', 'desc')
      );
      
      console.log('Executing query for test_results collection...');
      const snapshot = await getDocs(q);
      console.log('Query completed, got snapshot with size:', snapshot.size);
      
      let resultsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Loaded test results:', {
        totalResults: resultsData.length,
        sampleResult: resultsData[0],
        passedResults: resultsData.filter(r => r.passed).length,
        failedResults: resultsData.filter(r => !r.passed).length,
        allResults: resultsData.map(r => ({
          id: r.id,
          userId: r.userId,
          testId: r.testId,
          passed: r.passed,
          completedAt: r.completedAt,
          storeId: r.storeId
        }))
      });

      // Filter results based on user role
      if (profile?.role === 'STAFF') {
        console.log('Filtering for STAFF role - showing only own results');
        const beforeStaffFilter = resultsData.length;
        resultsData = resultsData.filter(result => result.userId === profile.email);
        console.log('After staff filter:', {
          before: beforeStaffFilter,
          after: resultsData.length,
          removed: beforeStaffFilter - resultsData.length
        });
      } else if (profile?.role === 'MANAGER') {
        console.log('Filtering for MANAGER role...');
        const managerStoreIds = profile.stores && typeof profile.stores === 'object' 
          ? Object.keys(profile.stores).filter(key => profile.stores[key] === true)
          : [];
        
        // Also include manager's assigned store
        if (profile.assignedStore && !managerStoreIds.includes(profile.assignedStore)) {
          managerStoreIds.push(profile.assignedStore);
        }
        
        console.log('Manager store IDs:', managerStoreIds);
        
        // Filter by staff assigned to manager's stores
        const managerStaff = staff.filter(user => 
          user.stores && Object.keys(user.stores).some(storeId => 
            managerStoreIds.includes(storeId) && user.stores[storeId] === true
          ) || user.assignedStore && managerStoreIds.includes(user.assignedStore)
        );
        
        console.log('Manager staff:', managerStaff.map(s => ({ email: s.email, stores: s.stores, assignedStore: s.assignedStore })));
        
        const beforeManagerFilter = resultsData.length;
        resultsData = resultsData.filter(result => 
          managerStaff.some(staff => staff.email === result.userId) ||
          (result.storeId && managerStoreIds.includes(result.storeId))
        );
        console.log('After manager filter:', {
          before: beforeManagerFilter,
          after: resultsData.length,
          removed: beforeManagerFilter - resultsData.length
        });
      }
      // For ADMIN, OWNER, SUPER_ADMIN - show all results (no filtering)

      if (selectedTest !== 'all') {
        console.log('Filtering for specific test:', selectedTest);
        const beforeTestFilter = resultsData.length;
        resultsData = resultsData.filter(result => result.testId === selectedTest);
        console.log('After test filter:', {
          before: beforeTestFilter,
          after: resultsData.length,
          removed: beforeTestFilter - resultsData.length
        });
      }

      // Filter by selected staff member
      if (selectedStaff !== 'all') {
        console.log('Filtering for specific staff:', selectedStaff);
        const beforeStaffFilter = resultsData.length;
        resultsData = resultsData.filter(result => result.userId === selectedStaff);
        console.log('After staff filter:', {
          before: beforeStaffFilter,
          after: resultsData.length,
          removed: beforeStaffFilter - resultsData.length
        });
      }

      // Filter by date range
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(selectedPeriod));
      console.log('Filtering by date range:', {
        selectedPeriod,
        daysAgo: daysAgo.toISOString(),
        currentDate: new Date().toISOString()
      });
      
      const beforeDateFilter = resultsData.length;
      resultsData = resultsData.filter(result => 
        result.completedAt && result.completedAt.toDate() >= daysAgo
      );
      console.log('After date filter:', {
        before: beforeDateFilter,
        after: resultsData.length,
        removed: beforeDateFilter - resultsData.length
      });

      console.log('Final filtered test results:', {
        afterFiltering: resultsData.length,
        periodDays: selectedPeriod,
        selectedTest: selectedTest,
        dateFilter: daysAgo.toISOString()
      });

      setResults(resultsData);
    } catch (error) {
      console.error('Error loading results:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      setResults([]);
    }
  };

  const loadStaff = async () => {
    try {
      console.log('Loading staff data...');
      const snapshot = await getDocs(collection(db, 'users'));
      console.log('Staff snapshot size:', snapshot.size);
      
      let staffData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.role === 'STAFF' || user.role === 'MANAGER');

      console.log('Initial staff data:', {
        totalStaff: staffData.length,
        sampleStaff: staffData.slice(0, 3).map(s => ({
          email: s.email,
          role: s.role,
          stores: s.stores,
          assignedStore: s.assignedStore
        }))
      });

      // Filter staff based on user role
      if (profile?.role === 'STAFF') {
        console.log('Filtering staff for STAFF role - showing only self');
        const beforeStaffFilter = staffData.length;
        staffData = staffData.filter(user => user.email === profile.email);
        console.log('After staff filter:', {
          before: beforeStaffFilter,
          after: staffData.length,
          removed: beforeStaffFilter - staffData.length
        });
      } else if (profile?.role === 'MANAGER') {
        console.log('Filtering staff for MANAGER role...');
        const managerStoreIds = profile.stores && typeof profile.stores === 'object' 
          ? Object.keys(profile.stores).filter(key => profile.stores[key] === true)
          : [];
        
        // Also include manager's assigned store
        if (profile.assignedStore && !managerStoreIds.includes(profile.assignedStore)) {
          managerStoreIds.push(profile.assignedStore);
        }
        
        console.log('Manager store IDs for staff filtering:', managerStoreIds);
        
        const beforeStaffFilter = staffData.length;
        staffData = staffData.filter(user => 
          user.stores && Object.keys(user.stores).some(storeId => 
            managerStoreIds.includes(storeId) && user.stores[storeId] === true
          ) || user.assignedStore && managerStoreIds.includes(user.assignedStore)
        );
        
        console.log('After staff filtering:', {
          before: beforeStaffFilter,
          after: staffData.length,
          removed: beforeStaffFilter - staffData.length,
          filteredStaff: staffData.map(s => ({
            email: s.email,
            role: s.role,
            stores: s.stores,
            assignedStore: s.assignedStore
          }))
        });
      }
      // For ADMIN, OWNER, SUPER_ADMIN - show all staff (no filtering)

      setStaff(staffData);
    } catch (error) {
      console.error('Error loading staff:', error);
      console.error('Staff loading error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      setStaff([]);
    }
  };

  const getPerformanceMetrics = () => {
    let filteredCompletions = results;
    let filteredTests = tests;

    // Filter by selected test
    if (selectedTest !== 'all') {
      console.log('Filtering test metrics for specific test:', selectedTest);
      const beforeTestFilter = filteredCompletions.length;
      filteredCompletions = filteredCompletions.filter(completion => completion.testId === selectedTest);
      console.log('After test filter in metrics:', {
        before: beforeTestFilter,
        after: filteredCompletions.length,
        removed: beforeTestFilter - filteredCompletions.length
      });
    }

    // Filter by selected staff member
    if (selectedStaff !== 'all') {
      console.log('Filtering training metrics for specific staff:', selectedStaff);
      const beforeStaffFilter = filteredCompletions.length;
      filteredCompletions = filteredCompletions.filter(completion => completion.userId === selectedStaff);
      console.log('After staff filter in metrics:', {
        before: beforeStaffFilter,
        after: filteredCompletions.length,
        removed: beforeStaffFilter - filteredCompletions.length
      });
    }

    // Calculate total assignments (not just attempts)
    const totalAssignments = filteredTests.reduce((sum, test) => {
      return sum + (test.assignees?.length || 0);
    }, 0);

    const totalAttempts = filteredCompletions.length;
    const passedAttempts = filteredCompletions.filter(c => c.passed).length;
    const failedAttempts = totalAttempts - passedAttempts;
    const passRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;
    const avgScore = totalAttempts > 0 ? Math.round(filteredCompletions.reduce((sum, c) => sum + (c.percentage || 0), 0) / totalAttempts) : 0;
    const avgTime = totalAttempts > 0 ? Math.round(filteredCompletions.reduce((sum, c) => sum + (c.timeTaken || 0), 0) / totalAttempts / 60) : 0;

    console.log('Test Performance Metrics:', {
      totalAssignments,
      totalAttempts,
      passedAttempts,
      failedAttempts,
      passRate,
      avgScore,
      avgTime,
      selectedStaff,
      sampleCompletions: filteredCompletions.slice(0, 3).map(c => ({
        id: c.id,
        userId: c.userId,
        testId: c.testId,
        passed: c.passed,
        percentage: c.percentage,
        timeTaken: c.timeTaken,
        completedAt: c.completedAt
      }))
    });

    return {
      totalAssignments,
      totalAttempts,
      passedAttempts,
      failedAttempts,
      passRate,
      avgScore,
      avgTime
    };
  };

  const getStaffPerformance = () => {
    const staffMap = {};
    
    results.forEach(result => {
      if (!staffMap[result.userId]) {
        staffMap[result.userId] = {
          name: result.userName || 'Unknown User',
          role: result.userRole || 'Unknown',
          attempts: 0,
          passed: 0,
          totalScore: 0,
          avgTime: 0
        };
      }
      
      staffMap[result.userId].attempts++;
      if (result.passed) staffMap[result.userId].passed++;
      staffMap[result.userId].totalScore += (result.percentage || 0);
      staffMap[result.userId].avgTime += (result.timeTaken || 0);
    });

    const staffPerformance = Object.values(staffMap).map(staff => ({
      ...staff,
      passRate: staff.attempts > 0 ? Math.round((staff.passed / staff.attempts) * 100) : 0,
      avgScore: staff.attempts > 0 ? Math.round(staff.totalScore / staff.attempts) : 0,
      avgTime: staff.attempts > 0 ? Math.round(staff.avgTime / staff.attempts / 60) : 0
    }));

    console.log('Staff Performance:', {
      totalStaff: staffPerformance.length,
      sampleStaff: staffPerformance.slice(0, 3)
    });

    return staffPerformance;
  };

  const getTestTrendData = () => {
    const trendMap = {};
    
    results.forEach(result => {
      const date = result.completedAt ? result.completedAt.toDate().toLocaleDateString() : 'Unknown';
      if (!trendMap[date]) {
        trendMap[date] = { date, attempts: 0, passed: 0, avgScore: 0, totalScore: 0 };
      }
      
      trendMap[date].attempts++;
      if (result.passed) trendMap[date].passed++;
      trendMap[date].totalScore += (result.percentage || 0);
    });

    const trendData = Object.values(trendMap)
      .map(item => ({
        ...item,
        passRate: item.attempts > 0 ? Math.round((item.passed / item.attempts) * 100) : 0,
        avgScore: item.attempts > 0 ? Math.round(item.totalScore / item.attempts) : 0
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log('Test Trend Data:', {
      totalDays: trendData.length,
      sampleTrend: trendData.slice(0, 3)
    });

    return trendData;
  };

  const getCategoryDistribution = () => {
    const categoryMap = {};
    
    results.forEach(result => {
      const test = tests.find(t => t.id === result.testId);
      if (test) {
        const category = test.category;
        if (!categoryMap[category]) {
          categoryMap[category] = { category, attempts: 0, passed: 0 };
        }
        
        categoryMap[category].attempts++;
        if (result.passed) categoryMap[category].passed++;
      }
    });

    return Object.values(categoryMap).map(item => ({
      ...item,
      passRate: item.attempts > 0 ? Math.round((item.passed / item.attempts) * 100) : 0
    }));
  };

  const getDifficultyDistribution = () => {
    const difficultyMap = {};
    
    results.forEach(result => {
      const test = tests.find(t => t.id === result.testId);
      if (test) {
        const difficulty = test.difficulty;
        if (!difficultyMap[difficulty]) {
          difficultyMap[difficulty] = { difficulty, attempts: 0, passed: 0 };
        }
        
        difficultyMap[difficulty].attempts++;
        if (result.passed) difficultyMap[difficulty].passed++;
      }
    });

    return Object.values(difficultyMap).map(item => ({
      ...item,
      passRate: item.attempts > 0 ? Math.round((item.passed / item.attempts) * 100) : 0
    }));
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading test performance...</p>
        </div>
      </div>
    );
  }

  const metrics = getPerformanceMetrics();
  const staffPerformance = getStaffPerformance();
  const trendData = getTestTrendData();
  const categoryData = getCategoryDistribution();
  const difficultyData = getDifficultyDistribution();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Test Performance</h1>
          <p className="mt-2 text-gray-600">
            Monitor test performance and analytics
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Test Filter</label>
              <select
                value={selectedTest}
                onChange={(e) => setSelectedTest(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Tests</option>
                {tests.map(test => (
                  <option key={test.id} value={test.id}>{test.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Staff Filter</label>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Staff</option>
                {staff.map(staffMember => (
                  <option key={staffMember.email} value={staffMember.email}>
                    {staffMember.name || staffMember.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Assignments</p>
                <p className="text-2xl font-semibold text-gray-900">{metrics.totalAssignments}</p>
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
                <p className="text-sm font-medium text-gray-500">Total Attempts</p>
                <p className="text-2xl font-semibold text-gray-900">{metrics.totalAttempts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Passed</p>
                <p className="text-2xl font-semibold text-gray-900">{metrics.passedAttempts}</p>
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
                <p className="text-2xl font-semibold text-gray-900">{metrics.failedAttempts}</p>
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
                <p className="text-2xl font-semibold text-gray-900">{metrics.passRate}%</p>
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
                <p className="text-sm font-medium text-gray-500">Avg Score</p>
                <p className="text-2xl font-semibold text-gray-900">{metrics.avgScore}%</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Time</p>
                <p className="text-2xl font-semibold text-gray-900">{metrics.avgTime}m</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Test Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Performance Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="attempts" stroke="#8884d8" name="Attempts" />
                <Line type="monotone" dataKey="passRate" stroke="#82ca9d" name="Pass Rate %" />
                <Line type="monotone" dataKey="avgScore" stroke="#ffc658" name="Avg Score %" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Category Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="attempts" fill="#8884d8" name="Attempts" />
                <Bar dataKey="passRate" fill="#82ca9d" name="Pass Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Difficulty Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Difficulty</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={difficultyData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ difficulty, passRate }) => `${difficulty}: ${passRate}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="attempts"
                >
                  {difficultyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Staff Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Staff Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={staffPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="passRate" fill="#82ca9d" name="Pass Rate %" />
                <Bar dataKey="avgScore" fill="#ffc658" name="Avg Score %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Staff Performance Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Detailed Staff Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attempts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pass Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staffPerformance.map((staff, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        staff.role === 'MANAGER' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {staff.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.attempts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.passed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        staff.passRate >= 80 ? 'bg-green-100 text-green-800' :
                        staff.passRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {staff.passRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.avgScore}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.avgTime}m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {staffPerformance.length === 0 && (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No performance data</h3>
                <p className="mt-1 text-sm text-gray-500">No test results found for the selected criteria.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPerformance;
