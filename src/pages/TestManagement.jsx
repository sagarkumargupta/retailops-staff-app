import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function TestManagement() {
  const { profile } = useUserProfile();
  const [tests, setTests] = useState([]);
  const [stores, setStores] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTest, setEditingTest] = useState(null);

  const [testForm, setTestForm] = useState({
    title: '',
    description: '',
    targetAudience: 'all_staff',
    assignedStores: [],
    assignees: [],
    timeLimit: 30,
    passingScore: 70,
    questions: []
  });

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStores(),
        loadStaff(),
        loadTests()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTests = async () => {
    try {
      // Check if profile and email exist before making the query
      if (!profile?.email) {
        console.log('Profile or email not available, skipping tests load');
        setTests([]);
        return;
      }

      let testsList = [];
      
      if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN') {
        // For admin roles, load all tests
        const testsSnap = await getDocs(collection(db, 'tests'));
        testsList = testsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else if (profile?.role === 'MANAGER') {
        // For managers, load tests they created or are assigned to
        const testsSnap = await getDocs(collection(db, 'tests'));
        testsList = testsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(test => 
            test.createdBy === profile.email || 
            (test.assignees && test.assignees.includes(profile.email))
          );
      } else {
        // For other roles, load all tests (fallback)
        const testsSnap = await getDocs(collection(db, 'tests'));
        testsList = testsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      // Sort by creation date (newest first)
      testsList.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      setTests(testsList);
    } catch (error) {
      console.error('Error loading tests:', error);
      setTests([]);
    }
  };

  const loadStores = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'stores'));
      let storesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (profile?.role === 'MANAGER') {
        const managerStoreIds = profile.stores && typeof profile.stores === 'object' 
          ? Object.keys(profile.stores).filter(key => profile.stores[key] === true)
          : [];
        storesData = storesData.filter(store => managerStoreIds.includes(store.id));
      }

      setStores(storesData);
    } catch (error) {
      console.error('Error loading stores:', error);
      setStores([]);
    }
  };

  const loadStaff = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      let staffData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.role === 'STAFF' || user.role === 'MANAGER');

      if (profile?.role === 'MANAGER') {
        const managerStoreIds = profile.stores && typeof profile.stores === 'object' 
          ? Object.keys(profile.stores).filter(key => profile.stores[key] === true)
          : [];
        staffData = staffData.filter(user => 
          user.stores && Object.keys(user.stores).some(storeId => 
            managerStoreIds.includes(storeId) && user.stores[storeId] === true
          )
        );
      }

      setStaff(staffData);
    } catch (error) {
      console.error('Error loading staff:', error);
      setStaff([]);
    }
  };

  const getAssignedStores = () => {
    if (testForm.targetAudience === 'location') {
      return testForm.assignedStores;
    }
    return [];
  };

  // Derive manager's store IDs from profile (supports single or multiple stores)
  const getManagerStoreIds = () => {
    if (!profile) return [];
    if (profile.assignedStore) return [profile.assignedStore];
    if (profile.stores && typeof profile.stores === 'object') {
      return Object.keys(profile.stores).filter((id) => profile.stores[id] === true);
    }
    return [];
  };

  const getAssignees = () => {
    if (testForm.targetAudience === 'individual') {
      return testForm.assignees;
    }
    return [];
  };

  const handleCreateTest = async () => {
    try {
      // Scope "All Staff" created by a Manager to only their store(s)
      const isManager = profile?.role === 'MANAGER';
      const managerStores = getManagerStoreIds();
      const effectiveTargetAudience = (isManager && testForm.targetAudience === 'all_staff') ? 'location' : testForm.targetAudience;
      const effectiveAssignedStores = (effectiveTargetAudience === 'location')
        ? (testForm.assignedStores && testForm.assignedStores.length > 0 ? testForm.assignedStores : (isManager ? managerStores : []))
        : [];

      const testData = {
        ...testForm,
        targetAudience: effectiveTargetAudience,
        createdBy: profile.email,
        createdAt: serverTimestamp(),
        assignedStores: effectiveAssignedStores,
        assignees: getAssignees(),
        totalQuestions: testForm.questions.length,
        totalPoints: testForm.questions.reduce((sum, q) => sum + (q.points || 1), 0)
      };

      await addDoc(collection(db, 'tests'), testData);
      setShowCreateModal(false);
      resetForm();
      loadTests();
    } catch (error) {
      console.error('Error creating test:', error);
      alert('Error creating test. Please try again.');
    }
  };

  const handleEditTest = async () => {
    try {
      const isManager = profile?.role === 'MANAGER';
      const managerStores = getManagerStoreIds();
      const effectiveTargetAudience = (isManager && testForm.targetAudience === 'all_staff') ? 'location' : testForm.targetAudience;
      const effectiveAssignedStores = (effectiveTargetAudience === 'location')
        ? (testForm.assignedStores && testForm.assignedStores.length > 0 ? testForm.assignedStores : (isManager ? managerStores : []))
        : [];

      const testData = {
        ...testForm,
        targetAudience: effectiveTargetAudience,
        updatedAt: serverTimestamp(),
        assignedStores: effectiveAssignedStores,
        assignees: getAssignees(),
        totalQuestions: testForm.questions.length,
        totalPoints: testForm.questions.reduce((sum, q) => sum + (q.points || 1), 0)
      };

      await updateDoc(doc(db, 'tests', editingTest.id), testData);
      setShowEditModal(false);
      resetForm();
      loadTests();
    } catch (error) {
      console.error('Error updating test:', error);
      alert('Error updating test. Please try again.');
    }
  };

  const handleDeleteTest = async (testId) => {
    if (window.confirm('Are you sure you want to delete this test?')) {
      try {
        await deleteDoc(doc(db, 'tests', testId));
        loadTests();
      } catch (error) {
        console.error('Error deleting test:', error);
        alert('Error deleting test. Please try again.');
      }
    }
  };

  const resetForm = () => {
    setTestForm({
      title: '',
      description: '',
      targetAudience: 'all_staff',
      assignedStores: [],
      assignees: [],
      timeLimit: 30,
      passingScore: 70,
      questions: []
    });
    setEditingTest(null);
  };

  const openEditModal = (test) => {
    setEditingTest(test);
    setTestForm({
      title: test.title,
      description: test.description,
      targetAudience: test.targetAudience,
      assignedStores: test.assignedStores || [],
      assignees: test.assignees || [],
      timeLimit: test.timeLimit,
      passingScore: test.passingScore,
      questions: test.questions || []
    });
    setShowEditModal(true);
  };

  const addQuestion = () => {
    const newQuestion = {
      id: Date.now(),
      type: 'multiple_choice',
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 1,
      explanation: ''
    };
    setTestForm(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
  };

  const updateQuestion = (index, field, value) => {
    const updatedQuestions = [...testForm.questions];
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: value
    };
    setTestForm(prev => ({
      ...prev,
      questions: updatedQuestions
    }));
  };

  const removeQuestion = (index) => {
    setTestForm(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const generateCalculationQuestion = () => {
    const questionTypes = [
      {
        type: 'ATV',
        template: 'Calculate ATV (Average Transaction Value) if total sales is ₹{sales} and number of transactions is {transactions}.',
        variables: { sales: Math.floor(Math.random() * 50000) + 10000, transactions: Math.floor(Math.random() * 50) + 10 },
        answer: (vars) => Math.round(vars.sales / vars.transactions)
      },
      {
        type: 'UPT',
        template: 'Calculate UPT (Units Per Transaction) if total units sold is {units} and number of transactions is {transactions}.',
        variables: { units: Math.floor(Math.random() * 200) + 50, transactions: Math.floor(Math.random() * 30) + 10 },
        answer: (vars) => Math.round((vars.units / vars.transactions) * 10) / 10
      },
      {
        type: 'ASP',
        template: 'Calculate ASP (Average Selling Price) if total sales is ₹{sales} and total units sold is {units}.',
        variables: { sales: Math.floor(Math.random() * 100000) + 20000, units: Math.floor(Math.random() * 300) + 50 },
        answer: (vars) => Math.round(vars.sales / vars.units)
      }
    ];

    const selectedType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    const questionText = selectedType.template.replace(/\{(\w+)\}/g, (match, key) => selectedType.variables[key]);
    const correctAnswer = selectedType.answer(selectedType.variables);

    const newQuestion = {
      id: Date.now(),
      type: 'calculation',
      question: questionText,
      correctAnswer: correctAnswer.toString(),
      points: 2,
      explanation: `Correct answer: ${correctAnswer}`
    };

    setTestForm(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading test management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Test Management</h1>
          <p className="mt-2 text-gray-600">
            Create and manage test modules for staff assessment
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Tests</p>
                <p className="text-2xl font-semibold text-gray-900">{tests.length}</p>
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
                <p className="text-sm font-medium text-gray-500">Active Tests</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {tests.filter(t => t.isActive).length}
                </p>
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
                <p className="text-sm font-medium text-gray-500">Avg Time Limit</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {tests.length > 0 ? Math.round(tests.reduce((sum, t) => sum + (t.timeLimit || 30), 0) / tests.length) : 0} min
                </p>
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
                <p className="text-sm font-medium text-gray-500">Total Questions</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {tests.reduce((sum, t) => sum + (t.totalQuestions || 0), 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex flex-wrap gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create New Test
          </button>
          <button
            onClick={generateCalculationQuestion}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Generate Calculation Question
          </button>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Limit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tests.map((test) => (
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
                        {test.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        test.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                        test.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {test.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {test.totalQuestions || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {test.timeLimit || 30} min
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        test.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {test.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(test)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTest(test.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tests.length === 0 && (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No tests</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new test module.</p>
              </div>
            )}
          </div>
        </div>

        {/* Test Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Create New Test
                  </h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Test Title</label>
                      <input
                        type="text"
                        value={testForm.title}
                        onChange={(e) => setTestForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter test title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select
                        value={testForm.category}
                        onChange={(e) => setTestForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="sales">Sales & Calculations</option>
                        <option value="product">Product Knowledge</option>
                        <option value="customer">Customer Experience</option>
                        <option value="store">Store Operations</option>
                        <option value="general">General Knowledge</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                      <select
                        value={testForm.difficulty}
                        onChange={(e) => setTestForm(prev => ({ ...prev, difficulty: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time Limit (minutes)</label>
                      <input
                        type="number"
                        value={testForm.timeLimit}
                        onChange={(e) => setTestForm(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || 30 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="5"
                        max="180"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Passing Score (%)</label>
                      <input
                        type="number"
                        value={testForm.passingScore}
                        onChange={(e) => setTestForm(prev => ({ ...prev, passingScore: parseInt(e.target.value) || 70 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                      <select
                        value={testForm.targetAudience}
                        onChange={(e) => setTestForm(prev => ({ ...prev, targetAudience: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all_staff">All Staff</option>
                        <option value="all_managers">All Managers</option>
                        <option value="location">Location Wise</option>
                        <option value="brand">Brand Wise</option>
                        <option value="individual">Individual</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={testForm.description}
                      onChange={(e) => setTestForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter test description"
                    />
                  </div>

                  {/* Assignment Options */}
                  {testForm.targetAudience === 'location' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Stores</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {stores.map(store => (
                          <label key={store.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={testForm.assignedStores.includes(store.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTestForm(prev => ({
                                    ...prev,
                                    assignedStores: [...prev.assignedStores, store.id]
                                  }));
                                } else {
                                  setTestForm(prev => ({
                                    ...prev,
                                    assignedStores: prev.assignedStores.filter(id => id !== store.id)
                                  }));
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">{store.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {testForm.targetAudience === 'individual' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Staff</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {staff.map(member => (
                          <label key={member.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={testForm.assignees.includes(member.email)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTestForm(prev => ({
                                    ...prev,
                                    assignees: [...prev.assignees, member.email]
                                  }));
                                } else {
                                  setTestForm(prev => ({
                                    ...prev,
                                    assignees: prev.assignees.filter(email => email !== member.email)
                                  }));
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">{member.name} ({member.role})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Questions Section */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-medium text-gray-900">Questions</h4>
                      <button
                        onClick={addQuestion}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Add Question
                      </button>
                    </div>

                    <div className="space-y-4">
                      {testForm.questions.map((question, index) => (
                        <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h5 className="font-medium">Question {index + 1}</h5>
                            <button
                              onClick={() => removeQuestion(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
                              <select
                                value={question.type}
                                onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="multiple_choice">Multiple Choice</option>
                                <option value="calculation">Calculation</option>
                                <option value="text">Text Answer</option>
                                <option value="true_false">True/False</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                              <input
                                type="number"
                                value={question.points}
                                onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="1"
                                max="10"
                              />
                            </div>
                          </div>

                          <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                            <textarea
                              value={question.question}
                              onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter your question"
                            />
                          </div>

                          {/* Options for multiple choice */}
                          {question.type === 'multiple_choice' && (
                            <div className="mb-3">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                              <div className="space-y-2">
                                {question.options.map((option, optionIndex) => (
                                  <div key={optionIndex} className="flex items-center">
                                    <input
                                      type="radio"
                                      name={`correct-${question.id}`}
                                      checked={question.correctAnswer === optionIndex}
                                      onChange={() => updateQuestion(index, 'correctAnswer', optionIndex)}
                                      className="mr-2"
                                    />
                                    <input
                                      type="text"
                                      value={option}
                                      onChange={(e) => {
                                        const newOptions = [...question.options];
                                        newOptions[optionIndex] = e.target.value;
                                        updateQuestion(index, 'options', newOptions);
                                      }}
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      placeholder={`Option ${optionIndex + 1}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Answer for calculation/text/true_false */}
                          {(question.type === 'calculation' || question.type === 'text' || question.type === 'true_false') && (
                            <div className="mb-3">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {question.type === 'calculation' ? 'Correct Answer' : 
                                 question.type === 'text' ? 'Expected Answer' : 'Correct Answer'}
                              </label>
                              {question.type === 'true_false' ? (
                                <select
                                  value={question.correctAnswer}
                                  onChange={(e) => updateQuestion(index, 'correctAnswer', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="true">True</option>
                                  <option value="false">False</option>
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={question.correctAnswer}
                                  onChange={(e) => updateQuestion(index, 'correctAnswer', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder={question.type === 'calculation' ? 'Enter correct answer' : 'Enter expected answer'}
                                />
                              )}
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (Optional)</label>
                            <textarea
                              value={question.explanation}
                              onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Explain the correct answer"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={testForm.isActive}
                        onChange={(e) => setTestForm(prev => ({ ...prev, isActive: e.target.checked }))}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Active Test</span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateTest}
                      disabled={!testForm.title || testForm.questions.length === 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create Test
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Test Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Edit Test
                  </h3>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Test Title</label>
                      <input
                        type="text"
                        value={testForm.title}
                        onChange={(e) => setTestForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter test title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select
                        value={testForm.category}
                        onChange={(e) => setTestForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="sales">Sales & Calculations</option>
                        <option value="product">Product Knowledge</option>
                        <option value="customer">Customer Experience</option>
                        <option value="store">Store Operations</option>
                        <option value="general">General Knowledge</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                      <select
                        value={testForm.difficulty}
                        onChange={(e) => setTestForm(prev => ({ ...prev, difficulty: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time Limit (minutes)</label>
                      <input
                        type="number"
                        value={testForm.timeLimit}
                        onChange={(e) => setTestForm(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || 30 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="5"
                        max="180"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Passing Score (%)</label>
                      <input
                        type="number"
                        value={testForm.passingScore}
                        onChange={(e) => setTestForm(prev => ({ ...prev, passingScore: parseInt(e.target.value) || 70 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                      <select
                        value={testForm.targetAudience}
                        onChange={(e) => setTestForm(prev => ({ ...prev, targetAudience: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all_staff">All Staff</option>
                        <option value="all_managers">All Managers</option>
                        <option value="location">Location Wise</option>
                        <option value="brand">Brand Wise</option>
                        <option value="individual">Individual</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={testForm.description}
                      onChange={(e) => setTestForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter test description"
                    />
                  </div>

                  {/* Assignment Options */}
                  {testForm.targetAudience === 'location' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Stores</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {stores.map(store => (
                          <label key={store.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={testForm.assignedStores.includes(store.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTestForm(prev => ({
                                    ...prev,
                                    assignedStores: [...prev.assignedStores, store.id]
                                  }));
                                } else {
                                  setTestForm(prev => ({
                                    ...prev,
                                    assignedStores: prev.assignedStores.filter(id => id !== store.id)
                                  }));
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">{store.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {testForm.targetAudience === 'individual' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Staff</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {staff.map(member => (
                          <label key={member.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={testForm.assignees.includes(member.email)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTestForm(prev => ({
                                    ...prev,
                                    assignees: [...prev.assignees, member.email]
                                  }));
                                } else {
                                  setTestForm(prev => ({
                                    ...prev,
                                    assignees: prev.assignees.filter(email => email !== member.email)
                                  }));
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">{member.name} ({member.role})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Questions Section */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-medium text-gray-900">Questions</h4>
                      <button
                        onClick={addQuestion}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Add Question
                      </button>
                    </div>

                    <div className="space-y-4">
                      {testForm.questions.map((question, index) => (
                        <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h5 className="font-medium">Question {index + 1}</h5>
                            <button
                              onClick={() => removeQuestion(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
                              <select
                                value={question.type}
                                onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="multiple_choice">Multiple Choice</option>
                                <option value="calculation">Calculation</option>
                                <option value="text">Text Answer</option>
                                <option value="true_false">True/False</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                              <input
                                type="number"
                                value={question.points}
                                onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="1"
                                max="10"
                              />
                            </div>
                          </div>

                          <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                            <textarea
                              value={question.question}
                              onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter your question"
                            />
                          </div>

                          {/* Options for multiple choice */}
                          {question.type === 'multiple_choice' && (
                            <div className="mb-3">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                              <div className="space-y-2">
                                {question.options.map((option, optionIndex) => (
                                  <div key={optionIndex} className="flex items-center">
                                    <input
                                      type="radio"
                                      name={`correct-${question.id}`}
                                      checked={question.correctAnswer === optionIndex}
                                      onChange={() => updateQuestion(index, 'correctAnswer', optionIndex)}
                                      className="mr-2"
                                    />
                                    <input
                                      type="text"
                                      value={option}
                                      onChange={(e) => {
                                        const newOptions = [...question.options];
                                        newOptions[optionIndex] = e.target.value;
                                        updateQuestion(index, 'options', newOptions);
                                      }}
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      placeholder={`Option ${optionIndex + 1}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Answer for calculation/text/true_false */}
                          {(question.type === 'calculation' || question.type === 'text' || question.type === 'true_false') && (
                            <div className="mb-3">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {question.type === 'calculation' ? 'Correct Answer' : 
                                 question.type === 'text' ? 'Expected Answer' : 'Correct Answer'}
                              </label>
                              {question.type === 'true_false' ? (
                                <select
                                  value={question.correctAnswer}
                                  onChange={(e) => updateQuestion(index, 'correctAnswer', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="true">True</option>
                                  <option value="false">False</option>
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={question.correctAnswer}
                                  onChange={(e) => updateQuestion(index, 'correctAnswer', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder={question.type === 'calculation' ? 'Enter correct answer' : 'Enter expected answer'}
                                />
                              )}
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (Optional)</label>
                            <textarea
                              value={question.explanation}
                              onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Explain the correct answer"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={testForm.isActive}
                        onChange={(e) => setTestForm(prev => ({ ...prev, isActive: e.target.checked }))}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Active Test</span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowEditModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditTest}
                      disabled={!testForm.title || testForm.questions.length === 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Update Test
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
