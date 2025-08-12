import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, setDoc, writeBatch } from 'firebase/firestore';
import useUserProfile from '../hooks/useUserProfile';

const ymdToday = () => new Date().toISOString().slice(0,10);

export default function Attendance(){
  const { profile } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [date, setDate] = useState(ymdToday());
  const [staff, setStaff] = useState([]);
  const [attMap, setAttMap] = useState({}); // staffId -> { present, checkIn, checkOut }
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Load stores filtered for MANAGER
  useEffect(()=>{ (async()=>{
    const ss = await getDocs(collection(db,'stores'));
    let list = ss.docs.map(d=>({id:d.id, ...d.data()}));
    if(profile?.role==='MANAGER' && Array.isArray(profile.stores) && profile.stores.length){
      list = list.filter(s => profile.stores.includes(s.id));
    }
    setStores(list);
    if(!storeId && list.length) setStoreId(list[0].id);
  })() }, [profile?.role, profile?.stores?.length]);

  // Load staff for selected store
  useEffect(()=>{ (async()=>{
    if(!storeId) { setStaff([]); return; }
    const snap = await getDocs(collection(db,'stores', storeId, 'staff'));
    const list = snap.docs.map(d=>({id:d.id, ...d.data()}));
    setStaff(list);
  })() }, [storeId]);

  // Load attendance for selected store+date
  useEffect(()=>{ (async()=>{
    if(!storeId || !date) { setAttMap({}); return; }
    const q1 = query(collection(db,'attendance'), where('storeId','==',storeId), where('date','==',date));
    const snap = await getDocs(q1);
    const map = {};
    snap.forEach(d=>{ const v=d.data(); map[v.staffId] = {
      present: !!v.present,
      checkIn: v.checkIn || '',
      checkOut: v.checkOut || ''
    }; });
    setAttMap(map);
  })() }, [storeId, date]);

  const onToggle = (sid) => {
    setAttMap(m => ({ ...m, [sid]: { present: !m[sid]?.present, checkIn: m[sid]?.checkIn||'', checkOut: m[sid]?.checkOut||'' } }));
  };
  const onTime = (sid, field, value) => {
    setAttMap(m => ({ ...m, [sid]: { present: !!m[sid]?.present, checkIn: field==='in'? value : (m[sid]?.checkIn||''), checkOut: field==='out'? value : (m[sid]?.checkOut||'') } }));
  };
  const markAll = (state) => {
    const next={}; for(const s of staff){ next[s.id] = { present: !!state, checkIn: attMap[s.id]?.checkIn||'', checkOut: attMap[s.id]?.checkOut||'' }; }
    setAttMap(next);
  };

  const save = async () => {
    if(!storeId || !date) return;
    setBusy(true); setMsg('');
    try{
      const batch = writeBatch(db);
      for(const s of staff){
        const v = attMap[s.id] || { present:false, checkIn:'', checkOut:'' };
        const id = `${storeId}_${date}_${s.id}`;
        const ref = doc(db,'attendance', id);
        batch.set(ref, {
          storeId, date,
          staffId: s.id,
          staffName: s.name || '',
          present: !!v.present,
          checkIn: v.checkIn || '',
          checkOut: v.checkOut || '',
          updatedAt: new Date()
        }, { merge: true });
      }
      await batch.commit();
      setMsg('✅ Saved');
    }catch(e){ setMsg('❌ Failed: ' + (e.code||e.message)); }
    finally{ setBusy(false); }
  };

  const storeLabel = useMemo(()=> stores.find(s=>s.id===storeId)?.name || '', [stores, storeId]);

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Staff Attendance</h2>
      <div className="bg-white rounded shadow p-4 mb-6 grid md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm mb-1">Store</label>
          <select value={storeId} onChange={e=>setStoreId(e.target.value)} className="w-full p-2 border rounded">
            {stores.map(s => <option key={s.id} value={s.id}>{s.brand} — {s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2 border rounded"/>
        </div>
        <div className="md:col-span-2 flex items-end gap-2">
          <button onClick={()=>markAll(true)} className="px-3 py-2 rounded border">Mark all present</button>
          <button onClick={()=>markAll(false)} className="px-3 py-2 rounded border">Mark all absent</button>
          <button disabled={busy} onClick={save} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60">{busy? 'Saving…':'Save Attendance'}</button>
          {msg && <div className="self-center text-sm">{msg}</div>}
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Staff</th>
              <th className="p-2 text-left">Present</th>
              <th className="p-2 text-left">Check-in</th>
              <th className="p-2 text-left">Check-out</th>
            </tr>
          </thead>
          <tbody>
            {staff.length===0 && (
              <tr><td colSpan={4} className="p-4 text-center text-gray-500">No staff in {storeLabel || 'store'}</td></tr>
            )}
            {staff.map(s=>{
              const v = attMap[s.id] || { present:false, checkIn:'', checkOut:'' };
              return (
                <tr key={s.id} className="border-t">
                  <td className="p-2">{s.name || s.id}</td>
                  <td className="p-2">
                    <input type="checkbox" checked={!!v.present} onChange={()=>onToggle(s.id)} />
                  </td>
                  <td className="p-2">
                    <input type="time" value={v.checkIn} onChange={e=>onTime(s.id,'in',e.target.value)} className="p-2 border rounded" />
                  </td>
                  <td className="p-2">
                    <input type="time" value={v.checkOut} onChange={e=>onTime(s.id,'out',e.target.value)} className="p-2 border rounded" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


