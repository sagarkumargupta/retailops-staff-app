import React, { useEffect, useMemo, useState } from 'react';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import useUserProfile from '../hooks/useUserProfile';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
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
  const { profile, getStoresForFiltering } = useUserProfile();
  const location = useLocation();

  const [stores, setStores] = useState([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [from, setFrom] = useState(ymdDaysAgo(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [lastYearData, setLastYearData] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const ss = await getDocs(collection(db, 'stores'));
      let list = ss.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Use new consistent access control pattern
      const userStores = getStoresForFiltering();
      if (userStores.length > 0) {
        list = list.filter(s => userStores.includes(s.id));
      }
      
      setStores(list);
      if (!storeId && list.length) setStoreId(list[0].id);
    })();
  }, [profile?.role, profile?.assignedStore]);

  // Handle navigation state from Rokar entry
  useEffect(() => {
    if (location.state?.showInsights) {
      setShowInsights(true);
      if (location.state.selectedStore) {
        setSelectedStoreIds([location.state.selectedStore]);
      }
      if (location.state.selectedDate) {
        const selectedDate = new Date(location.state.selectedDate);
        const fromDate = new Date(selectedDate);
        fromDate.setDate(fromDate.getDate() - 7); // Show 7 days around the selected date
        setFrom(fromDate.toISOString().slice(0, 10));
        setTo(selectedDate.toISOString().slice(0, 10));
      }
    }
  }, [location.state]);

  const storeIdToName = useMemo(() => Object.fromEntries(stores.map(s => [s.id, `${s.brand || ''} — ${s.name || ''}`])), [stores]);

  const toggleStore = (id) => {
    setSelectedStoreIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const fetchData = async () => {
    setBusy(true); setRows([]);
    try {
      const all = [];
      const userStores = getStoresForFiltering();
      const allowed = userStores.length > 0 
        ? stores.filter(s => userStores.includes(s.id)).map(s => s.id)
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

  const loadLastYearData = async () => {
    if (!selectedStoreIds.length) return;
    
    setInsightsLoading(true);
    try {
      const lastYearFrom = new Date(from);
      lastYearFrom.setFullYear(lastYearFrom.getFullYear() - 1);
      const lastYearTo = new Date(to);
      lastYearTo.setFullYear(lastYearTo.getFullYear() - 1);
      
      const all = [];
      for (const sid of selectedStoreIds) {
        const q1 = query(
          collection(db, 'rokar'),
          where('storeId', '==', sid),
          where('date', '>=', lastYearFrom.toISOString().slice(0, 10)),
          where('date', '<=', lastYearTo.toISOString().slice(0, 10))
        );
        const snap = await getDocs(q1);
        snap.forEach((d) => all.push({ id: d.id, ...d.data() }));
      }
      all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      setLastYearData(all);
    } catch (error) {
      console.error('Error loading last year data:', error);
    } finally {
      setInsightsLoading(false);
    }
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

      {/* Insights Section */}
      {showInsights && (
        <div className="bg-white rounded shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-800">📊 Performance Insights & Year-over-Year Analysis</h3>
            <button 
              onClick={loadLastYearData}
              disabled={insightsLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {insightsLoading ? 'Loading...' : '🔄 Load Last Year Data'}
            </button>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Current Period Summary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-3">📈 Current Period ({from} to {to})</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Sales:</span>
                  <span className="font-semibold text-green-600">₹{totals.sale.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Daily Sales:</span>
                  <span className="font-semibold">₹{rows.length > 0 ? Math.round(totals.sale / rows.length).toLocaleString() : 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Expenses:</span>
                  <span className="font-semibold text-red-600">₹{(totals.expense + totals.staff).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Cash Flow:</span>
                  <span className="font-semibold">₹{(totals.sale - totals.expense - totals.staff).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Last Year Comparison */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-3">📅 Last Year Comparison</h4>
              {lastYearData.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {(() => {
                    const lastYearTotal = lastYearData.reduce((sum, r) => sum + clean(r.totalSale), 0);
                    const lastYearAvg = lastYearData.length > 0 ? Math.round(lastYearTotal / lastYearData.length) : 0;
                    const currentAvg = rows.length > 0 ? Math.round(totals.sale / rows.length) : 0;
                    const growth = lastYearAvg > 0 ? ((currentAvg - lastYearAvg) / lastYearAvg * 100) : 0;
                    
                    return (
                      <>
                        <div className="flex justify-between">
                          <span>Last Year Sales:</span>
                          <span className="font-semibold">₹{lastYearTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg Daily Sales:</span>
                          <span className="font-semibold">₹{lastYearAvg.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Growth:</span>
                          <span className={`font-semibold ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Days Compared:</span>
                          <span className="font-semibold">{Math.min(rows.length, lastYearData.length)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  Click "Load Last Year Data" to see year-over-year comparison
                </div>
              )}
            </div>

            {/* Key Insights */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-800 mb-3">💡 Key Insights</h4>
              <div className="space-y-2 text-sm">
                {(() => {
                  const insights = [];
                  const avgSale = rows.length > 0 ? totals.sale / rows.length : 0;
                  const expenseRatio = totals.sale > 0 ? ((totals.expense + totals.staff) / totals.sale * 100) : 0;
                  
                  if (avgSale > 50000) insights.push('🚀 High performing period');
                  if (expenseRatio < 30) insights.push('💰 Excellent cost control');
                  if (expenseRatio > 50) insights.push('⚠️ High expense ratio');
                  if (rows.length >= 7) insights.push('📊 Good data coverage');
                  if (totals.sale > 0 && lastYearData.length > 0) {
                    const lastYearTotal = lastYearData.reduce((sum, r) => sum + clean(r.totalSale), 0);
                    const growth = lastYearTotal > 0 ? ((totals.sale - lastYearTotal) / lastYearTotal * 100) : 0;
                    if (growth > 10) insights.push('📈 Strong growth vs last year');
                    if (growth < -10) insights.push('📉 Declining vs last year');
                  }
                  
                  return insights.length > 0 ? (
                    insights.map((insight, index) => (
                      <div key={index} className="text-gray-700">• {insight}</div>
                    ))
                  ) : (
                    <div className="text-gray-600">Load data to see insights</div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

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


