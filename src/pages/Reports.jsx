import React, { useEffect, useMemo, useState } from 'react';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import useUserProfile from '../hooks/useUserProfile';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';

const clean = (v) => Number(v || 0) || 0;

function ymdDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function Reports() {
  const [user] = useAuthState(auth);
  const { profile } = useUserProfile();

  const [stores, setStores] = useState([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [from, setFrom] = useState(ymdDaysAgo(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => {
    const ss = await getDocs(collection(db, 'stores'));
    let list = ss.docs.map(d => ({ id: d.id, ...d.data() }));
    if (profile?.role === 'MANAGER' && Array.isArray(profile.stores) && profile.stores.length) {
      list = list.filter(s => profile.stores.includes(s.id));
    }
    setStores(list);
    if (!selectedStoreIds.length && list.length) setSelectedStoreIds(list.map(s => s.id));
  })() }, [profile?.role, profile?.stores?.length]);

  const storeIdToName = useMemo(() => Object.fromEntries(stores.map(s => [s.id, `${s.brand || ''} — ${s.name || ''}`])), [stores]);

  const toggleStore = (id) => {
    setSelectedStoreIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const fetchData = async () => {
    setBusy(true); setRows([]);
    try {
      const all = [];
      const allowed = (profile?.role === 'MANAGER' && Array.isArray(profile.stores) && profile.stores.length)
        ? stores.filter(s => profile.stores.includes(s.id)).map(s => s.id)
        : stores.map(s => s.id);
      const ids = (selectedStoreIds.length ? selectedStoreIds : allowed).filter(id => allowed.includes(id));
      for (const sid of ids) {
        const q1 = query(
          collection(db, 'rokar'),
          where('storeId', '==', sid),
          where('date', '>=', from),
          where('date', '<=', to)
        );
        const snap = await getDocs(q1);
        snap.forEach((d) => all.push({ id: d.id, ...d.data() }));
      }
      all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      setRows(all);
    } finally { setBusy(false); }
  };

  useEffect(() => { if (stores.length) fetchData(); }, [stores.length]);

  const totals = useMemo(() => {
    const t = {
      sale: 0, duesIn: 0, wallets: 0, bank: 0, home: 0,
      expense: 0, staff: 0, cashOut: 0
    };
    for (const r of rows) {
      t.sale += clean(r.totalSale);
      t.duesIn += clean(r.customerDuesPaid);
      const p = r.payments || {};
      t.wallets += clean(p.paytm) + clean(p.phonepe) + clean(p.gpay);
      t.bank += clean(p.bankDeposit);
      t.home += clean(p.home);
      t.expense += clean(r.expenseTotal);
      t.staff += clean(r.staffSalaryTotal);
      t.cashOut += clean(r.totalCashOut);
    }
    return t;
  }, [rows]);

  const chartDaily = useMemo(() => {
    const byDate = new Map();
    for (const r of rows) {
      const prev = byDate.get(r.date) || { date: r.date, sale: 0, expense: 0 };
      prev.sale += clean(r.totalSale);
      prev.expense += clean(r.expenseTotal) + clean(r.staffSalaryTotal);
      byDate.set(r.date, prev);
    }
    return Array.from(byDate.values());
  }, [rows]);

  const exportCSV = () => {
    if (!rows.length) return;
    const headers = ['date','store','totalSale','duesPaid','wallets','bankDeposit','home','expenseTotal','staffSalaryTotal','totalCashOut','closingBalance'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      const p = r.payments || {};
      const wallets = clean(p.paytm) + clean(p.phonepe) + clean(p.gpay);
      const vals = [
        r.date,
        JSON.stringify(storeIdToName[r.storeId] || r.storeId),
        clean(r.totalSale),
        clean(r.customerDuesPaid),
        wallets,
        clean(p.bankDeposit),
        clean(p.home),
        clean(r.expenseTotal),
        clean(r.staffSalaryTotal),
        clean(r.totalCashOut),
        clean(r.closingBalance),
      ];
      lines.push(vals.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reports_${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Reports</h2>

      <div className="bg-white rounded shadow p-4 mb-6 grid md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm mb-1">From</label>
          <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm mb-1">To</label>
          <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="w-full p-2 border rounded" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Stores</label>
          <div className="grid md:grid-cols-2 gap-2 max-h-28 overflow-auto p-2 border rounded">
            {stores.map(s => (
              <label key={s.id} className="flex items-center gap-2">
                <input type="checkbox" checked={selectedStoreIds.includes(s.id)} onChange={()=>toggleStore(s.id)} />
                <span>{s.brand} — {s.name}</span>
              </label>
            ))}
            {stores.length===0 && <div className="text-sm text-gray-500">No stores available</div>}
          </div>
        </div>
        <div className="md:col-span-4 flex gap-2">
          <button disabled={busy} onClick={fetchData} className="bg-slate-900 text-white px-4 py-2 rounded disabled:opacity-60">{busy? 'Loading…':'Apply Filters'}</button>
          <button disabled={!rows.length} onClick={exportCSV} className="border px-4 py-2 rounded disabled:opacity-60">Export CSV</button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="card card-pad"><div className="text-slate-500">Total Sale</div><div className="text-2xl font-bold">₹ {totals.sale.toLocaleString()}</div></div>
        <div className="card card-pad"><div className="text-slate-500">Wallets + Bank + Home</div><div className="text-2xl font-bold">₹ {(totals.wallets + totals.bank + totals.home).toLocaleString()}</div></div>
        <div className="card card-pad"><div className="text-slate-500">Expenses + Staff</div><div className="text-2xl font-bold">₹ {(totals.expense + totals.staff).toLocaleString()}</div></div>
        <div className="card card-pad"><div className="text-slate-500">Cash Out</div><div className="text-2xl font-bold">₹ {totals.cashOut.toLocaleString()}</div></div>
      </div>

      <div className="card card-pad mb-6">
        <h3 className="font-semibold mb-3">Daily Trends</h3>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={chartDaily} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sale" stroke="#2563eb" name="Sale" />
              <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Expense+Staff" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {!!rows.length && (
        <div className="bg-white rounded shadow overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Store</th>
                <th className="p-2 text-left">Total Sale</th>
                <th className="p-2 text-left">Dues Paid</th>
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
              {rows.map((r) => {
                const p = r.payments || {};
                const wallets = clean(p.paytm) + clean(p.phonepe) + clean(p.gpay);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.date}</td>
                    <td className="p-2">{storeIdToName[r.storeId] || r.storeId}</td>
                    <td className="p-2">{clean(r.totalSale)}</td>
                    <td className="p-2">{clean(r.customerDuesPaid)}</td>
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


