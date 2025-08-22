import React, { useEffect, useMemo, useState, useRef } from 'react';
import { collection, getDoc, getDocs, doc, query, where, setDoc, addDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { useNavigate } from 'react-router-dom';

const clean = (v) => Number(v || 0) || 0;
const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const prevYmd = (d) => { const x = new Date(d); x.setDate(x.getDate() - 1); return ymd(x); };

export default function RokarEntry() {
  const { profile } = useUserProfile();
  const navigate = useNavigate();

  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [date, setDate] = useState(ymd(new Date()));

  // Auto opening balance from previous day
  const [openingBalance, setOpeningBalance] = useState(0);
  const [openingSource, setOpeningSource] = useState('');

  // Income
  const [computerSale, setComputerSale] = useState('0');
  const [manualSale, setManualSale] = useState('0');
  const [manualBilled, setManualBilled] = useState('0');

  // Payments (Cash Out)
  const [payments, setPayments] = useState({ paytm: '0', phonepe: '0', gpay: '0', bankDeposit: '0', home: '0' });

  // Dues - Simple totals (compatible with existing data)
  const [duesGiven, setDuesGiven] = useState('0');
  const [customerDuesPaid, setCustomerDuesPaid] = useState('0');

  // Detailed Dues Tracking
  const [duesGivenDetails, setDuesGivenDetails] = useState([]);
  const [duesPaidDetails, setDuesPaidDetails] = useState([]);
  const [showDuesGivenModal, setShowDuesGivenModal] = useState(false);
  const [showDuesPaidModal, setShowDuesPaidModal] = useState(false);



  // Expenses - Standard categories from JSON data
  const [expenseBreakup, setExpenseBreakup] = useState({
    WATER: '0', TEA: '0', DISCOUNT: '0', ALTERATION: '0', 'STAFF LUNCH': '0',
    GENERATOR: '0', 'SHOP RENT': '0', ELECTRICITY: '0', 'HOME EXPENSE': '0', PETROL: '0',
    SUNDAY: '0', 'CASH RETURN': '0', TRANSPORT: '0'
  });

  // Staff Salary (auto-calculated from approved requests)
  const [staffSalaryTotal, setStaffSalaryTotal] = useState('0');
  const [staffSalarySource, setStaffSalarySource] = useState('');

  // Other Expense (auto-filled from approved requests)
  const [otherExpenseTotal, setOtherExpenseTotal] = useState(0);
  const [otherExpenseSource, setOtherExpenseSource] = useState('');
  const [otherExpenseDetails, setOtherExpenseDetails] = useState([]);

  // Existing doc detection
  const [existing, setExisting] = useState(null);
  const [checking, setChecking] = useState(false);

  // Cash Breakdown System
  const [cashBreakdown, setCashBreakdown] = useState({
    rs5: '0', rs10: '0', rs20: '0', rs50: '0', rs100: '0', rs200: '0', rs500: '0',
    coins: '0', foreignCash: '0'
  });
  const [showCashBreakdown, setShowCashBreakdown] = useState(false);
  const [showCashHistory, setShowCashHistory] = useState(false);
  const [previousCashData, setPreviousCashData] = useState(null);

  // UI state
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const approvalPersons = ['Akash Sir', 'Sagar Sir', 'Badal Sir'];

  // Function to load previous day's opening balance
  const loadPreviousDayOpening = async () => {
    const prevId = `${storeId}_${prevYmd(date)}`;
    console.log('RokarEntry: Checking previous day ID:', prevId);
    const prevRef = doc(db, 'rokar', prevId);
    const prevSnap = await getDoc(prevRef);
    if (prevSnap.exists()) {
      const prev = prevSnap.data();
      setOpeningBalance(clean(prev.closingBalance));
      setOpeningSource('Auto from previous day');
      console.log('RokarEntry: Using previous day closing balance:', prev.closingBalance);
    } else {
      setOpeningBalance(0);
      setOpeningSource('No previous day entry');
      console.log('RokarEntry: No previous day entry found');
    }
  };

  // Load stores, filtered for MANAGER
  useEffect(() => {
    (async () => {
      console.log('RokarEntry: Loading stores for profile:', profile?.role, profile?.stores);
      const ss = await getDocs(collection(db, 'stores'));
      let list = ss.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('RokarEntry: All stores loaded:', list.length);
      
      if (profile?.role === 'MANAGER' && profile.stores && typeof profile.stores === 'object') {
        const managerStoreIds = Object.keys(profile.stores).filter(key => profile.stores[key] === true);
        console.log('RokarEntry: Manager store IDs:', managerStoreIds);
        list = list.filter(s => managerStoreIds.includes(s.id));
        console.log('RokarEntry: Filtered stores for manager:', list.length);
      }
      
      setStores(list);
      if (!storeId && list.length) {
        setStoreId(list[0].id);
        console.log('RokarEntry: Selected store:', list[0].id);
      }
    })();
  }, [profile?.role, profile?.stores]);

  // On store/date change: fetch previous day's closing as opening; check duplicate; load approved expenses and salaries
  useEffect(() => {
    if (!storeId || !date) return;
    (async () => {
      console.log('RokarEntry: Loading data for store:', storeId, 'date:', date);
      setChecking(true);
      setExisting(null);
      try {
        // First check if there's an existing entry for current day with opening balance
        const currentId = `${storeId}_${date}`;
        console.log('RokarEntry: Checking current day ID:', currentId);
        const currentRef = doc(db, 'rokar', currentId);
        const curSnap = await getDoc(currentRef);
        
        if (curSnap.exists()) {
          console.log('RokarEntry: Found existing entry for current day');
          const existingData = curSnap.data();
          
          // Check if this is a substantial entry (has more than just opening balance)
          // Only consider it substantial if there's actual business data, not just opening balance
          // Also check if it's an admin entry (opening balance only)
          const isAdminEntry = existingData.isAdminEntry === true;
          const hasSubstantialData = (
            !isAdminEntry && (
              (existingData.totalSale > 0) || 
              (existingData.computerSale > 0) || 
              (existingData.manualSale > 0) ||
              (existingData.expenseTotal > 0) ||
              (existingData.staffSalaryTotal > 0) ||
              (existingData.customerDuesPaid > 0) ||
              (existingData.duesGiven > 0) ||
              (existingData.payments && (
                existingData.payments.paytm > 0 ||
                existingData.payments.phonepe > 0 ||
                existingData.payments.gpay > 0 ||
                existingData.payments.bankDeposit > 0 ||
                existingData.payments.home > 0
              )) ||
              // Check if there are any non-zero expenses in the breakdown
              (existingData.expenseBreakup && Object.values(existingData.expenseBreakup).some(exp => clean(exp) > 0))
            )
          );
          
          console.log('RokarEntry: Has substantial data:', hasSubstantialData, 'Is admin entry:', isAdminEntry, 'Data:', existingData);
          
          if (hasSubstantialData) {
            // This is a real entry with data, show the "already exists" message
            setExisting({ id: currentId, ...existingData });
            console.log('RokarEntry: Setting existing entry - substantial data found');
          } else {
            // This is just an opening balance entry, allow editing
            setExisting(null);
            console.log('RokarEntry: No substantial data, allowing edit');
          }
          
          // If existing entry has opening balance, use it
          if (existingData.openingBalance !== undefined && existingData.openingBalance !== null) {
            setOpeningBalance(clean(existingData.openingBalance));
            setOpeningSource('From existing entry');
            console.log('RokarEntry: Using opening balance from existing entry:', existingData.openingBalance);
          } else {
            // Fall back to previous day's closing balance
            await loadPreviousDayOpening();
          }
        } else {
          console.log('RokarEntry: No existing entry for current day');
          setExisting(null);
          // Load previous day's closing balance as opening
          await loadPreviousDayOpening();
        }

        // Load approved other expenses for this store and date
        try {
          console.log('RokarEntry: Loading approved expenses for store:', storeId, 'date:', date);
          const expenseQuery = query(
            collection(db, 'other_expenses'),
            where('storeId', '==', storeId),
            where('status', '==', 'approved'),
            where('date', '==', date)
          );
          const expenseSnap = await getDocs(expenseQuery);
          let totalExpense = 0;
          let expenseDetails = [];
          expenseSnap.forEach(doc => {
            const data = doc.data();
            console.log('RokarEntry: Found expense:', data);
            totalExpense += clean(data.amount);
            expenseDetails.push(`${data.category}: ${clean(data.amount)}`);
          });
          console.log('RokarEntry: Total expenses found for store', storeId, ':', expenseDetails.length, 'Total amount:', totalExpense);
          setOtherExpenseTotal(totalExpense);
          setOtherExpenseDetails(expenseDetails);
          setOtherExpenseSource(expenseDetails.length > 0 ? `Auto from ${expenseDetails.length} approved request(s)` : 'No approved expenses');
        } catch (error) {
          console.error('RokarEntry: Error loading expenses:', error);
          setOtherExpenseTotal(0);
          setOtherExpenseSource('Error loading expenses');
        }

        // Load approved salary requests for this store and specific date
        try {
          console.log('RokarEntry: Loading approved salary requests for store:', storeId, 'date:', date);
          
          // Look for salary requests that are approved and have a payment date matching today's date
          const salaryQuery = query(
            collection(db, 'salary_requests'),
            where('storeId', '==', storeId),
            where('status', '==', 'approved'),
            where('paymentDate', '==', date) // Use paymentDate field for date-specific payments
          );
          const salarySnap = await getDocs(salaryQuery);
          let totalSalary = 0;
          let salaryDetails = [];
          salarySnap.forEach(doc => {
            const data = doc.data();
            console.log('RokarEntry: Found approved salary request for date:', {
              id: doc.id,
              staffName: data.staffName || data.userName,
              amount: data.amount,
              paymentDate: data.paymentDate,
              status: data.status
            });
            totalSalary += clean(data.amount);
            salaryDetails.push(`${data.staffName || data.userName}: ₹${clean(data.amount).toLocaleString()}`);
          });
          console.log('RokarEntry: Total approved salary requests for date:', salaryDetails.length, 'Total amount:', totalSalary);
          setStaffSalaryTotal(totalSalary.toString());
          setStaffSalarySource(salaryDetails.length > 0 ? `Auto from ${salaryDetails.length} approved request(s) for ${date}: ${salaryDetails.join(', ')}` : 'No approved salary requests for this date');
        } catch (error) {
          console.error('RokarEntry: Error loading salary requests:', error);
          setStaffSalaryTotal('0');
          setStaffSalarySource('Error loading salary requests');
        }

        // Load previous day's cash breakdown
        try {
          await loadPreviousCashData();
        } catch (error) {
          console.error('RokarEntry: Error loading previous cash data:', error);
        }

      } catch (error) {
        console.error('RokarEntry: Error in main data loading:', error);
      } finally {
        setChecking(false);
      }
    })();
  }, [storeId, date]);

  const totalSale = useMemo(() => {
    return Math.max(0, clean(computerSale) + clean(manualSale) - clean(manualBilled));
  }, [computerSale, manualSale, manualBilled]);

  const totalCashOut = useMemo(() => {
    const p = payments || {};
    return clean(p.paytm) + clean(p.phonepe) + clean(p.gpay) + clean(p.bankDeposit) + clean(p.home);
  }, [payments]);

  const expenseTotal = useMemo(() => {
    const baseExpenses = Object.values(expenseBreakup).reduce((a, b) => a + clean(b), 0);
    return baseExpenses + otherExpenseTotal; // Include auto-filled other expenses
  }, [expenseBreakup, otherExpenseTotal]);

  const closingBalance = useMemo(() => {
    // Classical: opening + totalSale + duesIn - cashOut - expenses - staff - duesGiven
    return (
      clean(openingBalance) + totalSale + clean(customerDuesPaid) - clean(duesGiven) - totalCashOut - expenseTotal - clean(staffSalaryTotal)
    );
  }, [openingBalance, totalSale, customerDuesPaid, duesGiven, totalCashOut, expenseTotal, staffSalaryTotal]);

  // Cash Breakdown Calculations
  const cashTotal = useMemo(() => {
    const breakdown = cashBreakdown || {};
    return (
      clean(breakdown.rs5) * 5 +
      clean(breakdown.rs10) * 10 +
      clean(breakdown.rs20) * 20 +
      clean(breakdown.rs50) * 50 +
      clean(breakdown.rs100) * 100 +
      clean(breakdown.rs200) * 200 +
      clean(breakdown.rs500) * 500 +
      clean(breakdown.coins) +
      clean(breakdown.foreignCash)
    );
  }, [cashBreakdown]);

  const cashBalance = useMemo(() => {
    return closingBalance - cashTotal;
  }, [closingBalance, cashTotal]);

  const isCashBalanced = useMemo(() => {
    return Math.abs(cashBalance) < 1; // Allow 1 rupee tolerance
  }, [cashBalance]);

  const setPaymentField = (k, v) => setPayments(prev => ({ ...prev, [k]: v }));
  const setExpenseField = (k, v) => setExpenseBreakup(prev => ({ ...prev, [k]: v }));
  const setCashField = (k, v) => setCashBreakdown(prev => ({ ...prev, [k]: v }));

  // Load previous day's cash breakdown
  const loadPreviousCashData = async () => {
    if (!storeId || !date) return;
    try {
      const prevId = `${storeId}_${prevYmd(date)}`;
      const prevRef = doc(db, 'rokar', prevId);
      const prevSnap = await getDoc(prevRef);
      if (prevSnap.exists()) {
        const prev = prevSnap.data();
        setPreviousCashData(prev.cashBreakdown || null);
      } else {
        setPreviousCashData(null);
      }
    } catch (error) {
      console.error('Error loading previous cash data:', error);
      setPreviousCashData(null);
    }
  };

  // Auto-fill cash breakdown from previous day
  const autoFillCashFromPrevious = () => {
    if (previousCashData) {
      setCashBreakdown(previousCashData);
    }
  };

  // Clear all cash fields
  const clearCashFields = () => {
    setCashBreakdown({
      rs5: '0', rs10: '0', rs20: '0', rs50: '0', rs100: '0', rs200: '0', rs500: '0',
      coins: '0', foreignCash: '0'
    });
  };

  const formatCurrency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(clean(n));

  // Dues Management Functions
  const addDuesGiven = (details) => {
    setDuesGivenDetails(prev => [...prev, { ...details, id: Date.now() }]);
    setDuesGiven(prev => (clean(prev) + clean(details.amount)).toString());
    setShowDuesGivenModal(false);
  };

  const addDuesPaid = (details) => {
    setDuesPaidDetails(prev => [...prev, { ...details, id: Date.now() }]);
    setCustomerDuesPaid(prev => (clean(prev) + clean(details.amount)).toString());
    setShowDuesPaidModal(false);
  };

  const removeDuesGiven = (id) => {
    const item = duesGivenDetails.find(d => d.id === id);
    if (item) {
      setDuesGivenDetails(prev => prev.filter(d => d.id !== id));
      setDuesGiven(prev => Math.max(0, clean(prev) - clean(item.amount)).toString());
    }
  };

  const removeDuesPaid = (id) => {
    const item = duesPaidDetails.find(d => d.id === id);
    if (item) {
      setDuesPaidDetails(prev => prev.filter(d => d.id !== id));
      setCustomerDuesPaid(prev => Math.max(0, clean(prev) - clean(item.amount)).toString());
    }
  };

  const handleSave = async () => {
    if (!storeId) { setMessage('Please select a store'); return; }
    if (!date) { setMessage('Please select a date'); return; }
    if (existing) { 
      setMessage('A complete Rokar entry already exists for this store and date. Please view it in Rokar Book or contact admin to modify.'); 
      return; 
    }
    
    // Check if cash breakdown is balanced
    if (!isCashBalanced) {
      setMessage(`Cash mismatch! Closing Balance: ${formatCurrency(closingBalance)}, Cash Total: ${formatCurrency(cashTotal)}, Difference: ${formatCurrency(cashBalance)}`);
      setShowCashBreakdown(true);
      return;
    }
    
    setShowConfirm(true);
  };

  const confirmAndSave = async () => {
    setShowConfirm(false);
    setBusy(true);
    setMessage('');
    try {
      const id = `${storeId}_${date}`;
      const payload = {
        storeId,
        date,
        openingBalance: clean(openingBalance),
        computerSale: clean(computerSale),
        manualSale: clean(manualSale),
        manualBilled: clean(manualBilled),
        totalSale: totalSale,
        payments: {
          paytm: clean(payments.paytm),
          phonepe: clean(payments.phonepe),
          gpay: clean(payments.gpay),
          bankDeposit: clean(payments.bankDeposit),
          home: clean(payments.home),
        },
        totalCashOut: totalCashOut,
        duesGiven: clean(duesGiven),
        customerDuesPaid: clean(customerDuesPaid),
        // Store detailed dues information
        duesGivenDetails: duesGivenDetails,
        duesPaidDetails: duesPaidDetails,
        expenseBreakup: Object.fromEntries(Object.entries(expenseBreakup).map(([k, v]) => [k, clean(v)])),
        expenseTotal: expenseTotal,
        otherExpenseTotal: otherExpenseTotal,
        otherExpenseDetails: otherExpenseDetails,
        staffSalaryTotal: clean(staffSalaryTotal),
        closingBalance: closingBalance,
        cashBreakdown: Object.fromEntries(Object.entries(cashBreakdown).map(([k, v]) => [k, clean(v)])),
        cashTotal: cashTotal,
        createdAt: new Date(),
        createdBy: profile?.email || 'system'
      };
      await setDoc(doc(db, 'rokar', id), payload, { merge: false });
      setShowSuccess(true);
    } catch (e) {
      console.error(e);
      setMessage('Failed to save rokar');
    } finally { setBusy(false); }
  };

  if (!profile) return <div className="p-6">Loading…</div>;
  if (!['ADMIN','MANAGER'].includes(profile.role)) return <div className="p-6">Access denied</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="relative">
          <select value={storeId} onChange={(e)=>setStoreId(e.target.value)} className="p-2 border rounded peer bg-white min-w-[220px]" required>
            <option value="">Select Store</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.brand} — {s.name}</option>)}
          </select>
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600">Store</label>
        </div>
        <div className="relative">
          <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="p-2 border rounded peer bg-white" />
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600">Date</label>
        </div>
        <div className="relative">
          <input type="number" value={openingBalance} readOnly className="p-2 border rounded bg-gray-50 pr-16" />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600">Auto</span>
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600">Opening Balance</label>
          <p className="text-xs text-gray-500 mt-1">{openingSource}</p>
        </div>
      </div>

      {checking && <div className="p-3 bg-yellow-50 text-yellow-800 rounded">Checking previous/current entries and loading approved data…</div>}
      {!!existing && (
        <div className="p-3 bg-red-50 text-red-700 rounded">
          A Rokar entry already exists for this store and date. Please view it in Rokar Book.
        </div>
      )}

      {/* Income */}
      <section className="bg-white rounded shadow p-4">
        <h3 className="font-semibold mb-4">Income</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Computer Sale (₹)">
            <input type="number" value={computerSale} onChange={(e)=>setComputerSale(e.target.value)} className="w-full p-2 border rounded" />
          </Field>
          <Field label="Manual Sale (₹)">
            <input type="number" value={manualSale} onChange={(e)=>setManualSale(e.target.value)} className="w-full p-2 border rounded" />
          </Field>
          <Field label="Manual Billed (₹)">
            <input type="number" value={manualBilled} onChange={(e)=>setManualBilled(e.target.value)} className="w-full p-2 border rounded" />
          </Field>
        </div>
        <div className="mt-4 p-3 bg-green-50 rounded flex justify-between">
          <div className="text-green-700 font-medium">Total Sale</div>
          <div className="font-semibold text-green-700">{formatCurrency(totalSale)}</div>
        </div>
      </section>

      {/* Digital Payments / Cash Out */}
      <section className="bg-white rounded shadow p-4">
        <h3 className="font-semibold mb-4">Digital Payments / Cash Out</h3>
        <div className="grid md:grid-cols-5 gap-4">
          {['paytm','phonepe','gpay','bankDeposit','home'].map((k) => (
            <Field key={k} label={labelMap[k]}>
              <input type="number" value={payments[k]} onChange={(e)=>setPaymentField(k, e.target.value)} className="w-full p-2 border rounded" />
            </Field>
          ))}
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded flex justify-between">
          <div className="text-blue-700 font-medium">Total Cash Out</div>
          <div className="font-semibold text-blue-700">{formatCurrency(totalCashOut)}</div>
        </div>
      </section>

      {/* Dues */}
      <section className="bg-white rounded shadow p-4">
        <h3 className="font-semibold mb-4">Dues Management</h3>
        
        {/* Dues Given */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-medium text-gray-700">Dues Given</h4>
            <button 
              onClick={() => setShowDuesGivenModal(true)}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              + Add Due
            </button>
          </div>
          
          {duesGivenDetails.length > 0 && (
            <div className="bg-orange-50 p-3 rounded mb-3">
              <div className="space-y-2">
                {duesGivenDetails.map((due) => (
                  <div key={due.id} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium">{due.name}</span> - {due.mobile}
                      <br />
                      <span className="text-xs text-gray-600">
                        Due: {due.dueDate} | Approved by: {due.approvalPerson}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCurrency(due.amount)}</span>
                      <button 
                        onClick={() => removeDuesGiven(due.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center p-2 bg-orange-100 rounded">
            <span className="font-medium">Total Dues Given</span>
            <span className="font-semibold">{formatCurrency(duesGiven)}</span>
          </div>
        </div>

        {/* Dues Paid */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-medium text-gray-700">Customer Dues Paid</h4>
            <button 
              onClick={() => setShowDuesPaidModal(true)}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              + Add Payment
            </button>
          </div>
          
          {duesPaidDetails.length > 0 && (
            <div className="bg-green-50 p-3 rounded mb-3">
              <div className="space-y-2">
                {duesPaidDetails.map((payment) => (
                  <div key={payment.id} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium">{payment.name}</span> - {payment.mobile}
                      <br />
                      <span className="text-xs text-gray-600">
                        Paid on: {payment.paymentDate} | Approved by: {payment.approvalPerson}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCurrency(payment.amount)}</span>
                      <button 
                        onClick={() => removeDuesPaid(payment.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center p-2 bg-green-100 rounded">
            <span className="font-medium">Total Dues Paid</span>
            <span className="font-semibold">{formatCurrency(customerDuesPaid)}</span>
          </div>
        </div>
      </section>

             {/* Expenses */}
       <section className="bg-white rounded shadow p-4">
         <h3 className="font-semibold mb-4">Expenses</h3>
         <div className="grid md:grid-cols-4 gap-4">
           {Object.keys(expenseBreakup).map((k) => (
             <Field key={k} label={`${k} (₹)`}>
               <input type="number" value={expenseBreakup[k]} onChange={(e)=>setExpenseField(k, e.target.value)} className="w-full p-2 border rounded" />
             </Field>
           ))}
         </div>
        
                 {/* Auto-filled Other Expenses */}
         {otherExpenseTotal > 0 ? (
           <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
             <div className="flex justify-between items-center">
               <div>
                 <div className="text-purple-700 font-semibold text-lg">Other Expenses (Auto-filled from Approved Requests)</div>
                 <div className="text-sm text-purple-600 mt-1">{otherExpenseSource}</div>
               </div>
               <div className="font-bold text-purple-700 text-xl">{formatCurrency(otherExpenseTotal)}</div>
             </div>
           </div>
         ) : (
           <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
             <div className="text-gray-600 text-sm">
               <strong>Other Expenses:</strong> Auto-filled from approved expense requests (₹0 - No approved requests for this date)
             </div>
           </div>
         )}
        
        <div className="mt-4 p-3 bg-red-50 rounded flex justify-between">
          <div className="text-red-700 font-medium">Total Expenses</div>
          <div className="font-semibold text-red-700">{formatCurrency(expenseTotal)}</div>
        </div>
      </section>

      {/* Staff Salary */}
      <section className="bg-white rounded shadow p-4">
        <h3 className="font-semibold mb-4">Staff Salary</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Total Staff Salary (₹)">
            <input type="number" value={staffSalaryTotal} readOnly className="w-full p-2 border rounded bg-gray-50 pr-16" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600">Auto</span>
          </Field>
        </div>
        {staffSalarySource && (
          <div className="mt-2 p-2 bg-blue-50 rounded">
            <div className="text-xs text-blue-600">{staffSalarySource}</div>
          </div>
        )}
      </section>

      {/* Cash Breakdown */}
      <section className="bg-white rounded shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Cash Breakdown</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowCashHistory(true)}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
            >
              View Previous Day
            </button>
            {previousCashData && (
              <button 
                onClick={autoFillCashFromPrevious}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Auto-fill from Previous
              </button>
            )}
            <button 
              onClick={clearCashFields}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Clear All
            </button>
            <button 
              onClick={() => setShowCashBreakdown(!showCashBreakdown)}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              {showCashBreakdown ? 'Hide' : 'Show'} Cash Details
            </button>
          </div>
        </div>

        {/* Cash Summary */}
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-blue-50 rounded">
            <div className="text-sm text-blue-600">Closing Balance</div>
            <div className="text-xl font-bold text-blue-700">{formatCurrency(closingBalance)}</div>
          </div>
          <div className="p-3 bg-green-50 rounded">
            <div className="text-sm text-green-600">Cash Total</div>
            <div className="text-xl font-bold text-green-700">{formatCurrency(cashTotal)}</div>
          </div>
          <div className={`p-3 rounded ${isCashBalanced ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className={`text-sm ${isCashBalanced ? 'text-green-600' : 'text-red-600'}`}>
              {isCashBalanced ? '✓ Balanced' : '✗ Mismatch'}
            </div>
            <div className={`text-xl font-bold ${isCashBalanced ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(cashBalance)}
            </div>
          </div>
        </div>

        {/* Cash Details */}
        {showCashBreakdown && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="grid md:grid-cols-4 gap-4">
              <Field label="₹5 Notes">
                <input 
                  type="number" 
                  value={cashBreakdown.rs5} 
                  onChange={(e) => setCashField('rs5', e.target.value)} 
                  className="w-full p-2 border rounded" 
                />
              </Field>
              <Field label="₹10 Notes">
                <input 
                  type="number" 
                  value={cashBreakdown.rs10} 
                  onChange={(e) => setCashField('rs10', e.target.value)} 
                  className="w-full p-2 border rounded" 
                />
              </Field>
              <Field label="₹20 Notes">
                <input 
                  type="number" 
                  value={cashBreakdown.rs20} 
                  onChange={(e) => setCashField('rs20', e.target.value)} 
                  className="w-full p-2 border rounded" 
                />
              </Field>
              <Field label="₹50 Notes">
                <input 
                  type="number" 
                  value={cashBreakdown.rs50} 
                  onChange={(e) => setCashField('rs50', e.target.value)} 
                  className="w-full p-2 border rounded" 
                />
              </Field>
              <Field label="₹100 Notes">
                <input 
                  type="number" 
                  value={cashBreakdown.rs100} 
                  onChange={(e) => setCashField('rs100', e.target.value)} 
                  className="w-full p-2 border rounded" 
                />
              </Field>
              <Field label="₹200 Notes">
                <input 
                  type="number" 
                  value={cashBreakdown.rs200} 
                  onChange={(e) => setCashField('rs200', e.target.value)} 
                  className="w-full p-2 border rounded" 
                />
              </Field>
              <Field label="₹500 Notes">
                <input 
                  type="number" 
                  value={cashBreakdown.rs500} 
                  onChange={(e) => setCashField('rs500', e.target.value)} 
                  className="w-full p-2 border rounded" 
                />
              </Field>
              <Field label="Coins (₹)">
                <input 
                  type="number" 
                  value={cashBreakdown.coins} 
                  onChange={(e) => setCashField('coins', e.target.value)} 
                  className="w-full p-2 border rounded" 
                />
              </Field>
              <Field label="Foreign Cash (₹)">
                <input 
                  type="number" 
                  value={cashBreakdown.foreignCash} 
                  onChange={(e) => setCashField('foreignCash', e.target.value)} 
                  className="w-full p-2 border rounded" 
                />
              </Field>
            </div>
            
            {/* Cash Breakdown Summary */}
            <div className="mt-4 p-3 bg-white rounded border">
              <div className="grid md:grid-cols-4 gap-4 text-sm">
                <div>₹5 × {cashBreakdown.rs5} = {formatCurrency(clean(cashBreakdown.rs5) * 5)}</div>
                <div>₹10 × {cashBreakdown.rs10} = {formatCurrency(clean(cashBreakdown.rs10) * 10)}</div>
                <div>₹20 × {cashBreakdown.rs20} = {formatCurrency(clean(cashBreakdown.rs20) * 20)}</div>
                <div>₹50 × {cashBreakdown.rs50} = {formatCurrency(clean(cashBreakdown.rs50) * 50)}</div>
                <div>₹100 × {cashBreakdown.rs100} = {formatCurrency(clean(cashBreakdown.rs100) * 100)}</div>
                <div>₹200 × {cashBreakdown.rs200} = {formatCurrency(clean(cashBreakdown.rs200) * 200)}</div>
                <div>₹500 × {cashBreakdown.rs500} = {formatCurrency(clean(cashBreakdown.rs500) * 500)}</div>
                <div>Coins = {formatCurrency(cashBreakdown.coins)}</div>
                <div>Foreign = {formatCurrency(cashBreakdown.foreignCash)}</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Closing */}
      <section className="bg-white rounded shadow p-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-600">Calculated Closing Balance</div>
            <div className="text-2xl font-bold">{formatCurrency(closingBalance)}</div>
          </div>
          <button 
            disabled={busy || checking || !!existing || !isCashBalanced} 
            onClick={handleSave} 
            className="bg-slate-900 text-white px-6 py-3 rounded disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save Rokar'}
          </button>
        </div>
        {message && <div className="mt-3 p-2 bg-yellow-50 text-yellow-700 rounded">{message}</div>}
        {!isCashBalanced && (
          <div className="mt-3 p-2 bg-red-50 text-red-700 rounded">
            ⚠️ Cash must be balanced before saving. Please enter cash breakdown details.
          </div>
        )}
      </section>

      {/* Dues Given Modal */}
      {showDuesGivenModal && (
        <DuesModal 
          title="Add Dues Given"
          onSubmit={addDuesGiven}
          onClose={() => setShowDuesGivenModal(false)}
          approvalPersons={approvalPersons}
          type="given"
        />
      )}

      {/* Dues Paid Modal */}
      {showDuesPaidModal && (
        <DuesModal 
          title="Add Dues Paid"
          onSubmit={addDuesPaid}
          onClose={() => setShowDuesPaidModal(false)}
          approvalPersons={approvalPersons}
          type="paid"
        />
      )}

      {/* Confirm Modal */}
      {showConfirm && (
        <Modal onClose={()=>setShowConfirm(false)}>
          <div className="text-center">
            <h4 className="text-xl font-semibold mb-2">Confirm Closing Balance</h4>
            <p className="text-gray-600 mb-4">Please confirm the calculated closing balance for {date}.</p>
            <div className="text-3xl font-bold mb-6">{formatCurrency(closingBalance)}</div>
            <div className="flex gap-3 justify-center">
              <button onClick={()=>setShowConfirm(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={confirmAndSave} className="px-4 py-2 bg-slate-900 text-white rounded">Confirm & Save</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cash History Modal */}
      {showCashHistory && (
        <Modal onClose={() => setShowCashHistory(false)}>
          <div className="text-center">
            <h4 className="text-xl font-semibold mb-4">Previous Day Cash Breakdown</h4>
            <p className="text-gray-600 mb-4">Cash details for {prevYmd(date)}</p>
            
            {previousCashData ? (
              <div className="text-left">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-sm text-blue-600">₹5 Notes</div>
                    <div className="font-bold">{previousCashData.rs5 || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-sm text-blue-600">₹10 Notes</div>
                    <div className="font-bold">{previousCashData.rs10 || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-sm text-blue-600">₹20 Notes</div>
                    <div className="font-bold">{previousCashData.rs20 || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-sm text-blue-600">₹50 Notes</div>
                    <div className="font-bold">{previousCashData.rs50 || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-sm text-blue-600">₹100 Notes</div>
                    <div className="font-bold">{previousCashData.rs100 || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-sm text-blue-600">₹200 Notes</div>
                    <div className="font-bold">{previousCashData.rs200 || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-sm text-blue-600">₹500 Notes</div>
                    <div className="font-bold">{previousCashData.rs500 || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-sm text-blue-600">Coins (₹)</div>
                    <div className="font-bold">{formatCurrency(previousCashData.coins || 0)}</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-sm text-blue-600">Foreign Cash (₹)</div>
                    <div className="font-bold">{formatCurrency(previousCashData.foreignCash || 0)}</div>
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded text-center">
                  <div className="text-sm text-green-600">Total Cash</div>
                  <div className="text-xl font-bold text-green-700">
                    {formatCurrency(
                      (previousCashData.rs5 || 0) * 5 +
                      (previousCashData.rs10 || 0) * 10 +
                      (previousCashData.rs20 || 0) * 20 +
                      (previousCashData.rs50 || 0) * 50 +
                      (previousCashData.rs100 || 0) * 100 +
                      (previousCashData.rs200 || 0) * 200 +
                      (previousCashData.rs500 || 0) * 500 +
                      (previousCashData.coins || 0) +
                      (previousCashData.foreignCash || 0)
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-gray-600">No cash breakdown data available for the previous day.</p>
              </div>
            )}
            
            <div className="mt-6">
              <button onClick={() => setShowCashHistory(false)} className="px-4 py-2 bg-slate-900 text-white rounded">Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <Modal onClose={()=>setShowSuccess(false)}>
          <div className="text-center">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-2xl font-bold mb-3 text-green-800">🎉 Congratulations!</h4>
            <p className="text-lg text-gray-700 mb-2">Your Rokar entry has been saved successfully!</p>
            <p className="text-sm text-gray-600 mb-6">Store: {stores.find(s => s.id === storeId)?.name || 'Unknown'} | Date: {date}</p>
            
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h5 className="font-semibold text-blue-800 mb-2">📊 Quick Insights</h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Sale:</span>
                  <div className="font-semibold text-green-600">{formatCurrency(totalSale)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Closing Balance:</span>
                  <div className="font-semibold text-blue-600">{formatCurrency(closingBalance)}</div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setShowSuccess(false)} 
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Continue Editing
              </button>
              <button 
                onClick={() => {
                  setShowSuccess(false);
                  navigate('/reports', { 
                    state: { 
                      selectedStore: storeId,
                      selectedDate: date,
                      showInsights: true 
                    }
                  });
                }} 
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                📈 View Insights & Tracking
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}


function DuesModal({ title, onSubmit, onClose, approvalPersons, type }) {
  const [formData, setFormData] = useState({
    customerId: '',
    name: '',
    mobile: '',
    amount: '',
    approvalPerson: '',
    dueDate: type === 'given' ? new Date().toISOString().slice(0, 10) : '',
    paymentDate: type === 'paid' ? new Date().toISOString().slice(0, 10) : ''
  });
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadApprovedCustomers();
  }, []);

  const loadApprovedCustomers = async () => {
    setLoading(true);
    try {
      const qRef = query(collection(db, 'customers'), where('status', '==', 'approved'), orderBy('name'));
      const snap = await getDocs(qRef);
      const customersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(customersList);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData(prev => ({
        ...prev,
        customerId: customer.id,
        name: customer.name,
        mobile: customer.mobile
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.customerId || !formData.amount || !formData.approvalPerson) {
      alert('Please select customer and fill all required fields');
      return;
    }
    onSubmit(formData);
  };

  return (
    <Modal onClose={onClose}>
      <div className="text-center">
        <h4 className="text-xl font-semibold mb-4">{title}</h4>
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <Field label="Select Customer *">
            <select
              value={formData.customerId}
              onChange={(e) => handleCustomerSelect(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="">Select Customer</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} - {customer.mobile}
                </option>
              ))}
            </select>
          </Field>
          
          {formData.customerId && (
            <>
              <Field label="Customer Name">
                <input 
                  type="text" 
                  value={formData.name} 
                  readOnly
                  className="w-full p-2 border rounded bg-gray-50" 
                />
              </Field>
              
              <Field label="Mobile Number">
                <input 
                  type="tel" 
                  value={formData.mobile} 
                  readOnly
                  className="w-full p-2 border rounded bg-gray-50" 
                />
              </Field>
            </>
          )}
          
          <Field label="Amount (₹) *">
            <input 
              type="number" 
              value={formData.amount} 
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              className="w-full p-2 border rounded" 
              required 
              step="0.01"
            />
          </Field>
          
          <Field label="Approval Person *">
            <select 
              value={formData.approvalPerson} 
              onChange={(e) => setFormData({...formData, approvalPerson: e.target.value})}
              className="w-full p-2 border rounded" 
              required
            >
              <option value="">Select Approval Person</option>
              {approvalPersons.map(person => (
                <option key={person} value={person}>{person}</option>
              ))}
            </select>
          </Field>
          
          {type === 'given' && (
            <Field label="Due Date *">
              <input 
                type="date" 
                value={formData.dueDate} 
                onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                className="w-full p-2 border rounded" 
                required 
              />
            </Field>
          )}
          
          {type === 'paid' && (
            <Field label="Payment Date *">
              <input 
                type="date" 
                value={formData.paymentDate} 
                onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                className="w-full p-2 border rounded" 
                required 
              />
            </Field>
          )}
          
          <div className="flex gap-3 justify-center pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded">
              Add {type === 'given' ? 'Due' : 'Payment'}
            </button>
        </div>
      </form>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div className="relative">
      {children}
      <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600">{label}</label>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 relative shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-500 hover:text-gray-700">✕</button>
        {children}
      </div>
    </div>
  );
}

const labelMap = {
  paytm: 'Paytm (₹)',
  phonepe: 'PhonePe (₹)',
  gpay: 'GPay (₹)',
  bankDeposit: 'Bank Deposit (₹)',
  home: 'Home (₹)'
};
