import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, setDoc, writeBatch } from 'firebase/firestore';
import useUserProfile from '../hooks/useUserProfile';

const ymdToday = () => new Date().toISOString().slice(0,10);
const getCurrentTime = () => new Date().toTimeString().slice(0,5); // HH:MM format

export default function Attendance(){
  const { profile, getStoresForFiltering, canAccessAllStores } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [date, setDate] = useState(ymdToday());
  const [staff, setStaff] = useState([]);
  const [attMap, setAttMap] = useState({}); // staffId -> { present, checkIn, dayType, dayFraction }
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [timeModificationReason, setTimeModificationReason] = useState(''); // For admin time modifications

  // Check if user can edit attendance times (ADMIN/OWNER/SUPER_ADMIN only)
  const canEditTimes = useMemo(() => {
    return profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN' || profile?.role === 'OWNER';
  }, [profile?.role]);

  // Load stores filtered for MANAGER
  useEffect(()=>{ (async()=>{
    const ss = await getDocs(collection(db,'stores'));
    let list = ss.docs.map(d=>({id:d.id, ...d.data()}));
    
    // Use new consistent access control pattern
    const userStores = getStoresForFiltering();
    if (userStores.length > 0) {
      list = list.filter(s => userStores.includes(s.id));
    }
    
    setStores(list);
    if(!storeId && list.length) setStoreId(list[0].id);
  })() }, [profile?.role, profile?.assignedStore]);

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
      dayType: v.dayType || (v.present ? 'FULL' : 'FULL'),
      dayFraction: typeof v.dayFraction === 'number' ? v.dayFraction : (v.present ? 1 : 0)
    }; });
    setAttMap(map);
  })() }, [storeId, date]);

  const onToggle = (sid) => {
    const currentTime = getCurrentTime();
    setAttMap(m => {
      const was = m[sid] || {};
      const nextPresent = !was.present;
      const nextDayType = was.dayType || 'FULL';
      const nextDayFraction = nextPresent ? (nextDayType === 'HALF' ? 0.5 : 1) : 0;
      return {
        ...m,
        [sid]: {
          present: nextPresent,
          checkIn: nextPresent ? currentTime : '', // Always use current time for present staff
          dayType: nextDayType,
          dayFraction: nextDayFraction
        }
      };
    });
  };

  const onDayType = (sid, value) => {
    setAttMap(m => {
      const was = m[sid] || {};
      const fraction = value === 'HALF' ? 0.5 : 1;
      return {
        ...m,
        [sid]: {
          present: !!was.present,
          checkIn: was.checkIn || '',
          dayType: value,
          dayFraction: !!was.present ? fraction : 0
        }
      };
    });
  };

  // Allow admin users to modify check-in times for genuine late reasons
  const onTime = (sid, value) => {
    if (!canEditTimes) return; // Only admins can modify times
    
    setAttMap(m => ({ 
      ...m, 
      [sid]: { 
        ...m[sid],
        present: !!m[sid]?.present, 
        checkIn: value,
        dayType: m[sid]?.dayType || 'FULL',
        dayFraction: m[sid]?.dayFraction || (!!m[sid]?.present ? 1 : 0)
      } 
    }));
  };

  const markAll = (state) => {
    const currentTime = getCurrentTime();
    const next = {};
    for(const s of staff){ 
      next[s.id] = { 
        present: !!state, 
        checkIn: state ? currentTime : '', // Always use current time for present staff
        dayType: 'FULL',
        dayFraction: state ? 1 : 0
      }; 
    }
    setAttMap(next);
  };

  const save = async () => {
    if(!storeId || !date) return;
    setBusy(true); 
    setMsg('');
    try{
      const batch = writeBatch(db);
      for(const s of staff){
        const v = attMap[s.id] || { present: false, checkIn: '' };
        const id = `${storeId}_${date}_${s.id}`;
        const ref = doc(db,'attendance', id);
        
        // Determine check-in time based on user role
        let checkInTime;
        if (canEditTimes) {
          // Admin users can use modified times for genuine late reasons
          checkInTime = v.present ? (v.checkIn || getCurrentTime()) : '';
        } else {
          // Non-admin users always use current time
          checkInTime = v.present ? getCurrentTime() : '';
        }
        
        batch.set(ref, {
          storeId, 
          date,
          staffId: s.id,
          staffName: s.name || '',
          present: !!v.present,
          checkIn: checkInTime,
          dayType: v.dayType || (v.present ? 'FULL' : 'FULL'),
          dayFraction: typeof v.dayFraction === 'number' ? v.dayFraction : (v.present ? 1 : 0),
          updatedAt: new Date(),
          // Track who modified the time for audit purposes
          timeModifiedBy: canEditTimes && v.checkIn ? profile?.email : null,
          timeModifiedAt: canEditTimes && v.checkIn ? new Date() : null,
          timeModificationReason: canEditTimes && v.checkIn && timeModificationReason ? timeModificationReason : null
        }, { merge: true });
      }
      await batch.commit();
      setMsg('✅ Attendance saved successfully');
    }catch(e){ 
      setMsg('❌ Failed: ' + (e.code||e.message)); 
    }
    finally{ 
      setBusy(false); 
    }
  };

  const storeLabel = useMemo(()=> stores.find(s=>s.id===storeId)?.name || '', [stores, storeId]);

  return (
    <div className="max-w-7xl mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4">Staff Attendance</h2>
      
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">Attendance System</h3>
        <p className="text-blue-700 text-sm">
          • Check-in time is automatically set to current system time when marking present<br/>
          {canEditTimes ? (
            <>
              • <strong>Admin Access:</strong> You can modify check-in times for genuine late reasons<br/>
              • <strong>Time Modifications:</strong> All time changes are logged for audit purposes<br/>
            </>
          ) : (
            <>
              • Check-in time cannot be manually changed (auto-set for accuracy)<br/>
            </>
          )}
          • Check-out time is not required for attendance tracking
        </p>
      </div>

      <div className="bg-white rounded shadow p-4 mb-6 grid md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Store</label>
          <select value={storeId} onChange={e=>setStoreId(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            {stores.map(s => <option key={s.id} value={s.id}>{s.brand} — {s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"/>
        </div>
        <div className="md:col-span-2 flex items-end gap-2">
          <button onClick={()=>markAll(true)} className="px-4 py-2 rounded border hover:bg-gray-50 transition-colors">
            Mark All Present
          </button>
          <button onClick={()=>markAll(false)} className="px-4 py-2 rounded border hover:bg-gray-50 transition-colors">
            Mark All Absent
          </button>
          <button disabled={busy} onClick={save} className="px-6 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            {busy ? 'Saving…' : 'Save Attendance'}
          </button>
        </div>
      </div>

      {/* Admin Time Modification Reason Section */}
      {canEditTimes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Admin Time Modification</h4>
          <p className="text-yellow-700 text-sm mb-3">
            You have permission to modify check-in times for genuine late reasons. Please provide a reason for any time modifications.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={timeModificationReason}
              onChange={(e) => setTimeModificationReason(e.target.value)}
              placeholder="e.g., Traffic delay, Medical emergency, etc."
              className="flex-1 p-2 border rounded focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
            <button
              onClick={() => setTimeModificationReason('')}
              className="px-3 py-2 text-sm border border-yellow-300 rounded hover:bg-yellow-100 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          msg.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {msg}
        </div>
      )}

      <div className="bg-white rounded shadow overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Name</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in Time</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day Type</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {staff.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-gray-500">
                  No staff found in {storeLabel || 'selected store'}
                </td>
              </tr>
            )}
            {staff.map(s => {
              const v = attMap[s.id] || { present: false, checkIn: '' };
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="p-3 text-sm text-gray-900">{s.name || s.id}</td>
                  <td className="p-3">
                    <input 
                      type="checkbox" 
                      checked={!!v.present} 
                      onChange={() => onToggle(s.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="p-3">
                    <input 
                      type="time" 
                      value={v.checkIn} 
                      readOnly={!canEditTimes}
                      disabled={!canEditTimes}
                      onChange={e => onTime(s.id, e.target.value)}
                      className={`p-2 border rounded ${canEditTimes ? 'bg-white cursor-pointer' : 'bg-gray-50 cursor-not-allowed'}`}
                    />
                  </td>
                  <td className="p-3">
                    <select 
                      value={v.dayType || 'FULL'} 
                      onChange={e => onDayType(s.id, e.target.value)}
                      disabled={!v.present}
                      className={`p-2 border rounded ${!v.present ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="FULL">Full Day</option>
                      <option value="HALF">Half Day</option>
                    </select>
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




