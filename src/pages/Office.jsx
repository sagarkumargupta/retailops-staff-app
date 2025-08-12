import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const clean = (v) => Number(v || 0) || 0;
const ymdDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };

export default function Office() {
  const [stores, setStores] = useState([]);
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState(ymdDaysAgo(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0,10));
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => {
    const ss = await getDocs(collection(db, 'stores'));
    setStores(ss.docs.map(d => ({ id: d.id, ...d.data() })));
  })() }, []);

  const storeIdToName = useMemo(() => Object.fromEntries(stores.map(s => [s.id, `${s.brand || ''} — ${s.name || ''}`])), [stores]);

  const fetchAll = async () => {
    setBusy(true); const all = [];
    try {
      for (const s of stores) {
        const q1 = query(
          collection(db, 'rokar'),
          where('storeId', '==', s.id),
          where('date', '>=', from),
          where('date', '<=', to)
        );
        const snap = await getDocs(q1);
        snap.forEach(d => all.push({ id: d.id, ...d.data() }));
      }
      all.sort((a,b)=> a.date < b.date ? 1 : -1);
      setRows(all);
    } finally { setBusy(false); }
  };

  useEffect(() => { if (stores.length) fetchAll(); }, [stores.length]);

  const totals = useMemo(() => {
    const t = { sale:0, wallets:0, bank:0, home:0, expense:0, staff:0, cashOut:0 };
    for (const r of rows) {
      const p = r.payments || {};
      t.sale += clean(r.totalSale);
      t.wallets += clean(p.paytm)+clean(p.phonepe)+clean(p.gpay);
      t.bank += clean(p.bankDeposit);
      t.home += clean(p.home);
      t.expense += clean(r.expenseTotal);
      t.staff += clean(r.staffSalaryTotal);
      t.cashOut += clean(r.totalCashOut);
    }
    return t;
  }, [rows]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Office — All Stores Overview</h2>
        <Link to="/reports" className="px-3 py-1.5 rounded bg-slate-900 text-white">Open Detailed Reports</Link>
      </div>

      <div className="bg-white rounded shadow p-4 mb-6 grid md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm mb-1">From</label>
          <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm mb-1">To</label>
          <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="w-full p-2 border rounded" />
        </div>
        <div className="md:col-span-2 flex items-end">
          <button disabled={busy} onClick={fetchAll} className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-60">{busy?'Loading…':'Refresh'}</button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="card card-pad"><div className="text-slate-500">Total Sale</div><div className="text-2xl font-bold">₹ {totals.sale.toLocaleString()}</div></div>
        <div className="card card-pad"><div className="text-slate-500">Wallets + Bank + Home</div><div className="text-2xl font-bold">₹ {(totals.wallets+totals.bank+totals.home).toLocaleString()}</div></div>
        <div className="card card-pad"><div className="text-slate-500">Expenses + Staff</div><div className="text-2xl font-bold">₹ {(totals.expense+totals.staff).toLocaleString()}</div></div>
        <div className="card card-pad"><div className="text-slate-500">Cash Out</div><div className="text-2xl font-bold">₹ {totals.cashOut.toLocaleString()}</div></div>
      </div>

      {!!rows.length && (
        <div className="bg-white rounded shadow overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Store</th>
                <th className="p-2 text-left">Sale</th>
                <th className="p-2 text-left">Wallets</th>
                <th className="p-2 text-left">Bank</th>
                <th className="p-2 text-left">Home</th>
                <th className="p-2 text-left">Expense</th>
                <th className="p-2 text-left">Staff</th>
                <th className="p-2 text-left">Cash Out</th>
                <th className="p-2 text-left">Closing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const p = r.payments || {}; const wallets = clean(p.paytm)+clean(p.phonepe)+clean(p.gpay);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.date}</td>
                    <td className="p-2">{storeIdToName[r.storeId] || r.storeId}</td>
                    <td className="p-2">{clean(r.totalSale)}</td>
                    <td className="p-2">{wallets}</td>
                    <td className="p-2">{clean(p.bankDeposit)}</td>
                    <td className="p-2">{clean(p.home)}</td>
                    <td className="p-2">{clean(r.expenseTotal)}</td>
                    <td className="p-2">{clean(r.staffSalaryTotal)}</td>
                    <td className="p-2">{clean(r.totalCashOut)}</td>
                    <td className="p-2">{clean(r.closingBalance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


