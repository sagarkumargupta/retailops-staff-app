import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function DebugUserProfile() {
  const { profile } = useUserProfile();
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrainings();
  }, []);

  const loadTrainings = async () => {
    try {
      const trainingsSnap = await getDocs(collection(db, 'trainings'));
      const trainingsList = trainingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrainings(trainingsList);
    } catch (error) {
      console.error('Error loading trainings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Debug User Profile & Trainings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Profile */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">User Profile</h2>
          <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
            {JSON.stringify(profile, null, 2)}
          </pre>
        </div>

        {/* Trainings */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Trainings ({trainings.length})</h2>
          <div className="space-y-4">
            {trainings.map((training, index) => (
              <div key={training.id} className="border p-3 rounded">
                <h3 className="font-medium">{training.title}</h3>
                <div className="text-sm text-gray-600 mt-2">
                  <div><strong>ID:</strong> {training.id}</div>
                  <div><strong>Target Audience:</strong> {training.targetAudience}</div>
                  <div><strong>Assigned Stores:</strong> {JSON.stringify(training.assignedStores)}</div>
                  <div><strong>Assignees:</strong> {JSON.stringify(training.assignees)}</div>
                  <div><strong>Created By:</strong> {training.createdBy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

