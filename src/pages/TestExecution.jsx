import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { isUserAssigned } from '../utils/assignmentUtils';

const TestExecution = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useUserProfile();
  const [test, setTest] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      loadTest();
    }
  }, [testId, profile]);

  useEffect(() => {
    if (isStarted && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSubmitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isStarted, timeLeft]);

  const loadTest = async () => {
    try {
      setLoading(true);
      
      // Wait for profile to be loaded
      if (!profile) {
        console.log('Profile not loaded yet, waiting...');
        return;
      }
      
      const testDoc = await getDoc(doc(db, 'tests', testId));
      
      if (!testDoc.exists()) {
        setError('Test not found');
        return;
      }

      const testData = { id: testId, ...testDoc.data() };
      
      console.log('Checking assignment for test:', {
        testId,
        testTitle: testData.title,
        targetAudience: testData.targetAudience,
        userEmail: profile.email,
        userRole: profile.role
      });
      
      // Check if user is assigned to this test using unified utility
      const isAssigned = isUserAssigned(testData, profile);
      if (!isAssigned) {
        setError('You are not assigned to this test');
        return;
      }

      setTest(testData);
      setTimeLeft(testData.timeLimit * 60); // Convert minutes to seconds
    } catch (error) {
      console.error('Error loading test:', error);
      setError('Error loading test: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startTest = () => {
    setIsStarted(true);
  };

  const handleAnswer = (questionIndex, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const nextQuestion = () => {
    if (currentQuestion < test.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const goToQuestion = (index) => {
    setCurrentQuestion(index);
  };

  const handleSubmitTest = async () => {
    if (submitting) {
      console.log('Test submission already in progress');
      return;
    }
    
    try {
      setSubmitting(true);
      
      console.log('Submitting test with data:', {
        testId,
        profile: {
          email: profile?.email,
          name: profile?.name,
          role: profile?.role,
          storeId: profile?.storeId,
          assignedStore: profile?.assignedStore
        },
        answers,
        timeLeft
      });

      // Validate required fields
      if (!profile?.email) {
        throw new Error('User profile not loaded');
      }

      if (!testId) {
        throw new Error('Test ID not found');
      }

      const score = calculateScore();
      const percentage = Math.round((score / test.totalPoints) * 100);
      const passed = percentage >= test.passingScore;

      const result = {
        testId,
        testTitle: test.title,
        userId: profile.email,
        userName: profile.name || 'Unknown User',
        userRole: profile.role,
        storeId: profile.storeId || profile.assignedStore || null,
        answers,
        score,
        totalPoints: test.totalPoints,
        percentage,
        passed,
        timeTaken: test.timeLimit * 60 - timeLeft,
        completedAt: serverTimestamp()
      };

      console.log('Saving test result:', result);
      
      const docRef = await addDoc(collection(db, 'test_results'), result);
      console.log('Test result saved with ID:', docRef.id);
      
      setIsCompleted(true);
    } catch (error) {
      console.error('Error submitting test:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      alert(`Error submitting test: ${error.message}. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  const calculateScore = () => {
    let totalScore = 0;
    
    test.questions.forEach((question, index) => {
      const userAnswer = answers[index];
      if (userAnswer !== undefined) {
        if (question.type === 'multiple_choice') {
          if (userAnswer === question.correctAnswer) {
            totalScore += question.points;
          }
        } else if (question.type === 'calculation') {
          if (userAnswer && userAnswer.toString().trim() === question.correctAnswer.toString().trim()) {
            totalScore += question.points;
          }
        } else if (question.type === 'text') {
          if (userAnswer && userAnswer.toString().toLowerCase().trim() === question.correctAnswer.toString().toLowerCase().trim()) {
            totalScore += question.points;
          }
        } else if (question.type === 'true_false') {
          if (userAnswer === question.correctAnswer) {
            totalScore += question.points;
          }
        }
      }
    });
    
    return totalScore;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading test...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl font-semibold mb-4">{error}</div>
          <button
            onClick={() => navigate('/my-tests')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{test.title}</h1>
              <p className="text-gray-600 mb-6">{test.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{test.totalQuestions}</div>
                  <div className="text-sm text-blue-600">Questions</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{test.timeLimit}</div>
                  <div className="text-sm text-green-600">Minutes</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{test.passingScore}%</div>
                  <div className="text-sm text-yellow-600">Passing Score</div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Instructions</h3>
                <ul className="text-left text-gray-600 space-y-2">
                  <li>• Read each question carefully before answering</li>
                  <li>• You can navigate between questions using the question navigation</li>
                  <li>• The test will auto-submit when time runs out</li>
                  <li>• You need {test.passingScore}% to pass this test</li>
                  <li>• Once started, you cannot pause or restart the test</li>
                </ul>
              </div>

              <button
                onClick={startTest}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Start Test
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    const score = calculateScore();
    const percentage = Math.round((score / test.totalPoints) * 100);
    const passed = percentage >= test.passingScore;

    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${
                passed ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <svg className={`w-12 h-12 ${passed ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {passed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {passed ? 'Congratulations!' : 'Test Completed'}
              </h1>
              
              <p className="text-gray-600 mb-8">
                {passed 
                  ? 'You have successfully passed the test!' 
                  : 'You did not meet the passing score requirement.'
                }
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{score}/{test.totalPoints}</div>
                  <div className="text-sm text-blue-600">Score</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{percentage}%</div>
                  <div className="text-sm text-green-600">Percentage</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{formatTime(test.timeLimit * 60 - timeLeft)}</div>
                  <div className="text-sm text-yellow-600">Time Taken</div>
                </div>
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => navigate('/my-tests')}
                  className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
                >
                  Back to Tests
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  Retake Test
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = test.questions[currentQuestion];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{test.title}</h1>
              <p className="text-gray-600">Question {currentQuestion + 1} of {test.questions.length}</p>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${timeLeft < 300 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatTime(timeLeft)}
              </div>
              <div className="text-sm text-gray-600">Time Remaining</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Questions</h3>
              <div className="grid grid-cols-5 gap-2">
                {test.questions.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToQuestion(index)}
                    className={`p-2 rounded text-sm font-medium ${
                      currentQuestion === index
                        ? 'bg-blue-600 text-white'
                        : answers[index] !== undefined
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              
              <div className="mt-6 space-y-2">
                <div className="flex items-center text-sm">
                  <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
                  <span>Current Question</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className="w-4 h-4 bg-green-100 rounded mr-2"></div>
                  <span>Answered</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className="w-4 h-4 bg-gray-100 rounded mr-2"></div>
                  <span>Unanswered</span>
                </div>
              </div>
            </div>
          </div>

          {/* Question Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="mb-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Question {currentQuestion + 1}
                  </h2>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    {currentQ.points} point{currentQ.points > 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <p className="text-gray-900 text-lg">{currentQ.question}</p>
                </div>

                {/* Answer Options */}
                {currentQ.type === 'multiple_choice' && (
                  <div className="space-y-3">
                    {currentQ.options.map((option, optionIndex) => (
                      <label key={optionIndex} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name={`question-${currentQuestion}`}
                          value={optionIndex}
                          checked={answers[currentQuestion] === optionIndex}
                          onChange={(e) => handleAnswer(currentQuestion, parseInt(e.target.value))}
                          className="mr-3"
                        />
                        <span className="text-gray-900">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQ.type === 'calculation' && (
                  <div>
                    <input
                      type="number"
                      value={answers[currentQuestion] || ''}
                      onChange={(e) => handleAnswer(currentQuestion, e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your answer"
                    />
                  </div>
                )}

                {currentQ.type === 'text' && (
                  <div>
                    <textarea
                      value={answers[currentQuestion] || ''}
                      onChange={(e) => handleAnswer(currentQuestion, e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your answer"
                    />
                  </div>
                )}

                {currentQ.type === 'true_false' && (
                  <div className="space-y-3">
                    <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${currentQuestion}`}
                        value="true"
                        checked={answers[currentQuestion] === 'true'}
                        onChange={(e) => handleAnswer(currentQuestion, e.target.value)}
                        className="mr-3"
                      />
                      <span className="text-gray-900">True</span>
                    </label>
                    <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${currentQuestion}`}
                        value="false"
                        checked={answers[currentQuestion] === 'false'}
                        onChange={(e) => handleAnswer(currentQuestion, e.target.value)}
                        className="mr-3"
                      />
                      <span className="text-gray-900">False</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between">
                <button
                  onClick={previousQuestion}
                  disabled={currentQuestion === 0}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex space-x-3">
                  {currentQuestion < test.questions.length - 1 ? (
                    <button
                      onClick={nextQuestion}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmitTest}
                      disabled={submitting}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Submitting...' : 'Submit Test'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestExecution;
