import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

export default function TrainingPerformance() {
  const { profile } = useUserProfile();
  const [trainings, setTrainings] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // week, month, quarter, year
  const [selectedTraining, setSelectedTraining] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState('all');

  useEffect(() => {
    loadData();
  }, [profile?.role, profile?.stores, selectedPeriod, selectedTraining, selectedStaff]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('Loading training performance data...');
      console.log('Current profile:', {
        email: profile?.email,
        role: profile?.role,
        stores: profile?.stores,
        assignedStore: profile?.assignedStore
      });

      // Load staff from users collection
      const staffSnap = await getDocs(collection(db, 'users'));
      let staffData = staffSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.role === 'STAFF' || user.role === 'MANAGER');

      console.log('Loaded staff data:', {
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

      // Load trainings
      const trainingsSnap = await getDocs(collection(db, 'trainings'));
      let trainingsList = trainingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log('Loaded trainings:', {
        totalTrainings: trainingsList.length,
        sampleTraining: trainingsList[0],
        userRole: profile?.role,
        userEmail: profile?.email
      });
      
      // Filter trainings based on user role
      if (profile?.role === 'STAFF') {
        console.log('Filtering trainings for STAFF role - showing assigned trainings');
        const beforeStaffFilter = trainingsList.length;
        trainingsList = trainingsList.filter(training => 
          training.assignees && training.assignees.includes(profile.email) ||
          training.targetAudience === 'all_staff' ||
          (training.targetAudience === 'location' && training.assignedStores && 
           training.assignedStores.includes(profile.assignedStore))
        );
        console.log('After staff filter:', {
          before: beforeStaffFilter,
          after: trainingsList.length,
          removed: beforeStaffFilter - trainingsList.length
        });
      } else if (profile?.role === 'MANAGER') {
        console.log('Filtering trainings for MANAGER role');
        const beforeManagerFilter = trainingsList.length;
        trainingsList = trainingsList.filter(training => 
          training.createdBy === profile.email || 
          (training.assignees && training.assignees.includes(profile.email)) ||
          training.targetAudience === 'all_managers' ||
          (training.targetAudience === 'location' && training.assignedStores && 
           training.assignedStores.some(storeId => 
             profile.stores && profile.stores[storeId] === true ||
             profile.assignedStore === storeId
           ))
        );
        console.log('After manager filter:', {
          before: beforeManagerFilter,
          after: trainingsList.length,
          removed: beforeManagerFilter - trainingsList.length,
          createdByUser: trainingsList.filter(t => t.createdBy === profile.email).length,
          assignedToUser: trainingsList.filter(t => t.assignees && t.assignees.includes(profile.email)).length
        });
      }
      // For admins, show all trainings (no filtering needed)
      
      // Sort by creation date (newest first)
      trainingsList.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      setTrainings(trainingsList);

      // Load completions
      const completionsQuery = query(
        collection(db, 'training_completions'),
        orderBy('completedAt', 'desc')
      );
      const completionsSnap = await getDocs(completionsQuery);
      let completionsList = completionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      console.log('Loaded training completions:', {
        totalCompletions: completionsList.length,
        sampleCompletion: completionsList[0],
        passedCompletions: completionsList.filter(c => c.passed).length,
        failedCompletions: completionsList.filter(c => !c.passed).length
      });

      // Filter completions based on user role
      if (profile?.role === 'STAFF') {
        console.log('Filtering completions for STAFF role - showing only own completions');
        const beforeStaffFilter = completionsList.length;
        completionsList = completionsList.filter(completion => completion.userId === profile.email);
        console.log('After staff filter:', {
          before: beforeStaffFilter,
          after: completionsList.length,
          removed: beforeStaffFilter - completionsList.length
        });
      } else if (profile?.role === 'MANAGER') {
        console.log('Filtering completions for MANAGER role...');
        const managerStoreIds = profile.stores && typeof profile.stores === 'object' 
          ? Object.keys(profile.stores).filter(key => profile.stores[key] === true)
          : [];
        
        // Also include manager's assigned store
        if (profile.assignedStore && !managerStoreIds.includes(profile.assignedStore)) {
          managerStoreIds.push(profile.assignedStore);
        }
        
        console.log('Manager store IDs for completions filtering:', managerStoreIds);
        
        const beforeManagerFilter = completionsList.length;
        completionsList = completionsList.filter(completion => 
          staffData.some(staff => staff.email === completion.userId) ||
          (completion.storeId && managerStoreIds.includes(completion.storeId))
        );
        console.log('After manager filter:', {
          before: beforeManagerFilter,
          after: completionsList.length,
          removed: beforeManagerFilter - completionsList.length
        });
      }
      // For ADMIN, OWNER, SUPER_ADMIN - show all completions (no filtering)

      setCompletions(completionsList);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodStart = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        return new Date(now.getFullYear(), quarter * 3, 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  };

  const filterDataByPeriod = (data) => {
    const periodStart = getPeriodStart();
    return data.filter(item => {
      const itemDate = item.completedAt?.toDate ? item.completedAt.toDate() : new Date(item.completedAt);
      return itemDate >= periodStart;
    });
  };

  const getPerformanceMetrics = () => {
    let filteredCompletions = filterDataByPeriod(completions);
    let filteredTrainings = selectedTraining === 'all' 
      ? trainings 
      : trainings.filter(t => t.id === selectedTraining);

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

    const totalAssignments = filteredTrainings.reduce((sum, training) => {
      return sum + (training.assignees?.length || 0);
    }, 0);

    const completedCount = filteredCompletions.filter(c => c.status === 'completed').length;
    const failedCount = filteredCompletions.filter(c => c.status === 'failed').length;
    const pendingCount = totalAssignments - completedCount - failedCount;

    const completionRate = totalAssignments > 0 ? (completedCount / totalAssignments) * 100 : 0;
    const averageScore = filteredCompletions.length > 0 
      ? filteredCompletions.reduce((sum, c) => sum + (c.quizResults?.score || 0), 0) / filteredCompletions.length
      : 0;

    console.log('Training Performance Metrics:', {
      totalAssignments,
      completedCount,
      failedCount,
      pendingCount,
      completionRate: Math.round(completionRate),
      averageScore: Math.round(averageScore),
      selectedStaff,
      sampleCompletions: filteredCompletions.slice(0, 3).map(c => ({
        id: c.id,
        userId: c.userId,
        status: c.status,
        quizResults: c.quizResults,
        completedAt: c.completedAt
      }))
    });

    return {
      totalAssignments,
      completedCount,
      failedCount,
      pendingCount,
      completionRate: Math.round(completionRate),
      averageScore: Math.round(averageScore)
    };
  };

  const getStaffPerformance = () => {
    const filteredCompletions = filterDataByPeriod(completions);
    const filteredTrainings = selectedTraining === 'all' 
      ? trainings 
      : trainings.filter(t => t.id === selectedTraining);

    return staff.map(staffMember => {
      const staffCompletions = filteredCompletions.filter(c => c.userId === staffMember.email);
      
      // Count assigned trainings for this staff member
      const assignedTrainings = filteredTrainings.filter(t => 
        t.assignees && t.assignees.includes(staffMember.email) ||
        t.targetAudience === 'all_staff' ||
        (t.targetAudience === 'all_managers' && staffMember.role === 'MANAGER') ||
        (t.targetAudience === 'location' && t.assignedStores && 
         t.assignedStores.some(storeId => 
           staffMember.stores && staffMember.stores[storeId] === true ||
           staffMember.assignedStore === storeId
         ))
      );

      const completedCount = staffCompletions.filter(c => c.status === 'completed').length;
      const totalAssigned = assignedTrainings.length;
      const completionRate = totalAssigned > 0 ? (completedCount / totalAssigned) * 100 : 0;
      const averageScore = staffCompletions.length > 0 
        ? staffCompletions.reduce((sum, c) => sum + (c.quizResults?.score || 0), 0) / staffCompletions.length
        : 0;

      return {
        id: staffMember.email,
        name: staffMember.name || staffMember.email,
        store: staffMember.assignedStore || 'Unknown',
        role: staffMember.role,
        totalAssigned,
        completedCount,
        completionRate: Math.round(completionRate),
        averageScore: Math.round(averageScore),
        lastCompleted: staffCompletions.length > 0 ? staffCompletions[0].completedAt : null
      };
    }).filter(s => s.totalAssigned > 0).sort((a, b) => b.completionRate - a.completionRate);
  };

  const getTrainingTrendData = () => {
    const filteredCompletions = filterDataByPeriod(completions);
    const filteredTrainings = selectedTraining === 'all' 
      ? trainings 
      : trainings.filter(t => t.id === selectedTraining);

    // Group by date
    const grouped = {};
    filteredCompletions.forEach(completion => {
      const date = completion.completedAt?.toDate ? 
        completion.completedAt.toDate().toISOString().slice(0, 10) : 
        new Date(completion.completedAt).toISOString().slice(0, 10);
      
      if (!grouped[date]) {
        grouped[date] = { completed: 0, failed: 0 };
      }
      
      if (completion.status === 'completed') {
        grouped[date].completed++;
      } else {
        grouped[date].failed++;
      }
    });

    return Object.entries(grouped).map(([date, data]) => ({
      date,
      completed: data.completed,
      failed: data.failed,
      total: data.completed + data.failed
    })).sort((a, b) => a.date.localeCompare(b.date));
  };

  const getCategoryDistribution = () => {
    const filteredCompletions = filterDataByPeriod(completions);
    const filteredTrainings = selectedTraining === 'all' 
      ? trainings 
      : trainings.filter(t => t.id === selectedTraining);

    const categoryCounts = {};
    filteredCompletions.forEach(completion => {
      const training = filteredTrainings.find(t => t.id === completion.trainingId);
      if (training?.category) {
        categoryCounts[training.category] = (categoryCounts[training.category] || 0) + 1;
      }
    });

    return Object.entries(categoryCounts).map(([category, count]) => ({
      category: category.replace('_', ' ').toUpperCase(),
      count
    }));
  };

  const getDifficultyDistribution = () => {
    const filteredCompletions = filterDataByPeriod(completions);
    const filteredTrainings = selectedTraining === 'all' 
      ? trainings 
      : trainings.filter(t => t.id === selectedTraining);

    const difficultyCounts = {};
    filteredCompletions.forEach(completion => {
      const training = filteredTrainings.find(t => t.id === completion.trainingId);
      if (training?.difficulty) {
        difficultyCounts[training.difficulty] = (difficultyCounts[training.difficulty] || 0) + 1;
      }
    });

    return Object.entries(difficultyCounts).map(([difficulty, count]) => ({
      difficulty: difficulty.toUpperCase(),
      count
    }));
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN');
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (!profile) return <div className="p-6">Loading...</div>;
  if (!['ADMIN', 'MANAGER'].includes(profile.role)) return <div className="p-6">Access denied</div>;

  const metrics = getPerformanceMetrics();
  const staffPerformance = getStaffPerformance();
  const trendData = getTrainingTrendData();
  const categoryData = getCategoryDistribution();
  const difficultyData = getDifficultyDistribution();

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {profile?.role === 'MANAGER' ? 'My Team Training Performance' : 'Training Performance Dashboard'}
        </h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="p-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="week">Last Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Training</label>
            <select
              value={selectedTraining}
              onChange={(e) => setSelectedTraining(e.target.value)}
              className="p-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Trainings</option>
              {trainings.map(training => (
                <option key={training.id} value={training.id}>{training.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="p-2 border rounded focus:ring-2 focus:ring-blue-500"
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
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{metrics.totalAssignments}</div>
          <div className="text-sm text-gray-600">Total Assignments</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">{metrics.completedCount}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{metrics.completionRate}%</div>
          <div className="text-sm text-gray-600">Completion Rate</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-purple-600">{metrics.averageScore}%</div>
          <div className="text-sm text-gray-600">Average Score</div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Training Trend */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Training Completion Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="completed" stroke="#00C49F" name="Completed" />
              <Line type="monotone" dataKey="failed" stroke="#FF8042" name="Failed" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Training Category Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Difficulty Distribution */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Training Difficulty Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={difficultyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="difficulty" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Staff Performance */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Staff Completion Rates</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={staffPerformance.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="completionRate" fill="#00C49F" name="Completion Rate (%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Staff Performance Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Staff Training Performance</h2>
          
          {loading ? (
            <div className="text-center py-8">Loading performance data...</div>
          ) : staffPerformance.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No training performance data available for the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Store
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completion Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Average Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Completed
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staffPerformance.map((staffMember) => (
                    <tr key={staffMember.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{staffMember.name}</div>
                        <div className="text-sm text-gray-500">{staffMember.role}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {staffMember.store}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {staffMember.totalAssigned}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {staffMember.completedCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${staffMember.completionRate}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-900">{staffMember.completionRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {staffMember.averageScore}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(staffMember.lastCompleted)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



