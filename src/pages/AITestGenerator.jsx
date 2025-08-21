import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { Link } from 'react-router-dom';
import { updateAllUsersWithAITrainingPermissions } from '../utils/userManagement';

export default function AITestGenerator() {
  const { profile, hasPermission } = useUserProfile();
  const [availableModules, setAvailableModules] = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);
  const [testConfig, setTestConfig] = useState({
    testName: '',
    description: '',
    difficulty: 'intermediate',
    questionTypes: ['mcq', 'true_false', 'fill_blank', 'short_answer'],
    totalQuestions: 20,
    timeLimit: 30,
    passingScore: 70,
    allowRetake: true,
    shuffleQuestions: true,
    targetAudience: 'all_staff', // 'all_staff', 'managers_only', 'staff_only'
    priority: 'normal', // 'low', 'normal', 'high', 'critical'
    assignmentType: 'all_stores' // 'all_stores', 'brand_specific', 'store_specific'
  });
  const [stores, setStores] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedStores, setSelectedStores] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [generatedTests, setGeneratedTests] = useState([]);
  const [processingStatus, setProcessingStatus] = useState('idle');
  const [selectedTest, setSelectedTest] = useState(null);
  const [permissionMsg, setPermissionMsg] = useState('');
  const [permissionBusy, setPermissionBusy] = useState(false);

  useEffect(() => {
    if (profile?.email) {
      loadAvailableModules();
      loadGeneratedTests();
      loadStoresAndBrands();
    }
  }, [profile?.email]);

  const fixPermissions = async () => {
    setPermissionBusy(true);
    setPermissionMsg('Fixing permissions...');
    try {
      const result = await updateAllUsersWithAITrainingPermissions();
      setPermissionMsg(`✅ Fixed permissions for ${result.updatedCount} users. Please refresh the page.`);
      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error fixing permissions:', error);
      setPermissionMsg('❌ Failed to fix permissions: ' + error.message);
    } finally {
      setPermissionBusy(false);
    }
  };

  const loadStoresAndBrands = async () => {
    try {
      const storesSnap = await getDocs(collection(db, 'stores'));
      let storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter stores based on user's access
      const userStores = getStoresForFiltering();
      console.log('AITestGenerator: User accessible stores:', userStores);
      
      if (userStores.length > 0) {
        // User has specific store access - filter to only those stores
        storesList = storesList.filter(store => userStores.includes(store.id));
        console.log('AITestGenerator: Filtered stores for user:', storesList.length);
      }
      
      setStores(storesList);

      // Extract unique brands from accessible stores only
      const uniqueBrands = [...new Set(storesList.map(store => store.brand).filter(Boolean))];
      setBrands(uniqueBrands);
      console.log('AITestGenerator: Available brands for user:', uniqueBrands);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const loadAvailableModules = async () => {
    try {
      const modulesQuery = query(
        collection(db, 'aiTrainingModules'),
        where('status', '==', 'published')
      );
      const modulesSnap = await getDocs(modulesQuery);
      const modules = modulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailableModules(modules);
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };

  const loadGeneratedTests = async () => {
    try {
      const testsQuery = query(
        collection(db, 'aiGeneratedTests'),
        where('createdBy', '==', profile?.email)
      );
      const testsSnap = await getDocs(testsQuery);
      const tests = testsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGeneratedTests(tests);
    } catch (error) {
      console.error('Error loading tests:', error);
    }
  };

  const generateTest = async () => {
    if (!testConfig.testName || selectedModules.length === 0) {
      alert('Please provide a test name and select at least one module');
      return;
    }

    try {
      setProcessingStatus('generating');

      // Simulate AI test generation
      await new Promise(resolve => setTimeout(resolve, 3000));

      const allQuestions = [];
      const moduleTopics = new Set();

      // Collect questions from selected modules
      for (const moduleId of selectedModules) {
        const module = availableModules.find(m => m.id === moduleId);
        if (module) {
          module.topics.forEach(topic => moduleTopics.add(topic));
          
          module.sections.forEach(section => {
            section.questions.forEach(question => {
              allQuestions.push({
                ...question,
                moduleId: module.id,
                moduleTitle: module.title,
                sectionTitle: section.title
              });
            });
          });
        }
      }

      // Shuffle questions if enabled
      if (testConfig.shuffleQuestions) {
        allQuestions.sort(() => Math.random() - 0.5);
      }

      // Select questions based on configuration
      const selectedQuestions = allQuestions.slice(0, testConfig.totalQuestions);

      // Generate additional AI questions if needed
      const additionalQuestions = await generateAIQuestions(
        Array.from(moduleTopics),
        testConfig.totalQuestions - selectedQuestions.length
      );

      const finalQuestions = [...selectedQuestions, ...additionalQuestions];

      // Determine assignment based on type
      let assignedStores = [];
      let assignedBrands = [];
      
      switch (testConfig.assignmentType) {
        case 'all_stores':
          assignedStores = stores.map(store => store.id);
          assignedBrands = brands;
          break;
        case 'brand_specific':
          assignedBrands = selectedBrands;
          assignedStores = stores.filter(store => selectedBrands.includes(store.brand)).map(store => store.id);
          break;
        case 'store_specific':
          assignedStores = selectedStores;
          assignedBrands = [...new Set(stores.filter(store => selectedStores.includes(store.id)).map(store => store.brand))];
          break;
      }

      const test = {
        id: `test_${Date.now()}`,
        name: testConfig.testName,
        description: testConfig.description,
        difficulty: testConfig.difficulty,
        questions: finalQuestions,
        totalQuestions: finalQuestions.length,
        timeLimit: testConfig.timeLimit,
        passingScore: testConfig.passingScore,
        allowRetake: testConfig.allowRetake,
        shuffleQuestions: testConfig.shuffleQuestions,
        moduleIds: selectedModules,
        topics: Array.from(moduleTopics),
        assignmentType: testConfig.assignmentType,
        assignedStores: assignedStores,
        assignedBrands: assignedBrands,
        targetAudience: testConfig.targetAudience,
        priority: testConfig.priority,
        createdAt: new Date(),
        createdBy: profile?.email,
        status: 'draft',
        statistics: {
          totalAttempts: 0,
          averageScore: 0,
          passRate: 0
        }
      };

      // Save to Firestore
      const testRef = await addDoc(collection(db, 'aiGeneratedTests'), {
        ...test,
        createdAt: serverTimestamp()
      });

      test.id = testRef.id;
      setGeneratedTests(prev => [...prev, test]);
      setProcessingStatus('ready');

      // Reset form
      setTestConfig({
        ...testConfig,
        testName: '',
        description: ''
      });
      setSelectedModules([]);

      alert('Test generated successfully!');

    } catch (error) {
      console.error('Error generating test:', error);
      setProcessingStatus('error');
      alert('Error generating test. Please try again.');
    }
  };

  const generateAIQuestions = async (topics, count) => {
    const questions = [];
    const questionTypes = testConfig.questionTypes;

    for (let i = 0; i < count; i++) {
      const type = questionTypes[Math.floor(Math.random() * questionTypes.length)];
      const topic = topics[Math.floor(Math.random() * topics.length)];

      switch (type) {
        case 'mcq':
          questions.push({
            type: 'mcq',
            question: `Which of the following best describes ${topic.toLowerCase()}?`,
            options: [
              'A systematic approach to problem-solving',
              'A random collection of activities',
              'An optional business process',
              'A temporary organizational structure'
            ],
            correctAnswer: 0,
            explanation: `${topic} involves a systematic approach to achieve business objectives.`,
            moduleId: 'ai_generated',
            moduleTitle: 'AI Generated',
            sectionTitle: topic
          });
          break;

        case 'true_false':
          questions.push({
            type: 'true_false',
            question: `${topic} is essential for retail business success.`,
            correctAnswer: true,
            explanation: `${topic} plays a crucial role in retail operations and customer satisfaction.`,
            moduleId: 'ai_generated',
            moduleTitle: 'AI Generated',
            sectionTitle: topic
          });
          break;

        case 'fill_blank':
          questions.push({
            type: 'fill_blank',
            question: `The primary goal of ${topic.toLowerCase()} is to improve ________.`,
            correctAnswer: 'efficiency',
            explanation: 'Efficiency improvement is a key objective of this process.',
            moduleId: 'ai_generated',
            moduleTitle: 'AI Generated',
            sectionTitle: topic
          });
          break;

        case 'short_answer':
          questions.push({
            type: 'short_answer',
            question: `Explain the importance of ${topic.toLowerCase()} in retail operations.`,
            correctAnswer: 'It helps improve customer satisfaction and operational efficiency',
            explanation: 'This topic is crucial for maintaining high service standards.',
            moduleId: 'ai_generated',
            moduleTitle: 'AI Generated',
            sectionTitle: topic
          });
          break;
      }
    }

    return questions;
  };

  const publishTest = async (testId) => {
    try {
      await setDoc(doc(db, 'aiGeneratedTests', testId), {
        status: 'published',
        publishedAt: serverTimestamp()
      }, { merge: true });

      setGeneratedTests(prev =>
        prev.map(t => t.id === testId ? { ...t, status: 'published' } : t)
      );

      alert('Test published successfully!');
    } catch (error) {
      console.error('Error publishing test:', error);
      alert('Error publishing test');
    }
  };

  const toggleModuleSelection = (moduleId) => {
    setSelectedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  if (!hasPermission('canUseAITraining')) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access AI Test Generator.</p>
          <button
            onClick={fixPermissions}
            disabled={permissionBusy}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {permissionBusy ? 'Fixing...' : 'Fix Permissions'}
          </button>
          {permissionMsg && (
            <p className="mt-4 text-sm text-gray-600">{permissionMsg}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🧠 AI Test Generator</h1>
        <p className="text-gray-600">Generate comprehensive test series from training modules using AI</p>
      </div>

      {/* Assignment Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">🎯 Assignment Configuration</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignment Type
            </label>
            <select
              value={testConfig.assignmentType}
              onChange={(e) => setTestConfig(prev => ({ ...prev, assignmentType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all_stores">All Stores</option>
              <option value="brand_specific">Brand Specific</option>
              <option value="store_specific">Store Specific</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Audience
            </label>
            <select
              value={testConfig.targetAudience}
              onChange={(e) => setTestConfig(prev => ({ ...prev, targetAudience: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all_staff">All Staff</option>
              <option value="managers_only">Managers Only</option>
              <option value="staff_only">Staff Only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority Level
            </label>
            <select
              value={testConfig.priority}
              onChange={(e) => setTestConfig(prev => ({ ...prev, priority: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Brand Selection */}
        {testConfig.assignmentType === 'brand_specific' && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Select Brands</h3>
            <div className="grid md:grid-cols-3 gap-3">
              {brands.map((brand) => (
                <label key={brand} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedBrands.includes(brand)}
                    onChange={() => {
                      setSelectedBrands(prev =>
                        prev.includes(brand)
                          ? prev.filter(b => b !== brand)
                          : [...prev, brand]
                      );
                    }}
                    className="mr-3"
                  />
                  <span className="text-sm font-medium text-gray-700">{brand}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Store Selection */}
        {testConfig.assignmentType === 'store_specific' && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Select Stores</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stores.map((store) => (
                <label key={store.id} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedStores.includes(store.id)}
                    onChange={() => {
                      setSelectedStores(prev =>
                        prev.includes(store.id)
                          ? prev.filter(id => id !== store.id)
                          : [...prev, store.id]
                      );
                    }}
                    className="mr-3"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-700">{store.name}</div>
                    <div className="text-xs text-gray-500">{store.brand} • {store.city}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Test Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">⚙️ Test Configuration</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Name *
            </label>
            <input
              type="text"
              value={testConfig.testName}
              onChange={(e) => setTestConfig(prev => ({ ...prev, testName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter test name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty Level
            </label>
            <select
              value={testConfig.difficulty}
              onChange={(e) => setTestConfig(prev => ({ ...prev, difficulty: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Questions
            </label>
            <input
              type="number"
              value={testConfig.totalQuestions}
              onChange={(e) => setTestConfig(prev => ({ ...prev, totalQuestions: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="5"
              max="100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Limit (minutes)
            </label>
            <input
              type="number"
              value={testConfig.timeLimit}
              onChange={(e) => setTestConfig(prev => ({ ...prev, timeLimit: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="5"
              max="180"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Passing Score (%)
            </label>
            <input
              type="number"
              value={testConfig.passingScore}
              onChange={(e) => setTestConfig(prev => ({ ...prev, passingScore: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="50"
              max="100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question Types
            </label>
            <div className="space-y-2">
              {['mcq', 'true_false', 'fill_blank', 'short_answer'].map(type => (
                <label key={type} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={testConfig.questionTypes.includes(type)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTestConfig(prev => ({
                          ...prev,
                          questionTypes: [...prev.questionTypes, type]
                        }));
                      } else {
                        setTestConfig(prev => ({
                          ...prev,
                          questionTypes: prev.questionTypes.filter(t => t !== type)
                        }));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 capitalize">
                    {type.replace('_', ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={testConfig.description}
            onChange={(e) => setTestConfig(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows="3"
            placeholder="Enter test description"
          />
        </div>

        <div className="mt-4 flex space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={testConfig.allowRetake}
              onChange={(e) => setTestConfig(prev => ({ ...prev, allowRetake: e.target.checked }))}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Allow Retake</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={testConfig.shuffleQuestions}
              onChange={(e) => setTestConfig(prev => ({ ...prev, shuffleQuestions: e.target.checked }))}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Shuffle Questions</span>
          </label>
        </div>
      </div>

      {/* Module Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📚 Select Training Modules</h2>
        
        {availableModules.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No published training modules available.</p>
            <Link to="/ai-training-generator" className="text-blue-600 hover:underline">
              Create training modules first
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableModules.map((module) => (
              <div
                key={module.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedModules.includes(module.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => toggleModuleSelection(module.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{module.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{module.description}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {module.topics.slice(0, 3).map((topic, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          {topic}
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>{module.duration} min</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        module.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                        module.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {module.difficulty}
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 ml-2 ${
                    selectedModules.includes(module.id)
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {selectedModules.includes(module.id) && (
                      <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedModules.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              Selected {selectedModules.length} module(s)
            </p>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <div className="text-center mb-8">
        <button
          onClick={generateTest}
          disabled={processingStatus === 'generating' || selectedModules.length === 0 || !testConfig.testName}
          className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processingStatus === 'generating' ? 'Generating Test...' : 'Generate Test'}
        </button>
      </div>

      {/* Generated Tests */}
      {generatedTests.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📝 Generated Tests</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generatedTests.map((test) => (
              <div key={test.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{test.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{test.description}</p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Questions:</span>
                    <span className="font-medium">{test.totalQuestions}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Time Limit:</span>
                    <span className="font-medium">{test.timeLimit} min</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Passing Score:</span>
                    <span className="font-medium">{test.passingScore}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Assignment:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      test.assignmentType === 'all_stores' ? 'bg-blue-100 text-blue-800' :
                      test.assignmentType === 'brand_specific' ? 'bg-purple-100 text-purple-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {test.assignmentType?.replace('_', ' ') || 'all stores'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Priority:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      test.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      test.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      test.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {test.priority || 'normal'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      test.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {test.status}
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedTest(test)}
                    className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
                  >
                    View Details
                  </button>
                  {test.status === 'draft' && (
                    <button
                      onClick={() => publishTest(test.id)}
                      className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700"
                    >
                      Publish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Details Modal */}
      {selectedTest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">{selectedTest.name}</h2>
                <button
                  onClick={() => setSelectedTest(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Test Overview</h3>
                <p className="text-gray-600 mb-4">{selectedTest.description}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{selectedTest.totalQuestions}</div>
                    <div className="text-sm text-gray-600">Questions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{selectedTest.timeLimit}</div>
                    <div className="text-sm text-gray-600">Minutes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{selectedTest.passingScore}%</div>
                    <div className="text-sm text-gray-600">Pass Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{selectedTest.statistics.totalAttempts}</div>
                    <div className="text-sm text-gray-600">Attempts</div>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Topics Covered</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedTest.topics.map((topic, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sample Questions</h3>
                <div className="space-y-4">
                  {selectedTest.questions.slice(0, 3).map((question, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Question {index + 1}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          question.type === 'mcq' ? 'bg-blue-100 text-blue-800' :
                          question.type === 'true_false' ? 'bg-green-100 text-green-800' :
                          question.type === 'fill_blank' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {question.type.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      
                      <p className="text-gray-900 mb-2">{question.question}</p>
                      
                      {question.type === 'mcq' && question.options && (
                        <div className="space-y-1">
                          {question.options.map((option, optIndex) => (
                            <div key={optIndex} className="text-sm text-gray-600">
                              {String.fromCharCode(65 + optIndex)}. {option}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="mt-2 text-xs text-gray-500">
                        Module: {question.moduleTitle} • Section: {question.sectionTitle}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedTest(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <Link
                  to={`/test-management`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Manage Tests
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
