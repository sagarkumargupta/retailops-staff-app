import React, { useEffect, useMemo, useState } from 'react';
import { auth, db, storage } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const ymdToday = () => new Date().toISOString().slice(0,10);

// compress image to ~1200px max width, jpeg ~0.7
async function compressImage(file, quality = 0.7, maxWidth = 1200) {
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  await new Promise((res) => { img.onload = res; });
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  URL.revokeObjectURL(img.src);
  return new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
}

export default function SelfAttendance() {
  const [user] = useAuthState(auth);
  const [store, setStore] = useState(null);
  const [staff, setStaff] = useState(null);
  const [date, setDate] = useState(ymdToday());
  const [present, setPresent] = useState(true);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [ySale, setYSale] = useState('');
  const [tTarget, setTTarget] = useState('');
  const [uniform, setUniform] = useState('YES');
  const [inShoe, setInShoe] = useState('YES');
  const [photo, setPhoto] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // match staff by email
  useEffect(()=>{ (async()=>{
    if(!user?.email) return;
    // find staff doc with matching email
    const ss = await getDocs(collection(db,'stores'));
    const stores = ss.docs.map(d=>({id:d.id, ...d.data()}));
    for(const s of stores){
      const q1 = query(collection(db,'stores', s.id, 'staff'), where('email','==', user.email.toLowerCase()));
      const snap = await getDocs(q1);
      if(!snap.empty){
        setStore(s);
        const st = snap.docs[0];
        setStaff({ id: st.id, ...st.data(), storeId: s.id });
        break;
      }
    }
  })() }, [user?.email]);

  const submit = async (e) => {
    e.preventDefault(); setMsg('');
    if(!user) { setMsg('Login required'); return; }
    if(!staff?.id || !store?.id) { setMsg('Your staff profile is not linked. Ask manager to add your email.'); return; }
    setBusy(true);
    try{
      let photoUrl = '';
      if(photo){
        const compressed = await compressImage(photo);
        const r = ref(storage, `attendance/${store.id}/${staff.id}/${date}.jpg`);
        await uploadBytes(r, compressed, { contentType: compressed.type });
        photoUrl = await getDownloadURL(r);
      }
      const id = `${store.id}_${date}_${staff.id}`;
      await setDoc(doc(db,'attendance', id), {
        storeId: store.id,
        date,
        staffId: staff.id,
        staffName: staff.name || '',
        staffEmail: user.email.toLowerCase(),
        present,
        checkIn,
        checkOut,
        answers: {
          yesterdaySale: Number(YSale||0) || 0,
          todayTarget: Number(tTarget||0) || 0,
          uniform,
          inShoe,
        },
        photoUrl,
        submittedAt: new Date(),
      }, { merge: true });
      setMsg('✅ Submitted');
    }catch(e){ setMsg('❌ Failed: ' + (e.code||e.message)); }
    finally{ setBusy(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">My Attendance</h2>
      {!user && <p>Please login first.</p>}
      {user && !staff && <p className="text-sm">We could not find your staff profile by email. Ask your manager to add your email in Staff list.</p>}
      {user && staff && (
        <form onSubmit={submit} className="bg-white rounded shadow p-4 grid gap-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Date</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">Present</label>
              <input type="checkbox" checked={present} onChange={e=>setPresent(e.target.checked)} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Check-in</label>
              <input type="time" value={checkIn} onChange={e=>setCheckIn(e.target.value)} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">Check-out</label>
              <input type="time" value={checkOut} onChange={e=>setCheckOut(e.target.value)} className="w-full p-2 border rounded" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Yesterday Sale (₹)</label>
              <input value={YSale} onChange={e=>setYSale(e.target.value)} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">Today Target (₹)</label>
              <input value={tTarget} onChange={e=>setTTarget(e.target.value)} className="w-full p-2 border rounded" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Uniform</label>
              <select value={uniform} onChange={e=>setUniform(e.target.value)} className="w-full p-2 border rounded">
                <option>YES</option>
                <option>NO</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">In Shoes</label>
              <select value={inShoe} onChange={e=>setInShoe(e.target.value)} className="w-full p-2 border rounded">
                <option>YES</option>
                <option>NO</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Photo (compressed automatically)</label>
            <input type="file" accept="image/*" capture="environment" onChange={e=>setPhoto(e.target.files[0])} />
          </div>

          <div className="flex gap-2 items-center">
            <button disabled={busy} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60">{busy?'Submitting…':'Submit'}</button>
            {msg && <div className="text-sm">{msg}</div>}
          </div>
        </form>
      )}
    </div>
  );
}


