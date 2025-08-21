import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function DuesDashboard() {
  const { profile } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [loading, setLoading] = useState(true);
  const [rokarDocs, setRokarDocs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkReminders, setShowBulkReminders] = useState(false);

  useEffect(() => {
    loadStores();
  }, [profile?.email]);

  useEffect(() => {
    if (selectedStoreId) loadRokar(selectedStoreId);
  }, [selectedStoreId]);

  const loadStores = async () => {
    if (!profile) return;
    try {
      const snap = await getDocs(collection(db, 'stores'));
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (profile.role === 'MANAGER' && profile.stores && typeof profile.stores === 'object') {
        const allowed = Object.keys(profile.stores).filter(k => profile.stores[k] === true);
        list = list.filter(s => allowed.includes(s.id));
      }
      setStores(list);
      if (profile.role === 'MANAGER' && list.length) {
        setSelectedStoreId(list[0].id);
      } else if ((profile.role === 'ADMIN' || profile.role === 'OFFICE') && list.length) {
        setSelectedStoreId('__ALL__');
      }
    } catch (e) {
      console.error('Error loading stores:', e);
    }
  };

  const loadRokar = async (storeId) => {
    setLoading(true);
    try {
      let qRef;
      if (storeId === '__ALL__') {
        qRef = query(collection(db, 'rokar'), orderBy('date', 'desc'));
      } else {
        qRef = query(collection(db, 'rokar'), where('storeId', '==', storeId), orderBy('date', 'desc'));
      }
      const snap = await getDocs(qRef);
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRokarDocs(rows);
    } catch (e) {
      console.error('Error loading rokar:', e);
      setRokarDocs([]);
    } finally {
      setLoading(false);
    }
  };

  const aggregates = useMemo(() => {
    const customers = new Map(); // key: customerId, value: { customerId, name, mobile, given, paid, lastDueDate }
    let totalGiven = 0;
    let totalPaid = 0;
    for (const r of rokarDocs) {
      const given = Array.isArray(r.duesGivenDetails) ? r.duesGivenDetails : [];
      for (const d of given) {
        const key = d.customerId || (d.mobile && d.mobile.trim()) || (d.name && d.name.trim()) || 'unknown';
        const item = customers.get(key) || { 
          customerId: d.customerId, 
          name: d.name || 'Unknown', 
          mobile: d.mobile || '', 
          given: 0, 
          paid: 0, 
          lastDueDate: null 
        };
        item.given += Number(d.amount || 0);
        if (d.dueDate) item.lastDueDate = d.dueDate;
        customers.set(key, item);
        totalGiven += Number(d.amount || 0);
      }
      const paid = Array.isArray(r.duesPaidDetails) ? r.duesPaidDetails : [];
      for (const p of paid) {
        const key = p.customerId || (p.mobile && p.mobile.trim()) || (p.name && p.name.trim()) || 'unknown';
        const item = customers.get(key) || { 
          customerId: p.customerId, 
          name: p.name || 'Unknown', 
          mobile: p.mobile || '', 
          given: 0, 
          paid: 0, 
          lastDueDate: null 
        };
        item.paid += Number(p.amount || 0);
        customers.set(key, item);
        totalPaid += Number(p.amount || 0);
      }
    }
    const rows = Array.from(customers.values()).map(c => ({ ...c, outstanding: c.given - c.paid }));
    const outstandingTotal = rows.reduce((s, r) => s + r.outstanding, 0);
    const overdueCount = rows.filter(r => r.outstanding > 0 && r.lastDueDate && r.lastDueDate < new Date().toISOString().slice(0,10)).length;
    const top = rows.filter(r => r.outstanding > 0).sort((a,b)=>b.outstanding-a.outstanding).slice(0,10);
    return { totalGiven, totalPaid, outstandingTotal, overdueCount, topCustomers: top, customersCount: rows.length, allCustomers: rows };
  }, [rokarDocs]);

  const formatCurrency = (n) => {
    const num = Number(n || 0);
    return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return aggregates.allCustomers || [];
    const term = searchTerm.toLowerCase();
    return (aggregates.allCustomers || []).filter(c => 
      c.name.toLowerCase().includes(term) || 
      (c.mobile && c.mobile.includes(term))
    );
  }, [aggregates.allCustomers, searchTerm]);

  const exportToCSV = () => {
    const headers = ['Customer Name', 'Mobile', 'Total Given', 'Total Paid', 'Outstanding', 'Last Due Date'];
    const csvContent = [
      headers.join(','),
      ...filteredCustomers.map(c => [
        `"${c.name}"`,
        c.mobile || '',
        c.given,
        c.paid,
        c.outstanding,
        c.lastDueDate || ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dues_${selectedStoreId}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const sendBulkWhatsAppReminders = () => {
    const customersWithMobile = filteredCustomers.filter(c => c.outstanding > 0 && c.mobile);
    if (customersWithMobile.length === 0) {
      alert('No customers with mobile numbers and outstanding dues found.');
      return;
    }
    
    const message = `Bulk WhatsApp Reminders for ${customersWithMobile.length} customers with outstanding dues.`;
    if (confirm(message + '\n\nThis will open multiple WhatsApp windows. Continue?')) {
      customersWithMobile.forEach(c => {
        const text = `Namaste ${c.name},\nAapke upar ₹${Number(c.outstanding).toLocaleString('en-IN')} ka baki hai. Kripya jaldi se jama karein. - ${selectedStoreId}`;
        const url = `https://wa.me/91${c.mobile}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
      });
    }
  };

  const whatsappReminderUrl = (mobile, name, amount) => {
    if (!mobile) return null;
    const text = `Namaste ${name||''},\nAapke upar ₹${Number(amount).toLocaleString('en-IN')} ka baki hai. Kripya jaldi se jama karein. - ${selectedStoreId}`;
    return `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Dues Dashboard</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">Select Store</label>
            {profile?.role === 'MANAGER' ? (
              <input value={stores[0]?.name || ''} readOnly className="w-full p-2 border rounded bg-gray-50" />
            ) : (
              <select value={selectedStoreId} onChange={(e)=>setSelectedStoreId(e.target.value)} className="w-full p-2 border rounded">
                <option value="__ALL__">All Stores</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="text-sm text-gray-500">Total Customers: {aggregates.customersCount || 0}</div>
        </div>
        <div className="mt-3 flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by customer name or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Export CSV
            </button>
            <button
              onClick={() => setShowBulkReminders(true)}
              className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Bulk WhatsApp
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : !selectedStoreId ? (
        <div className="text-gray-600">Please select a store to view dues.</div>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <Card title="Total Dues Given" value={formatCurrency(aggregates.totalGiven)} color="bg-orange-100" />
            <Card title="Total Dues Received" value={formatCurrency(aggregates.totalPaid)} color="bg-green-100" />
            <Card title="Outstanding" value={formatCurrency(aggregates.outstandingTotal)} color="bg-red-100" />
            <Card title="Overdue" value={`${aggregates.overdueCount || 0}`} color="bg-yellow-100" />
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">
                {searchTerm ? 'Search Results' : 'Top Outstanding Customers'}
              </h2>
              <div className="flex gap-2">
                <Link to="/dues/ledger" state={{ storeId: selectedStoreId }} className="px-3 py-1.5 border rounded">Open Ledger</Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mobile</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {(searchTerm ? filteredCustomers : aggregates.topCustomers || []).map((c, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2">{c.mobile || '-'}</td>
                      <td className="px-3 py-2 text-right font-medium text-red-600">{formatCurrency(c.outstanding)}</td>
                                             <td className="px-3 py-2 text-right space-x-2">
                         <Link to={`/dues/customer/${encodeURIComponent(selectedStoreId)}/${encodeURIComponent(c.customerId || c.mobile || c.name)}`} className="px-2 py-1 border rounded">View</Link>
                         {c.mobile && (
                           <a href={whatsappReminderUrl(c.mobile, c.name, c.outstanding)} target="_blank" rel="noreferrer" className="px-2 py-1 bg-green-600 text-white rounded">WhatsApp</a>
                         )}
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {searchTerm && filteredCustomers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No customers found matching "{searchTerm}"
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Bulk WhatsApp Reminders Modal */}
      {showBulkReminders && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Bulk WhatsApp Reminders</h3>
            <p className="text-gray-600 mb-4">
              This will send WhatsApp reminders to all customers with outstanding dues and mobile numbers.
            </p>
            <div className="bg-yellow-50 p-3 rounded mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This will open multiple WhatsApp windows. Make sure to close them after sending.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkReminders(false)}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  sendBulkWhatsAppReminders();
                  setShowBulkReminders(false);
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Send Reminders
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, value, color }) {
  return (
    <div className={`${color} p-4 rounded-lg`}> 
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}


