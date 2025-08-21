import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { Link } from 'react-router-dom';
import { updateAllUsersWithAITrainingPermissions } from '../utils/userManagement';

export default function AIFaceCompanion() {
  const { profile, hasPermission } = useUserProfile();
  const [companions, setCompanions] = useState([]);
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [permissionMsg, setPermissionMsg] = useState('');
  const [permissionBusy, setPermissionBusy] = useState(false);
  const fileInputRef = useRef(null);

  const [companionConfig, setCompanionConfig] = useState({
    name: '',
    role: 'owner', // 'owner', 'manager', 'supervisor', 'trainer'
    personality: 'motivational', // 'motivational', 'professional', 'friendly', 'strict'
    avatarType: 'custom', // 'custom', 'prebuilt'
    voiceType: 'professional', // 'professional', 'friendly', 'authoritative', 'calm'
    meetingStyle: 'morning_brief', // 'morning_brief', 'performance_review', 'motivation', 'training'
    stores: [],
    brands: [],
    targetAudience: 'all_staff', // 'all_staff', 'managers_only', 'staff_only'
    schedule: {
      enabled: false,
      time: '09:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      timezone: 'Asia/Kolkata'
    }
  });

  const [stores, setStores] = useState([]);
  const [brands, setBrands] = useState([]);

  // Check permissions
  useEffect(() => {
    if (!hasPermission('canUseAITraining')) {
      console.log('User does not have AI training permission');
    }
  }, [hasPermission]);

  // Load stores and brands
  useEffect(() => {
    loadStoresAndBrands();
    loadExistingCompanions();
  }, []);

  const loadStoresAndBrands = async () => {
    try {
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStores(storesList);

      // Extract unique brands
      const uniqueBrands = [...new Set(storesList.map(store => store.brand).filter(Boolean))];
      setBrands(uniqueBrands);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const loadExistingCompanions = async () => {
    try {
      const companionsQuery = query(
        collection(db, 'aiFaceCompanions'),
        where('createdBy', '==', profile?.email)
      );
      const companionsSnap = await getDocs(companionsQuery);
      const companionsList = companionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompanions(companionsList);
    } catch (error) {
      console.error('Error loading companions:', error);
    }
  };

  const fixPermissions = async () => {
    setPermissionBusy(true);
    setPermissionMsg('Fixing permissions...');
    try {
      const result = await updateAllUsersWithAITrainingPermissions();
      setPermissionMsg(`✅ Fixed permissions for ${result.updatedCount} users. Please refresh the page.`);
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

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload only JPG, JPEG, or PNG files');
      return;
    }

    try {
      const storageRef = ref(storage, `ai-companions/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      setCompanionConfig(prev => ({
        ...prev,
        avatarUrl: downloadURL
      }));
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Error uploading avatar. Please try again.');
    }
  };

  const generateCompanion = async () => {
    if (!companionConfig.name || !companionConfig.role) {
      alert('Please provide a name and role for the AI companion');
      return;
    }

    setIsGenerating(true);

    try {
      // Simulate AI companion generation
      await new Promise(resolve => setTimeout(resolve, 3000));

      const companion = {
        id: `companion_${Date.now()}`,
        name: companionConfig.name,
        role: companionConfig.role,
        personality: companionConfig.personality,
        avatarType: companionConfig.avatarType,
        avatarUrl: companionConfig.avatarUrl || null,
        voiceType: companionConfig.voiceType,
        meetingStyle: companionConfig.meetingStyle,
        stores: companionConfig.stores,
        brands: companionConfig.brands,
        targetAudience: companionConfig.targetAudience,
        schedule: companionConfig.schedule,
        scripts: generateMeetingScripts(companionConfig),
        createdAt: new Date(),
        createdBy: profile?.email,
        status: 'active'
      };

      // Save to Firestore
      const companionRef = await addDoc(collection(db, 'aiFaceCompanions'), {
        ...companion,
        createdAt: serverTimestamp()
      });

      companion.id = companionRef.id;
      setCompanions(prev => [...prev, companion]);
      setIsCreating(false);
      setIsGenerating(false);

      // Reset form
      setCompanionConfig({
        name: '',
        role: 'owner',
        personality: 'motivational',
        avatarType: 'custom',
        voiceType: 'professional',
        meetingStyle: 'morning_brief',
        stores: [],
        brands: [],
        targetAudience: 'all_staff',
        schedule: {
          enabled: false,
          time: '09:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          timezone: 'Asia/Kolkata'
        }
      });

      alert('AI Face Companion created successfully!');

    } catch (error) {
      console.error('Error generating companion:', error);
      setIsGenerating(false);
      alert('Error creating AI companion. Please try again.');
    }
  };

  const generateMeetingScripts = (config) => {
    const scripts = {
      morning_brief: generateMorningBriefScript(config),
      performance_review: generatePerformanceReviewScript(config),
      motivation: generateMotivationScript(config),
      training: generateTrainingScript(config)
    };
    return scripts;
  };

  const generateMorningBriefScript = (config) => {
    const roleTitles = {
      owner: 'Owner',
      manager: 'Manager',
      supervisor: 'Supervisor',
      trainer: 'Trainer'
    };

    const personalityTones = {
      motivational: 'energetic and encouraging',
      professional: 'professional and focused',
      friendly: 'warm and approachable',
      strict: 'direct and authoritative'
    };

    return {
      greeting: `Good morning team! I'm ${config.name}, your ${roleTitles[config.role]}. Let's start this day with ${personalityTones[config.personality]} energy.`,
      agenda: `Today we'll focus on our key priorities: customer service excellence, sales targets, and team collaboration.`,
      motivation: `Remember, every interaction is an opportunity to create a memorable customer experience. Let's make today count!`,
      closing: `I believe in each one of you. Let's work together to achieve our goals. Have a productive day!`
    };
  };

  const generatePerformanceReviewScript = (config) => {
    return {
      positive: `Excellent work! Your performance has been outstanding. You've consistently exceeded expectations and demonstrated great leadership.`,
      improvement: `I see potential for growth here. Let's work together to improve these areas. I'm here to support your development.`,
      encouragement: `Every challenge is an opportunity to grow. I believe in your ability to overcome obstacles and succeed.`,
      closing: `Keep up the great work, and remember that continuous improvement is the key to long-term success.`
    };
  };

  const generateMotivationScript = (config) => {
    return {
      general: `Team, you are capable of amazing things. Your dedication and hard work don't go unnoticed.`,
      challenging_times: `During challenging times, remember why we started. Your resilience inspires everyone around you.`,
      success: `Success is not just about numbers; it's about the impact we make on our customers and each other.`,
      closing: `You have the power to make a difference. Let's continue to support each other and grow together.`
    };
  };

  const generateTrainingScript = (config) => {
    return {
      introduction: `Welcome to today's training session. I'm here to guide you through important concepts and best practices.`,
      explanation: `Let me explain this step by step. Understanding these fundamentals will help you excel in your role.`,
      practice: `Now let's practice together. Remember, practice makes perfect, and I'm here to help you improve.`,
      closing: `Great job! Keep practicing these skills, and don't hesitate to ask questions. Learning is a continuous journey.`
    };
  };

  const toggleStoreSelection = (storeId) => {
    setCompanionConfig(prev => ({
      ...prev,
      stores: prev.stores.includes(storeId)
        ? prev.stores.filter(id => id !== storeId)
        : [...prev.stores, storeId]
    }));
  };

  const toggleBrandSelection = (brand) => {
    setCompanionConfig(prev => ({
      ...prev,
      brands: prev.brands.includes(brand)
        ? prev.brands.filter(b => b !== brand)
        : [...prev.brands, brand]
    }));
  };

  const startMeeting = async (companion) => {
    // Simulate starting a meeting with the AI companion
    alert(`Starting meeting with ${companion.name}...\n\nThis would integrate with your video conferencing platform to use the AI avatar.`);
  };

  if (!hasPermission('canUseAITraining')) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access AI Face Companion.</p>
          <button
            onClick={fixPermissions}
            disabled={permissionBusy}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 AI Face Companion</h1>
        <p className="text-gray-600">Create AI-powered avatars for owners and managers to conduct meetings, appreciate teams, and provide motivation</p>
      </div>

      {/* Create New Companion */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Create AI Face Companion</h2>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            {isCreating ? 'Cancel' : 'Create New'}
          </button>
        </div>

        {isCreating && (
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Companion Name *
                </label>
                <input
                  type="text"
                  value={companionConfig.name}
                  onChange={(e) => setCompanionConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Enter companion name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  value={companionConfig.role}
                  onChange={(e) => setCompanionConfig(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="trainer">Trainer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personality
                </label>
                <select
                  value={companionConfig.personality}
                  onChange={(e) => setCompanionConfig(prev => ({ ...prev, personality: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="motivational">Motivational</option>
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="strict">Strict</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice Type
                </label>
                <select
                  value={companionConfig.voiceType}
                  onChange={(e) => setCompanionConfig(prev => ({ ...prev, voiceType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="authoritative">Authoritative</option>
                  <option value="calm">Calm</option>
                </select>
              </div>
            </div>

            {/* Avatar Configuration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Avatar Type
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="custom"
                    checked={companionConfig.avatarType === 'custom'}
                    onChange={(e) => setCompanionConfig(prev => ({ ...prev, avatarType: e.target.value }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Custom Avatar</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="prebuilt"
                    checked={companionConfig.avatarType === 'prebuilt'}
                    onChange={(e) => setCompanionConfig(prev => ({ ...prev, avatarType: e.target.value }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Pre-built Avatar</span>
                </label>
              </div>
            </div>

            {companionConfig.avatarType === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Avatar Image
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">Upload a clear photo for the AI to generate an avatar</p>
              </div>
            )}

            {/* Meeting Style */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Meeting Style
              </label>
              <select
                value={companionConfig.meetingStyle}
                onChange={(e) => setCompanionConfig(prev => ({ ...prev, meetingStyle: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="morning_brief">Morning Brief</option>
                <option value="performance_review">Performance Review</option>
                <option value="motivation">Motivation Session</option>
                <option value="training">Training Session</option>
              </select>
            </div>

            {/* Store/Brand Assignment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to Stores
              </label>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-40 overflow-y-auto">
                {stores.map((store) => (
                  <label key={store.id} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={companionConfig.stores.includes(store.id)}
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

            {/* Schedule Configuration */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={companionConfig.schedule.enabled}
                  onChange={(e) => setCompanionConfig(prev => ({
                    ...prev,
                    schedule: { ...prev.schedule, enabled: e.target.checked }
                  }))}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Enable Scheduled Meetings</span>
              </label>
              
              {companionConfig.schedule.enabled && (
                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meeting Time
                    </label>
                    <input
                      type="time"
                      value={companionConfig.schedule.time}
                      onChange={(e) => setCompanionConfig(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule, time: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Days of Week
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                        <label key={day} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={companionConfig.schedule.days.includes(day)}
                            onChange={(e) => {
                              const newDays = e.target.checked
                                ? [...companionConfig.schedule.days, day]
                                : companionConfig.schedule.days.filter(d => d !== day);
                              setCompanionConfig(prev => ({
                                ...prev,
                                schedule: { ...prev.schedule, days: newDays }
                              }));
                            }}
                            className="mr-1"
                          />
                          <span className="text-sm text-gray-700 capitalize">{day}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <div className="text-center">
              <button
                onClick={generateCompanion}
                disabled={isGenerating || !companionConfig.name}
                className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Creating AI Companion...' : 'Create AI Face Companion'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Existing Companions */}
      {companions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your AI Face Companions</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companions.map((companion) => (
              <div key={companion.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{companion.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    companion.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {companion.status}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Role:</span>
                    <span className="font-medium capitalize">{companion.role}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Personality:</span>
                    <span className="font-medium capitalize">{companion.personality}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Meeting Style:</span>
                    <span className="font-medium capitalize">{companion.meetingStyle.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Stores:</span>
                    <span className="font-medium">{companion.stores.length}</span>
                  </div>
                  {companion.schedule.enabled && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Schedule:</span>
                      <span className="font-medium">{companion.schedule.time} ({companion.schedule.days.length} days)</span>
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedCompanion(companion)}
                    className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => startMeeting(companion)}
                    className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700"
                  >
                    Start Meeting
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Companion Details Modal */}
      {selectedCompanion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">{selectedCompanion.name}</h2>
                <button
                  onClick={() => setSelectedCompanion(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Companion Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Role:</p>
                    <p className="text-sm text-gray-600 capitalize">{selectedCompanion.role}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Personality:</p>
                    <p className="text-sm text-gray-600 capitalize">{selectedCompanion.personality}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Voice Type:</p>
                    <p className="text-sm text-gray-600 capitalize">{selectedCompanion.voiceType}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Meeting Style:</p>
                    <p className="text-sm text-gray-600 capitalize">{selectedCompanion.meetingStyle.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Meeting Scripts</h3>
                <div className="space-y-4">
                  {Object.entries(selectedCompanion.scripts).map(([type, script]) => (
                    <div key={type} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2 capitalize">{type.replace('_', ' ')}</h4>
                      <div className="space-y-2 text-sm">
                        {Object.entries(script).map(([key, text]) => (
                          <div key={key}>
                            <p className="font-medium text-gray-700 capitalize">{key}:</p>
                            <p className="text-gray-600 italic">"{text}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedCompanion(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => startMeeting(selectedCompanion)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Start Meeting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

