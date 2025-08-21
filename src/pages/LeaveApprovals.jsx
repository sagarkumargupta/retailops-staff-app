import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import useUserProfile from '../hooks/useUserProfile';

export default function LeaveApprovals(){
  const { profile, getStoresForFiltering } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(()=>{ (async()=>{
    const ss = await getDocs(collection(db,'stores'));
    let list = ss.docs.map(d=>({id:d.id, ...d.data()}));
    
    // Use new consistent access control pattern
    const userStores = getStoresForFiltering();
    if (userStores.length > 0) {
      list = list.filter(s => userStores.includes(s.id));
      
      // For managers, automatically set the store ID to their assigned store
      if (profile?.role === 'MANAGER' && userStores.length > 0) {
        setStoreId(userStores[0]); // Set to first assigned store
      }
    }
    
    setStores(list);
  })() }, [profile?.role, profile?.assignedStore]);

  const load = async()=>{
    if(!storeId) {
      console.log('No store selected, cannot load leave requests');
      setRows([]);
      return;
    }
    
    setBusy(true);
    try {
      const q1 = query(collection(db,'leave_requests'), where('storeId','==',storeId));
      const snap = await getDocs(q1);
      const list = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=> (a.createdAt?.seconds||0) > (b.createdAt?.seconds||0) ? -1 : 1);
      setRows(list);
      console.log(`Loaded ${list.length} leave requests for store: ${storeId}`);
    } catch (error) {
      console.error('Error loading leave requests:', error);
      setRows([]);
    } finally {
      setBusy(false);
    }
  };
  useEffect(()=>{ 
    if (storeId) {
      load(); 
    }
  }, [storeId]);

  const setStatus = async(id, status) => {
    await updateDoc(doc(db,'leave_requests', id), { status });
    load();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">
        {profile?.role === 'MANAGER' ? 'My Store Leave Approvals' : 'Leave Approvals'}
      </h2>
      <div className="bg-white rounded shadow p-4 mb-6 grid md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm mb-1">Store</label>
          <select 
            value={storeId} 
            onChange={e=>setStoreId(e.target.value)} 
            className="w-full p-2 border rounded"
            disabled={profile?.role === 'MANAGER' && stores.length === 1}
          >
            <option value="">Select a store</option>
            {stores.map(s=> <option key={s.id} value={s.id}>{s.brand} — {s.name}</option>)}
          </select>
          {profile?.role === 'MANAGER' && stores.length === 1 && (
            <p className="text-xs text-gray-500 mt-1">Your assigned store</p>
          )}
        </div>
        <div className="md:col-span-2 flex items-end">
          <button 
            disabled={busy || !storeId} 
            onClick={load} 
            className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-60"
          >
            {busy? 'Loading…':'Refresh'}
          </button>
        </div>
      </div>

      {!storeId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                No store selected
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Please select a store to view leave requests.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow overflow-auto">
        {rows.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No leave requests found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {storeId ? 'No leave requests found for this store.' : 'Select a store to view leave requests.'}
            </p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Staff</th>
                <th className="p-2 text-left">From</th>
                <th className="p-2 text-left">To</th>
                <th className="p-2 text-left">Reason</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
              <tr key={r.id} className="border-top">
                <td className="p-2">{r.staffName || r.staffId}</td>
                <td className="p-2">{r.from}</td>
                <td className="p-2">{r.to}</td>
                <td className="p-2">{r.reason || '-'}</td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    r.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    r.status?.toLowerCase() === 'approved' ? 'bg-green-100 text-green-800' :
                    r.status?.toLowerCase() === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {r.status?.toUpperCase()}
                  </span>
                </td>
                <td className="p-2">
                  {r.status?.toLowerCase() === 'pending' ? (
                    <div className="flex gap-1">
                      <button 
                        onClick={()=>setStatus(r.id,'approved')} 
                        className="px-3 py-1 rounded bg-green-500 text-white text-xs hover:bg-green-600"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={()=>setStatus(r.id,'rejected')} 
                        className="px-3 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-600"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">
                      {r.status?.toLowerCase() === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


