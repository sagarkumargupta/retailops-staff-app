import React, { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function DevMakeAdmin() {
  const [user] = useAuthState(auth);
  const [msg, setMsg] = useState('');
  const makeAdmin = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { role: 'ADMIN' }, { merge: true });
      setMsg('✅ You are now ADMIN. Sign out/in to refresh.');
    } catch (e) {
      setMsg('❌ Failed: ' + (e.code || e.message));
    }
  };
  if (!user) return (
    <div className="max-w-md mx-auto card card-pad mt-8">
      <p>Please <Link to="/login" className="text-blue-600">login</Link> first.</p>
    </div>
  );
  return (
    <div className="max-w-md mx-auto card card-pad mt-8">
      <h2 className="text-xl font-bold mb-3">Bootstrap Admin</h2>
      <p className="text-sm text-slate-600 mb-4">Signed in as: <strong>{user.email}</strong></p>
      <button onClick={makeAdmin} className="bg-indigo-600 text-white px-4 py-2 rounded">Make me ADMIN</button>
      {msg && <p className="mt-3">{msg}</p>}
      <p className="mt-4 text-xs text-slate-500">Use once, then remove this page for security.</p>
    </div>
  );
}


