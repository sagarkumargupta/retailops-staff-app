import React, { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

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
    const ss = await getDocs(collection(db,'stores'));
    const stores = ss.docs.map(d=>({id:d.id, ...d.data()}));
    for(const s of stores){
      const q1 = query(collection(db,'stores', s.id, 'staff'), where('email','==', (user.email||'').toLowerCase()));
      const snap = await getDocs(q1);
      if(!snap.empty){ setStore(s); setStaff({ id: snap.docs[0].id, ...snap.docs[0].data() }); break; }
    }
  })() }, [user?.email]);

  useEffect(()=>{ (async()=>{
    if(!user) return; const q1 = query(collection(db,'leave_requests'), where('userEmail','==',(user.email||'').toLowerCase()));
    const snap = await getDocs(q1); setMine(snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=> (a.createdAt?.seconds||0) > (b.createdAt?.seconds||0) ? -1 : 1));
  })() }, [user?.email, msg]);

  const submit = async (e)=>{
    e.preventDefault(); setMsg('');
    if(!user || !store || !staff) { setMsg('Your staff profile is not linked to a store.'); return; }
    if(!from || !to) { setMsg('Select a date range'); return; }
    setBusy(true);
    try{
      await addDoc(collection(db,'leave_requests'), {
        storeId: store.id,
        staffId: staff.id,
        staffName: staff.name || '',
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
      <form onSubmit={submit} className="bg-white rounded shadow p-4 mb-6 grid md:grid-cols-3 gap-3">
        <div className="md:col-span-1">
          <label className="block text-sm mb-1">From</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full p-2 border rounded"/>
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm mb-1">To</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full p-2 border rounded"/>
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm mb-1">Reason</label>
          <textarea value={reason} onChange={e=>setReason(e.target.value)} className="w-full p-2 border rounded" rows={3}/>
        </div>
        <div className="md:col-span-3 flex items-center gap-2">
          <button disabled={busy} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60">{busy?'Submitting…':'Submit'}</button>
          {msg && <div className="text-sm">{msg}</div>}
        </div>
      </form>

      <div className="bg-white rounded shadow overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">From</th>
              <th className="p-2 text-left">To</th>
              <th className="p-2 text-left">Reason</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {mine.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.from}</td>
                <td className="p-2">{r.to}</td>
                <td className="p-2">{r.reason||'-'}</td>
                <td className="p-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


