import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import useUserProfile from '../hooks/useUserProfile';

const EXPENSE_KEYS = ['WATER','TEA','DISCOUNT','ALTERATION','STAFF LUNCH','GENERATOR','SHOP RENT','ELECTRICITY','HOME EXPENSE','PETROL','SUNDAY','CASH RETURN','TRANSPORT'];

const cleanNumber = (n) => {
  if (n === null || n === undefined || n === '') return 0;
  const v = Number(String(n).replace(/[,₹ ]/g, ''));
  return isNaN(v) ? 0 : v;
};
const toYMD = (v) => {
  const d = XLSX.SSF.parse_date_code(v);
  if (d) { const yyyy=String(d.y).padStart(4,'0'); const mm=String(d.m).padStart(2,'0'); const dd=String(d.d).padStart(2,'0'); return `${yyyy}-${mm}-${dd}`; }
  const t = new Date(v); if(!isNaN(t.getTime())) return t.toISOString().slice(0,10);
  const s = String(v || '').trim(); const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m){ const [_, d1,m1,y1]=m; const yyyy=y1.length===2? '20'+y1:y1; return `${yyyy}-${String(m1).padStart(2,'0')}-${String(d1).padStart(2,'0')}` }
  return s;
};

const closingFrom = (r) => {
  const sale = cleanNumber(r.totalSale || 0);
  const duesIn = cleanNumber(r.customerDuesPaid || 0);
  const pay = r.payments||{};
  const wallets = cleanNumber(pay.paytm||0) + cleanNumber(pay.phonepe||0) + cleanNumber(pay.gpay||0);
  const bank = cleanNumber(pay.bankDeposit||0);
  const home = cleanNumber(pay.home||0);
  const out = cleanNumber(r.duesGiven||0) + cleanNumber(r.totalCashOut||0) + cleanNumber(r.expenseTotal||0) + cleanNumber(r.staffSalaryTotal||0);
  return cleanNumber(r.openingBalance||0) + sale + duesIn - wallets - bank - home - out;
};

