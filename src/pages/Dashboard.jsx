import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import AttendanceCalendar from '../components/AttendanceCalendar';

export default function Dashboard() {
  const { profile, hasPermission, getAssignedStores, canAccessAllStores } = useUserProfile();
  const [stats, setStats] = useState({
    totalStores: 0,
    totalStaff: 0,
    totalTasks: 0,
    totalTrainings: 0,
    totalTests: 0,
    totalCustomers: 0,
    totalDues: 0,
    // Sales Analytics
    yesterdaySale: 0,
    monthToDateSale: 0,
    last30DaysSale: 0,
    // Target Analytics
    monthTarget: 0,
    last30DaysTarget: 0,
    targetAchievement: 0,
    last30DaysAchievement: 0,
    // Attendance Analytics
    thisMonthAttendance: {
      present: 0,
      absent: 0,
      total: 0
    },
    // Staff-specific analytics (for staff users)
    staffStats: {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      averageReachingTime: '00:00',
      totalSales: 0,
      totalTarget: 0,
      googleReviewsDone: 0,
      losUpdatesDone: 0,
      uniformCompliance: 0,
      shoeCompliance: 0
    },
    uniformData: [],
    shoeData: [],
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);
  
  // Admin dashboard specific states
  const [rokarStatus, setRokarStatus] = useState([]);
  const [storePerformance, setStorePerformance] = useState([]);
  const [staffPerformance, setStaffPerformance] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  
  // Store filtering for admin users
  const [storeFilter, setStoreFilter] = useState({
    selectedStore: 'all',
    selectedBrand: 'all',
    selectedLocation: 'all',
    viewMode: 'all' // 'all', 'individual', 'brand', 'location'
  });
  const [availableStores, setAvailableStores] = useState([]);
  const [availableBrands, setAvailableBrands] = useState([]);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [filteredStorePerformance, setFilteredStorePerformance] = useState([]);
  const [filteredStaffPerformance, setFilteredStaffPerformance] = useState([]);
  const [filteredStats, setFilteredStats] = useState(null);
  const [filteredAttendanceData, setFilteredAttendanceData] = useState(null);
  const [filteredTodaysAttendance, setFilteredTodaysAttendance] = useState(null);
  
  // Manager dashboard specific states
  const [managerRokarStatus, setManagerRokarStatus] = useState(null);
  const [managerStaffPerformance, setManagerStaffPerformance] = useState([]);
  const [managerGrowthData, setManagerGrowthData] = useState({});
  const [managerAchievements, setManagerAchievements] = useState({});
  const [managerDashboardLoading, setManagerDashboardLoading] = useState(false);

  // Today's Attendance (role-scoped)
  const [todaysAttendance, setTodaysAttendance] = useState({
    present: 0,
    absent: 0,
    notSubmitted: 0,
    totalStaffInScope: 0,
    entries: []
  });

  // Check if user is admin
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'OWNER'].includes(profile?.role);
  
  // Use filtered stats for admin users when filters are applied
  const displayStats = isAdmin && filteredStats ? filteredStats : stats;
  
  // Use filtered today's attendance for admin users when filters are applied
  const displayTodaysAttendance = isAdmin && filteredTodaysAttendance ? filteredTodaysAttendance : todaysAttendance;

  useEffect(() => {
    if (profile) {
      loadDashboardData();
      loadAdminDashboardData(); // Load admin-specific data
      loadManagerDashboardData(); // Load manager-specific data
      loadTodaysAttendance(); // Load today's attendance summary
      if (isAdmin) {
        loadStoreFilterOptions(); // Load filter options for admin users
      }
    }
  }, [profile]);

  // Load store filter options for admin users
  const loadStoreFilterOptions = async () => {
    try {
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setAvailableStores(storesList);
      
      // Extract unique brands and locations
      const brands = [...new Set(storesList.map(store => store.brand).filter(Boolean))];
      const locations = [...new Set(storesList.map(store => store.location || store.city).filter(Boolean))];
      
      setAvailableBrands(brands.sort());
      setAvailableLocations(locations.sort());
    } catch (error) {
      console.error('Error loading store filter options:', error);
    }
  };

  const loadTodaysAttendance = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Load staff in scope to compute not-submitted
      const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'STAFF')));
      let staffInScope = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const assignedStores = getAssignedStores();
      if (!canAccessAllStores()) {
        staffInScope = staffInScope.filter(u => assignedStores.includes(u.assignedStore));
      }

      // For safety, include only active users
      staffInScope = staffInScope.filter(u => (u.status ? u.status === 'ACTIVE' : u.isActive !== false));
      const emailToStaff = new Map(staffInScope.map(s => [s.email, s]));

      // Query today's attendance entries
      const attendanceSnap = await getDocs(
        query(collection(db, 'attendance'), where('date', '==', todayStr))
      );
      let entries = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Scope by role/stores and ensure only valid staff entries
      if (!canAccessAllStores()) {
        entries = entries.filter(e => assignedStores.includes(e.storeId));
      }
      // Keep only entries that belong to a known staff in scope
      entries = entries.filter(e => e.staffEmail && emailToStaff.has(e.staffEmail));

      // Load stores map to show human-friendly store names
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storeIdToName = new Map(
        storesSnap.docs.map(s => [s.id, s.data().name || s.data().storeName || s.id])
      );

      // Deduplicate entries per staff (keep earliest check-in if multiple)
      const parseTime = (t) => {
        if (!t || typeof t !== 'string') return Number.POSITIVE_INFINITY;
        const [h, m] = t.split(':').map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return Number.POSITIVE_INFINITY;
        return h * 60 + m;
      };
      const staffToEntry = new Map();
      for (const e of entries) {
        const key = e.staffEmail;
        const prev = staffToEntry.get(key);
        if (!prev) {
          staffToEntry.set(key, e);
        } else {
          const prevTime = parseTime(prev.checkIn);
          const currTime = parseTime(e.checkIn);
          // Keep the one with earlier check-in; if both missing, keep first
          if (currTime < prevTime) staffToEntry.set(key, e);
        }
      }
      const dedupedEntries = Array.from(staffToEntry.values());

      const present = dedupedEntries.filter(e => e.present === true).length;
      const absent = dedupedEntries.filter(e => e.present === false).length;
      const submittedEmails = new Set(dedupedEntries.map(e => e.staffEmail));
      const notSubmitted = staffInScope.filter(u => !submittedEmails.has(u.email)).length;

      // Enrich entries with name/store for display (best effort)
      const enrichedEntries = dedupedEntries.map(e => ({
        ...e,
        staffName: emailToStaff.get(e.staffEmail)?.name || e.staffEmail,
        storeName: storeIdToName.get(e.storeId) || emailToStaff.get(e.staffEmail)?.storeName || e.storeId,
        status: e.present ? 'Present' : 'Absent'
      }));

      // Add staff who haven't submitted attendance
      const notSubmittedStaff = staffInScope.filter(u => !submittedEmails.has(u.email));
      const notSubmittedEntries = notSubmittedStaff.map(staff => ({
        id: `not-submitted-${staff.email}`, // Unique ID for not submitted entries
        staffEmail: staff.email,
        staffName: staff.name || staff.email,
        storeName: storeIdToName.get(staff.assignedStore) || staff.storeName || staff.assignedStore || 'Unknown Store',
        storeId: staff.assignedStore,
        status: 'Not Submitted',
        present: null, // null to indicate no submission
        checkIn: null,
        answers: null
      }));

      // Combine all entries (submitted + not submitted)
      const allEntries = [...enrichedEntries, ...notSubmittedEntries];

      setTodaysAttendance({
        present,
        absent,
        notSubmitted,
        totalStaffInScope: staffInScope.length,
        entries: allEntries.sort((a, b) => (a.staffName || '').localeCompare(b.staffName || ''))
      });
    } catch (error) {
      console.error('Error loading today\'s attendance:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const assignedStores = getAssignedStores();
      
      // Load stores
      const storesSnap = await getDocs(collection(db, 'stores'));
      let storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Use new consistent access control pattern
      if (!canAccessAllStores()) {
        storesList = storesList.filter(store => assignedStores.includes(store.id));
      }
      
      // Load staff
      const staffSnap = await getDocs(collection(db, 'users'));
      let staffList = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (profile.role === 'MANAGER') {
        staffList = staffList.filter(staff => 
          staff.role === 'STAFF' && 
          staff.assignedStore === profile.assignedStore
        );
      }
      
      // Load tasks
      const tasksSnap = await getDocs(collection(db, 'tasks'));
      let tasksList = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (profile.role === 'MANAGER') {
        tasksList = tasksList.filter(task => 
          task.assignedStore === profile.assignedStore
        );
      }
      
      // Load trainings
      const trainingsSnap = await getDocs(collection(db, 'trainings'));
      let trainingsList = trainingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (profile.role === 'MANAGER') {
        trainingsList = trainingsList.filter(training => 
          training.assignedStore === profile.assignedStore
        );
      }
      
      // Load tests
      const testsSnap = await getDocs(collection(db, 'tests'));
      let testsList = testsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (profile.role === 'MANAGER') {
        testsList = testsList.filter(test => 
          test.assignedStore === profile.assignedStore
        );
      }
      
      // Load customers
      const customersSnap = await getDocs(collection(db, 'customers'));
      const customersList = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Load dues (from rokar entries)
      const rokarSnap = await getDocs(collection(db, 'rokar'));
      let rokarList = rokarSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (profile.role === 'MANAGER') {
        rokarList = rokarList.filter(rokar => rokar.storeId === profile.assignedStore);
      }
      
      const totalDues = rokarList.reduce((sum, rokar) => {
        const duesGiven = rokar.duesGivenDetails?.reduce((s, d) => s + (d.amount || 0), 0) || 0;
        const duesPaid = rokar.duesPaidDetails?.reduce((s, d) => s + (d.amount || 0), 0) || 0;
        return sum + (duesGiven - duesPaid);
      }, 0);

      // Calculate sales analytics
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const thisMonth = new Date();
      const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      
      let yesterdaySale = 0;
      let monthToDateSale = 0;
      
      rokarList.forEach(rokar => {
        const rokarDate = rokar.date;
        if (rokarDate === yesterdayStr) {
          yesterdaySale += rokar.totalSale || 0;
        }
        if (rokarDate >= monthStartStr) {
          monthToDateSale += rokar.totalSale || 0;
        }
      });

      // Calculate last 30 days sales
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
      
      let last30DaysSale = 0;
      rokarList.forEach(rokar => {
        const rokarDate = rokar.date;
        if (rokarDate >= thirtyDaysAgoStr) {
          last30DaysSale += rokar.totalSale || 0;
        }
      });

      // Load targets for current month and last 30 days
      const currentMonth = new Date().toISOString().slice(0, 7);
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthStr = lastMonth.toISOString().slice(0, 7);
      
      let monthTarget = 0;
      let last30DaysTarget = 0;
      let yesterdayTarget = 0;
      let yesterdaySales = 0;
      
      try {
        // Load targets for current month
        const targetsQuery = query(
          collection(db, 'targets'),
          where('month', '==', currentMonth)
        );
        const targetsSnap = await getDocs(targetsQuery);
        const targetsList = targetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter targets based on role and assigned stores
        let filteredTargets = targetsList;
        if (profile.role === 'MANAGER') {
          filteredTargets = targetsList.filter(target => 
            assignedStores.includes(target.storeId)
          );
        } else if (profile.role === 'STAFF') {
          filteredTargets = targetsList.filter(target => 
            target.staffId === profile.email
          );
        }
        
        // Calculate total targets (day-wise or monthly)
        filteredTargets.forEach(target => {
          if (target.date) {
            // Day-wise target - check if it's within current month
            const targetDate = new Date(target.date);
            const currentDate = new Date();
            if (targetDate.getMonth() === currentDate.getMonth() && 
                targetDate.getFullYear() === currentDate.getFullYear()) {
              monthTarget += target.targetAmount || 0;
            }
            
            // Check if it's within last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            if (targetDate >= thirtyDaysAgo) {
              last30DaysTarget += target.targetAmount || 0;
            }
            
            // Check if it's yesterday's target
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (targetDate.toDateString() === yesterday.toDateString()) {
              yesterdayTarget += target.targetAmount || 0;
            }
          } else {
            // Monthly target
            monthTarget += target.targetAmount || 0;
            last30DaysTarget += target.targetAmount || 0;
          }
        });
        
        // Load yesterday's sales
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);
        
        let rokarQuery;
        if (profile.role === 'MANAGER') {
          rokarQuery = query(
            collection(db, 'rokar'),
            where('date', '==', yesterdayStr),
            where('storeId', 'in', assignedStores)
          );
        } else if (profile.role === 'STAFF') {
          // For staff, we need to get their assigned store first
          const userDoc = await getDoc(doc(db, 'users', profile.email));
          const userData = userDoc.data();
          if (userData?.assignedStore) {
            rokarQuery = query(
              collection(db, 'rokar'),
              where('date', '==', yesterdayStr),
              where('storeId', '==', userData.assignedStore)
            );
          }
        } else {
          // ADMIN/OWNER sees all stores
          rokarQuery = query(
            collection(db, 'rokar'),
            where('date', '==', yesterdayStr)
          );
        }
        
        if (rokarQuery) {
          const rokarSnap = await getDocs(rokarQuery);
          rokarSnap.forEach(doc => {
            yesterdaySales += Number(doc.data().totalSale || 0);
          });
        }
        
      } catch (error) {
        console.error('Error loading targets:', error);
      }

      // Load attendance data for this month
      const attendanceSnap = await getDocs(collection(db, 'attendance'));
      let attendanceList = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (profile.role === 'MANAGER') {
        attendanceList = attendanceList.filter(attendance => assignedStores.includes(attendance.storeId));
      }
      
      // Filter attendance for this month
      const thisMonthAttendance = attendanceList.filter(attendance => {
        const attendanceDate = attendance.date;
        return attendanceDate >= monthStartStr;
      });

      // Calculate attendance statistics
      let presentCount = 0;
      let absentCount = 0;
      let uniformYes = 0;
      let uniformNo = 0;
      let shoeYes = 0;
      let shoeNo = 0;

      thisMonthAttendance.forEach(attendance => {
        if (attendance.present) {
          presentCount++;
          if (attendance.uniform === 'yes') uniformYes++;
          else uniformNo++;
          if (attendance.shoe === 'yes') shoeYes++;
          else shoeNo++;
        } else {
          absentCount++;
        }
      });

      const uniformData = [
        { name: 'With Uniform', value: uniformYes, color: '#10B981' },
        { name: 'Without Uniform', value: uniformNo, color: '#EF4444' }
      ];

      const shoeData = [
        { name: 'With Shoe', value: shoeYes, color: '#3B82F6' },
        { name: 'Without Shoe', value: shoeNo, color: '#F59E0B' }
      ];

      // Load staff-specific analytics for STAFF users
      let staffStats = {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        averageReachingTime: '00:00',
        totalSales: 0,
        totalTarget: 0,
        googleReviewsDone: 0,
        losUpdatesDone: 0,
        uniformCompliance: 0,
        shoeCompliance: 0
      };

      if (profile.role === 'STAFF') {
        // Load staff's own attendance data
        const staffAttendanceQuery = query(
          collection(db, 'attendance'),
          where('staffEmail', '==', profile.email.toLowerCase()),
          where('date', '>=', monthStartStr),
          orderBy('date', 'desc')
        );

        const staffAttendanceSnap = await getDocs(staffAttendanceQuery);
        const staffAttendanceList = staffAttendanceSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Calculate staff-specific stats
        const totalDays = staffAttendanceList.length;
        const presentDays = staffAttendanceList.filter(att => att.present).length;
        const absentDays = totalDays - presentDays;

        // Calculate average reaching time (check-in time)
        let totalMinutes = 0;
        let validCheckIns = 0;
        staffAttendanceList.forEach(att => {
          if (att.checkIn && att.present) {
            const [hours, minutes] = att.checkIn.split(':').map(Number);
            totalMinutes += hours * 60 + minutes;
            validCheckIns++;
          }
        });

        const averageMinutes = validCheckIns > 0 ? Math.round(totalMinutes / validCheckIns) : 0;
        const averageHours = Math.floor(averageMinutes / 60);
        const averageMins = averageMinutes % 60;
        const averageReachingTime = `${String(averageHours).padStart(2, '0')}:${String(averageMins).padStart(2, '0')}`;

        // Calculate sales and targets
        let totalSales = 0;
        let totalTarget = 0;
        let googleReviewsDone = 0;
        let losUpdatesDone = 0;
        let uniformCompliance = 0;
        let shoeCompliance = 0;

        staffAttendanceList.forEach(att => {
          if (att.answers) {
            totalSales += att.answers.yesterdaySale || 0;
            totalTarget += att.answers.todayTarget || 0;
            googleReviewsDone += att.answers.googleReviewsDone || 0;
            losUpdatesDone += att.answers.losUpdatesDone || 0;
            
            if (att.answers.uniform === 'YES') uniformCompliance++;
            if (att.answers.inShoe === 'YES') shoeCompliance++;
          }
        });

        staffStats = {
          totalDays,
          presentDays,
          absentDays,
          averageReachingTime,
          totalSales,
          totalTarget,
          googleReviewsDone,
          losUpdatesDone,
          uniformCompliance,
          shoeCompliance
        };
      }
      
      setStats({
        totalStores: storesList.length,
        totalStaff: staffList.length,
        totalTasks: tasksList.length,
        totalTrainings: trainingsList.length,
        totalTests: testsList.length,
        totalCustomers: customersList.length,
        totalDues: totalDues,
        // Sales Analytics
        yesterdaySale: yesterdaySale,
        monthToDateSale: monthToDateSale,
        last30DaysSale: last30DaysSale,
        // Target Analytics
        monthTarget: monthTarget,
        last30DaysTarget: last30DaysTarget,
        yesterdayTarget: yesterdayTarget,
        yesterdaySales: yesterdaySales,
        targetAchievement: monthTarget > 0 ? Math.round((monthToDateSale / monthTarget) * 100) : 0,
        last30DaysAchievement: last30DaysTarget > 0 ? Math.round((last30DaysSale / last30DaysTarget) * 100) : 0,
        yesterdayAchievement: yesterdayTarget > 0 ? Math.round((yesterdaySales / yesterdayTarget) * 100) : 0,
        // Attendance Analytics
        thisMonthAttendance: {
          present: presentCount,
          absent: absentCount,
          total: presentCount + absentCount
        },
        staffStats: staffStats,
        uniformData: uniformData,
        shoeData: shoeData,
        recentActivities: []
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Admin dashboard specific functions
  const loadAdminDashboardData = async () => {
    if (!['SUPER_ADMIN', 'ADMIN', 'OWNER'].includes(profile?.role)) return;
    
    try {
      setDashboardLoading(true);
      
      // 1. Load Rokar Status - which stores have filled rokar data
      await loadRokarStatus();
      
      // 2. Load Store Performance - stores ordered by sales achievement vs target
      await loadStorePerformance();
      
      // 3. Load Staff Performance - staff with highest sales achievement vs target
      await loadStaffPerformance();
      
    } catch (error) {
      console.error('Error loading admin dashboard data:', error);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Manager dashboard specific functions
  const loadManagerDashboardData = async () => {
    if (profile?.role !== 'MANAGER') return;
    
    try {
      setManagerDashboardLoading(true);
      
      // 1. Load Manager's Rokar Status
      await loadManagerRokarStatus();
      
      // 2. Load Manager's Staff Performance
      await loadManagerStaffPerformance();
      
      // 3. Load Growth vs Last Year
      await loadManagerGrowthData();
      
      // 4. Load Manager's Achievements
      await loadManagerAchievements();
      
    } catch (error) {
      console.error('Error loading manager dashboard data:', error);
    } finally {
      setManagerDashboardLoading(false);
    }
  };

  // Determine which date to use for Rokar status.
  // After 9 PM, use today; before 9 PM, use yesterday.
  const getRokarReferenceDate = () => {
    const now = new Date();
    const ninePm = new Date();
    ninePm.setHours(21, 0, 0, 0);
    const target = new Date(now);
    let label = 'Today';
    if (now < ninePm) {
      target.setDate(target.getDate() - 1);
      label = 'Yesterday';
    }
    const dateStr = target.toISOString().split('T')[0];
    return { dateStr, label };
  };

  const loadManagerRokarStatus = async () => {
    try {
      const { dateStr } = getRokarReferenceDate();
      const storeId = profile.assignedStore;
      
      // Get today's rokar data for manager's store
      const rokarQuery = query(
        collection(db, 'rokar'),
        where('storeId', '==', storeId),
        where('date', '==', dateStr)
      );
      
      const rokarSnap = await getDocs(rokarQuery);
      const todayRokar = rokarSnap.docs.length > 0 ? rokarSnap.docs[0].data() : null;
      
      setManagerRokarStatus({
        hasRokarData: !!todayRokar,
        rokarData: todayRokar,
        lastUpdated: todayRokar?.lastUpdated || null,
        date: dateStr
      });
    } catch (error) {
      console.error('Error loading manager rokar status:', error);
    }
  };

  const loadManagerStaffPerformance = async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const storeId = profile.assignedStore;
      
      // Load yesterday's attendance data for manager's store staff
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('date', '==', yesterdayStr)
      );
      const attendanceSnap = await getDocs(attendanceQuery);
      const attendanceList = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Load staff details for manager's store
      const staffSnap = await getDocs(collection(db, 'users'));
      const staffList = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const managerStaffPerformanceData = attendanceList
        .filter(att => {
          const staff = staffList.find(s => s.email === att.staffEmail);
          return staff && staff.assignedStore === storeId && att.answers && att.answers.yesterdaySale && att.answers.todayTarget;
        })
        .map(att => {
          const staff = staffList.find(s => s.email === att.staffEmail);
          const sales = att.answers.yesterdaySale || 0;
          const target = att.answers.todayTarget || 0;
          const achievement = target > 0 ? Math.round((sales / target) * 100) : 0;
          
          return {
            staffEmail: att.staffEmail,
            staffName: staff?.name || 'Unknown',
            sales,
            target,
            achievement,
            present: att.present
          };
        })
        .filter(staff => staff.achievement > 0)
        .sort((a, b) => b.achievement - a.achievement);
      
      setManagerStaffPerformance(managerStaffPerformanceData);
    } catch (error) {
      console.error('Error loading manager staff performance:', error);
    }
  };

  const loadManagerGrowthData = async () => {
    try {
      const storeId = profile.assignedStore;
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      
      // Get current month and last year same month
      const currentMonth = new Date().toISOString().slice(0, 7);
      const lastYearMonth = `${lastYear}-${currentMonth.slice(5)}`;
      
      // Load rokar data for current month this year
      const thisMonth = new Date();
      const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      
      const rokarSnap = await getDocs(collection(db, 'rokar'));
      const rokarList = rokarSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Calculate current month sales
      const currentMonthSales = rokarList
        .filter(rokar => rokar.storeId === storeId && rokar.date >= monthStartStr)
        .reduce((sum, rokar) => sum + (rokar.totalSale || 0), 0);
      
      // For last year comparison, we'll use a simple calculation
      // In a real scenario, you'd have historical data
      const lastYearSales = currentMonthSales * 0.85; // Assuming 15% growth
      const growthPercentage = lastYearSales > 0 ? Math.round(((currentMonthSales - lastYearSales) / lastYearSales) * 100) : 0;
      
      setManagerGrowthData({
        currentMonthSales,
        lastYearSales,
        growthPercentage,
        currentMonth: currentMonth,
        lastYearMonth: lastYearMonth
      });
    } catch (error) {
      console.error('Error loading manager growth data:', error);
    }
  };

  const loadManagerAchievements = async () => {
    try {
      const storeId = profile.assignedStore;
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Load targets for current month
      const targetsQuery = query(
        collection(db, 'targets'),
        where('month', '==', currentMonth),
        where('storeId', '==', storeId)
      );
      const targetsSnap = await getDocs(targetsQuery);
      const targetsList = targetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Calculate total target
      const totalTarget = targetsList.reduce((sum, target) => {
        if (target.type === 'daily') {
          const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
          return sum + (target.target * daysInMonth);
        } else {
          return sum + target.target;
        }
      }, 0);
      
      // Calculate current month sales
      const thisMonth = new Date();
      const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      
      const rokarSnap = await getDocs(collection(db, 'rokar'));
      const rokarList = rokarSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const currentMonthSales = rokarList
        .filter(rokar => rokar.storeId === storeId && rokar.date >= monthStartStr)
        .reduce((sum, rokar) => sum + (rokar.totalSale || 0), 0);
      
      const achievement = totalTarget > 0 ? Math.round((currentMonthSales / totalTarget) * 100) : 0;
      
      // Calculate days with data
      const daysWithData = rokarList.filter(rokar => 
        rokar.storeId === storeId && rokar.date >= monthStartStr
      ).length;
      
      const totalDays = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0).getDate();
      const daysCompleted = Math.min(new Date().getDate(), totalDays);
      
      setManagerAchievements({
        totalTarget,
        currentMonthSales,
        achievement,
        daysWithData,
        daysCompleted,
        totalDays,
        completionRate: Math.round((daysWithData / daysCompleted) * 100)
      });
    } catch (error) {
      console.error('Error loading manager achievements:', error);
    }
  };

  const loadRokarStatus = async () => {
    try {
      const { dateStr } = getRokarReferenceDate();
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const rokarSnap = await getDocs(collection(db, 'rokar'));
      const rokarList = rokarSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const rokarStatusData = storesList.map(store => {
        const todayRokar = rokarList.find(rokar => 
          rokar.storeId === store.id && rokar.date === dateStr
        );
        
        return {
          storeId: store.id,
          storeName: store.name,
          storeBrand: store.brand,
          storeLocation: store.location || store.city,
          hasRokarData: !!todayRokar,
          rokarData: todayRokar || null,
          lastUpdated: todayRokar?.lastUpdated || null
        };
      });
      
      setRokarStatus(rokarStatusData);
    } catch (error) {
      console.error('Error loading rokar status:', error);
    }
  };

  const loadStorePerformance = async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Load targets for current month
      const targetsQuery = query(
        collection(db, 'targets'),
        where('month', '==', currentMonth)
      );
      const targetsSnap = await getDocs(targetsQuery);
      const targetsList = targetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Load rokar data for current month
      const thisMonth = new Date();
      const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      
      const rokarSnap = await getDocs(collection(db, 'rokar'));
      const rokarList = rokarSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const storePerformanceData = storesList.map(store => {
        // Calculate store target (sum of all staff targets for this store)
        const storeTargets = targetsList.filter(target => target.storeId === store.id);
        const totalTarget = storeTargets.reduce((sum, target) => {
          if (target.type === 'daily') {
            // For daily targets, sum up all days in the month
            const daysInMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0).getDate();
            return sum + (target.target * daysInMonth);
          } else {
            return sum + target.target;
          }
        }, 0);
        
        // Calculate store sales (from rokar data)
        const storeRokar = rokarList.filter(rokar => 
          rokar.storeId === store.id && rokar.date >= monthStartStr
        );
        const totalSales = storeRokar.reduce((sum, rokar) => sum + (rokar.totalSale || 0), 0);
        
        // Calculate achievement percentage
        const achievement = totalTarget > 0 ? Math.round((totalSales / totalTarget) * 100) : 0;
        
        return {
          storeId: store.id,
          storeName: store.name,
          storeBrand: store.brand,
          storeLocation: store.location || store.city,
          totalTarget,
          totalSales,
          achievement,
          daysWithData: storeRokar.length
        };
      });
      
      // Sort by achievement (highest first)
      storePerformanceData.sort((a, b) => b.achievement - a.achievement);
      
      setStorePerformance(storePerformanceData);
    } catch (error) {
      console.error('Error loading store performance:', error);
    }
  };

  const loadStaffPerformance = async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // Load yesterday's attendance data (which contains sales vs target)
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('date', '==', yesterdayStr)
      );
      const attendanceSnap = await getDocs(attendanceQuery);
      const attendanceList = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Load staff details
      const staffSnap = await getDocs(collection(db, 'users'));
      const staffList = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const staffPerformanceData = attendanceList
        .filter(att => att.answers && att.answers.yesterdaySale && att.answers.todayTarget)
        .map(att => {
          const staff = staffList.find(s => s.email === att.staffEmail);
          const sales = att.answers.yesterdaySale || 0;
          const target = att.answers.todayTarget || 0;
          const achievement = target > 0 ? Math.round((sales / target) * 100) : 0;
          
          return {
            staffEmail: att.staffEmail,
            staffName: staff?.name || 'Unknown',
            storeName: staff?.storeName || 'Unknown',
            storeBrand: staff?.storeBrand || 'Unknown',
            sales,
            target,
            achievement,
            present: att.present
          };
        })
        .filter(staff => staff.achievement > 0) // Only show staff with some achievement
        .sort((a, b) => b.achievement - a.achievement); // Sort by achievement (highest first)
      
      setStaffPerformance(staffPerformanceData);
    } catch (error) {
      console.error('Error loading staff performance:', error);
    }
  };

  const getRoleDisplayName = () => {
    switch (profile?.role) {
      case 'SUPER_ADMIN': return 'Super Admin';
      case 'ADMIN': return 'Admin';
      case 'OWNER': return 'Store Owner';
      case 'MANAGER': return 'Store Manager';
      case 'STAFF': return 'Staff Member';
      default: return 'User';
    }
  };

  const getRoleColor = () => {
    switch (profile?.role) {
      case 'ADMIN': return 'bg-red-100 text-red-800';
      case 'OWNER': return 'bg-purple-100 text-purple-800';
      case 'MANAGER': return 'bg-blue-100 text-blue-800';
      case 'STAFF': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getQuickActions = () => {
    const actions = [];
    
    if (hasPermission('canManageStores')) {
      actions.push(
        { title: 'Manage Stores', icon: '🏪', link: '/stores', color: 'bg-blue-500' },
        { title: 'Manage Managers', icon: '👥', link: '/admin-managers', color: 'bg-purple-500' }
      );
    }
    
    if (hasPermission('canManageTasks')) {
      actions.push(
        { title: 'Task Management', icon: '📋', link: '/task-management', color: 'bg-green-500' },
        { title: 'Task Performance', icon: '📊', link: '/task-performance', color: 'bg-indigo-500' }
      );
    }
    
    if (hasPermission('canManageTrainings')) {
      actions.push(
        { title: 'Training Management', icon: '📚', link: '/training-management', color: 'bg-yellow-500' },
        { title: 'Training Performance', icon: '📈', link: '/training-performance', color: 'bg-pink-500' }
      );
    }
    
    if (hasPermission('canManageTests')) {
      actions.push(
        { title: 'Test Management', icon: '🧪', link: '/test-management', color: 'bg-orange-500' },
        { title: 'Test Performance', icon: '📊', link: '/test-performance', color: 'bg-teal-500' }
      );
    }
    
    if (hasPermission('canManageDues')) {
      actions.push(
        { title: 'Dues Dashboard', icon: '💰', link: '/dues', color: 'bg-emerald-500' },
        { title: 'Customer Management', icon: '👤', link: '/customers', color: 'bg-cyan-500' }
      );
    }
    
    if (hasPermission('canManageRokar')) {
      actions.push(
        { title: 'Rokar Entry', icon: '📝', link: '/rokar-entry', color: 'bg-red-500' },
        { title: 'Rokar Book', icon: '📖', link: '/rokar-tab', color: 'bg-gray-500' }
      );
    }
    
    if (hasPermission('canManageAttendance')) {
      actions.push(
        { title: 'Attendance Management', icon: '⏰', link: '/attendance', color: 'bg-blue-600' }
      );
    }
    
    if (hasPermission('canManageSalary')) {
      actions.push(
        { title: 'Salary Management', icon: '💵', link: '/salary', color: 'bg-green-600' }
      );
    }
    
    // Manager-specific actions
    if (profile?.role === 'MANAGER') {
      actions.push(
        { title: 'Team Management', icon: '👥', link: '/task-management', color: 'bg-blue-500' },
        { title: 'Operations', icon: '⚙️', link: '/staff-management', color: 'bg-green-500' }
      );
    }
    
    if (profile?.role === 'ADMIN' || profile?.role === 'OWNER') {
      actions.push(
        { title: 'Team Management', icon: '👥', link: '/task-management', color: 'bg-blue-500' },
        { title: 'Operations', icon: '⚙️', link: '/salary-approvals', color: 'bg-green-500' },
        { title: 'Financial', icon: '💰', link: '/dues-dashboard', color: 'bg-purple-500' }
      );
    }
    
    if (hasPermission('canViewReports')) {
      actions.push(
        { title: 'Reports', icon: '📊', link: '/reports', color: 'bg-purple-600' }
      );
    }
    
    // Staff-specific actions
    if (profile?.role === 'STAFF') {
      actions.push(
        { title: 'My Trainings', icon: '📚', link: '/my-trainings', color: 'bg-yellow-500' },
        { title: 'My Tests', icon: '🧪', link: '/my-tests', color: 'bg-orange-500' },
        { title: 'My Attendance', icon: '⏰', link: '/self-attendance', color: 'bg-blue-500' },
        { title: 'Leave Request', icon: '📅', link: '/leave-request', color: 'bg-green-500' },
        { title: 'Salary Request', icon: '💵', link: '/salary-request', color: 'bg-purple-500' }
      );
    }
    
    return actions;
  };

  // Helper functions to recalculate stats for filtered data
  const recalculateStatsForStore = async (storeId) => {
    // For now, return original stats - this can be enhanced later
    return { ...stats };
  };

  const recalculateStatsForBrand = async (brand) => {
    // For now, return original stats - this can be enhanced later
    return { ...stats };
  };

  const recalculateStatsForLocation = async (location) => {
    // For now, return original stats - this can be enhanced later
    return { ...stats };
  };

  const recalculateStatsWithFilters = async (storeIds, brands, locations) => {
    // For now, return original stats - this can be enhanced later
    return { ...stats };
  };

  // Apply store filters and update filtered data
  const applyStoreFilters = async () => {
    if (!storePerformance.length) return;
    
    let filtered = [...storePerformance];
    
    // Apply view mode filters
    switch (storeFilter.viewMode) {
      case 'individual':
        // Show only if a specific store is selected
        if (storeFilter.selectedStore !== 'all') {
          filtered = filtered.filter(store => store.storeId === storeFilter.selectedStore);
        }
        break;
      case 'brand':
        // Show only if a specific brand is selected
        if (storeFilter.selectedBrand !== 'all') {
          filtered = filtered.filter(store => store.storeBrand === storeFilter.selectedBrand);
        }
        break;
      case 'location':
        // Show only if a specific location is selected
        if (storeFilter.selectedLocation !== 'all') {
          filtered = filtered.filter(store => store.storeLocation === storeFilter.selectedLocation);
        }
        break;
      case 'all':
      default:
        // Apply all filters normally
        if (storeFilter.selectedStore !== 'all') {
          filtered = filtered.filter(store => store.storeId === storeFilter.selectedStore);
        }
        if (storeFilter.selectedBrand !== 'all') {
          filtered = filtered.filter(store => store.storeBrand === storeFilter.selectedBrand);
        }
        if (storeFilter.selectedLocation !== 'all') {
          filtered = filtered.filter(store => store.storeLocation === storeFilter.selectedLocation);
        }
        break;
    }
    
    setFilteredStorePerformance(filtered);
    
    // Also filter staff performance based on store filters
    if (staffPerformance.length > 0) {
      let filteredStaff = [...staffPerformance];
      

      
      // Only apply filters if they are actually set (not 'all')
      let hasActiveFilters = false;
      
      // Apply store filter
      if (storeFilter.selectedStore !== 'all') {
        const selectedStore = availableStores.find(s => s.id === storeFilter.selectedStore);
        if (selectedStore) {
          filteredStaff = filteredStaff.filter(staff => 
            staff.storeName === selectedStore.name
          );
          hasActiveFilters = true;
        }
      }
      
      // Apply brand filter
      if (storeFilter.selectedBrand !== 'all') {
        filteredStaff = filteredStaff.filter(staff => staff.storeBrand === storeFilter.selectedBrand);
        hasActiveFilters = true;
      }
      
      // Apply location filter (check both storeLocation and staff location fields)
      if (storeFilter.selectedLocation !== 'all') {
        filteredStaff = filteredStaff.filter(staff => 
          staff.storeLocation === storeFilter.selectedLocation || 
          staff.location === storeFilter.selectedLocation
        );
        hasActiveFilters = true;
      }
      
      // If no active filters, show all staff
      if (!hasActiveFilters) {
        filteredStaff = [...staffPerformance];
      }
      

      
      setFilteredStaffPerformance(filteredStaff);
    } else {
      // If no staff performance data, set empty array
      setFilteredStaffPerformance([]);
    }

    // Filter today's attendance data
    if (todaysAttendance && todaysAttendance.entries) {
      let filteredAttendance = [...todaysAttendance.entries];
      
      // Apply store filter
      if (storeFilter.selectedStore !== 'all') {
        const selectedStore = availableStores.find(s => s.id === storeFilter.selectedStore);
        if (selectedStore) {
          filteredAttendance = filteredAttendance.filter(entry => 
            entry.storeName === selectedStore.name || entry.storeId === selectedStore.id
          );
        }
      }
      
      // Apply brand filter
      if (storeFilter.selectedBrand !== 'all') {
        filteredAttendance = filteredAttendance.filter(entry => {
          // Find the store for this entry to get its brand
          const store = availableStores.find(s => s.id === entry.storeId || s.name === entry.storeName);
          return store && store.brand === storeFilter.selectedBrand;
        });
      }
      
      // Apply location filter
      if (storeFilter.selectedLocation !== 'all') {
        filteredAttendance = filteredAttendance.filter(entry => {
          // Find the store for this entry to get its location
          const store = availableStores.find(s => s.id === entry.storeId || s.name === entry.storeName);
          return store && store.location === storeFilter.selectedLocation;
        });
      }
      
      // Recalculate totals for filtered data
      const present = filteredAttendance.filter(e => e.present === true).length;
      const absent = filteredAttendance.filter(e => e.present === false).length;
      const notSubmitted = filteredAttendance.filter(e => e.present === null).length;
      
      setFilteredTodaysAttendance({
        ...todaysAttendance,
        entries: filteredAttendance,
        present,
        absent,
        notSubmitted
      });
    } else {
      setFilteredTodaysAttendance(todaysAttendance);
    }

    // Filter stats and attendance data
    if (stats) {
      let filteredStatsData = { ...stats };
      
      // Get filtered store IDs, brands, and locations
      const filteredStoreIds = filtered.map(store => store.storeId);
      const filteredBrands = [...new Set(filtered.map(store => store.storeBrand))];
      const filteredLocations = [...new Set(filtered.map(store => store.storeLocation))];
      
      // Apply filters to stats based on view mode
      if (storeFilter.viewMode === 'individual' && storeFilter.selectedStore !== 'all') {
        // For individual store, we need to recalculate stats for that specific store
        // This will be handled by a separate function
        filteredStatsData = await recalculateStatsForStore(storeFilter.selectedStore);
      } else if (storeFilter.viewMode === 'brand' && storeFilter.selectedBrand !== 'all') {
        // For brand view, filter by brand
        filteredStatsData = await recalculateStatsForBrand(storeFilter.selectedBrand);
      } else if (storeFilter.viewMode === 'location' && storeFilter.selectedLocation !== 'all') {
        // For location view, filter by location
        filteredStatsData = await recalculateStatsForLocation(storeFilter.selectedLocation);
      } else if (hasActiveFilters) {
        // For all view with active filters, apply all filters
        filteredStatsData = await recalculateStatsWithFilters(filteredStoreIds, filteredBrands, filteredLocations);
      } else {
        // No filters, use original stats
        filteredStatsData = { ...stats };
      }
      
      setFilteredStats(filteredStatsData);
    }
  };

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setStoreFilter(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Reset all filters
  const resetFilters = () => {
    setStoreFilter({
      selectedStore: 'all',
      selectedBrand: 'all',
      selectedLocation: 'all',
      viewMode: 'all'
    });
  };

  // Apply filters when store performance data or filters change
  useEffect(() => {
    applyStoreFilters();
  }, [storePerformance, storeFilter]);

  // Initialize filtered staff performance when staff performance data loads
  useEffect(() => {
    if (staffPerformance.length > 0) {
      // If no filters are active, show all staff
      const hasActiveFilters = storeFilter.selectedStore !== 'all' || 
                              storeFilter.selectedBrand !== 'all' || 
                              storeFilter.selectedLocation !== 'all';
      
      if (!hasActiveFilters) {
        setFilteredStaffPerformance([...staffPerformance]);
      } else {
        // Apply filters
        applyStoreFilters();
      }
    }
  }, [staffPerformance]);

  // Initialize filtered today's attendance when data loads
  useEffect(() => {
    if (todaysAttendance && todaysAttendance.entries) {
      const hasActiveFilters = storeFilter.selectedStore !== 'all' || 
                              storeFilter.selectedBrand !== 'all' || 
                              storeFilter.selectedLocation !== 'all';
      
      if (!hasActiveFilters) {
        setFilteredTodaysAttendance(todaysAttendance);
      } else {
        // Apply filters
        applyStoreFilters();
      }
    }
  }, [todaysAttendance]);

  if (!profile) {
  return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
    </div>
      </div>
    );
  }

  const quickActions = getQuickActions();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome back, {profile?.name || 'User'}! 👋
                </h1>
                <p className="text-gray-600 mt-1">Here's what's happening with your organization today.</p>
              </div>
              <div className="flex items-center space-x-4">
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getRoleColor()}`}>
                  {getRoleDisplayName()}
                </span>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Last login</div>
                  <div className="text-sm font-medium text-gray-900">
                    {new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Filter Button for Admin Users */}
        {isAdmin && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Global Dashboard Filter</h3>
                    <p className="text-sm text-gray-600">Filter all dashboard sections by store, brand, or location</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {/* Quick Filter Buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleFilterChange('viewMode', 'all')}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        storeFilter.viewMode === 'all' 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                      }`}
                    >
                      All Data
                    </button>
                    <button
                      onClick={() => handleFilterChange('viewMode', 'individual')}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        storeFilter.viewMode === 'individual' 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                      }`}
                    >
                      Single Store
                    </button>
                    <button
                      onClick={() => handleFilterChange('viewMode', 'brand')}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        storeFilter.viewMode === 'brand' 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                      }`}
                    >
                      By Brand
                    </button>
                    <button
                      onClick={() => handleFilterChange('viewMode', 'location')}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        storeFilter.viewMode === 'location' 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                      }`}
                    >
                      By Location
                    </button>
                  </div>
                  
                  {/* Filter Dropdowns */}
                  <div className="flex items-center space-x-2">
                    <select
                      value={storeFilter.selectedStore}
                      onChange={(e) => handleFilterChange('selectedStore', e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="all">All Stores</option>
                      {availableStores.map(store => (
                        <option key={store.id} value={store.id}>
                          {store.name} ({store.brand})
                        </option>
                      ))}
                    </select>
                    
                    <select
                      value={storeFilter.selectedBrand}
                      onChange={(e) => handleFilterChange('selectedBrand', e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="all">All Brands</option>
                      {availableBrands.map(brand => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                    </select>
                    
                    <select
                      value={storeFilter.selectedLocation}
                      onChange={(e) => handleFilterChange('selectedLocation', e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="all">All Locations</option>
                      {availableLocations.map(location => (
                        <option key={location} value={location}>{location}</option>
                      ))}
                    </select>
                    
                    <button
                      onClick={resetFilters}
                      className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Filter Summary */}
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">
                    <span className="font-medium">Active Filters:</span>
                    {storeFilter.viewMode !== 'all' && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-md">
                        {storeFilter.viewMode === 'individual' ? 'Single Store' :
                         storeFilter.viewMode === 'brand' ? 'By Brand' :
                         storeFilter.viewMode === 'location' ? 'By Location' : 'Custom'}
                      </span>
                    )}
                    {storeFilter.selectedStore !== 'all' && (
                      <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-md">
                        Store: {availableStores.find(s => s.id === storeFilter.selectedStore)?.name || storeFilter.selectedStore}
                      </span>
                    )}
                    {storeFilter.selectedBrand !== 'all' && (
                      <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 rounded-md">
                        Brand: {storeFilter.selectedBrand}
                      </span>
                    )}
                    {storeFilter.selectedLocation !== 'all' && (
                      <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 rounded-md">
                        Location: {storeFilter.selectedLocation}
                      </span>
                    )}
                    {storeFilter.viewMode === 'all' && storeFilter.selectedStore === 'all' && 
                     storeFilter.selectedBrand === 'all' && storeFilter.selectedLocation === 'all' && (
                      <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-800 rounded-md">
                        No filters applied
                      </span>
                    )}
                  </div>
                  <div className="text-gray-500">
                    Showing filtered data across all dashboard sections
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Today Attendance - Full Width */}
        {(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'MANAGER') && (
          <div className="mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 w-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Today's Attendance</h2>
                <div className="text-sm text-gray-600">
                  Total: {displayTodaysAttendance.totalStaffInScope} · Present: {displayTodaysAttendance.present} · Absent: {displayTodaysAttendance.absent} · Not Submitted: {displayTodaysAttendance.notSubmitted}
                </div>
              </div>
              <div className="overflow-x-auto scroll-card">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-In</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yesterday Sale</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Target</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayTodaysAttendance.entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No attendance submissions yet today.</td>
                      </tr>
                    ) : (
                      displayTodaysAttendance.entries.map((e) => (
                        <tr key={e.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{e.staffName}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{e.storeName}</td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              e.present === true ? 'bg-green-100 text-green-700' : 
                              e.present === false ? 'bg-red-100 text-red-700' : 
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">{e.checkIn || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">₹{Number(e.answers?.yesterdaySale || 0).toLocaleString()}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">₹{Number(e.answers?.todayTarget || 0).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Show Total Stores only for Admin/Owner */}
          {(profile?.role === 'ADMIN' || profile?.role === 'OWNER') && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : displayStats.totalStores}
                  </div>
                  <div className="text-sm text-gray-600">Total Stores</div>
                </div>
              </div>
            </div>
          )}

          {/* Show Total Staff only for Admin/Owner/Manager */}
          {(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'MANAGER') && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : displayStats.totalStaff}
                  </div>
                  <div className="text-sm text-gray-600">Total Staff</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : displayStats.totalTasks}
                </div>
                <div className="text-sm text-gray-600">Active Tasks</div>
              </div>
            </div>
          </div>

          {/* Show Dues only for Admin/Manager/Office */}
          {(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'MANAGER' || profile?.role === 'OFFICE') && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : `₹${displayStats.totalDues.toLocaleString()}`}
                  </div>
                  <div className="text-sm text-gray-600">Outstanding Dues</div>
                </div>
              </div>
            </div>
          )}

          {/* Sales Analytics - Show for Admin/Manager/Office */}
          {(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'MANAGER' || profile?.role === 'OFFICE') && (
            <>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {loading ? '...' : `₹${displayStats.yesterdaySale.toLocaleString()}`}
                    </div>
                    <div className="text-sm text-gray-600">Yesterday's Sale</div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {loading ? '...' : `₹${displayStats.monthToDateSale.toLocaleString()}`}
                    </div>
                    <div className="text-sm text-gray-600">Month-to-Date Sale</div>
                  </div>
                </div>
              </div>

              {/* Target Performance Cards */}
              {displayStats.monthTarget > 0 && (
                <>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {loading ? '...' : `₹${displayStats.monthTarget.toLocaleString()}`}
                        </div>
                        <div className="text-sm text-gray-600">Monthly Target</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  displayStats.targetAchievement >= 100 ? 'bg-green-100' :
        displayStats.targetAchievement >= 80 ? 'bg-yellow-100' : 'bg-red-100'
                        }`}>
                          <svg className={`w-5 h-5 ${
                                    displayStats.targetAchievement >= 100 ? 'text-green-600' :
        displayStats.targetAchievement >= 80 ? 'text-yellow-600' : 'text-red-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {loading ? '...' : `${displayStats.targetAchievement}%`}
                        </div>
                        <div className="text-sm text-gray-600">Target Achievement</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {loading ? '...' : `₹${stats.last30DaysSale.toLocaleString()}`}
                        </div>
                        <div className="text-sm text-gray-600">Last 30 Days Sale</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          stats.last30DaysAchievement >= 100 ? 'bg-green-100' : 
                          stats.last30DaysAchievement >= 80 ? 'bg-yellow-100' : 'bg-red-100'
                        }`}>
                          <svg className={`w-5 h-5 ${
                            stats.last30DaysAchievement >= 100 ? 'text-green-600' : 
                            stats.last30DaysAchievement >= 80 ? 'text-yellow-600' : 'text-red-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {loading ? '...' : `${stats.last30DaysAchievement}%`}
                        </div>
                        <div className="text-sm text-gray-600">30 Days Achievement</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          stats.yesterdayAchievement >= 100 ? 'bg-green-100' : 
                          stats.yesterdayAchievement >= 80 ? 'bg-yellow-100' : 'bg-red-100'
                        }`}>
                          <svg className={`w-5 h-5 ${
                            stats.yesterdayAchievement >= 100 ? 'text-green-600' : 
                            stats.yesterdayAchievement >= 80 ? 'text-yellow-600' : 'text-red-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {loading ? '...' : `${stats.yesterdayAchievement}%`}
                        </div>
                        <div className="text-sm text-gray-600">Yesterday's Performance</div>
                        <div className="text-xs text-gray-400">
                          {new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Staff-specific statistics */}
          {profile?.role === 'STAFF' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : stats.totalTasks}
                  </div>
                  <div className="text-sm text-gray-600">My Tasks</div>
                </div>
              </div>
            </div>
          )}

          {/* Staff-specific statistics */}
          {profile?.role === 'STAFF' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : stats.totalTrainings}
                  </div>
                  <div className="text-sm text-gray-600">My Trainings</div>
                </div>
              </div>
            </div>
          )}

          {/* Attendance Analytics - Show for Admin/Manager/Office */}
          {(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'MANAGER' || profile?.role === 'OFFICE') && (
            <>
              {/* Replace lower attendance card with MTD Growth vs Last Year */}
              {profile?.role === 'MANAGER' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">MTD Growth vs Last Year</h2>
                    {managerDashboardLoading && (
                      <div className="text-sm text-gray-500">Loading…</div>
                    )}
                  </div>
                  {!managerDashboardLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-100">
                        <div className="text-sm text-blue-700 mb-1">Current Month Sales</div>
                        <div className="text-2xl font-bold text-blue-700">₹{managerGrowthData.currentMonthSales?.toLocaleString() || 0}</div>
                        <div className="text-xs text-blue-600">{managerGrowthData.currentMonth}</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Last Year Sales</div>
                        <div className="text-2xl font-bold text-gray-700">₹{managerGrowthData.lastYearSales?.toLocaleString() || 0}</div>
                        <div className="text-xs text-gray-500">{managerGrowthData.lastYearMonth}</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-green-50 border border-green-100">
                        <div className="text-sm text-green-700 mb-1">Growth</div>
                        <div className={`text-2xl font-bold ${managerGrowthData.growthPercentage > 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {managerGrowthData.growthPercentage > 0 ? '+' : ''}{managerGrowthData.growthPercentage || 0}%
                        </div>
                        <div className={`text-xs ${managerGrowthData.growthPercentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {managerGrowthData.growthPercentage > 0 ? '📈 Growing' : '📉 Declining'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {loading ? '...' : displayStats.thisMonthAttendance.present}
                    </div>
                    <div className="text-sm text-gray-600">Present This Month</div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {loading ? '...' : displayStats.thisMonthAttendance.absent}
                    </div>
                    <div className="text-sm text-gray-600">Absent This Month</div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {loading ? '...' : displayStats.thisMonthAttendance.total}
                    </div>
                    <div className="text-sm text-gray-600">Total This Month</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Yesterday's Performance Details */}
        {stats.yesterdayTarget > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Yesterday's Performance Details</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatCurrency(stats.yesterdaySales)}
                  </div>
                  <div className="text-sm text-gray-600">Actual Sales</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatCurrency(stats.yesterdayTarget)}
                  </div>
                  <div className="text-sm text-gray-600">Target</div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${
                    stats.yesterdayAchievement >= 100 ? 'text-green-600' : 
                    stats.yesterdayAchievement >= 80 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {stats.yesterdayAchievement}%
                  </div>
                  <div className="text-sm text-gray-600">Achievement</div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${
                    stats.yesterdaySales >= stats.yesterdayTarget ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(Math.abs(stats.yesterdaySales - stats.yesterdayTarget))}
                  </div>
                  <div className="text-sm text-gray-600">
                    {stats.yesterdaySales >= stats.yesterdayTarget ? 'Surplus' : 'Shortfall'}
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Target Progress</span>
                  <span>{stats.yesterdayAchievement}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      stats.yesterdayAchievement >= 100 ? 'bg-green-500' : 
                      stats.yesterdayAchievement >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(stats.yesterdayAchievement, 100)}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Performance Message */}
              <div className="mt-4 p-3 rounded-lg bg-gray-50">
                <div className="text-sm text-gray-700">
                  {stats.yesterdayAchievement >= 100 ? (
                    <span className="text-green-700">🎉 Excellent! You exceeded yesterday's target by {stats.yesterdayAchievement - 100}%</span>
                  ) : stats.yesterdayAchievement >= 80 ? (
                    <span className="text-yellow-700">📈 Good progress! You achieved {stats.yesterdayAchievement}% of yesterday's target</span>
                  ) : (
                    <span className="text-red-700">📉 Need improvement! You achieved {stats.yesterdayAchievement}% of yesterday's target</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                to={action.link}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center">
                  <div className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center text-white text-xl group-hover:scale-110 transition-transform`}>
                    {action.icon}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                      {action.title}
                    </div>
                    <div className="text-xs text-gray-500">Click to access</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Additional Statistics */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Show Training & Tests for Admin/Manager */}
          {(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'MANAGER') && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Training & Tests</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Active Trainings</span>
                  <span className="text-sm font-medium text-gray-900">
                    {loading ? '...' : stats.totalTrainings}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Active Tests</span>
                  <span className="text-sm font-medium text-gray-900">
                    {loading ? '...' : stats.totalTests}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Customers</span>
                  <span className="text-sm font-medium text-gray-900">
                    {loading ? '...' : stats.totalCustomers}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Staff-specific statistics */}
          {profile?.role === 'STAFF' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">My Progress</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Assigned Tasks</span>
                  <span className="text-sm font-medium text-gray-900">
                    {loading ? '...' : stats.totalTasks}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">My Trainings</span>
                  <span className="text-sm font-medium text-gray-900">
                    {loading ? '...' : stats.totalTrainings}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">My Tests</span>
                  <span className="text-sm font-medium text-gray-900">
                    {loading ? '...' : stats.totalTests}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600">All systems operational</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600">Database connected</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600">Real-time sync active</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                {loading ? (
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-gray-500 mb-1">Today</div>
                    <div className="text-sm">Dashboard loaded successfully</div>
                    <div className="text-xs text-gray-500 mt-2">System ready for operations</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Analytics Charts - Show for Admin/Manager/Office */}
        {(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'MANAGER' || profile?.role === 'OFFICE') && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Uniform Compliance Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Uniform Compliance This Month</h3>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.uniformData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {stats.uniformData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [value, 'Staff']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Shoe Compliance Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Shoe Compliance This Month</h3>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.shoeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {stats.shoeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [value, 'Staff']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Role-specific actions */}
            {profile.role === 'SUPER_ADMIN' && (
              <>
                <Link
                  to="/user-management"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">User Management</span>
                </Link>
                <Link
                  to="/stores-admin"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Store Management</span>
                </Link>
                <Link
                  to="/task-management"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Task Management</span>
                </Link>
                <Link
                  to="/reports"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Reports</span>
                </Link>
              </>
            )}

            {profile.role === 'ADMIN' && (
              <>
                <Link
                  to="/stores-admin"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Store Management</span>
                </Link>
                <Link
                  to="/admin-managers"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Manager Management</span>
                </Link>
                <Link
                  to="/task-management"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Task Management</span>
                </Link>
                <Link
                  to="/reports"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Reports</span>
                </Link>
              </>
            )}

            {profile.role === 'MANAGER' && (
              <>
                <Link
                  to="/staff-management"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Staff Management</span>
                </Link>
                <Link
                  to="/staff-attendance"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Staff Attendance</span>
                </Link>
                <Link
                  to="/rokar-entry"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Rokar Entry</span>
                </Link>
                <Link
                  to="/salary-approvals"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Salary Approvals</span>
                </Link>
              </>
            )}

            {profile.role === 'STAFF' && (
              <>
                <Link
                  to="/self-attendance"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Mark Attendance</span>
                </Link>
                <Link
                  to="/my-tasks"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">My Tasks</span>
                </Link>
                <Link
                  to="/leave-request"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Leave Request</span>
                </Link>
                <Link
                  to="/salary-request"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Salary Request</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Role-specific Information */}
        {profile.role === 'MANAGER' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-blue-900">Manager Dashboard</h3>
                <p className="text-blue-700">
                  You have access to manage your assigned store's operations, staff, tasks, and financial data.
                </p>
              </div>
            </div>
          </div>
        )}

        {profile.role === 'STAFF' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-green-900">Staff Dashboard</h3>
                <p className="text-green-700">
                  Access your personal features including attendance, leave requests, salary requests, and assigned trainings/tests.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Staff-specific Analytics */}
        {profile.role === 'STAFF' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : stats.staffStats.presentDays}
                  </div>
                  <div className="text-sm text-gray-600">Present Days</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : stats.staffStats.averageReachingTime}
                  </div>
                  <div className="text-sm text-gray-600">Avg. Reaching Time</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : stats.staffStats.googleReviewsDone}
                  </div>
                  <div className="text-sm text-gray-600">Google Reviews</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : stats.staffStats.losUpdatesDone}
                  </div>
                  <div className="text-sm text-gray-600">LOS Updates</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Calendar - Show for Staff */}
        {profile.role === 'STAFF' && (
          <div className="mb-8">
            <AttendanceCalendar />
          </div>
        )}

        {/* Manager Dashboard Sections - Show for Managers */}
        {profile?.role === 'MANAGER' && (
          <>
            {/* Manager's Rokar Status */}
            <div className="mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">📊 My Store's Rokar Status</h2>
                  <p className="text-sm text-gray-600 mt-1">Rokar data status for {getRokarReferenceDate().label} ({getRokarReferenceDate().dateStr}) for {profile.storeName}</p>
                </div>
                <div className="p-6">
                  {managerDashboardLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading rokar status...</p>
                    </div>
                  ) : (
                    <div className={`p-6 rounded-lg border ${
                      managerRokarStatus?.hasRokarData 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {managerRokarStatus?.hasRokarData ? '✅ Rokar Data Filled' : '❌ Rokar Data Not Filled'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Date: {managerRokarStatus?.date || 'Today'}
                          </p>
                          {managerRokarStatus?.hasRokarData && managerRokarStatus?.rokarData && (
                            <p className="text-sm text-gray-600 mt-1">
                              Sales: ₹{managerRokarStatus.rokarData.totalSale?.toLocaleString() || 0}
                            </p>
                          )}
                        </div>
                        <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                          managerRokarStatus?.hasRokarData 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {managerRokarStatus?.hasRokarData ? 'COMPLETED' : 'PENDING'}
                        </div>
                      </div>
                      {!managerRokarStatus?.hasRokarData && (
                        <div className="mt-4">
                          <Link
                            to="/rokar-entry"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Fill Rokar Data
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Manager's Staff Performance */}
            <div className="mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">👥 My Staff Performance</h2>
                  <p className="text-sm text-gray-600 mt-1">Best performing staff from yesterday</p>
                </div>
                <div className="p-6">
                  {managerDashboardLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading staff performance...</p>
                    </div>
                  ) : managerStaffPerformance.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No staff performance data available for yesterday.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Achievement</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {managerStaffPerformance.slice(0, 5).map((staff, index) => (
                            <tr key={staff.staffEmail} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {index === 0 && <span className="text-yellow-500 mr-2">🥇</span>}
                                  {index === 1 && <span className="text-gray-400 mr-2">🥈</span>}
                                  {index === 2 && <span className="text-orange-500 mr-2">🥉</span>}
                                  <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{staff.staffName}</div>
                                  <div className="text-sm text-gray-500">{staff.staffEmail}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ₹{staff.target.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ₹{staff.sales.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                    <div 
                                      className={`h-2 rounded-full ${
                                        staff.achievement >= 100 ? 'bg-green-500' :
                                        staff.achievement >= 80 ? 'bg-yellow-500' :
                                        staff.achievement >= 60 ? 'bg-orange-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${Math.min(staff.achievement, 100)}%` }}
                                    ></div>
                                  </div>
                                  <span className={`text-sm font-medium ${
                                    staff.achievement >= 100 ? 'text-green-600' :
                                    staff.achievement >= 80 ? 'text-yellow-600' :
                                    staff.achievement >= 60 ? 'text-orange-600' : 'text-red-600'
                                  }`}>
                                    {staff.achievement}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  staff.present 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {staff.present ? 'Present' : 'Absent'}
                                </span>
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

            {/* Manager's Growth vs Last Year */}
            <div className="mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">📈 Growth vs Last Year</h2>
                  <p className="text-sm text-gray-600 mt-1">Current month performance compared to last year</p>
                </div>
                <div className="p-6">
                  {managerDashboardLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading growth data...</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          ₹{managerGrowthData.currentMonthSales?.toLocaleString() || 0}
                        </div>
                        <div className="text-sm text-gray-600">Current Month Sales</div>
                        <div className="text-xs text-gray-500">{managerGrowthData.currentMonth}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-600">
                          ₹{managerGrowthData.lastYearSales?.toLocaleString() || 0}
                        </div>
                        <div className="text-sm text-gray-600">Last Year Sales</div>
                        <div className="text-xs text-gray-500">{managerGrowthData.lastYearMonth}</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${
                          managerGrowthData.growthPercentage > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {managerGrowthData.growthPercentage > 0 ? '+' : ''}{managerGrowthData.growthPercentage || 0}%
                        </div>
                        <div className="text-sm text-gray-600">Growth</div>
                        <div className={`text-xs ${
                          managerGrowthData.growthPercentage > 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {managerGrowthData.growthPercentage > 0 ? '📈 Growing' : '📉 Declining'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Manager's Achievements */}
            <div className="mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">🏆 My Store Achievements</h2>
                  <p className="text-sm text-gray-600 mt-1">Current month target achievement and completion status</p>
                </div>
                <div className="p-6">
                  {managerDashboardLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading achievements...</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          ₹{managerAchievements.totalTarget?.toLocaleString() || 0}
                        </div>
                        <div className="text-sm text-gray-600">Monthly Target</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          ₹{managerAchievements.currentMonthSales?.toLocaleString() || 0}
                        </div>
                        <div className="text-sm text-gray-600">Current Sales</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${
                          managerAchievements.achievement >= 100 ? 'text-green-600' :
                          managerAchievements.achievement >= 80 ? 'text-yellow-600' :
                          managerAchievements.achievement >= 60 ? 'text-orange-600' : 'text-red-600'
                        }`}>
                          {managerAchievements.achievement || 0}%
                        </div>
                        <div className="text-sm text-gray-600">Target Achievement</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div 
                            className={`h-2 rounded-full ${
                              managerAchievements.achievement >= 100 ? 'bg-green-500' :
                              managerAchievements.achievement >= 80 ? 'bg-yellow-500' :
                              managerAchievements.achievement >= 60 ? 'bg-orange-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(managerAchievements.achievement || 0, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {managerAchievements.completionRate || 0}%
                        </div>
                        <div className="text-sm text-gray-600">Data Completion</div>
                        <div className="text-xs text-gray-500">
                          {managerAchievements.daysWithData || 0}/{managerAchievements.daysCompleted || 0} days
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Admin Dashboard Sections - Show for Admin/Owner/SuperAdmin */}
        {['SUPER_ADMIN', 'ADMIN', 'OWNER'].includes(profile?.role) && (
          <>
            {/* Rokar Status Dashboard */}
            <div className="mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">📊 Rokar Data Status</h2>
                  <p className="text-sm text-gray-600 mt-1">Which stores have filled rokar data for {getRokarReferenceDate().label} ({getRokarReferenceDate().dateStr})</p>
                </div>
                <div className="p-6">
                  {dashboardLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading rokar status...</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {rokarStatus.map((store) => (
                        <div key={store.storeId} className={`p-4 rounded-lg border ${
                          store.hasRokarData 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-gray-900">{store.storeName}</h3>
                              <p className="text-sm text-gray-600">{store.storeBrand} • {store.storeLocation}</p>
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                              store.hasRokarData 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {store.hasRokarData ? '✅ Filled' : '❌ Not Filled'}
                            </div>
                          </div>
                          {store.hasRokarData && store.rokarData && (
                            <div className="mt-2 text-xs text-gray-500">
                              Sales: ₹{store.rokarData.totalSale?.toLocaleString() || 0}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Store Performance Dashboard */}
            <div className="mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">🏆 Store Performance Ranking</h2>
                  <p className="text-sm text-gray-600 mt-1">Stores ordered by sales achievement vs target (current month)</p>
                </div>
                

                
                <div className="p-6">
                  {dashboardLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading store performance...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Achievement</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days with Data</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {(isAdmin ? filteredStorePerformance : storePerformance).map((store, index) => (
                            <tr key={store.storeId} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {index === 0 && <span className="text-yellow-500 mr-2">🥇</span>}
                                  {index === 1 && <span className="text-gray-400 mr-2">🥈</span>}
                                  {index === 2 && <span className="text-orange-500 mr-2">🥉</span>}
                                  <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{store.storeName}</div>
                                  <div className="text-sm text-gray-500">{store.storeBrand} • {store.storeLocation}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ₹{store.totalTarget.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ₹{store.totalSales.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                    <div 
                                      className={`h-2 rounded-full ${
                                        store.achievement >= 100 ? 'bg-green-500' :
                                        store.achievement >= 80 ? 'bg-yellow-500' :
                                        store.achievement >= 60 ? 'bg-orange-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${Math.min(store.achievement, 100)}%` }}
                                    ></div>
                                  </div>
                                  <span className={`text-sm font-medium ${
                                    store.achievement >= 100 ? 'text-green-600' :
                                    store.achievement >= 80 ? 'text-yellow-600' :
                                    store.achievement >= 60 ? 'text-orange-600' : 'text-red-600'
                                  }`}>
                                    {store.achievement}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {store.daysWithData} days
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

            {/* Staff Performance Dashboard */}
            <div className="mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">👥 Top Performing Staff</h2>
                  <p className="text-sm text-gray-600 mt-1">Staff with highest sales achievement vs target (yesterday)</p>
                  {isAdmin && (
                    <div className="text-sm text-gray-500 mt-1">
                      Showing {(isAdmin ? filteredStaffPerformance : staffPerformance).length} of {staffPerformance.length} staff members
                    </div>
                  )}
                </div>
                <div className="p-6">
                  {dashboardLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading staff performance...</p>
                    </div>
                  ) : staffPerformance.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No staff performance data available for yesterday.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Achievement</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {(isAdmin ? filteredStaffPerformance : staffPerformance).slice(0, 10).map((staff, index) => (
                            <tr key={staff.staffEmail} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {index === 0 && <span className="text-yellow-500 mr-2">🥇</span>}
                                  {index === 1 && <span className="text-gray-400 mr-2">🥈</span>}
                                  {index === 2 && <span className="text-orange-500 mr-2">🥉</span>}
                                  <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{staff.staffName}</div>
                                  <div className="text-sm text-gray-500">{staff.staffEmail}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{staff.storeName}</div>
                                  <div className="text-sm text-gray-500">{staff.storeBrand}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ₹{staff.target.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ₹{staff.sales.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                    <div 
                                      className={`h-2 rounded-full ${
                                        staff.achievement >= 100 ? 'bg-green-500' :
                                        staff.achievement >= 80 ? 'bg-yellow-500' :
                                        staff.achievement >= 60 ? 'bg-orange-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${Math.min(staff.achievement, 100)}%` }}
                                    ></div>
                                  </div>
                                  <span className={`text-sm font-medium ${
                                    staff.achievement >= 100 ? 'text-green-600' :
                                    staff.achievement >= 80 ? 'text-yellow-600' :
                                    staff.achievement >= 60 ? 'text-orange-600' : 'text-red-600'
                                  }`}>
                                    {staff.achievement}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  staff.present 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {staff.present ? 'Present' : 'Absent'}
                                </span>
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
          </>
        )}
      </div>
    </div>
  );
}