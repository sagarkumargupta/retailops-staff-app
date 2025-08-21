import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function TrainingManagement() {
  const { profile } = useUserProfile();
  const [trainings, setTrainings] = useState([]);
  const [stores, setStores] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);

  const [trainingForm, setTrainingForm] = useState({
    title: '',
    description: '',
    contentUrl: '',
    targetAudience: 'all_staff',
    assignedStores: [],
    assignees: [],
    estimatedDuration: 30,
    passingScore: 70
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
        loadTrainings()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStores = async () => {
    try {
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStores(storesList);
    } catch (error) {
      console.error('Error loading stores:', error);
      setStores([]);
    }
  };

  const loadStaff = async () => {
    try {
      const staffSnap = await getDocs(collection(db, 'users'));
      const staffList = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStaff(staffList);
    } catch (error) {
      console.error('Error loading staff:', error);
      setStaff([]);
    }
  };

  const loadTrainings = async () => {
    try {
      let trainingsList = [];
      
      if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN') {
        // For admin roles, load all trainings
        const trainingsSnap = await getDocs(collection(db, 'trainings'));
        trainingsList = trainingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else if (profile?.role === 'MANAGER') {
        // For managers, load trainings they created or are assigned to
        const trainingsSnap = await getDocs(collection(db, 'trainings'));
        trainingsList = trainingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(training => 
            training.createdBy === profile.email || 
            (training.assignees && training.assignees.includes(profile.email))
          );
      } else {
        // For other roles, load all trainings (fallback)
        const trainingsSnap = await getDocs(collection(db, 'trainings'));
        trainingsList = trainingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      // Sort by creation date (newest first)
      trainingsList.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      setTrainings(trainingsList);
    } catch (error) {
      console.error('Error loading trainings:', error);
      setTrainings([]);
    }
  };

  const getAssignedStores = () => {
    const { targetAudience, assignedStores } = trainingForm;
    
    // If a manager selects All Staff, scope to manager's stores only
    if (profile?.role === 'MANAGER' && targetAudience === 'all_staff') {
      if (profile.assignedStore) return [profile.assignedStore];
      if (profile.stores && typeof profile.stores === 'object') {
        return Object.keys(profile.stores).filter(key => profile.stores[key] === true);
      }
      return [];
    }

    if (targetAudience === 'all_staff' || targetAudience === 'all_managers') {
      return stores.map(s => s.id);
    } else if (targetAudience === 'location') {
      // For location-based, use manager's stores
      if (profile?.role === 'MANAGER') {
        return Object.keys(profile.stores).filter(key => profile.stores[key] === true);
      }
      return assignedStores;
    } else if (targetAudience === 'brand') {
      // For brand-based, use manager's stores
      if (profile?.role === 'MANAGER') {
        return Object.keys(profile.stores).filter(key => profile.stores[key] === true);
      }
      return assignedStores;
    } else {
      return assignedStores;
    }
  };

  const getAssignees = () => {
    const { targetAudience, assignees } = trainingForm;
    const assignedStoreIds = getAssignedStores();
    
    let result = [];
    
    if (targetAudience === 'all_staff') {
      result = staff.filter(s => assignedStoreIds.includes(s.assignedStore)).map(s => s.email);
    } else if (targetAudience === 'all_managers') {
      result = staff.filter(s => assignedStoreIds.includes(s.assignedStore) && s.role === 'MANAGER').map(s => s.email);
    } else if (targetAudience === 'location' || targetAudience === 'brand') {
      result = staff.filter(s => assignedStoreIds.includes(s.assignedStore)).map(s => s.email);
    } else {
      result = assignees;
    }
    
    return result;
  };

  const handleCreateTraining = async () => {
    if (!trainingForm.title || !trainingForm.description || !trainingForm.contentUrl) {
      alert('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const assignedStores = getAssignedStores();
      const assignees = getAssignees();

      const trainingData = {
        ...trainingForm,
        assignedStores,
        assignees,
        createdBy: profile?.email,
        createdByRole: profile?.role,
        createdAt: serverTimestamp(),
        status: 'active'
      };

      await addDoc(collection(db, 'trainings'), trainingData);
      setShowCreateModal(false);
      resetForm();
      await loadTrainings();
      alert('Training created successfully!');
    } catch (error) {
      console.error('Error creating training:', error);
      alert('Failed to create training');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTraining = async () => {
    if (!editingTraining) return;

    setLoading(true);
    try {
      const assignedStores = getAssignedStores();
      const assignees = getAssignees();

      const trainingData = {
        ...trainingForm,
        assignedStores,
        assignees,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'trainings', editingTraining.id), trainingData);
      setShowEditModal(false);
      setEditingTraining(null);
      resetForm();
      await loadTrainings();
      alert('Training updated successfully!');
    } catch (error) {
      console.error('Error updating training:', error);
      alert('Failed to update training');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTraining = async (trainingId) => {
    if (!confirm('Are you sure you want to delete this training?')) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'trainings', trainingId));
      await loadTrainings();
      alert('Training deleted successfully!');
    } catch (error) {
      console.error('Error deleting training:', error);
      alert('Failed to delete training');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTrainingForm({
      title: '',
      description: '',
      contentUrl: '',
      targetAudience: 'all_staff',
      assignedStores: [],
      assignees: [],
      estimatedDuration: 30,
      passingScore: 70
    });
  };

  const openEditModal = (training) => {
    setEditingTraining(training);
    setTrainingForm({
      title: training.title,
      description: training.description,
      contentUrl: training.contentUrl,
      targetAudience: training.targetAudience,
      assignedStores: training.assignedStores || [],
      assignees: training.assignees || [],
      estimatedDuration: training.estimatedDuration,
      passingScore: training.passingScore
    });
    setShowEditModal(true);
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'video': return '🎥';
      case 'pdf': return '📄';
      case 'ppt': return '📊';
      default: return '📁';
    }
  };

  if (!profile) return <div className="p-6">Loading...</div>;
  if (!['ADMIN', 'MANAGER'].includes(profile.role)) return <div className="p-6">Access denied</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {profile?.role === 'MANAGER' ? 'My Team Training Management' : 'Training Management'}
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Create Training
        </button>
      </div>

      {/* Training Statistics */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{trainings.length}</div>
          <div className="text-sm text-gray-600">Total Trainings</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {trainings.filter(t => t.isActive).length}
          </div>
          <div className="text-sm text-gray-600">Active Trainings</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-purple-600">
            {trainings.filter(t => t.hasQuizzes).length}
          </div>
          <div className="text-sm text-gray-600">With Quizzes</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-orange-600">
            {staff.length}
          </div>
          <div className="text-sm text-gray-600">Total Staff</div>
        </div>
      </div>

      {/* Trainings List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Training Programs</h2>
          
          {loading ? (
            <div className="text-center py-8">Loading trainings...</div>
          ) : trainings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No trainings found. Create your first training program!
            </div>
          ) : (
            <div className="space-y-4">
              {trainings.map((training) => (
                <div key={training.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getContentTypeIcon(training.contentType)}</span>
                        <h3 className="text-lg font-semibold">{training.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(training.difficulty)}`}>
                          {training.difficulty}
                        </span>
                        {training.hasQuizzes && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                            Quiz
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 mb-2">{training.description}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>📅 {training.estimatedDuration}</span>
                        <span>👥 {training.assignees?.length || 0} assigned</span>
                        <span>🏪 {training.assignedStores?.length || 0} stores</span>
                        <span>📊 Passing: {training.passingScore}%</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(training)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTraining(training.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Training Modal */}
      {showCreateModal && (
        <TrainingModal
          title="Create New Training"
          form={trainingForm}
          setForm={setTrainingForm}
          onSubmit={handleCreateTraining}
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          stores={stores}
          staff={staff}
          loading={loading}
        />
      )}

      {/* Edit Training Modal */}
      {showEditModal && (
        <TrainingModal
          title="Edit Training"
          form={trainingForm}
          setForm={setTrainingForm}
          onSubmit={handleEditTraining}
          onClose={() => {
            setShowEditModal(false);
            setEditingTraining(null);
            resetForm();
          }}
          stores={stores}
          staff={staff}
          loading={loading}
        />
      )}
    </div>
  );
}

// Training Modal Component
function TrainingModal({ title, form, setForm, onSubmit, onClose, stores, staff, loading }) {
  const [showQuizBuilder, setShowQuizBuilder] = useState(false);

  const addQuiz = () => {
    const newQuiz = {
      id: Date.now(),
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: ''
    };
    setForm(prev => ({
      ...prev,
      quizzes: [...prev.quizzes, newQuiz]
    }));
  };

  const updateQuiz = (index, field, value) => {
    const updatedQuizzes = [...form.quizzes];
    updatedQuizzes[index] = { ...updatedQuizzes[index], [field]: value };
    setForm(prev => ({ ...prev, quizzes: updatedQuizzes }));
  };

  const removeQuiz = (index) => {
    setForm(prev => ({
      ...prev,
      quizzes: prev.quizzes.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-6">
            {/* Basic Information */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Training Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  <option value="product_knowledge">Product Knowledge</option>
                  <option value="sales_techniques">Sales Techniques</option>
                  <option value="customer_service">Customer Service</option>
                  <option value="store_operations">Store Operations</option>
                  <option value="safety_procedures">Safety Procedures</option>
                  <option value="company_policies">Company Policies</option>
                  <option value="technology_training">Technology Training</option>
                  <option value="soft_skills">Soft Skills</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Content Details */}
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
                <select
                  value={form.contentType}
                  onChange={(e) => setForm(prev => ({ ...prev, contentType: e.target.value }))}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="video">YouTube Video</option>
                  <option value="pdf">PDF Document</option>
                  <option value="ppt">PowerPoint</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty Level</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm(prev => ({ ...prev, difficulty: e.target.value }))}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Duration</label>
                <input
                  type="text"
                  value={form.estimatedDuration}
                  onChange={(e) => setForm(prev => ({ ...prev, estimatedDuration: parseInt(e.target.value) }))}
                  placeholder="e.g., 30 minutes"
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Content URL *</label>
              <input
                type="url"
                value={form.contentUrl}
                onChange={(e) => setForm(prev => ({ ...prev, contentUrl: e.target.value }))}
                placeholder={form.contentType === 'video' ? 'YouTube video URL' : 'Document URL'}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Assignment */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                <select
                  value={form.targetAudience}
                  onChange={(e) => setForm(prev => ({ ...prev, targetAudience: e.target.value }))}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all_staff">All Staff</option>
                  <option value="all_managers">All Managers</option>
                  <option value="location">Location-based</option>
                  <option value="brand">Brand-based</option>
                  <option value="individual">Individual Selection</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Passing Score (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.passingScore}
                  onChange={(e) => setForm(prev => ({ ...prev, passingScore: parseInt(e.target.value) }))}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Quiz Configuration */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.hasQuizzes}
                    onChange={(e) => setForm(prev => ({ ...prev, hasQuizzes: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="font-medium">Include Quiz Questions</span>
                </label>
                {form.hasQuizzes && (
                  <button
                    type="button"
                    onClick={() => setShowQuizBuilder(!showQuizBuilder)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {showQuizBuilder ? 'Hide Quiz Builder' : 'Show Quiz Builder'}
                  </button>
                )}
              </div>

              {form.hasQuizzes && showQuizBuilder && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Quiz Questions</h4>
                    <button
                      type="button"
                      onClick={addQuiz}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      + Add Question
                    </button>
                  </div>

                  {form.quizzes.map((quiz, index) => (
                    <div key={quiz.id} className="border rounded p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <h5 className="font-medium">Question {index + 1}</h5>
                        <button
                          type="button"
                          onClick={() => removeQuiz(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-3">
                        <input
                          type="text"
                          value={quiz.question}
                          onChange={(e) => updateQuiz(index, 'question', e.target.value)}
                          placeholder="Enter question"
                          className="w-full p-2 border rounded"
                        />

                        <div className="grid md:grid-cols-2 gap-2">
                          {quiz.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${index}`}
                                checked={quiz.correctAnswer === optionIndex}
                                onChange={() => updateQuiz(index, 'correctAnswer', optionIndex)}
                                className="mr-2"
                              />
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...quiz.options];
                                  newOptions[optionIndex] = e.target.value;
                                  updateQuiz(index, 'options', newOptions);
                                }}
                                placeholder={`Option ${optionIndex + 1}`}
                                className="flex-1 p-2 border rounded"
                              />
                            </div>
                          ))}
                        </div>

                        <input
                          type="text"
                          value={quiz.explanation}
                          onChange={(e) => updateQuiz(index, 'explanation', e.target.value)}
                          placeholder="Explanation (optional)"
                          className="w-full p-2 border rounded"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Training'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
