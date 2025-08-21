import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { isUserAssigned } from '../utils/assignmentUtils';

export default function TrainingExecution() {
  const { trainingId } = useParams();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  
  console.log('TrainingExecution - Profile state:', {
    hasProfile: !!profile,
    profileEmail: profile?.email,
    profileRole: profile?.role
  });
  
  const [training, setTraining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState('content'); // content, quiz, complete
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [completionTime, setCompletionTime] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [completing, setCompleting] = useState(false);
  
  const videoRef = useRef(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoCompleted, setVideoCompleted] = useState(false);

  useEffect(() => {
    if (profile) {
      loadTraining();
      setStartTime(Date.now());
    }
  }, [trainingId, profile]);

  useEffect(() => {
    if (startTime) {
      const interval = setInterval(() => {
        setCompletionTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [startTime]);

  const loadTraining = async () => {
    try {
      setLoading(true);
      
      // Wait for profile to be loaded
      if (!profile) {
        console.log('Profile not loaded yet, waiting...');
        return;
      }
      
      const trainingDoc = await getDoc(doc(db, 'trainings', trainingId));
      
      if (!trainingDoc.exists()) {
        setError('Training not found');
        return;
      }

      const trainingData = { id: trainingId, ...trainingDoc.data() };
      
      console.log('Checking assignment for training:', {
        trainingId,
        trainingTitle: trainingData.title,
        targetAudience: trainingData.targetAudience,
        userEmail: profile.email,
        userRole: profile.role
      });
      
      // Check if user is assigned to this training using unified utility
      const isAssigned = isUserAssigned(trainingData, profile);
      
      if (!isAssigned) {
        setError('You are not assigned to this training');
        return;
      }
      
      setTraining(trainingData);
    } catch (error) {
      console.error('Error loading training:', error);
      setError('Error loading training: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoProgress = () => {
    // YouTube iframes don't expose currentTime and duration
    // We'll use a manual progress system instead
    if (!videoCompleted) {
      // Increment progress gradually as user watches
      setVideoProgress(prev => {
        const newProgress = Math.min(prev + 1, 100);
        if (newProgress >= 90) {
          setVideoCompleted(true);
        }
        return newProgress;
      });
    }
  };

  const handleVideoEnded = () => {
    setVideoCompleted(true);
    setVideoProgress(100);
  };

  // Add manual progress tracking for non-video content
  const handleContentProgress = () => {
    if (training.contentType !== 'video') {
      setVideoCompleted(true);
      setVideoProgress(100);
    }
  };

  // Add timer-based progress tracking for videos
  useEffect(() => {
    let progressTimer;
    
    if (currentStep === 'content' && training?.contentType === 'video' && !videoCompleted) {
      // Start progress timer - increment every 2 seconds
      progressTimer = setInterval(() => {
        setVideoProgress(prev => {
          const newProgress = Math.min(prev + 2, 100);
          if (newProgress >= 90) {
            setVideoCompleted(true);
          }
          return newProgress;
        });
      }, 2000);
    }
    
    return () => {
      if (progressTimer) {
        clearInterval(progressTimer);
      }
    };
  }, [currentStep, training?.contentType, videoCompleted]);

  const startQuiz = () => {
    if (!videoCompleted) {
      alert('Please complete the training content before proceeding.');
      return;
    }
    
    if (training.hasQuizzes) {
      setCurrentStep('quiz');
    } else {
      // For trainings without quizzes, complete directly
      completeTraining();
    }
  };

  const handleQuizAnswer = (questionIndex, answerIndex) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }));
  };

  const submitQuiz = () => {
    const totalQuestions = training.quizzes.length;
    let correctAnswers = 0;
    
    training.quizzes.forEach((quiz, index) => {
      if (quizAnswers[index] === quiz.correctAnswer) {
        correctAnswers++;
      }
    });
    
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    const passed = score >= training.passingScore;
    
    setQuizResults({
      score,
      passed,
      totalQuestions,
      correctAnswers,
      answers: quizAnswers
    });
    
    setShowResults(true);
  };

  const completeTraining = async () => {
    if (completing) {
      console.log('Training completion already in progress');
      return;
    }
    
    try {
      setCompleting(true);
      
      console.log('Completing training with data:', {
        trainingId,
        profile: {
          email: profile?.email,
          name: profile?.name,
          storeId: profile?.storeId,
          assignedStore: profile?.assignedStore
        },
        quizResults,
        videoProgress,
        completionTime
      });

      // Validate required fields
      if (!profile?.email) {
        throw new Error('User profile not loaded');
      }

      if (!trainingId) {
        throw new Error('Training ID not found');
      }

      // Check if user has already completed this training
      const existingCompletionQuery = query(
        collection(db, 'training_completions'),
        where('trainingId', '==', trainingId),
        where('userEmail', '==', profile.email)
      );
      
      const existingCompletionSnap = await getDocs(existingCompletionQuery);
      if (!existingCompletionSnap.empty) {
        console.log('User has already completed this training, updating existing record');
        // Update existing completion instead of creating new one
        const existingDoc = existingCompletionSnap.docs[0];
        const updateData = {
          completedAt: serverTimestamp(),
          completionTime: completionTime || 0,
          quizResults: quizResults || null,
          videoProgress: videoProgress || 0,
          status: training.hasQuizzes ? (quizResults?.passed ? 'completed' : 'failed') : 'completed'
        };
        
        await updateDoc(doc(db, 'training_completions', existingDoc.id), updateData);
        console.log('Training completion updated with ID:', existingDoc.id);
        setCurrentStep('complete');
        return;
      }

      // Save new training completion record
      const completionData = {
        trainingId,
        userId: profile.email, // Use email as userId
        userEmail: profile.email,
        userName: profile.name || 'Unknown User',
        storeId: profile.storeId || profile.assignedStore || null,
        completedAt: serverTimestamp(),
        completionTime: completionTime || 0, // Ensure it's not undefined
        quizResults: quizResults || null,
        videoProgress: videoProgress || 0, // Ensure it's not undefined
        status: training.hasQuizzes ? (quizResults?.passed ? 'completed' : 'failed') : 'completed'
      };
      
      console.log('Saving completion data:', completionData);
      
      const docRef = await addDoc(collection(db, 'training_completions'), completionData);
      console.log('Training completion saved with ID:', docRef.id);
      
      setCurrentStep('complete');
    } catch (error) {
      console.error('Error completing training:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      alert(`Error saving completion: ${error.message}. Please try again.`);
    } finally {
      setCompleting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'video': return '🎥';
      case 'pdf': return '📄';
      case 'ppt': return '📊';
      default: return '📁';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading training...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="mb-4">
            <svg className="h-12 w-12 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/my-trainings')}
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to My Trainings
          </button>
        </div>
      </div>
    );
  }

  if (!training) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="mb-4">
            <svg className="h-12 w-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Training Not Found</h1>
          <p className="text-gray-600 mb-4">The training you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/my-trainings')}
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to My Trainings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getContentTypeIcon(training.contentType)}</span>
              <div>
                <h1 className="text-xl font-semibold">{training.title}</h1>
                <p className="text-sm text-gray-600">{training.category}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Completion Time</div>
              <div className="font-mono">{formatTime(completionTime)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-gray-600">
              {currentStep === 'content' ? '1/3' : currentStep === 'quiz' ? '2/3' : '3/3'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: currentStep === 'content' ? '33%' : 
                       currentStep === 'quiz' ? '66%' : '100%' 
              }}
            ></div>
          </div>
        </div>

        {/* Content Step */}
        {currentStep === 'content' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Training Content</h2>
              <p className="text-gray-600 mb-4">{training.description}</p>
              
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <span>⏱️ {training.estimatedDuration}</span>
                <span>📊 Difficulty: {training.difficulty}</span>
                {training.hasQuizzes && <span>❓ Includes Quiz</span>}
              </div>
            </div>

            {/* Content Display */}
            <div className="mb-6">
              {training.contentType === 'video' && (
                <div className="space-y-4">
                  <div className="relative">
                    <iframe
                      ref={videoRef}
                      src={training.contentUrl.replace('watch?v=', 'embed/') + '?rel=0&modestbranding=1'}
                      title={training.title}
                      className="w-full aspect-video rounded-lg"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      onEnded={handleVideoEnded}
                    ></iframe>
                    
                    {/* Video Progress */}
                    <div className="mt-2">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(videoProgress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${videoProgress}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* Manual Progress Button */}
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => {
                          setVideoCompleted(true);
                          setVideoProgress(100);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        ✅ Mark as Watched
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {training.contentType === 'pdf' && (
                <div className="border rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📄</div>
                    <p className="text-gray-600 mb-4">PDF Document</p>
                    <a 
                      href={training.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Open PDF Document
                    </a>
                    <div className="mt-4">
                      <button
                        onClick={handleContentProgress}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        ✅ Mark as Read
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {training.contentType === 'ppt' && (
                <div className="border rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📊</div>
                    <p className="text-gray-600 mb-4">PowerPoint Presentation</p>
                    <a 
                      href={training.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Open Presentation
                    </a>
                    <div className="mt-4">
                      <button
                        onClick={handleContentProgress}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        ✅ Mark as Viewed
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => navigate('/my-trainings')}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                ← Back to Trainings
              </button>
              
              <button
                onClick={startQuiz}
                disabled={!videoCompleted || completing}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {completing ? 'Completing...' : (training.hasQuizzes ? 'Start Quiz →' : 'Mark Complete →')}
              </button>
            </div>
          </div>
        )}

        {/* Quiz Step */}
        {currentStep === 'quiz' && training.hasQuizzes && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Training Quiz</h2>
              <p className="text-gray-600">
                Answer the following questions to test your understanding. 
                You need to score at least {training.passingScore}% to pass.
              </p>
            </div>

            <div className="space-y-6">
              {training.quizzes.map((quiz, index) => (
                <div key={quiz.id} className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">
                    Question {index + 1}: {quiz.question}
                  </h3>
                  
                  <div className="space-y-2">
                    {quiz.options.map((option, optionIndex) => (
                      <label key={optionIndex} className="flex items-center p-3 border rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name={`question-${index}`}
                          value={optionIndex}
                          checked={quizAnswers[index] === optionIndex}
                          onChange={() => handleQuizAnswer(index, optionIndex)}
                          className="mr-3"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setCurrentStep('content')}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                ← Back to Content
              </button>
              
              <button
                onClick={submitQuiz}
                disabled={Object.keys(quizAnswers).length < training.quizzes.length}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Submit Quiz
              </button>
            </div>
          </div>
        )}

        {/* Quiz Results */}
        {showResults && quizResults && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="text-center">
                <div className={`text-6xl mb-4 ${quizResults.passed ? 'text-green-500' : 'text-red-500'}`}>
                  {quizResults.passed ? '🎉' : '😔'}
                </div>
                
                <h2 className="text-xl font-semibold mb-2">
                  {quizResults.passed ? 'Congratulations!' : 'Quiz Results'}
                </h2>
                
                <div className="mb-4">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {quizResults.score}%
                  </div>
                  <p className="text-gray-600">
                    {quizResults.correctAnswers} out of {quizResults.totalQuestions} correct
                  </p>
                </div>
                
                {quizResults.passed ? (
                  <p className="text-green-600 font-medium mb-4">
                    You passed! Great job completing the training.
                  </p>
                ) : (
                  <p className="text-red-600 font-medium mb-4">
                    You need {training.passingScore}% to pass. Please review the content and try again.
                  </p>
                )}
                
                <div className="space-y-2">
                  <button
                    onClick={completeTraining}
                    disabled={completing}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {completing ? 'Completing...' : (quizResults.passed ? 'Complete Training' : 'Try Again')}
                  </button>
                  
                  {!quizResults.passed && (
                    <button
                      onClick={() => {
                        setShowResults(false);
                        setQuizAnswers({});
                        setQuizResults(null);
                      }}
                      className="w-full px-4 py-2 border rounded hover:bg-gray-50"
                    >
                      Review Content
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Completion Step */}
        {currentStep === 'complete' && (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-semibold mb-2">Training Completed!</h2>
            <p className="text-gray-600 mb-6">
              Congratulations! You have successfully completed "{training.title}".
            </p>
            
            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <div className="text-sm text-green-600 mb-2">Completion Summary</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium">Time Taken</div>
                  <div className="text-gray-600">{formatTime(completionTime)}</div>
                </div>
                {quizResults && (
                  <div>
                    <div className="font-medium">Quiz Score</div>
                    <div className="text-gray-600">{quizResults.score}%</div>
                  </div>
                )}
              </div>
            </div>
            
            <button
              onClick={() => navigate('/my-trainings')}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Back to My Trainings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



