import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { isUserAssigned } from '../utils/assignmentUtils';

export default function TaskExecution() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const { profile } = useUserProfile();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepValidations, setStepValidations] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs for media capture
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (profile) {
      loadTask();
    }
  }, [taskId, profile]);

  const loadTask = async () => {
    try {
      setLoading(true);
      
      // Wait for profile to be loaded
      if (!profile) {
        console.log('Profile not loaded yet, waiting...');
        return;
      }
      
      const taskDoc = await getDoc(doc(db, 'tasks', taskId));
      
      if (!taskDoc.exists()) {
        setError('Task not found');
        return;
      }

      const taskData = { id: taskId, ...taskDoc.data() };
      
      console.log('Checking assignment for task:', {
        taskId,
        taskTitle: taskData.title,
        assignTo: taskData.assignTo,
        userEmail: profile.email,
        userRole: profile.role
      });
      
      // Check if user is assigned to this task using unified utility
      const unifiedTask = {
        ...taskData,
        targetAudience: taskData.targetAudience || taskData.assignTo // Use targetAudience if available, otherwise fallback to assignTo
      };
      
      const isAssigned = isUserAssigned(unifiedTask, profile);
      if (!isAssigned) {
        setError('You are not assigned to this task');
        return;
      }

      setTask(taskData);
      
      // Initialize step validations
      if (taskData.hasSteps && taskData.steps) {
        const initialValidations = {};
        taskData.steps.forEach((step, index) => {
          initialValidations[index] = {
            completed: false,
            validation: null,
            timestamp: null,
            submittedBy: null
          };
        });
        setStepValidations(initialValidations);
      }
    } catch (error) {
      console.error('Error loading task:', error);
      setError('Error loading task: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStepData = () => {
    if (!task || !task.hasSteps || !task.steps) return null;
    return task.steps[currentStep];
  };

  const getValidationMethodColor = (method) => {
    switch (method) {
      case 'image': return 'bg-green-100 text-green-800';
      case 'voice': return 'bg-purple-100 text-purple-800';
      case 'text': return 'bg-blue-100 text-blue-800';
      case 'checklist': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getValidationMethodIcon = (method) => {
    switch (method) {
      case 'image': return '📷';
      case 'voice': return '🎤';
      case 'text': return '📝';
      case 'checklist': return '✅';
      default: return '❌';
    }
  };

  // Image validation methods
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      
      canvasRef.current.toBlob(async (blob) => {
        const fileName = `task_${taskId}_step_${currentStep}_${Date.now()}.jpg`;
        const storageRef = ref(storage, `task-validations/${fileName}`);
        
        try {
          await uploadBytes(storageRef, blob);
          const downloadURL = await getDownloadURL(storageRef);
          
          setStepValidations(prev => ({
            ...prev,
            [currentStep]: {
              completed: true,
              validation: { type: 'image', url: downloadURL },
              timestamp: new Date(),
              submittedBy: user.email
            }
          }));
          
          stopCamera();
        } catch (error) {
          console.error('Error uploading image:', error);
          alert('Error uploading image');
        }
      }, 'image/jpeg', 0.8);
    }
  };

  // Voice validation methods
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const fileName = `task_${taskId}_step_${currentStep}_${Date.now()}.wav`;
        const storageRef = ref(storage, `task-validations/${fileName}`);
        
        try {
          await uploadBytes(storageRef, audioBlob);
          const downloadURL = await getDownloadURL(storageRef);
          
          setStepValidations(prev => ({
            ...prev,
            [currentStep]: {
              completed: true,
              validation: { type: 'voice', url: downloadURL },
              timestamp: new Date(),
              submittedBy: user.email
            }
          }));
        } catch (error) {
          console.error('Error uploading voice note:', error);
          alert('Error uploading voice note');
        }
      };

      mediaRecorderRef.current.start();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // Text validation method
  const submitTextValidation = (text) => {
    setStepValidations(prev => ({
      ...prev,
      [currentStep]: {
        completed: true,
        validation: { type: 'text', content: text },
        timestamp: new Date(),
        submittedBy: user.email
      }
    }));
  };

  // Checklist validation method
  const toggleChecklistValidation = () => {
    setStepValidations(prev => ({
      ...prev,
      [currentStep]: {
        completed: !prev[currentStep]?.completed,
        validation: { type: 'checklist', checked: !prev[currentStep]?.completed },
        timestamp: new Date(),
        submittedBy: user.email
      }
    }));
  };

  const nextStep = () => {
    if (currentStep < task.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeTask = async () => {
    if (submitting) {
      console.log('Task completion already in progress');
      return;
    }
    
    try {
      setSubmitting(true);
      
      console.log('Completing task with data:', {
        taskId,
        profile: {
          email: profile?.email,
          name: profile?.name,
          storeId: profile?.storeId,
          assignedStore: profile?.assignedStore
        },
        stepValidations
      });

      // Validate required fields
      if (!profile?.email) {
        throw new Error('User profile not loaded');
      }

      if (!taskId) {
        throw new Error('Task ID not found');
      }

      // Update task with completion data
      const userStore = profile.assignedStore;
      
      // Create store-specific completion tracking
      const storeCompletions = task.storeCompletions || {};
      const currentStoreCompletion = storeCompletions[userStore] || {
        completedBy: [],
        completedAt: null,
        stepValidations: {}
      };
      
      // Update the store-specific completion
      const updatedStoreCompletion = {
        ...currentStoreCompletion,
        completedBy: [...currentStoreCompletion.completedBy, profile.email],
        completedAt: serverTimestamp(),
        stepValidations: stepValidations
      };
      
      const updateData = {
        storeCompletions: {
          ...storeCompletions,
          [userStore]: updatedStoreCompletion
        },
        // Keep backward compatibility with global completion tracking
        completedBy: [...(task.completedBy || []), profile.email],
        stepValidations: stepValidations,
        completedAt: serverTimestamp(),
        completedByUser: profile.email,
        storeId: userStore
      };

      console.log('Updating task with store-specific completion data:', updateData);
      
      await updateDoc(doc(db, 'tasks', taskId), updateData);

      console.log('Task completed successfully');
      alert('Task completed successfully!');
      navigate('/my-tasks');
    } catch (error) {
      console.error('Error completing task:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      alert(`Error completing task: ${error.message}. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  const renderValidationComponent = (step) => {
    const validation = stepValidations[currentStep];
    const method = step.validationMethod || 'none'; // Default to 'none' if undefined
    
    console.log('Validation component debug:', {
      step,
      method,
      validation,
      currentStep
    });

    switch (method) {
      case 'image':
        return (
          <div className="space-y-4">
            {!validation?.completed ? (
              <div>
                <button
                  onClick={startCamera}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  📷 Start Camera
                </button>
                <div className="mt-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full max-w-md border rounded"
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>
                <button
                  onClick={capturePhoto}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-2"
                >
                  📸 Capture Photo
                </button>
              </div>
            ) : (
              <div className="text-green-600">
                ✅ Photo captured successfully
              </div>
            )}
          </div>
        );

      case 'voice':
        return (
          <div className="space-y-4">
            {!validation?.completed ? (
              <div>
                <button
                  onClick={startVoiceRecording}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                >
                  🎤 Start Recording
                </button>
                <button
                  onClick={stopVoiceRecording}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 ml-2"
                >
                  ⏹️ Stop Recording
                </button>
              </div>
            ) : (
              <div className="text-green-600">
                ✅ Voice note recorded successfully
              </div>
            )}
          </div>
        );

      case 'text':
        return (
          <div className="space-y-4">
            {!validation?.completed ? (
              <div>
                <textarea
                  placeholder="Enter your response..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="4"
                  id="textValidation"
                />
                <button
                  onClick={() => {
                    const text = document.getElementById('textValidation').value;
                    if (text.trim()) {
                      submitTextValidation(text);
                    } else {
                      alert('Please enter a response');
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  📝 Submit Response
                </button>
              </div>
            ) : (
              <div className="text-green-600">
                ✅ Text response submitted
              </div>
            )}
          </div>
        );

      case 'checklist':
        return (
          <div className="space-y-4">
            <button
              onClick={toggleChecklistValidation}
              className={`px-4 py-2 rounded ${
                validation?.completed
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-yellow-600 text-white hover:bg-yellow-700'
              }`}
            >
              {validation?.completed ? '✅ Completed' : '☐ Mark as Complete'}
            </button>
          </div>
        );

      case 'none':
      default:
        return (
          <div className="space-y-4">
            <div className="text-gray-500 mb-4">
              No validation required for this step
            </div>
            <button
              onClick={() => {
                setStepValidations(prev => ({
                  ...prev,
                  [currentStep]: {
                    completed: true,
                    validation: { type: 'none', message: 'No validation required' },
                    timestamp: new Date(),
                    submittedBy: user.email
                  }
                }));
              }}
              className={`px-4 py-2 rounded ${
                validation?.completed
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {validation?.completed ? '✅ Step Completed' : '✓ Mark Step as Complete'}
            </button>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading task...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="mb-4">
            <svg className="h-12 w-12 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/my-tasks')}
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to My Tasks
          </button>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="mb-4">
            <svg className="h-12 w-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Task Not Found</h1>
          <p className="text-gray-600 mb-4">The task you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/my-tasks')}
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to My Tasks
          </button>
        </div>
      </div>
    );
  }

  const currentStepData = getCurrentStepData();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{task.title}</h1>
              <p className="text-blue-100 mt-1">{task.description}</p>
            </div>
            <button
              onClick={() => navigate('/task-management')}
              className="text-blue-100 hover:text-white"
            >
              ← Back to Tasks
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {task.hasSteps && (
          <div className="p-6 border-b">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Step {currentStep + 1} of {task.steps.length}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round(((currentStep + 1) / task.steps.length) * 100)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / task.steps.length) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="p-6">
          {task.hasSteps && currentStepData ? (
            <div className="space-y-6">
              {/* Step Header */}
              <div className="flex items-center space-x-3">
                <span className="bg-blue-100 text-blue-800 text-lg font-bold px-3 py-1 rounded-full">
                  {currentStep + 1}
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{currentStepData.title}</h2>
                  <p className="text-gray-600">{currentStepData.description}</p>
                </div>
              </div>

              {/* Validation Method */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-4">
                  <span className="text-lg">{getValidationMethodIcon(currentStepData.validationMethod)}</span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getValidationMethodColor(currentStepData.validationMethod)}`}>
                    {currentStepData.validationMethod?.toUpperCase() || 'NO VALIDATION'}
                  </span>
                </div>

                {/* Validation Component */}
                {renderValidationComponent(currentStepData)}
              </div>

              {/* Step Navigation */}
              <div className="flex justify-between pt-6 border-t">
                <div className="text-sm text-gray-500">
                  Step {currentStep + 1} of {task.steps.length} - 
                  {stepValidations[currentStep]?.completed ? ' ✅ Completed' : ' ⏳ Pending'}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    className={`px-4 py-2 rounded ${
                      currentStep === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-600 text-white hover:bg-gray-700'
                    }`}
                  >
                    ← Previous Step
                  </button>

                  {currentStep < task.steps.length - 1 ? (
                    <button
                      onClick={nextStep}
                      disabled={!stepValidations[currentStep]?.completed}
                      className={`px-4 py-2 rounded ${
                        !stepValidations[currentStep]?.completed
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      Next Step →
                    </button>
                  ) : (
                    <button
                      onClick={completeTask}
                      disabled={!stepValidations[currentStep]?.completed || submitting}
                      className={`px-4 py-2 rounded ${
                        !stepValidations[currentStep]?.completed || submitting
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {submitting ? 'Completing...' : 'Complete Task'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Simple Task</h3>
                  <p className="text-gray-500">This task has no specific steps or validation requirements.</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Task Information</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Title:</strong> {task.title}</p>
                    <p><strong>Description:</strong> {task.description}</p>
                    <p><strong>Category:</strong> {task.category}</p>
                    <p><strong>Priority:</strong> {task.priority}</p>
                    {task.deadline && (
                      <p><strong>Deadline:</strong> {new Date(task.deadline).toLocaleDateString()}</p>
                    )}
                    {task.estimatedHours && (
                      <p><strong>Estimated Hours:</strong> {task.estimatedHours}h</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={completeTask}
                    disabled={submitting}
                    className={`px-6 py-3 rounded-lg text-white font-medium ${
                      submitting
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                    }`}
                  >
                    {submitting ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Completing...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Complete Task
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


