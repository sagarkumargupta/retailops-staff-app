import React, { useState, useEffect } from 'react';
import { collection, getDocs, getDoc, doc, setDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import * as XLSX from 'xlsx';

export default function TargetManagement() {
  const { profile } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [staff, setStaff] = useState([]);
  const [targets, setTargets] = useState([]);
  const [yesterdaySales, setYesterdaySales] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile?.role, profile?.stores, selectedMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load stores
      const storesSnap = await getDocs(collection(db, 'stores'));
      let storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter stores based on role
      if (profile?.role === 'MANAGER' && profile.stores && typeof profile.stores === 'object') {
        const managerStoreIds = Object.keys(profile.stores).filter(key => profile.stores[key] === true);
        storesList = storesList.filter(s => managerStoreIds.includes(s.id));
      }
      setStores(storesList);

      // Load staff
      const staffSnap = await getDocs(collection(db, 'users'));
      let staffList = staffSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => ['STAFF', 'MANAGER'].includes(user.role));
      
      // Filter staff based on role
      if (profile?.role === 'MANAGER') {
        staffList = staffList.filter(user => 
          user.assignedStore && Object.keys(profile.stores || {}).includes(user.assignedStore)
        );
      }
      setStaff(staffList);

             // Load existing targets
       await loadTargets();
       
       // Load yesterday's sales
       await loadYesterdaySales();
     } catch (error) {
       console.error('Error loading data:', error);
       setMessage('Error loading data: ' + error.message);
     } finally {
       setLoading(false);
     }
   };

     const loadTargets = async () => {
     try {
       const targetsQuery = query(
         collection(db, 'targets'),
         where('month', '==', selectedMonth),
         orderBy('createdAt', 'desc')
       );
       const targetsSnap = await getDocs(targetsQuery);
       const targetsList = targetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
       setTargets(targetsList);
     } catch (error) {
       console.error('Error loading targets:', error);
     }
   };

   const loadYesterdaySales = async () => {
     try {
       const yesterday = new Date();
       yesterday.setDate(yesterday.getDate() - 1);
       const yesterdayStr = yesterday.toISOString().slice(0, 10);
       
       let rokarQuery;
       if (profile?.role === 'MANAGER') {
         const managerStoreIds = Object.keys(profile.stores || {}).filter(key => profile.stores[key] === true);
         rokarQuery = query(
           collection(db, 'rokar'),
           where('date', '==', yesterdayStr),
           where('storeId', 'in', managerStoreIds)
         );
       } else if (profile?.role === 'STAFF') {
         const userDoc = await getDoc(doc(db, 'users', profile.email));
         const userData = userDoc.data();
         if (userData?.assignedStore) {
           rokarQuery = query(
             collection(db, 'rokar'),
             where('date', '==', yesterdayStr),
             where('storeId', '==', userData.assignedStore)
           );
         }
       } else {
         // ADMIN/OWNER sees all stores
         rokarQuery = query(
           collection(db, 'rokar'),
           where('date', '==', yesterdayStr)
         );
       }
       
       if (rokarQuery) {
         const rokarSnap = await getDocs(rokarQuery);
         let totalSales = 0;
         rokarSnap.forEach(doc => {
           totalSales += Number(doc.data().totalSale || 0);
         });
         setYesterdaySales(totalSales);
       }
     } catch (error) {
       console.error('Error loading yesterday sales:', error);
     }
   };

  const calculateLastYearTarget = async (storeId, staffId = null) => {
    try {
      const lastYear = new Date(selectedMonth).getFullYear() - 1;
      const lastYearMonth = `${lastYear}-${selectedMonth.slice(5)}`;
      
      // Get last year's actual performance
      const startDate = `${lastYearMonth}-01`;
      const endDate = `${lastYearMonth}-31`;
      
      const rokarQuery = query(
        collection(db, 'rokar'),
        where('storeId', '==', storeId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const rokarSnap = await getDocs(rokarQuery);
      
      let totalSale = 0;
      rokarSnap.forEach(doc => {
        totalSale += Number(doc.data().totalSale || 0);
      });
      
      // Return +10% of last year's performance
      return Math.round(totalSale * 1.1);
    } catch (error) {
      console.error('Error calculating last year target:', error);
      return 0;
    }
  };

  const generateExcelTemplate = () => {
    // Get current month's days
    const currentDate = new Date(selectedMonth);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Create day-wise template
    const template = [];
    
         // Get stores and staff for demo data (filtered by role)
     const demoStores = stores.slice(0, 3); // First 3 stores for demo
     const demoStaff = staff.slice(0, 5); // First 5 staff for demo
    
    demoStores.forEach(store => {
      // Add store-level targets (no staff assigned)
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        template.push({
          'Store ID': store.id,
          'Store Name': store.name,
          'Staff ID': '', // Empty for store-level target
          'Staff Name': '', // Empty for store-level target
          'Date': dateStr,
          'Day': day,
          'Target Amount': Math.floor(Math.random() * 20000) + 30000, // Random target between 30k-50k
          'Month': selectedMonth,
          'Target Type': 'Store Target',
          'Notes': `Daily target for ${store.name}`
        });
      }
      
      // Add staff-level targets for this store
      const storeStaff = demoStaff.filter(s => s.assignedStore === store.id);
      if (storeStaff.length > 0) {
        storeStaff.forEach(staffMember => {
          for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            template.push({
              'Store ID': store.id,
              'Store Name': store.name,
              'Staff ID': staffMember.email,
              'Staff Name': staffMember.name || staffMember.email,
              'Date': dateStr,
              'Day': day,
              'Target Amount': Math.floor(Math.random() * 10000) + 15000, // Random target between 15k-25k
              'Month': selectedMonth,
              'Target Type': 'Staff Target',
              'Notes': `Daily target for ${staffMember.name || staffMember.email}`
            });
          }
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Target Template');
    
    // Add column widths for better readability
    ws['!cols'] = [
      { width: 15 }, // Store ID
      { width: 20 }, // Store Name
      { width: 25 }, // Staff ID
      { width: 20 }, // Staff Name
      { width: 12 }, // Date
      { width: 8 },  // Day
      { width: 15 }, // Target Amount
      { width: 12 }, // Month
      { width: 15 }, // Target Type
      { width: 30 }  // Notes
    ];
    
    const fileName = `target_template_${selectedMonth}_demo.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setMessage('');

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      let successCount = 0;
      let errorCount = 0;

      for (const row of rows) {
        try {
          const targetData = {
            storeId: row['Store ID'],
            storeName: row['Store Name'],
            staffId: row['Staff ID'] || null,
            staffName: row['Staff Name'] || null,
            date: row['Date'] || null,
            day: row['Day'] || null,
            targetAmount: Number(row['Target Amount']) || 0,
            month: row['Month'] || selectedMonth,
            targetType: row['Target Type'] || 'Daily Target',
            notes: row['Notes'] || '',
            createdAt: new Date(),
            createdBy: profile?.email || 'system'
          };

          // If no target amount specified, calculate from last year
          if (targetData.targetAmount === 0) {
            targetData.targetAmount = await calculateLastYearTarget(targetData.storeId, targetData.staffId);
            targetData.notes = `Auto-calculated +10% from last year: ${targetData.notes}`;
          }

          // Create unique ID for target (include date for day-wise targets)
          const targetId = targetData.date ? 
            `${targetData.storeId}_${targetData.staffId || 'store'}_${targetData.date}` :
            `${targetData.storeId}_${targetData.staffId || 'store'}_${targetData.month}`;
          
          await setDoc(doc(db, 'targets', targetId), targetData);

          successCount++;
        } catch (error) {
          console.error('Error processing row:', row, error);
          errorCount++;
        }
      }

      setMessage(`✅ Upload completed! Success: ${successCount}, Errors: ${errorCount}`);
      await loadTargets();
    } catch (error) {
      console.error('Error uploading file:', error);
      setMessage('❌ Error uploading file: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const getTargetsForCurrentView = () => {
    if (profile?.role === 'STAFF') {
      return targets.filter(t => t.staffId === profile.email);
    } else if (profile?.role === 'MANAGER') {
      const managerStoreIds = Object.keys(profile.stores || {}).filter(key => profile.stores[key] === true);
      return targets.filter(t => managerStoreIds.includes(t.storeId));
    } else {
      return targets; // ADMIN/OWNER sees all
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  // Helper functions for yesterday's performance
  const getYesterdayTarget = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    
    return getTargetsForCurrentView()
      .filter(target => target.date === yesterdayStr)
      .reduce((sum, target) => sum + (target.targetAmount || 0), 0);
  };

  const getYesterdaySales = () => {
    return yesterdaySales;
  };

  const getYesterdayAchievement = () => {
    const target = getYesterdayTarget();
    const sales = getYesterdaySales();
    return target > 0 ? Math.round((sales / target) * 100) : 0;
  };

  if (!profile) return <div className="p-6">Loading...</div>;
  if (!['ADMIN', 'OWNER', 'MANAGER'].includes(profile.role)) {
    return <div className="p-6">Access denied. Only managers and above can manage targets.</div>;
  }

  return (
    <div className="p-6 space-y-6">
             <div className="flex justify-between items-center">
         <h1 className="text-2xl font-bold">Target Management</h1>
         <div className="text-sm text-gray-600">
           {profile.role === 'MANAGER' ? 'Your Store & Staff Targets' : 
            profile.role === 'STAFF' ? 'Your Targets' : 'All Targets'}
         </div>
       </div>

      {/* Month Selection */}
      <div className="bg-white rounded shadow p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-gray-600">
            {new Date(selectedMonth).toLocaleDateString('en-IN', { 
              year: 'numeric', 
              month: 'long' 
            })}
          </div>
        </div>
      </div>

             {/* Excel Upload Section */}
       <div className="bg-white rounded shadow p-6">
         <h2 className="text-lg font-semibold mb-4">📊 Day-wise Target Management</h2>
         
                   <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">📋 Instructions</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>Day-wise Targets:</strong> Set daily targets for each store and staff member</li>
              <li>• <strong>Store Targets:</strong> Leave Staff ID and Staff Name empty for store-level targets</li>
              <li>• <strong>Staff Targets:</strong> Fill Staff ID (email) and Staff Name for individual targets</li>
              <li>• <strong>Auto-calculation:</strong> If Target Amount is 0, system calculates +10% from last year</li>
              <li>• <strong>Demo Data:</strong> Template includes sample data with real store and staff names</li>
              {profile.role === 'MANAGER' && (
                <li>• <strong>Manager Access:</strong> You can only manage targets for your assigned stores and staff</li>
              )}
            </ul>
          </div>
         
         <div className="grid md:grid-cols-2 gap-6">
           <div>
             <h3 className="font-medium mb-2">Download Demo Template</h3>
             <button
               onClick={generateExcelTemplate}
               className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
             >
               📥 Download Demo Excel Template
             </button>
                           <p className="text-sm text-gray-600 mt-2">
                Template includes day-wise targets for all days of the month with demo data
                {profile.role === 'MANAGER' && (
                  <span className="block mt-1 text-blue-600">
                    📋 Only your assigned stores and staff will be included
                  </span>
                )}
              </p>
           </div>

           <div>
             <h3 className="font-medium mb-2">Upload Targets</h3>
             <input
               type="file"
               accept=".xlsx,.xls"
               onChange={handleFileUpload}
               disabled={uploading}
               className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
             />
             <p className="text-sm text-gray-600 mt-2">
               Upload filled template to set day-wise targets
             </p>
           </div>
         </div>

        {message && (
          <div className={`mt-4 p-3 rounded-lg ${
            message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}

        {uploading && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading targets...
            </div>
          </div>
        )}
      </div>

             {/* Yesterday's Performance Summary */}
       <div className="bg-white rounded shadow p-6 mb-6">
         <h2 className="text-lg font-semibold mb-4">📊 Yesterday's Performance Summary</h2>
         <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="bg-blue-50 p-4 rounded-lg">
             <div className="text-2xl font-bold text-blue-600">
               {formatCurrency(getYesterdayTarget())}
             </div>
             <div className="text-sm text-blue-700">Yesterday's Target</div>
           </div>
           <div className="bg-green-50 p-4 rounded-lg">
             <div className="text-2xl font-bold text-green-600">
               {formatCurrency(getYesterdaySales())}
             </div>
             <div className="text-sm text-green-700">Yesterday's Sales</div>
           </div>
           <div className="bg-purple-50 p-4 rounded-lg">
             <div className="text-2xl font-bold text-purple-600">
               {getYesterdayAchievement()}%
             </div>
             <div className="text-sm text-purple-700">Achievement</div>
           </div>
           <div className="bg-orange-50 p-4 rounded-lg">
             <div className="text-2xl font-bold text-orange-600">
               {formatCurrency(Math.abs(getYesterdaySales() - getYesterdayTarget()))}
             </div>
             <div className="text-sm text-orange-700">
               {getYesterdaySales() >= getYesterdayTarget() ? 'Surplus' : 'Shortfall'}
             </div>
           </div>
         </div>
       </div>

       {/* Targets Display */}
       <div className="bg-white rounded shadow">
         <div className="p-4 border-b">
           <h2 className="text-lg font-semibold">Current Targets</h2>
           <p className="text-sm text-gray-600">
             {getTargetsForCurrentView().length} targets found for {selectedMonth}
           </p>
         </div>

        {loading ? (
          <div className="p-6 text-center">Loading targets...</div>
        ) : getTargetsForCurrentView().length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
                             <thead className="bg-gray-50">
                 <tr>
                   <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Store</th>
                   <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Staff</th>
                   <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                   <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Target Amount</th>
                   <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Target Type</th>
                   <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Notes</th>
                   <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Created By</th>
                 </tr>
               </thead>
              <tbody className="divide-y divide-gray-200">
                                 {getTargetsForCurrentView().map((target) => (
                   <tr key={target.id} className="hover:bg-gray-50">
                     <td className="px-4 py-3 text-sm text-gray-900">{target.storeName}</td>
                     <td className="px-4 py-3 text-sm text-gray-900">
                       {target.staffName || 'Store Target'}
                     </td>
                     <td className="px-4 py-3 text-sm text-gray-900">
                       {target.date ? new Date(target.date).toLocaleDateString('en-IN') : 'Monthly'}
                     </td>
                     <td className="px-4 py-3 text-sm font-medium text-green-600">
                       {formatCurrency(target.targetAmount)}
                     </td>
                     <td className="px-4 py-3 text-sm text-gray-900">
                       <span className={`px-2 py-1 rounded-full text-xs ${
                         target.targetType === 'Store Target' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                       }`}>
                         {target.targetType}
                       </span>
                     </td>
                     <td className="px-4 py-3 text-sm text-gray-900">{target.notes}</td>
                     <td className="px-4 py-3 text-sm text-gray-900">{target.createdBy}</td>
                   </tr>
                 ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            No targets found for {selectedMonth}. Upload targets using the Excel template above.
          </div>
        )}
      </div>
    </div>
  );
}
