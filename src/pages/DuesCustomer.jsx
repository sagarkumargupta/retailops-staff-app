import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function DuesCustomer() {
  const { profile } = useUserProfile();
  const { storeId, customerKey } = useParams();
  const [rokarDocs, setRokarDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { if (storeId) loadRokar(); }, [storeId]);

  const loadRokar = async () => {
    setLoading(true);
    try {
      const qRef = query(collection(db, 'rokar'), where('storeId', '==', storeId), orderBy('date', 'asc'));
      const snap = await getDocs(qRef);
      setRokarDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  };

  const ledger = useMemo(() => {
    const key = decodeURIComponent(customerKey);
    const lines = [];
    let totalGiven = 0, totalPaid = 0;
    for (const r of rokarDocs) {
      (Array.isArray(r.duesGivenDetails) ? r.duesGivenDetails : []).forEach(d => {
        const k = d.customerId || (d.mobile && d.mobile.trim()) || (d.name && d.name.trim());
        if (k === key) {
          lines.push({ date: r.date, type: 'GIVEN', amount: Number(d.amount||0), name: d.name, mobile: d.mobile, dueDate: d.dueDate, approval: d.approvalPerson });
          totalGiven += Number(d.amount||0);
        }
      });
      (Array.isArray(r.duesPaidDetails) ? r.duesPaidDetails : []).forEach(p => {
        const k = p.customerId || (p.mobile && p.mobile.trim()) || (p.name && p.name.trim());
        if (k === key) {
          lines.push({ date: r.date, type: 'PAID', amount: Number(p.amount||0), name: p.name, mobile: p.mobile, paymentDate: p.paymentDate, approval: p.approvalPerson });
          totalPaid += Number(p.amount||0);
        }
      });
    }
    return { lines: lines.sort((a,b)=>a.date.localeCompare(b.date)), totalGiven, totalPaid, outstanding: totalGiven-totalPaid, customerName: lines[0]?.name, mobile: lines[0]?.mobile };
  }, [rokarDocs, customerKey]);

  const formatCurrency = (n) => `₹${Number(n||0).toLocaleString('en-IN')}`;
  
  const filteredLines = useMemo(() => {
    if (!searchTerm) return ledger.lines;
    const term = searchTerm.toLowerCase();
    return ledger.lines.filter(line => 
      line.name.toLowerCase().includes(term) || 
      (line.mobile && line.mobile.includes(term)) ||
      line.type.toLowerCase().includes(term)
    );
  }, [ledger.lines, searchTerm]);

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Amount', 'Approval', 'Due/Pay Date'];
    const csvContent = [
      headers.join(','),
      ...filteredLines.map(line => [
        line.date,
        line.type,
        line.amount,
        line.approval || '',
        line.type === 'GIVEN' ? (line.dueDate || '') : (line.paymentDate || '')
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer_dues_${storeId}_${ledger.customerName}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const whatsAppLink = () => {
    if (!ledger.mobile) return '#';
    const text = `Namaste ${ledger.customerName||''},\nAapke upar ₹${Number(ledger.outstanding).toLocaleString('en-IN')} ka baki hai. Kripya jaldi se jama karein. - ${storeId}`;
    return `https://wa.me/91${ledger.mobile}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="p-4">
             <div className="flex justify-between items-center mb-4">
         <h1 className="text-2xl font-semibold">Customer Dues</h1>
         <div className="flex gap-2">
           {ledger.mobile && (
             <a href={whatsAppLink()} className="px-3 py-1.5 bg-green-600 text-white rounded" target="_blank" rel="noreferrer">Send WhatsApp Reminder</a>
           )}
           <button
             onClick={exportToCSV}
             className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
           >
             Export CSV
           </button>
         </div>
       </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <Card title="Total Given" value={formatCurrency(ledger.totalGiven)} color="bg-orange-100" />
            <Card title="Total Paid" value={formatCurrency(ledger.totalPaid)} color="bg-green-100" />
            <Card title="Outstanding" value={formatCurrency(ledger.outstanding)} color="bg-red-100" />
          </div>

                     <div className="bg-white rounded shadow overflow-hidden">
             <div className="p-4 border-b">
               <div className="text-lg font-semibold">{ledger.customerName || 'Unknown'}</div>
               <div className="text-sm text-gray-600">{ledger.mobile || '-'}</div>
             </div>
             <div className="p-4 border-b">
               <input
                 type="text"
                 placeholder="Search entries..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full p-2 border rounded"
               />
             </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Approval</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due/Pay Date</th>
                  </tr>
                </thead>
                                 <tbody className="divide-y divide-gray-200 bg-white">
                   {filteredLines.map((r, i) => (
                     <tr key={i}>
                       <td className="px-3 py-2">{r.date}</td>
                       <td className="px-3 py-2">{r.type}</td>
                       <td className="px-3 py-2 text-right">{formatCurrency(r.amount)}</td>
                       <td className="px-3 py-2">{r.approval || '-'}</td>
                       <td className="px-3 py-2">{r.type==='GIVEN' ? (r.dueDate || '-') : (r.paymentDate || '-')}</td>
                     </tr>
                   ))}
                 </tbody>
              </table>
              {searchTerm && filteredLines.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No entries found matching "{searchTerm}"
                </div>
              )}
            </div>
          </div>
        </>
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


