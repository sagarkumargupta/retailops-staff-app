import React, { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, getDocs, query, where, doc, setDoc, getDoc } from 'firebase/firestore';
import useUserProfile from '../hooks/useUserProfile';

const ymdToday = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getCurrentTime = () => new Date().toTimeString().slice(0,5); // HH:MM format

export default function SelfAttendance() {
  const [user] = useAuthState(auth);
  const { profile } = useUserProfile();
  const [store, setStore] = useState(null);
  const [staff, setStaff] = useState(null);
  const [date, setDate] = useState(ymdToday());
  const [present, setPresent] = useState(true);
  const [checkIn, setCheckIn] = useState(getCurrentTime());
  const [dayType, setDayType] = useState('FULL');
  
  // Debug date initialization
  useEffect(() => {
    console.log('Date initialization:', {
      ymdToday: ymdToday(),
      currentDate: new Date().toISOString(),
      dateState: date
    });
  }, [date]);
  
  // Ensure date is always correct on component mount
  useEffect(() => {
    const correctDate = ymdToday();
    if (date !== correctDate) {
      console.log('Correcting date from', date, 'to', correctDate);
      setDate(correctDate);
    }
  }, []); // Empty dependency array - only run once on mount
  
  const [ySale, setYSale] = useState('');
  const [tTarget, setTTarget] = useState('');
  const [uniform, setUniform] = useState('YES');
  const [inShoe, setInShoe] = useState('YES');
  const [googleReviewsDone, setGoogleReviewsDone] = useState(0);
  const [losUpdatesDone, setLosUpdatesDone] = useState(0);
  const [quantity, setQuantity] = useState('');
  const [bills, setBills] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Simplified staff lookup using profile from useUserProfile hook
  useEffect(() => {
    (async () => {
      if (!user?.email || !profile) return;
      
      console.log('SelfAttendance: User profile found:', profile);
      
      // Check if user has a valid role for attendance
      if (!['STAFF', 'MANAGER'].includes(profile.role)) {
        console.log('SelfAttendance: User role not eligible for attendance:', profile.role);
        return;
      }
      
      // Check if user has an assigned store
      if (!profile.assignedStore) {
        console.log('SelfAttendance: User has no assigned store');
        return;
      }
      
      try {
        // Get store information
        const storeDoc = await getDoc(doc(db, 'stores', profile.assignedStore));
        if (storeDoc.exists()) {
          const storeData = storeDoc.data();
          setStore({ id: profile.assignedStore, ...storeData });
          
          // Set staff information from profile
          setStaff({
            id: user.email.toLowerCase(),
            name: profile.name || user.email?.split('@')[0] || 'User',
            email: user.email.toLowerCase(),
            role: profile.role,
            storeId: profile.assignedStore,
            ...profile
          });
          
          console.log('SelfAttendance: Staff/Manager setup complete:', {
            name: profile.name,
            role: profile.role,
            store: storeData.name,
            storeId: profile.assignedStore
          });
        } else {
          console.error('SelfAttendance: Store not found:', profile.assignedStore);
        }
      } catch (error) {
        console.error('SelfAttendance: Error setting up staff/manager:', error);
      }
    })();
  }, [user?.email, profile]);

  // Auto-update check-in time when present is toggled
  useEffect(() => {
    if (present) {
      setCheckIn(getCurrentTime());
    }
  }, [present]);

  useEffect(() => {
    if (!present) setDayType('FULL');
  }, [present]);



  const submit = async (e) => {
    e.preventDefault(); 
    setMsg('');
    if(!user) { setMsg('Login required'); return; }
    if(!staff?.id || !store?.id) { setMsg('Your profile is not linked. Contact your manager or admin.'); return; }
    
    // Validate date - can only submit for today
    const selectedDate = new Date(date + 'T00:00:00'); // Ensure we're comparing dates only
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // Get today's date only
    
    console.log('Date validation:', {
      selectedDate: selectedDate.toISOString(),
      todayDate: todayDate.toISOString(),
      selectedDateString: date,
      todayString: today.toISOString().slice(0, 10),
      ymdToday: ymdToday()
    });
    
    // More robust date comparison
    const selectedDateString = selectedDate.toISOString().slice(0, 10);
    const todayDateString = todayDate.toISOString().slice(0, 10);
    
    if (selectedDateString !== todayDateString) {
      console.log('Date mismatch detected:', {
        selectedDateString,
        todayDateString,
        selectedDate: selectedDate.toISOString(),
        todayDate: todayDate.toISOString()
      });
      
      // Auto-correct the date if it's wrong
      const correctDate = ymdToday();
      if (date !== correctDate) {
        console.log('Auto-correcting date from', date, 'to', correctDate);
        setDate(correctDate);
        setMsg('⚠️ Date was automatically corrected to today. Please try submitting again.');
        return;
      }
      
      setMsg('❌ Attendance can only be submitted for today. Please refresh the page if the date is incorrect.');
      return;
    }
    
    // Check if attendance already exists for this date
    const id = `${store.id}_${date}_${staff.id}`;
    const existingAttendance = await getDoc(doc(db, 'attendance', id));
    
    if (existingAttendance.exists()) {
      setMsg('❌ Attendance already submitted for this date. You cannot submit multiple times.');
      return;
    }
    
    // Force current time for check-in to prevent manipulation
    const currentTime = getCurrentTime();
    console.log('Setting check-in time to current time:', currentTime);
    
    setBusy(true);
    try{
      await setDoc(doc(db,'attendance', id), {
        storeId: store.id,
        date,
        staffId: staff.id,
        staffName: staff.name || '',
        staffEmail: user.email.toLowerCase(),
        staffRole: staff.role || 'STAFF',
        present,
        checkIn: currentTime, // Always use current time, ignore any user-modified value
        dayType: present ? dayType : 'FULL',
        dayFraction: present ? (dayType === 'HALF' ? 0.5 : 1) : 0,
        answers: {
          yesterdaySale: Number(ySale||0) || 0,
          todayTarget: Number(tTarget||0) || 0,
          uniform,
          inShoe,
          googleReviewsDone: Number(googleReviewsDone||0) || 0,
          losUpdatesDone: Number(losUpdatesDone||0) || 0,
          quantity: Number(quantity||0) || 0,
          bills: Number(bills||0) || 0,
        },
        submittedAt: new Date(),
      });
      setMsg('✅ Attendance submitted successfully');
    }catch(e){ 
      setMsg('❌ Failed: ' + (e.code||e.message)); 
    }
    finally{ 
      setBusy(false); 
    }
  };



  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4">My Attendance</h2>
      
      {!user && <p>Please login first.</p>}
      {user && !staff && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-2">Profile Access Issue</p>
              <p className="mb-2">We could not find your profile or you don't have permission to access attendance. This might be due to:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Your profile not being properly created in the system</li>
                <li>You don't have STAFF or MANAGER role</li>
                <li>You don't have an assigned store</li>
                <li>Permission issues with your account</li>
              </ul>
              <p className="mt-2 text-xs">
                <strong>Solution:</strong> Contact your manager or admin to ensure your profile is properly set up with STAFF/MANAGER role and assigned store.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {user && staff && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Store:</strong> {store?.brand} — {store?.name}
            </p>
            <p className="text-sm text-blue-600">
              <strong>Role:</strong> {staff?.role === 'MANAGER' ? 'Store Manager' : 'Staff Member'} — {staff?.name} ({staff?.email})
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-green-800 mb-2">Attendance System</h3>
            <p className="text-green-700 text-sm">
              • Attendance can only be submitted for today's date<br/>
              • Check-in time is automatically set to current system time<br/>
              • Check-out time is not required<br/>
              • <strong>Yesterday's Sales:</strong> Enter your sales from yesterday (not today)<br/>
              • <strong>Today's Target:</strong> Enter your target for today<br/>
              • <strong>Quantity Sold:</strong> Number of items you sold yesterday<br/>
              • <strong>Number of Bills:</strong> Total bills you generated yesterday<br/>
              • Google Reviews and LOS Updates should be entered as numerical counts<br/>
              • Attendance can be submitted without photo (photo feature will be added later)
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <input 
                  type="date" 
                  value={date} 
                  readOnly
                  className="w-full p-3 border rounded-lg peer bg-gray-50 cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Today's Date (Auto-set)</label>
              </div>
              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={present} onChange={e=>setPresent(e.target.checked)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                  <span className="text-sm font-medium">Present Today</span>
                </label>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <input 
                  type="time" 
                  value={checkIn} 
                  readOnly 
                  disabled
                  className="w-full p-3 border rounded-lg peer bg-gray-50 cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Check-in Time (Auto-set, cannot change)</label>
              </div>
              <div className="relative">
                <select 
                  value={dayType} 
                  onChange={e=>setDayType(e.target.value)} 
                  disabled={!present} 
                  className={`w-full p-3 border rounded-lg peer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!present ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}`}
                >
                  <option value="FULL">Full Day</option>
                  <option value="HALF">Half Day</option>
                </select>
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Day Type</label>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <input type="number" value={ySale} onChange={e=>setYSale(e.target.value)} className="w-full p-3 border rounded-lg peer bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder=" " />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Yesterday Sale (₹)</label>
              </div>
              <div className="relative">
                <input type="number" value={tTarget} onChange={e=>setTTarget(e.target.value)} className="w-full p-3 border rounded-lg peer bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder=" " />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Today Target (₹)</label>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <select value={uniform} onChange={e=>setUniform(e.target.value)} className="w-full p-3 border rounded-lg peer bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="YES">YES - Wearing Uniform</option>
                  <option value="NO">NO - Not Wearing Uniform</option>
                </select>
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Uniform Status</label>
              </div>
              <div className="relative">
                <select value={inShoe} onChange={e=>setInShoe(e.target.value)} className="w-full p-3 border rounded-lg peer bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="YES">YES - Wearing Shoes</option>
                  <option value="NO">NO - Not Wearing Shoes</option>
                </select>
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Shoe Status</label>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <input 
                  type="number" 
                  value={googleReviewsDone} 
                  onChange={e=>setGoogleReviewsDone(e.target.value)} 
                  min="0"
                  className="w-full p-3 border rounded-lg peer bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder=" " 
                />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Google Reviews Done Yesterday</label>
              </div>
              <div className="relative">
                <input 
                  type="number" 
                  value={losUpdatesDone} 
                  onChange={e=>setLosUpdatesDone(e.target.value)} 
                  min="0"
                  className="w-full p-3 border rounded-lg peer bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder=" " 
                />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">LOS Updates Done Yesterday</label>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={e=>setQuantity(e.target.value)} 
                  min="0"
                  className="w-full p-3 border rounded-lg peer bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder=" " 
                />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Quantity Sold Yesterday</label>
              </div>
              <div className="relative">
                <input 
                  type="number" 
                  value={bills} 
                  onChange={e=>setBills(e.target.value)} 
                  min="0"
                  className="w-full p-3 border rounded-lg peer bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder=" " 
                />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Number of Bills Yesterday</label>
              </div>
            </div>



            <div className="flex gap-3 items-center pt-4">
              <button disabled={busy} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed font-medium transition-colors">
                {busy ? 'Submitting…' : 'Submit Attendance'}
              </button>
              {msg && (
                <div className={`text-sm px-3 py-2 rounded ${
                  msg.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {msg}
                </div>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}


