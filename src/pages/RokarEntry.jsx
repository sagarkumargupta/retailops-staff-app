import React, { useEffect, useMemo, useState } from 'react';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import useUserProfile from '../hooks/useUserProfile';
import { collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';

const EXPENSE_KEYS = ['WATER','TEA','DISCOUNT','ALTERATION','STAFF LUNCH','GENERATOR','SHOP RENT','ELECTRICITY','HOME EXPENSE','PETROL','SUNDAY','CASH RETURN','TRANSPORT','Other Exp.   (if any)'];

const clean = v => Number(v||0) || 0;
const prevDate = (ymd) => {
  const d = new Date(ymd); d.setDate(d.getDate()-1);
  return d.toISOString().slice(0,10);
}
const closingFrom = (r) => {
  const sale = clean(r.totalSale);
  const duesIn = clean(r.customerDuesPaid);
  const pay = r.payments||{};
  const wallets = clean(pay.paytm)+clean(pay.phonepe)+clean(pay.gpay);
  const bank = clean(pay.bankDeposit);
  const home = clean(pay.home);
  const out = clean(r.duesGiven)+clean(r.totalCashOut)+clean(r.expenseTotal)+clean(r.staffSalaryTotal);
  return clean(r.openingBalance) + sale + duesIn - wallets - bank - home - out;
};

export default function RokarEntry(){
  const [user] = useAuthState(auth);
  const { profile } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));

  const [form, setForm] = useState({
    openingBalance: '',
    computerSale: '', manualSale: '', manualBilled: '',
    totalSale: '',
    customerDuesPaid: '',
    payments: { paytm:'', phonepe:'', gpay:'', bankDeposit:'', home:'' },
    duesGiven: '', totalCashOut: '',
    expenseBreakup: Object.fromEntries(EXPENSE_KEYS.map(k=>[k, ''])),
    expenseTotal: '',
    staffSalaryTotal: ''
  });
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(()=>{ (async()=>{
    const snap = await getDocs(collection(db,'stores'));
    let list = snap.docs.map(d=>({id:d.id, ...d.data()}));
    if(profile?.role==='MANAGER' && Array.isArray(profile.stores) && profile.stores.length){
      list = list.filter(s => profile.stores.includes(s.id));
    }
    setStores(list);
    if(!storeId && list.length) setStoreId(list[0].id);
  })() }, [profile?.role, profile?.stores?.length]);

  // auto-fill opening from yesterday's closing
  useEffect(()=>{ (async()=>{
    if(!storeId || !date) return;
    const y = prevDate(date);
    const ref = doc(db,'rokar', `${storeId}_${y}`);
    const snap = await getDoc(ref);
    if(snap.exists()){
      const v = snap.data().closingBalance || 0;
      setForm(f => ({...f, openingBalance: v}));
    }
  })() }, [storeId, date]);

  const onChange = e => {
    const { name, value } = e.target;
    if(name.startsWith('pay_')){
      const key = name.split('pay_')[1];
      setForm(f => ({...f, payments: { ...f.payments, [key]: value }}));
    } else if (name.startsWith('exp_')){
      const key = name.split('exp_')[1];
      setForm(f => ({...f, expenseBreakup: { ...f.expenseBreakup, [key]: value }}));
    } else {
      setForm(f => ({...f, [name]: value}));
    }
  };

  const sumExpenses = () => Object.values(form.expenseBreakup||{}).reduce((a,b)=> a + (Number(b||0)||0), 0);

  const submit = async (e) => {
    e.preventDefault(); setMsg('');
    if(!storeId) { setMsg('Select store'); return; }
    setBusy(true);
    try{
      const docId = `${storeId}_${date}`;
      const ref = doc(db,'rokar', docId);
      const exists = await getDoc(ref);
      if(exists.exists() && profile?.role!=='ADMIN'){ setMsg('Entry exists. Ask ADMIN to edit.'); setBusy(false); return; }

      const payments = {
        paytm: clean(form.payments.paytm), phonepe: clean(form.payments.phonepe), gpay: clean(form.payments.gpay),
        bankDeposit: clean(form.payments.bankDeposit), home: clean(form.payments.home)
      };
      const payload = {
        storeId, date,
        openingBalance: clean(form.openingBalance),
        computerSale: clean(form.computerSale), manualSale: clean(form.manualSale), manualBilled: clean(form.manualBilled),
        totalSale: clean(form.totalSale),
        customerDuesPaid: clean(form.customerDuesPaid),
        payments,
        duesGiven: clean(form.duesGiven),
        totalCashOut: clean(form.totalCashOut),
        expenseBreakup: Object.fromEntries(Object.entries(form.expenseBreakup).map(([k,v])=>[k, clean(v)])),
        expenseTotal: clean(form.expenseTotal) || sumExpenses(),
        staffSalaryTotal: clean(form.staffSalaryTotal),
        createdBy: user?.uid || null,
        updatedAt: new Date()
      };
      payload.closingBalance = closingFrom(payload);
      await setDoc(ref, payload, { merge: false });
      setMsg('✅ Saved');
    }catch(e){
      console.error(e); setMsg('❌ Failed: ' + (e.code || e.message));
    }finally{ setBusy(false); }
  };

  const selectedStore = useMemo(()=> stores.find(s=>s.id===storeId), [stores, storeId]);

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Daily Rokar Entry</h2>
      <form onSubmit={submit} className="bg-white rounded shadow p-4 grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm mb-1">Store</label>
          <select value={storeId} onChange={e=>setStoreId(e.target.value)} className="w-full p-2 border rounded">
            {stores.map(s=>(<option key={s.id} value={s.id}>{s.brand} — {s.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2 border rounded"/>
        </div>
        <div>
          <label className="block text-sm mb-1">Opening Balance</label>
          <input name="openingBalance" value={form.openingBalance} onChange={onChange} className="w-full p-2 border rounded" />
          <p className="text-xs text-slate-500 mt-1">Auto-fills from yesterday closing (if present).</p>
        </div>

        <div className="md:col-span-3 grid md:grid-cols-4 gap-3">
          <input name="computerSale" placeholder="COMPUTER Sale" value={form.computerSale} onChange={onChange} className="p-2 border rounded"/>
          <input name="manualSale" placeholder="MANUAL SALE" value={form.manualSale} onChange={onChange} className="p-2 border rounded"/>
          <input name="manualBilled" placeholder="MANUAL BILLED" value={form.manualBilled} onChange={onChange} className="p-2 border rounded"/>
          <input name="totalSale" placeholder="TOTAL SALE" value={form.totalSale} onChange={onChange} className="p-2 border rounded"/>
          <input name="customerDuesPaid" placeholder="CUSTOMER DUES PAID" value={form.customerDuesPaid} onChange={onChange} className="p-2 border rounded"/>
          <input name="pay_bank" placeholder="BANK DEPOSIT" value={form.payments.bankDeposit} onChange={(e)=>onChange({target:{name:'pay_bankDeposit', value:e.target.value}})} className="p-2 border rounded" style={{display:'none'}}/>
        </div>

        <div className="md:col-span-3">
          <h3 className="font-semibold mb-2">Payments (cash-outs from drawer)</h3>
          <div className="grid md:grid-cols-5 gap-3">
            <input name="pay_paytm" placeholder="PAYTM SALE" value={form.payments.paytm} onChange={onChange} className="p-2 border rounded"/>
            <input name="pay_phonepe" placeholder="PHONEPE" value={form.payments.phonepe} onChange={onChange} className="p-2 border rounded"/>
            <input name="pay_gpay" placeholder="GPAY" value={form.payments.gpay} onChange={onChange} className="p-2 border rounded"/>
            <input name="pay_bankDeposit" placeholder="BANK DEPOSIT" value={form.payments.bankDeposit} onChange={onChange} className="p-2 border rounded"/>
            <input name="pay_home" placeholder="HOME" value={form.payments.home} onChange={onChange} className="p-2 border rounded"/>
          </div>
        </div>

        <input name="duesGiven" placeholder="DUES GIVEN" value={form.duesGiven} onChange={onChange} className="p-2 border rounded"/>
        <input name="totalCashOut" placeholder="Total cash out" value={form.totalCashOut} onChange={onChange} className="p-2 border rounded"/>
        <input name="staffSalaryTotal" placeholder="STAFF (total salary)" value={form.staffSalaryTotal} onChange={onChange} className="p-2 border rounded"/>

        <div className="md:col-span-3">
          <h3 className="font-semibold mb-2">Expense Breakup</h3>
          <div className="grid md:grid-cols-4 gap-3">
            {EXPENSE_KEYS.map(k=>(
              <input key={k} name={`exp_${k}`} placeholder={k} value={form.expenseBreakup[k]} onChange={onChange} className="p-2 border rounded"/>
            ))}
          </div>
          <div className="mt-3 grid md:grid-cols-3 gap-3">
            <input name="expenseTotal" placeholder="TOTAL EXPENSE" value={form.expenseTotal} onChange={onChange} className="p-2 border rounded"/>
            <button disabled={busy} className="bg-indigo-600 text-white px-4 py-2 rounded">{busy? 'Saving…':'Save Rokar'}</button>
            {msg && <div className="self-center text-sm">{msg}</div>}
          </div>
        </div>
      </form>
    </div>
  )
}