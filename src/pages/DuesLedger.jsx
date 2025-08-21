import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function DuesLedger() {
  const { profile } = useUserProfile();
  const location = useLocation();
  const state = location.state || {};
  const [storeId, setStoreId] = useState(state.storeId || '');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rokarDocs, setRokarDocs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { loadStores(); }, [profile?.email]);
  useEffect(() => { if (storeId) loadRokar(storeId); }, [storeId]);

  const loadStores = async () => {
    const snap = await getDocs(collection(db, 'stores'));
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (profile?.role === 'MANAGER' && profile.stores && typeof profile.stores === 'object') {
      const allowed = Object.keys(profile.stores).filter(k => profile.stores[k] === true);
      list = list.filter(s => allowed.includes(s.id));
    }
    setStores(list);
    if (!storeId && profile?.role === 'MANAGER' && list.length) {
      setStoreId(list[0].id);
    } else if ((profile?.role === 'ADMIN' || profile?.role === 'OFFICE') && list.length) {
      setStoreId('__ALL__');
    }
  };

  const loadRokar = async (id) => {
    setLoading(true);
    try {
      let qRef;
      if (id === '__ALL__') {
        qRef = query(collection(db, 'rokar'), orderBy('date', 'asc'));
      } else {
        qRef = query(collection(db, 'rokar'), where('storeId', '==', id), orderBy('date', 'asc'));
      }
      const snap = await getDocs(qRef);
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRokarDocs(rows);
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    const list = [];
    for (const r of rokarDocs) {
      const date = r.date;
      (Array.isArray(r.duesGivenDetails) ? r.duesGivenDetails : []).forEach(d => {
        list.push({ type: 'GIVEN', date, name: d.name, mobile: d.mobile, amount: Number(d.amount||0), approval: d.approvalPerson, dueDate: d.dueDate });
      });
      (Array.isArray(r.duesPaidDetails) ? r.duesPaidDetails : []).forEach(p => {
        list.push({ type: 'PAID', date, name: p.name, mobile: p.mobile, amount: Number(p.amount||0), approval: p.approvalPerson, paymentDate: p.paymentDate });
      });
    }
    return list.sort((a,b)=>a.date.localeCompare(b.date));
  }, [rokarDocs]);

  const totals = useMemo(() => {
    let given = 0, paid = 0;
    rows.forEach(r => { if (r.type==='GIVEN') given += r.amount; else paid += r.amount; });
    return { given, paid, outstanding: given - paid };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(r => 
      r.name.toLowerCase().includes(term) || 
      (r.mobile && r.mobile.includes(term))
    );
  }, [rows, searchTerm]);

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Customer', 'Mobile', 'Amount', 'Approval', 'Due/Pay Date'];
    const csvContent = [
      headers.join(','),
      ...filteredRows.map(r => [
        r.date,
        r.type,
        `"${r.name}"`,
        r.mobile || '',
        r.amount,
        r.approval || '',
        r.type === 'GIVEN' ? (r.dueDate || '') : (r.paymentDate || '')
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dues_ledger_${storeId}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (n) => `₹${Number(n||0).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dues Ledger</h1>
          <p className="mt-2 text-gray-600">Complete chronological view of all dues transactions</p>
        </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="grid md:grid-cols-4 gap-6 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Store</label>
            {profile?.role === 'MANAGER' ? (
              <input value={stores[0]?.name || ''} readOnly className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50" />
            ) : (
              <select value={storeId} onChange={e=>setStoreId(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="__ALL__">All Stores</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <div className="text-sm font-medium text-orange-800">Total Given</div>
            <div className="text-2xl font-bold text-orange-900">{formatCurrency(totals.given)}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="text-sm font-medium text-green-800">Total Paid</div>
            <div className="text-2xl font-bold text-green-900">{formatCurrency(totals.paid)}</div>
          </div>
        </div>
        <div className="mt-6">
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="text-sm font-medium text-red-800">Outstanding Amount</div>
            <div className="text-2xl font-bold text-red-900">{formatCurrency(totals.outstanding)}</div>
          </div>
        </div>
         <div className="mt-6 flex flex-col md:flex-row gap-4">
           <div className="flex-1">
             <label className="block text-sm font-medium text-gray-700 mb-2">Search Transactions</label>
             <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                 </svg>
               </div>
               <input
                 type="text"
                 placeholder="Search by customer name or mobile..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
               />
             </div>
           </div>
           <div className="flex items-end">
             <button
               onClick={exportToCSV}
               className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
             >
               <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
               </svg>
               Export CSV
             </button>
           </div>
         </div>
       </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-gray-600">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading transactions...
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due/Pay Date</th>
                </tr>
              </thead>
                                               <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredRows.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{r.date}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          r.type === 'GIVEN' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{r.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{r.mobile || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900">{formatCurrency(r.amount)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{r.approval || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{r.type==='GIVEN' ? (r.dueDate || '-') : (r.paymentDate || '-')}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {searchTerm && filteredRows.length === 0 && (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions found</h3>
                  <p className="mt-1 text-sm text-gray-500">No entries match your search criteria.</p>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}


