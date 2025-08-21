import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { Link } from 'react-router-dom';
import { filterAssignedItems } from '../utils/assignmentUtils';

export default function MyTrainings() {
  const { profile } = useUserProfile();
  const [trainings, setTrainings] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, completed, failed

  useEffect(() => {
    loadTrainings();
  }, [profile]);

  const loadTrainings = async () => {
    if (!profile?.email) {
      console.log('Profile not loaded yet, skipping training load');
      return;
    }
    
    setLoading(true);
    try {
      // Load all trainings first, then filter using unified utility
      let trainingsQuery;
      if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN') {
        trainingsQuery = query(
          collection(db, 'trainings'),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc')
        );
      } else {
        trainingsQuery = query(
          collection(db, 'trainings'),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc')
        );
      }
      
      const trainingsSnap = await getDocs(trainingsQuery);
      let trainingsList = trainingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter trainings based on user assignment using unified utility
      if (profile?.role !== 'SUPER_ADMIN' && profile?.role !== 'ADMIN') {
        console.log('Filtering trainings for user:', {
          role: profile?.role,
          email: profile?.email,
          totalTrainings: trainingsList.length
        });
        
        trainingsList = filterAssignedItems(trainingsList, profile);
        console.log('Filtered trainings count:', trainingsList.length);
      }
      
      setTrainings(trainingsList);

      // Load completion records
      const completionsQuery = query(
        collection(db, 'training_completions'),
        where('userId', '==', profile.email),
        orderBy('completedAt', 'desc')
      );
      
      const completionsSnap = await getDocs(completionsQuery);
      const completionsList = completionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompletions(completionsList);
    } catch (error) {
      console.error('Error loading trainings:', error);
      
      // Enhanced fallback: handle both index errors and other errors
      try {
        // Try simpler queries without orderBy first
        const trainingsQuerySimple = query(
          collection(db, 'trainings'),
          where('isActive', '==', true)
        );
        
        const trainingsSnap = await getDocs(trainingsQuerySimple);
        let trainingsList = trainingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter trainings based on user assignment using unified utility
        if (profile?.role !== 'SUPER_ADMIN' && profile?.role !== 'ADMIN') {
          trainingsList = filterAssignedItems(trainingsList, profile);
        }
        
        // Sort client-side
        trainingsList = trainingsList.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB - dateA;
        });
        
        setTrainings(trainingsList);

        // Try simpler completion query
        const completionsQuerySimple = query(
          collection(db, 'training_completions'),
          where('userId', '==', profile.email)
        );
        
        const completionsSnap = await getDocs(completionsQuerySimple);
        let completionsList = completionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort client-side
        completionsList = completionsList.sort((a, b) => {
          const dateA = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt);
          const dateB = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt);
          return dateB - dateA;
        });
        
        setCompletions(completionsList);
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
        // Final fallback: load all and filter client-side
        const trainingsSnap = await getDocs(collection(db, 'trainings'));
        let trainingsList = trainingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        trainingsList = trainingsList.filter(training => training.isActive);
        
        // Filter trainings based on user assignment using unified utility
        if (profile?.role !== 'SUPER_ADMIN' && profile?.role !== 'ADMIN') {
          trainingsList = filterAssignedItems(trainingsList, profile);
        }
        
        setTrainings(trainingsList);
        setCompletions([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getTrainingStatus = (training) => {
    const completion = completions.find(c => c.trainingId === training.id);
    if (!completion) return 'pending';
    return completion.status;
  };

  const getTrainingProgress = (training) => {
    const completion = completions.find(c => c.trainingId === training.id);
    if (!completion) return 0;
    
    if (training.hasQuizzes) {
      return completion.quizResults?.passed ? 100 : 50; // 50% for failed quiz
    }
    return 100; // No quiz means 100% when completed
  };

  const getFilteredTrainings = () => {
    if (filter === 'all') return trainings;
    
    return trainings.filter(training => {
      const status = getTrainingStatus(training);
      return status === filter;
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
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

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN');
  };

  const formatTime = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!profile) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">My Trainings</h1>
        <p className="text-gray-600">Complete your assigned training programs to improve your skills</p>
      </div>

      {/* Statistics */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{trainings.length}</div>
          <div className="text-sm text-gray-600">Total Assigned</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {trainings.filter(t => getTrainingStatus(t) === 'completed').length}
          </div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">
            {trainings.filter(t => getTrainingStatus(t) === 'pending').length}
          </div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">
            {trainings.filter(t => getTrainingStatus(t) === 'failed').length}
          </div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'all', label: 'All Trainings', count: trainings.length },
              { key: 'pending', label: 'Pending', count: trainings.filter(t => getTrainingStatus(t) === 'pending').length },
              { key: 'completed', label: 'Completed', count: trainings.filter(t => getTrainingStatus(t) === 'completed').length },
              { key: 'failed', label: 'Failed', count: trainings.filter(t => getTrainingStatus(t) === 'failed').length }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Trainings List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading your trainings...</p>
        </div>
      ) : getFilteredTrainings().length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filter === 'all' ? 'No trainings assigned' : `No ${filter} trainings`}
          </h3>
          <p className="text-gray-600">
            {filter === 'all' 
              ? 'You don\'t have any training programs assigned yet.' 
              : `You don't have any ${filter} training programs.`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {getFilteredTrainings().map((training) => {
            const status = getTrainingStatus(training);
            const progress = getTrainingProgress(training);
            const completion = completions.find(c => c.trainingId === training.id);

            return (
              <div key={training.id} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{getContentTypeIcon(training.contentType)}</span>
                      <h3 className="text-lg font-semibold">{training.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(training.difficulty)}`}>
                        {training.difficulty}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status)}`}>
                        {status === 'completed' ? '✅ Completed' : 
                         status === 'failed' ? '❌ Failed' : '⏳ Pending'}
                      </span>
                    </div>

                    <p className="text-gray-600 mb-3">{training.description}</p>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span>📅 {training.estimatedDuration}</span>
                      <span>📊 Passing: {training.passingScore}%</span>
                      {training.hasQuizzes && <span>❓ Includes Quiz</span>}
                      {completion && (
                        <span>⏱️ Completed in: {formatTime(completion.completionTime)}</span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Completion Details */}
                    {completion && (
                      <div className="bg-gray-50 rounded p-3 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="font-medium">Completed:</span> {formatDate(completion.completedAt)}
                          </div>
                          {completion.quizResults && (
                            <div>
                              <span className="font-medium">Quiz Score:</span> {completion.quizResults.score}%
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    {status === 'pending' ? (
                      <Link
                        to={`/training-execution/${training.id}`}
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Start Training
                      </Link>
                    ) : status === 'failed' ? (
                      <Link
                        to={`/training-execution/${training.id}`}
                        className="inline-block px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Retry Training
                      </Link>
                    ) : (
                      <div className="text-center">
                        <div className="text-green-600 text-2xl mb-1">✅</div>
                        <span className="text-sm text-green-600 font-medium">Completed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completion History */}
      {completions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Training History</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Training
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {completions.map((completion) => {
                    const training = trainings.find(t => t.id === completion.trainingId);
                    return (
                      <tr key={completion.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {training?.title || 'Unknown Training'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {training?.category || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(completion.status)}`}>
                            {completion.status === 'completed' ? '✅ Completed' : '❌ Failed'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {completion.quizResults ? `${completion.quizResults.score}%` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatTime(completion.completionTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(completion.completedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
