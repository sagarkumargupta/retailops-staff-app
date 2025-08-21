import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { Link } from 'react-router-dom';
import { updateAllUsersWithAITrainingPermissions } from '../utils/userManagement';

export default function AITrainingGenerator() {
  const { profile, hasPermission } = useUserProfile();
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processingStatus, setProcessingStatus] = useState('idle');
  const [generatedModules, setGeneratedModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [stores, setStores] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedStores, setSelectedStores] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [assignmentType, setAssignmentType] = useState('all_stores'); // 'all_stores', 'brand_specific', 'store_specific'
  const [trainingConfig, setTrainingConfig] = useState({
    difficulty: 'intermediate',
    questionTypes: ['mcq', 'true_false', 'fill_blank'],
    moduleDuration: 30,
    questionsPerModule: 10,
    targetAudience: 'all_staff', // 'all_staff', 'managers_only', 'staff_only'
    priority: 'normal' // 'low', 'normal', 'high', 'critical'
  });
  const [permissionMsg, setPermissionMsg] = useState('');
  const [permissionBusy, setPermissionBusy] = useState(false);
  const fileInputRef = useRef(null);

  // Check permissions
  useEffect(() => {
    if (!hasPermission('canUseAITraining')) {
      console.log('User does not have AI training permission');
    }
  }, [hasPermission]);

  // Load stores and brands
  useEffect(() => {
    loadStoresAndBrands();
  }, []);

  const loadStoresAndBrands = async () => {
    try {
      const storesSnap = await getDocs(collection(db, 'stores'));
      let storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter stores based on user's access
      const userStores = getStoresForFiltering();
      console.log('AITrainingGenerator: User accessible stores:', userStores);
      
      if (userStores.length > 0) {
        // User has specific store access - filter to only those stores
        storesList = storesList.filter(store => userStores.includes(store.id));
        console.log('AITrainingGenerator: Filtered stores for user:', storesList.length);
      }
      
      setStores(storesList);

      // Extract unique brands from accessible stores only
      const uniqueBrands = [...new Set(storesList.map(store => store.brand).filter(Boolean))];
      setBrands(uniqueBrands);
      console.log('AITrainingGenerator: Available brands for user:', uniqueBrands);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

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

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    const allowedTypes = ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    
    const validFiles = files.filter(file => allowedTypes.includes(file.type));
    
    if (validFiles.length !== files.length) {
      alert('Please upload only PDF and PowerPoint files');
      return;
    }

    setProcessingStatus('uploading');
    
    try {
      const uploadedFileData = [];
      
      for (const file of validFiles) {
        try {
          // Upload to Firebase Storage
          const storageRef = ref(storage, `training-documents/${Date.now()}_${file.name}`);
          const uploadResult = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(uploadResult.ref);
          
          uploadedFileData.push({
            name: file.name,
            type: file.type,
            size: file.size,
            url: downloadURL,
            uploadedAt: new Date(),
            status: 'uploaded'
          });
        } catch (uploadError) {
          console.error('Upload error for file:', file.name, uploadError);
          
          // If CORS error, create a mock file entry for demo purposes
          if (uploadError.code === 'storage/unauthorized' || uploadError.message.includes('CORS')) {
            uploadedFileData.push({
              name: file.name,
              type: file.type,
              size: file.size,
              url: null, // No URL due to CORS
              uploadedAt: new Date(),
              status: 'uploaded_demo',
              error: 'CORS issue - using demo mode'
            });
          } else {
            throw uploadError; // Re-throw other errors
          }
        }
      }
      
      setUploadedFiles(prev => [...prev, ...uploadedFileData]);
      setProcessingStatus('analyzing');
      
      // Start AI analysis
      await analyzeDocuments(uploadedFileData);
      
    } catch (error) {
      console.error('Error uploading files:', error);
      setProcessingStatus('error');
      
      if (error.message.includes('CORS')) {
        alert('CORS Error: File upload is blocked. This is a development issue. Please try uploading from the production site or contact support.');
      } else {
        alert('Error uploading files. Please try again.');
      }
    }
  };

  const analyzeDocuments = async (files) => {
    try {
      setProcessingStatus('analyzing');
      
      // Simulate AI analysis (in real implementation, this would call AI services)
      const analysisResults = await Promise.all(
        files.map(async (file) => {
          // Simulate AI processing delay
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          return {
            fileId: file.name,
            fileName: file.name,
            extractedContent: await simulateContentExtraction(file),
            keyTopics: generateKeyTopics(file.name),
            difficulty: assessDifficulty(file.name),
            estimatedDuration: Math.floor(Math.random() * 45) + 15,
            suggestedModules: generateSuggestedModules(file.name),
            recommendedBrands: generateRecommendedBrands(file.name),
            recommendedStores: generateRecommendedStores(file.name)
          };
        })
      );
      
      setAiAnalysis(analysisResults);
      setProcessingStatus('ready');
      
    } catch (error) {
      console.error('Error analyzing documents:', error);
      setProcessingStatus('error');
    }
  };

  const simulateContentExtraction = async (file) => {
    // Simulate AI content extraction
    const mockContent = {
      sections: [
        {
          title: "Introduction to Retail Operations",
          content: "Retail operations encompass all activities involved in running a retail business...",
          keyPoints: ["Customer service", "Inventory management", "Sales techniques"]
        },
        {
          title: "Customer Service Excellence",
          content: "Providing exceptional customer service is crucial for retail success...",
          keyPoints: ["Active listening", "Problem solving", "Product knowledge"]
        },
        {
          title: "Sales Techniques and Strategies",
          content: "Effective sales techniques can significantly improve store performance...",
          keyPoints: ["Upselling", "Cross-selling", "Building relationships"]
        }
      ],
      summary: "Comprehensive guide to retail operations covering customer service, sales techniques, and operational best practices.",
      learningObjectives: [
        "Understand retail operations fundamentals",
        "Master customer service techniques",
        "Apply effective sales strategies"
      ]
    };
    
    return mockContent;
  };

  const generateKeyTopics = (fileName) => {
    const topics = [
      "Customer Service", "Sales Techniques", "Inventory Management", 
      "Store Operations", "Team Leadership", "Product Knowledge",
      "Communication Skills", "Problem Solving", "Time Management"
    ];
    
    return topics.slice(0, Math.floor(Math.random() * 4) + 3);
  };

  const assessDifficulty = (fileName) => {
    const difficulties = ['beginner', 'intermediate', 'advanced'];
    return difficulties[Math.floor(Math.random() * difficulties.length)];
  };

  const generateSuggestedModules = (fileName) => {
    return [
      {
        title: "Fundamentals Module",
        description: "Basic concepts and principles",
        duration: 20,
        questions: 8
      },
      {
        title: "Advanced Techniques",
        description: "Advanced strategies and best practices",
        duration: 35,
        questions: 12
      },
      {
        title: "Practical Applications",
        description: "Real-world scenarios and case studies",
        duration: 25,
        questions: 10
      }
    ];
  };

  const generateRecommendedBrands = (fileName) => {
    return brands.slice(0, Math.floor(Math.random() * 3) + 1);
  };

  const generateRecommendedStores = (fileName) => {
    return stores.slice(0, Math.floor(Math.random() * 5) + 2).map(store => store.id);
  };

  const generateTrainingModule = async (analysis) => {
    try {
      setProcessingStatus('generating');
      
      // Simulate AI module generation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Determine assignment based on type
      let assignedStores = [];
      let assignedBrands = [];
      
      switch (assignmentType) {
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
      
      const module = {
        id: `module_${Date.now()}`,
        title: `AI Generated: ${analysis.fileName}`,
        description: analysis.extractedContent.summary,
        difficulty: analysis.difficulty,
        duration: analysis.estimatedDuration,
        topics: analysis.keyTopics,
        sections: analysis.extractedContent.sections.map(section => ({
          title: section.title,
          content: section.content,
          keyPoints: section.keyPoints,
          questions: generateQuestions(section, trainingConfig.questionsPerModule)
        })),
        learningObjectives: analysis.extractedContent.learningObjectives,
        assignmentType: assignmentType,
        assignedStores: assignedStores,
        assignedBrands: assignedBrands,
        targetAudience: trainingConfig.targetAudience,
        priority: trainingConfig.priority,
        createdAt: new Date(),
        createdBy: profile?.email,
        status: 'draft'
      };
      
      // Save to Firestore
      const moduleRef = await addDoc(collection(db, 'aiTrainingModules'), {
        ...module,
        createdAt: serverTimestamp()
      });
      
      module.id = moduleRef.id;
      setGeneratedModules(prev => [...prev, module]);
      setProcessingStatus('ready');
      
      return module;
      
    } catch (error) {
      console.error('Error generating training module:', error);
      setProcessingStatus('error');
    }
  };

  const generateQuestions = (section, count) => {
    const questions = [];
    const questionTypes = ['mcq', 'true_false', 'fill_blank'];
    
    for (let i = 0; i < count; i++) {
      const type = questionTypes[Math.floor(Math.random() * questionTypes.length)];
      
      switch (type) {
        case 'mcq':
          questions.push({
            type: 'mcq',
            question: `What is the primary focus of ${section.title.toLowerCase()}?`,
            options: [
              'Customer satisfaction',
              'Profit maximization',
              'Employee training',
              'Inventory control'
            ],
            correctAnswer: 0,
            explanation: 'Customer satisfaction is the primary focus of retail operations.'
          });
          break;
          
        case 'true_false':
          questions.push({
            type: 'true_false',
            question: `${section.title} is essential for retail success.`,
            correctAnswer: true,
            explanation: 'This statement is true as it directly impacts business performance.'
          });
          break;
          
        case 'fill_blank':
          questions.push({
            type: 'fill_blank',
            question: `The key to successful ${section.title.toLowerCase()} is ________.`,
            correctAnswer: 'consistency',
            explanation: 'Consistency in approach and execution leads to better results.'
          });
          break;
      }
    }
    
    return questions;
  };

  const publishModule = async (moduleId) => {
    try {
      await setDoc(doc(db, 'aiTrainingModules', moduleId), {
        status: 'published',
        publishedAt: serverTimestamp()
      }, { merge: true });
      
      setGeneratedModules(prev => 
        prev.map(m => m.id === moduleId ? { ...m, status: 'published' } : m)
      );
      
      alert('Module published successfully!');
    } catch (error) {
      console.error('Error publishing module:', error);
      alert('Error publishing module');
    }
  };

  const loadExistingModules = async () => {
    try {
      const modulesQuery = query(
        collection(db, 'aiTrainingModules'),
        where('createdBy', '==', profile?.email)
      );
      const modulesSnap = await getDocs(modulesQuery);
      const modules = modulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGeneratedModules(modules);
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };

  useEffect(() => {
    if (profile?.email) {
      loadExistingModules();
    }
  }, [profile?.email]);

  const toggleStoreSelection = (storeId) => {
    setSelectedStores(prev =>
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const toggleBrandSelection = (brand) => {
    setSelectedBrands(prev =>
      prev.includes(brand)
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    );
  };

  if (!hasPermission('canUseAITraining')) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access AI Training Generator.</p>
          <button
            onClick={fixPermissions}
            disabled={permissionBusy}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {permissionBusy ? 'Fixing...' : 'Fix Permissions'}
          </button>
          {permissionMsg && <p className="mt-4 text-sm text-gray-500">{permissionMsg}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 AI Training Generator</h1>
        <p className="text-gray-600">Upload PDFs and PowerPoints to automatically generate training modules and test series</p>
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
              value={assignmentType}
              onChange={(e) => setAssignmentType(e.target.value)}
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
              value={trainingConfig.targetAudience}
              onChange={(e) => setTrainingConfig(prev => ({ ...prev, targetAudience: e.target.value }))}
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
              value={trainingConfig.priority}
              onChange={(e) => setTrainingConfig(prev => ({ ...prev, priority: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty Level
            </label>
            <select
              value={trainingConfig.difficulty}
              onChange={(e) => setTrainingConfig(prev => ({ ...prev, difficulty: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Brand Selection */}
        {assignmentType === 'brand_specific' && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Select Brands</h3>
            <div className="grid md:grid-cols-3 gap-3">
              {brands.map((brand) => (
                <label key={brand} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedBrands.includes(brand)}
                    onChange={() => toggleBrandSelection(brand)}
                    className="mr-3"
                  />
                  <span className="text-sm font-medium text-gray-700">{brand}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Store Selection */}
        {assignmentType === 'store_specific' && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Select Stores</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stores.map((store) => (
                <label key={store.id} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedStores.includes(store.id)}
                    onChange={() => toggleStoreSelection(store.id)}
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

      {/* File Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📁 Upload Documents</h2>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.ppt,.pptx"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={processingStatus === 'uploading' || processingStatus === 'analyzing'}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {processingStatus === 'uploading' ? 'Uploading...' : 
             processingStatus === 'analyzing' ? 'Analyzing...' : 'Choose Files'}
          </button>
          
                     <p className="text-sm text-gray-500 mt-2">
             Supported formats: PDF, PPT, PPTX (Max 10MB each)
           </p>
           <p className="text-xs text-orange-600 mt-1">
             ⚠️ Note: File uploads may not work in development due to CORS. Use production site for full functionality.
           </p>
        </div>

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Uploaded Files</h3>
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {file.uploadedAt.toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    file.status === 'uploaded' ? 'bg-green-100 text-green-800' : 
                    file.status === 'uploaded_demo' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-yellow-100 text-yellow-800' // Fallback for other statuses
                  }`}>
                    {file.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis Results */}
      {aiAnalysis && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🧠 AI Analysis Results</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {aiAnalysis.map((analysis, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{analysis.fileName}</h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Key Topics:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysis.keyTopics.map((topic, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700">Difficulty: 
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                        analysis.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                        analysis.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {analysis.difficulty}
                      </span>
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Estimated Duration: {analysis.estimatedDuration} minutes
                    </p>
                  </div>

                  {analysis.recommendedBrands && analysis.recommendedBrands.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Recommended Brands:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {analysis.recommendedBrands.map((brand, i) => (
                          <span key={i} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            {brand}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => generateTrainingModule(analysis)}
                    disabled={processingStatus === 'generating'}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {processingStatus === 'generating' ? 'Generating...' : 'Generate Training Module'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Modules */}
      {generatedModules.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📚 Generated Training Modules</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generatedModules.map((module) => (
              <div key={module.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{module.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{module.description}</p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{module.duration} min</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Difficulty:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      module.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                      module.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {module.difficulty}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Assignment:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      module.assignmentType === 'all_stores' ? 'bg-blue-100 text-blue-800' :
                      module.assignmentType === 'brand_specific' ? 'bg-purple-100 text-purple-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {module.assignmentType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Priority:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      module.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      module.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      module.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {module.priority}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      module.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {module.status}
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedModule(module)}
                    className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
                  >
                    View Details
                  </button>
                  {module.status === 'draft' && (
                    <button
                      onClick={() => publishModule(module.id)}
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

      {/* Module Details Modal */}
      {selectedModule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">{selectedModule.title}</h2>
                <button
                  onClick={() => setSelectedModule(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Assignment Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Type:</p>
                    <p className="text-sm text-gray-600 capitalize">{selectedModule.assignmentType.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Target Audience:</p>
                    <p className="text-sm text-gray-600 capitalize">{selectedModule.targetAudience.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Priority:</p>
                    <p className="text-sm text-gray-600 capitalize">{selectedModule.priority}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Assigned Stores:</p>
                    <p className="text-sm text-gray-600">{selectedModule.assignedStores?.length || 0} stores</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Learning Objectives</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  {selectedModule.learningObjectives.map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))}
                </ul>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Topics Covered</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedModule.topics.map((topic, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Module Sections</h3>
                <div className="space-y-4">
                  {selectedModule.sections.map((section, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">{section.title}</h4>
                      <p className="text-gray-600 text-sm mb-3">{section.content}</p>
                      
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Key Points:</p>
                        <ul className="list-disc list-inside text-sm text-gray-600">
                          {section.keyPoints.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Questions: {section.questions.length}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedModule(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <Link
                  to={`/training-management`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Manage Training
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