export default function BulkUpload() {
  const { profile, getStoresForFiltering } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [rows, setRows] = useState([]);
  const [rawPreview, setRawPreview] = useState([]);
  const [msg, setMsg] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [overwrite, setOverwrite] = useState(false);

  useEffect(() => { (async () => {
    const ss = await getDocs(collection(db, 'stores'));
    let list = ss.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Use new consistent access control pattern
    const userStores = getStoresForFiltering();
    if (userStores.length > 0) {
      list = list.filter(s => userStores.includes(s.id));
    }
    
    setStores(list);
  })() }, [profile?.role, profile?.assignedStore]);

  const selectedStore = useMemo(() => stores.find(s => s.id === storeId), [stores, storeId]);

  const parse = async () => {
    setMsg('');
    if (!file) { setMsg('Choose the January Excel'); return; }
    
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
      if (aoa.length < 3) { setMsg('Sheet seems empty'); return; }
      const headers = (aoa[1] || []).map(h => String(h || '').trim());
      const body = aoa.slice(2);
      
      console.log('BulkUpload: Headers found:', headers);
      console.log('BulkUpload: Total rows to process:', body.length);

      const idx = (name) => headers.findIndex(h => h === name);
      const col = (row, name) => { const i = idx(name); return i>=0? row[i]: '' };

    const HDR = {
      date: 'Date',
      opening: 'Opening\n Balance',
      closing: 'Closing\n Balance',
      compSale: 'COMPUTER  Sale',
      manualSale: 'MANUAL SALE',
      manualBilled: 'MANUAL BILLED',
      totalSale: 'TOTAL SALE',
      duesPaid: 'CUSTOMER DUES PAID',
      paytm: 'PAYTM SALE',
      phonepe: 'PHONEPE',
      gpay: 'GPAY',
      bank: 'BANK DEPOSIT',
      home: 'HOME',
      duesGiven: 'DUES GIVEN',
      cashOut: 'Ttotal cash out',
      totalExpense: 'TOTAL EXPENSE',
      totalSalary: 'TOTAL SALARY'
    };

    const mapped = [];
    for (const r of body) {
      if (!r || r.length === 0) continue;
      const rawDate = col(r, HDR.date);
      if (!rawDate) continue;
      const date = toYMD(rawDate);
      const expenseBreakup = {}; let expParts=0;
      for(const k of EXPENSE_KEYS){ const v = cleanNumber(col(r,k)); expenseBreakup[k]=v; expParts+=v; }
      let staffTotal = cleanNumber(col(r, HDR.totalSalary));
      if (!staffTotal) { let s=0; for(let i=1;i<=7;i++){ s += cleanNumber(col(r, `STAFF ${i}`)); } staffTotal = s; }
      const row = {
        date,
        openingBalance: cleanNumber(col(r, HDR.opening)),
        closingBalance: cleanNumber(col(r, HDR.closing)), // Use closing balance from Excel directly
        computerSale: cleanNumber(col(r, HDR.compSale)),
        manualSale: cleanNumber(col(r, HDR.manualSale)),
        manualBilled: cleanNumber(col(r, HDR.manualBilled)),
        totalSale: cleanNumber(col(r, HDR.totalSale)),
        customerDuesPaid: cleanNumber(col(r, HDR.duesPaid)),
        payments: {
          paytm: cleanNumber(col(r, HDR.paytm)),
          phonepe: cleanNumber(col(r, HDR.phonepe)),
          gpay: cleanNumber(col(r, HDR.gpay)),
          bankDeposit: cleanNumber(col(r, HDR.bank)),
          home: cleanNumber(col(r, HDR.home))
        },
        duesGiven: cleanNumber(col(r, HDR.duesGiven)),
        totalCashOut: cleanNumber(col(r, HDR.cashOut)),
        expenseBreakup,
        expenseTotal: cleanNumber(col(r, HDR.totalExpense)) || expParts,
        staffSalaryTotal: staffTotal
      };
      // Remove the automatic closing balance calculation - use Excel data as-is
      mapped.push(row)
    }
    setRawPreview(mapped.slice(0,50)); 
    setRows(mapped); 
    setMsg(`Parsed ${mapped.length} rows. Import when ready.`);
    } catch (error) {
      console.error('BulkUpload: Error parsing Excel file:', error);
      setMsg(`❌ Error parsing Excel file: ${error.message}`);
    }
  };

  const importRows = async () => {
    if (!storeId) { setMsg('Select store'); return; }
    if (!rows.length) { setMsg('Parse a file first'); return; }
    
    setBusy(true);
    setMsg('Starting import...');
    
    let inserted = 0, skipped = 0, overwritten = 0, errors = 0;
    const totalRows = rows.length;
    
    try {
      console.log(`BulkUpload: Starting import of ${totalRows} rows for store: ${storeId}`);
      
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        
        // Update progress message every 10 rows
        if (i % 10 === 0 || i === rows.length - 1) {
          setMsg(`Importing... ${i + 1}/${totalRows} (${Math.round(((i + 1) / totalRows) * 100)}%)`);
        }
        
        try {
          const docId = `${storeId}_${r.date}`;
          const ref = doc(db, 'rokar', docId);
          
          // Check if document exists
          const exists = await getDoc(ref);
          
          if (exists.exists() && !overwrite) { 
            skipped++; 
            continue; 
          }

          const payloadBase = {
            ...r,
            storeId,
            storeName: selectedStore?.name || '',
            brand: selectedStore?.brand || '',
            city: selectedStore?.city || '',
            importedAt: new Date(),
            importedBy: profile?.email || 'unknown'
          };

          if (exists.exists() && overwrite) {
            await setDoc(ref, { ...payloadBase, updatedAt: new Date() }, { merge: false });
            overwritten++;
            console.log(`BulkUpload: Overwrote document ${docId}`);
          } else {
            await setDoc(ref, { ...payloadBase, createdAt: new Date() }, { merge: false });
            inserted++;
            console.log(`BulkUpload: Created document ${docId}`);
          }
        } catch (rowError) {
          console.error(`BulkUpload: Error processing row ${i + 1}:`, rowError);
          errors++;
          // Continue with next row instead of stopping
        }
      }
      
      const resultMsg = `✅ Import completed! • Imported: ${inserted} • Overwrote: ${overwritten} • Skipped: ${skipped} • Errors: ${errors}`;
      console.log('BulkUpload: Import completed:', resultMsg);
      setMsg(resultMsg);
      
    } catch (e) {
      console.error('BulkUpload: Import failed:', e);
      setMsg(`❌ Import failed: ${e.code || e.message}`);
    } finally { 
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Bulk Excel Upload — Rokar (Jan format)</h2>
      <div className="bg-white rounded shadow p-4 mb-6 grid md:grid-cols-3 gap-4">
        <div>
          <label className="block mb-1 font-medium">Store</label>
          <select value={storeId} onChange={(e)=>setStoreId(e.target.value)} className="w-full p-2 border rounded">
            <option value="">Select store…</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.brand} — {s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Excel (.xlsx/.xls)</label>
          <input type="file" accept=".xlsx,.xls" onChange={e=>setFile(e.target.files[0])}/>
        </div>
        <div className="flex items-end gap-2">
          <button onClick={parse} className="bg-slate-800 text-white px-4 py-2 rounded">Parse & Preview</button>
          <button disabled={busy} onClick={importRows} className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-60">
            {busy ? 'Importing...' : 'Import'}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)} />
            Overwrite existing
          </label>
        </div>
      </div>
      
      {/* Progress Bar */}
      {busy && (
        <div className="bg-white rounded shadow p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Import Progress</span>
            <span className="text-sm text-gray-500">{msg}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full transition-all duration-300" style={{ width: '100%' }}></div>
          </div>
        </div>
      )}
      {msg && <p className="mb-4">{msg}</p>}
      {!!rawPreview.length && (
        <div className="bg-white rounded shadow p-4 overflow-auto">
          <p className="mb-2 text-sm text-gray-600">Preview (first 50 normalized rows).</p>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>{Object.keys(rawPreview[0]).map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rawPreview.map((r,i)=>(
                <tr key={i} className="border-t">
                  {Object.keys(rawPreview[0]).map(h => <td key={h} className="p-2">{typeof r[h]==='object'? JSON.stringify(r[h]) : String(r[h])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}