import React, { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';

export default function LeaveRequest(){
  const [user] = useAuthState(auth);
  const [store, setStore] = useState(null);
  const [staff, setStaff] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState([]);

  useEffect(()=>{ (async()=>{
    if(!user?.email) return;
    
    // First, check if user is a manager in users collection
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if(userSnap.exists()) {
      const userData = userSnap.data();
      if(userData.role === 'MANAGER' && userData.stores) {
        // Manager found - get their assigned store
        const storeIds = Object.keys(userData.stores);
        if(storeIds.length > 0) {
          const storeId = storeIds[0]; // Take first store (single store policy)
          const storeRef = doc(db, 'stores', storeId);
          const storeSnap = await getDoc(storeRef);
          
          if(storeSnap.exists()) {
            const storeData = storeSnap.data();
            setStore({ id: storeId, ...storeData });
            setStaff({ 
              id: user.uid, 
              name: userData.displayName || user.email?.split('@')[0] || 'Manager',
              email: user.email.toLowerCase(),
              role: 'MANAGER'
            });
            return;
          }
        }
      }
    }
    
    // If not a manager, check for staff records
    try {
      // First, try to get user profile from users collection
      const userDoc = await getDoc(doc(db, 'users', user.email.toLowerCase()));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'STAFF' && userData.assignedStore) {
          // Get store information
          const storeDoc = await getDoc(doc(db, 'stores', userData.assignedStore));
          if (storeDoc.exists()) {
            setStore({ id: userData.assignedStore, ...storeDoc.data() });
            setStaff({ 
              id: user.email.toLowerCase(), 
              ...userData, 
              storeId: userData.assignedStore 
            });
            return; // Exit early if we found the user
          }
        }
      }
      
      // Fallback: Check stores subcollections (this might fail due to security rules)
      const ss = await getDocs(collection(db,'stores'));
      const stores = ss.docs.map(d=>({id:d.id, ...d.data()}));
      for(const s of stores){
        try {
          const q1 = query(collection(db,'stores', s.id, 'staff'), where('email','==', user.email.toLowerCase()));
          const snap = await getDocs(q1);
          if(!snap.empty){ 
            setStore(s); 
            setStaff({ id: snap.docs[0].id, ...snap.docs[0].data() }); 
            break; 
          }
        } catch (subcollectionError) {
          console.warn(`Could not access staff subcollection for store ${s.id}:`, subcollectionError);
          // Continue to next store
          continue;
        }
      }
    } catch (storesError) {
      console.error('Could not access stores collection:', storesError);
    }
  })() }, [user?.email, user?.uid]);

  useEffect(()=>{ (async()=>{
    if(!user) return; const q1 = query(collection(db,'leave_requests'), where('userEmail','==',(user.email||'').toLowerCase()));
    const snap = await getDocs(q1); setMine(snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=> (a.createdAt?.seconds||0) > (b.createdAt?.seconds||0) ? -1 : 1));
  })() }, [user?.email, msg]);

  const submit = async (e)=>{
    e.preventDefault(); setMsg('');
    if(!user || !store || !staff) { setMsg('Your profile is not linked to a store.'); return; }
    if(!from || !to) { setMsg('Select a date range'); return; }
    
    // Validate dates - cannot request leave for past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    if (fromDate < today) {
      setMsg('❌ Cannot request leave for past dates.');
      return;
    }
    
    if (toDate < fromDate) {
      setMsg('❌ End date cannot be before start date.');
      return;
    }
    
    // Calculate leave duration
    const timeDiff = toDate.getTime() - fromDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
    
    if (daysDiff > 30) {
      setMsg('❌ Leave request cannot exceed 30 days.');
      return;
    }
    
    if (!reason.trim() || reason.trim().length < 10) {
      setMsg('❌ Please provide a detailed reason (minimum 10 characters).');
      return;
    }
    
    // Check for overlapping leave requests
    const overlappingRequests = mine.filter(request => {
      if (request.status === 'REJECTED') return false; // Ignore rejected requests
      
      const requestFrom = new Date(request.from);
      const requestTo = new Date(request.to);
      const newFrom = new Date(from);
      const newTo = new Date(to);
      
      // Check if date ranges overlap
      return (newFrom <= requestTo && newTo >= requestFrom);
    });
    
    if (overlappingRequests.length > 0) {
      setMsg('❌ You already have a leave request for these dates. Please check your existing requests.');
      return;
    }
    
    setBusy(true);
    try{
      await addDoc(collection(db,'leave_requests'), {
        storeId: store.id,
        staffId: staff.id,
        staffName: staff.name || '',
        staffRole: staff.role || 'STAFF',
        userEmail: (user.email||'').toLowerCase(),
        from, to, reason, status: 'PENDING',
        createdAt: serverTimestamp()
      });
      setFrom(''); setTo(''); setReason(''); setMsg('✅ Request submitted');
    }catch(e){ setMsg('❌ Failed: ' + (e.code||e.message)); }
    finally{ setBusy(false); }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Leave Request</h2>
      
      {user && staff && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-blue-800">
            <strong>Store:</strong> {store?.brand} — {store?.name}
          </p>
          <p className="text-sm text-blue-600">
            <strong>Role:</strong> {staff?.role === 'MANAGER' ? 'Store Manager' : 'Staff Member'} — {staff?.name} ({staff?.email})
          </p>
        </div>
      )}
      
      {user && !staff && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm text-yellow-800">We could not find your profile. If you're a staff member, ask your manager to add your email. If you're a manager, contact admin to set up your store assignment.</p>
          </div>
        </div>
      )}
      
      <form onSubmit={submit} className="bg-white rounded-lg shadow-lg p-6 mb-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="relative">
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full p-3 border rounded-lg peer bg-transparent" required />
            <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">From Date</label>
          </div>
          <div className="relative">
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full p-3 border rounded-lg peer bg-transparent" required />
            <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">To Date</label>
          </div>
        </div>
        <div className="relative">
          <textarea value={reason} onChange={e=>setReason(e.target.value)} className="w-full p-3 border rounded-lg peer bg-transparent resize-none" rows={3} placeholder=" " required />
          <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Reason for Leave</label>
        </div>
        <div className="flex gap-3 items-center pt-4">
          <button disabled={busy} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 font-medium">
            {busy ? 'Submitting…' : 'Submit Leave Request'}
          </button>
          {msg && (
            <div className={`text-sm px-3 py-2 rounded ${msg.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {msg}
            </div>
          )}
        </div>
      </form>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">My Leave Requests</h3>
        </div>
        {mine.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No leave requests submitted yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mine.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.from}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.to}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{r.reason || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        r.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        r.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


