import React, { useEffect, useState } from 'react'
import { db } from '../firebase'
import { collection, addDoc, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore'
import janData from '../data/mufti_bettiah_january_normalized.json'

export default function AdminSeed(){
  const [stores,setStores]=useState([])
  const [storeId,setStoreId]=useState('')
  const [msg,setMsg]=useState('')
  const [busy,setBusy]=useState(false)

  useEffect(()=>{ (async()=>{
    const snap=await getDocs(collection(db,'stores'))
    setStores(snap.docs.map(d=>({id:d.id,...d.data()})))
  })() },[])

  const selected = stores.find(s=>s.id===storeId)

  const seed = async ()=>{
    if(!storeId) { setMsg('Select a store'); return; }
    setBusy(true); let inserted=0, skipped=0
    try{
      for(const r of janData){
        const id = `${storeId}_${r.date}`;
        const ref = doc(db,'rokar', id)
        const ex = await getDoc(ref)
        if(ex.exists()){ skipped++; continue; }
        await setDoc(ref, { ...r, storeId, storeName: selected?.name||'', brand:selected?.brand||'', city:selected?.city||'', createdAt: new Date() })
        inserted++
      }
      setMsg(`✅ Seeded ${inserted} • Skipped ${skipped}`)
    }catch(e){ console.error(e); setMsg('❌ Failed: '+(e.code||e.message)) } finally{ setBusy(false) }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">Admin → Seed January Data</h2>
      <div className="card card-pad mb-4 grid md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm mb-1">Store</label>
          <select value={storeId} onChange={e=>setStoreId(e.target.value)} className="w-full p-2 border rounded">
            <option value="">Select store…</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.brand} — {s.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2 flex items-end">
          <button disabled={busy} onClick={seed} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-60">{busy? 'Seeding…' : 'Seed January'}</button>
        </div>
      </div>
      {msg && <p>{msg}</p>}
      <p className="text-sm text-slate-500">Uses the bundled <code>src/data/mufti_bettiah_january_normalized.json</code>.</p>
    </div>
  )
}