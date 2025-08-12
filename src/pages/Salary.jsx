import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import useUserProfile from '../hooks/useUserProfile';

const ymd = (d) => d.toISOString().slice(0,10);
const monthStart = (iso) => { const d = new Date(iso+'T00:00:00'); d.setDate(1); return ymd(d); };
const monthEnd = (iso) => { const d = new Date(iso+'T00:00:00'); d.setMonth(d.getMonth()+1); d.setDate(0); return ymd(d); };
const clean = (v) => Number(v||0) || 0;

export default function Salary(){
  const { profile } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7)); // yyyy-mm
  const [staff, setStaff] = useState([]);
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

  useEffect(()=>{ (async()=>{
    if(!storeId) { setStaff([]); return; }
    const snap = await getDocs(collection(db,'stores', storeId, 'staff'));
    setStaff(snap.docs.map(d=>({id:d.id, ...d.data()})));
  })() }, [storeId]);

  const compute = async () => {
    if(!storeId) return; setBusy(true);
    const from = monthStart(month+'-01'); const to = monthEnd(month+'-01');
    const attQ = query(collection(db,'attendance'), where('storeId','==',storeId), where('date','>=',from), where('date','<=',to));
    const attSnap = await getDocs(attQ); const att = attSnap.docs.map(d=>d.data());
    // load approved leave requests for this store/month
    const lrQ = query(collection(db,'leave_requests'), where('storeId','==',storeId));
    const lrSnap = await getDocs(lrQ);
    const requests = lrSnap.docs.map(d=>({id:d.id, ...d.data()}));
    const store = stores.find(s=>s.id===storeId) || {};
    const shiftStart = String(store.shiftStart||'10:00');
    const grace = Number(store.lateGraceMin||0);
    const penalty = Number(store.latePenalty||0);
    // For fines that are global/not store-level, we can apply defaults or move to staff-level fields later.
    const unapprovedFine = 200; // default fine per unapproved leave day

    const byStaff = new Map();
    for(const a of att){
      const m = byStaff.get(a.staffId) || { days:0, lates:0 };
      if(a.present) m.days++;
      if(a.checkIn){
        const late = isLate(shiftStart, a.checkIn, grace);
        if(late) m.lates++;
      }
      byStaff.set(a.staffId, m);
    }

    const out = [];
    for(const s of staff){
      const st = byStaff.get(s.id) || { days:0, lates:0 };
      const base = clean(s.salary);
      const perDay = base / 30; // simple month basis
      const leaveAllowance = clean(s.leaveDays);
      const lunch = clean(s.lunchAllowance);
      const sun = clean(s.extraSundayAllowance);

      const daysPresent = st.days;
      const assumedWorkingDays = 30; // can be parameterized
      const absences = Math.max(0, assumedWorkingDays - daysPresent);
      const excessLeaves = Math.max(0, absences - leaveAllowance);
      const leaveDeduction = excessLeaves * perDay;
      const lateDeduction = st.lates * penalty;

      // allowances: lunch for present days; extra Sunday for each Sunday present
      const sundaysPresent = countSundaysPresent(att.filter(a=>a.staffId===s.id && a.present));
      const lunchAdd = lunch * daysPresent;
      const sundayAdd = sun * sundaysPresent;

      const unapprovedCount = countUnapprovedLeaves(s.id, from, to, requests);
      const unapprovedDeduction = unapprovedCount * unapprovedFine;
      const total = Math.max(0, base - leaveDeduction - lateDeduction - unapprovedDeduction + lunchAdd + sundayAdd);
      out.push({
        staffId: s.id, name: s.name || s.id,
        base, daysPresent, absences, excessLeaves,
        lates: st.lates,
        leaveDeduction, lateDeduction, unapprovedDeduction,
        lunchAdd, sundayAdd,
        total
      });
    }
    setRows(out); setBusy(false);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Salary — Monthly</h2>
      <div className="bg-white rounded shadow p-4 mb-6 grid md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm mb-1">Store</label>
          <select value={storeId} onChange={e=>setStoreId(e.target.value)} className="w-full p-2 border rounded">
            {stores.map(s=> <option key={s.id} value={s.id}>{s.brand} — {s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Month</label>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="w-full p-2 border rounded" />
        </div>
        <div className="md:col-span-2 flex items-end">
          <button disabled={busy} onClick={compute} className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-60">{busy? 'Computing…':'Compute Salary'}</button>
        </div>
      </div>

      {!!rows.length && (
        <div className="bg-white rounded shadow overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Staff</th>
                <th className="p-2 text-left">Base</th>
                <th className="p-2 text-left">Present</th>
                <th className="p-2 text-left">Absences</th>
                <th className="p-2 text-left">Excess Leaves</th>
                <th className="p-2 text-left">Lates</th>
                <th className="p-2 text-left">Leave Deduction</th>
                <th className="p-2 text-left">Late Deduction</th>
                <th className="p-2 text-left">Lunch Add</th>
                <th className="p-2 text-left">Sunday Add</th>
                <th className="p-2 text-left">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=> (
                <tr key={r.staffId} className="border-t">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">₹ {r.base.toLocaleString()}</td>
                  <td className="p-2">{r.daysPresent}</td>
                  <td className="p-2">{r.absences}</td>
                  <td className="p-2">{r.excessLeaves}</td>
                  <td className="p-2">{r.lates}</td>
                  <td className="p-2">₹ {r.leaveDeduction.toLocaleString()}</td>
                  <td className="p-2">₹ {r.lateDeduction.toLocaleString()}</td>
                  <td className="p-2">₹ {r.lunchAdd.toLocaleString()}</td>
                  <td className="p-2">₹ {r.sundayAdd.toLocaleString()}</td>
                  <td className="p-2 font-semibold">₹ {r.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function isLate(shiftStart, checkIn, graceMin){
  // compare HH:MM strings
  const [sh, sm] = shiftStart.split(':').map(Number);
  const [ch, cm] = (checkIn||'').split(':').map(Number);
  if(isNaN(sh) || isNaN(ch)) return false;
  const sMin = sh*60 + sm;
  const cMin = ch*60 + cm;
  return cMin > (sMin + Number(graceMin||0));
}

function countSundaysPresent(att){
  let c=0;
  for(const a of att){
    const d = new Date(a.date+'T00:00:00');
    if(d.getDay()===0) c++;
  }
  return c;
}

function dateInRange(d, from, to){ return d >= from && d <= to; }
function eachDate(from, to){
  const out=[]; const s=new Date(from+'T00:00:00'); const e=new Date(to+'T00:00:00');
  for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)) out.push(ymd(d));
  return out;
}
function countUnapprovedLeaves(staffId, from, to, requests){
  // Count days between from..to that are in PENDING/REJECTED leave ranges for this staff
  const days = eachDate(from, to);
  const relevant = requests.filter(r => r.staffId===staffId && (r.status!=='APPROVED'));
  let count = 0;
  for(const d of days){
    if(relevant.some(r => dateInRange(d, r.from, r.to))) count++;
  }
  return count;
}


