import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import useUserProfile from '../hooks/useUserProfile';

export default function LeaveApprovals(){
  const { profile } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(()=>{ (async()=>{
    const ss = await getDocs(collection(db,'stores'));
    let list = ss.docs.map(d=>({id:d.id, ...d.data()}));
    if(profile?.role==='MANAGER' && Array.isArray(profile.stores) && profile.stores.length){
      list = list.filter(s => profile.stores.includes(s.id));
    }
    setStores(list);
    if(!storeId && list.length) setStoreId(list[0].id);
  })() }, [profile?.role, profile?.stores?.length]);

  const load = async()=>{
    if(!storeId) return; setBusy(true);
    const q1 = query(collection(db,'leave_requests'), where('storeId','==',storeId));
    const snap = await getDocs(q1);
    const list = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=> (a.createdAt?.seconds||0) > (b.createdAt?.seconds||0) ? -1 : 1);
    setRows(list); setBusy(false);
  };
  useEffect(()=>{ load(); }, [storeId]);

  const setStatus = async(id, status) => {
    await updateDoc(doc(db,'leave_requests', id), { status });
    load();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Leave Approvals</h2>
      <div className="bg-white rounded shadow p-4 mb-6 grid md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm mb-1">Store</label>
          <select value={storeId} onChange={e=>setStoreId(e.target.value)} className="w-full p-2 border rounded">
            {stores.map(s=> <option key={s.id} value={s.id}>{s.brand} — {s.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2 flex items-end">
          <button disabled={busy} onClick={load} className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-60">{busy? 'Loading…':'Refresh'}</button>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-auto">
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
                <td className="p-2">{r.status}</td>
                <td className="p-2">
                  <button onClick={()=>setStatus(r.id,'APPROVED')} className="px-3 py-1 rounded border mr-2">Approve</button>
                  <button onClick={()=>setStatus(r.id,'REJECTED')} className="px-3 py-1 rounded bg-red-600 text-white">Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


