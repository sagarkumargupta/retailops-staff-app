import React, { useEffect, useMemo, useState } from 'react'
import { db } from '../firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import useUserProfile from '../hooks/useUserProfile'

export default function Dashboard(){
  const { profile } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [today, setToday] = useState(new Date().toISOString().slice(0,10));
  const [counts, setCounts] = useState({ totalStaff: 0, presentToday: 0 });

  useEffect(()=>{ (async()=>{
    const ss = await getDocs(collection(db,'stores'));
    let list = ss.docs.map(d=>({id:d.id, ...d.data()}));
    if(profile?.role==='MANAGER' && Array.isArray(profile.stores) && profile.stores.length){
      list = list.filter(s => profile.stores.includes(s.id));
    }
    setStores(list);
  })() }, [profile?.role, profile?.stores?.length]);

  useEffect(()=>{ (async()=>{
    if(!stores.length) { setCounts({ totalStaff: 0, presentToday: 0 }); return; }
    let totalStaff = 0; let present = 0;
    for(const s of stores){
      const staffSnap = await getDocs(collection(db,'stores', s.id, 'staff'));
      totalStaff += staffSnap.size;
      const attQ = query(collection(db,'attendance'), where('storeId','==', s.id), where('date','==', today));
      const attSnap = await getDocs(attQ);
      present += attSnap.docs.map(d=>d.data()).filter(a => a.present).length;
    }
    setCounts({ totalStaff, presentToday: present });
  })() }, [stores, today]);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="card card-pad"><div className="text-slate-500">Total Employees</div><div className="text-2xl font-bold">{counts.totalStaff}</div></div>
      <div className="card card-pad"><div className="text-slate-500">Present Today</div><div className="text-2xl font-bold">{counts.presentToday}</div></div>
      <div className="card card-pad"><div className="text-slate-500">Role</div><div className="text-2xl font-bold">{profile?.role||'-'}</div></div>
      <div className="card card-pad md:col-span-3">Use the navigation to manage stores, staff, attendance, reports, salary and more.</div>
    </div>
  )
}