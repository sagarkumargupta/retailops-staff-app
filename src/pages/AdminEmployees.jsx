import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function AdminEmployees() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'SALESMAN',
    salary: '',
    leaveDays: '',
    lunchAllowance: '',
    extraSundayAllowance: '',
    previousAdvance: ''
  });
  const [employees, setEmployees] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      loadEmployees();
    }
  }, [selectedStore]);

  const loadStores = async () => {
    const storesSnap = await getDocs(collection(db, 'stores'));
    setStores(storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const loadEmployees = async () => {
    if (!selectedStore) return;
    const employeesSnap = await getDocs(collection(db, 'stores', selectedStore, 'staff'));
    setEmployees(employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const onChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const reset = () => {
    setForm({
      name: '',
      phone: '',
      email: '',
      role: 'SALESMAN',
      salary: '',
      leaveDays: '',
      lunchAllowance: '',
      extraSundayAllowance: '',
      previousAdvance: ''
    });
    setEditingId(null);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!selectedStore) {
      alert('Please select a store first');
      return;
    }

    const payload = {
      ...form,
      salary: Number(form.salary) || 0,
      leaveDays: Number(form.leaveDays) || 0,
      lunchAllowance: Number(form.lunchAllowance) || 0,
      extraSundayAllowance: Number(form.extraSundayAllowance) || 0,
      previousAdvance: Number(form.previousAdvance) || 0,
      createdAt: new Date()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'stores', selectedStore, 'staff', editingId), payload);
      } else {
        await addDoc(collection(db, 'stores', selectedStore, 'staff'), payload);
      }
      reset();
      loadEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Error saving employee');
    }
  };

  const editRow = (employee) => {
    setForm({
      name: employee.name || '',
      phone: employee.phone || '',
      email: employee.email || '',
      role: employee.role || 'SALESMAN',
      salary: employee.salary?.toString() || '',
      leaveDays: employee.leaveDays?.toString() || '',
      lunchAllowance: employee.lunchAllowance?.toString() || '',
      extraSundayAllowance: employee.extraSundayAllowance?.toString() || '',
      previousAdvance: employee.previousAdvance?.toString() || ''
    });
    setEditingId(employee.id);
  };

  const deleteRow = async (id) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      try {
        await deleteDoc(doc(db, 'stores', selectedStore, 'staff', id));
        loadEmployees();
      } catch (error) {
        console.error('Error deleting employee:', error);
        alert('Error deleting employee');
      }
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Manage Employees</h1>
      
      <div className="mb-6">
        <select 
          value={selectedStore} 
          onChange={(e) => setSelectedStore(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">Select Store</option>
          {stores.map(store => (
            <option key={store.id} value={store.id}>
              {store.brand} — {store.name}
            </option>
          ))}
        </select>
      </div>

      {selectedStore && (
        <>
          <form onSubmit={save} className="mb-8 p-4 border rounded">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <input name="name" value={form.name} onChange={onChange} placeholder="Name" className="p-2 border rounded" required />
              <input name="phone" value={form.phone} onChange={onChange} placeholder="Phone" className="p-2 border rounded" required />
              <input name="email" value={form.email} onChange={onChange} placeholder="Email" className="p-2 border rounded" required />
              <select name="role" value={form.role} onChange={onChange} className="p-2 border rounded">
                <option value="SALESMAN">Salesman</option>
                <option value="CASHIER">Cashier</option>
                <option value="TAILOR">Tailor</option>
                <option value="GUARD">Guard</option>
              </select>
              <input name="salary" value={form.salary} onChange={onChange} placeholder="Salary (₹)" className="p-2 border rounded" />
              <input name="leaveDays" value={form.leaveDays} onChange={onChange} placeholder="Leave Days" className="p-2 border rounded" />
              <input name="lunchAllowance" value={form.lunchAllowance} onChange={onChange} placeholder="Lunch (₹/day)" className="p-2 border rounded" />
              <input name="extraSundayAllowance" value={form.extraSundayAllowance} onChange={onChange} placeholder="Extra Sunday (₹/day)" className="p-2 border rounded" />
              <input name="previousAdvance" value={form.previousAdvance} onChange={onChange} placeholder="Previous Advance (₹)" className="p-2 border rounded" />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
                {editingId ? 'Update' : 'Add'} Employee
              </button>
              <button type="button" onClick={reset} className="px-4 py-2 bg-gray-600 text-white rounded">
                Reset
              </button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left border">Name</th>
                  <th className="p-2 text-left border">Phone</th>
                  <th className="p-2 text-left border">Email</th>
                  <th className="p-2 text-left border">Role</th>
                  <th className="p-2 text-left border">Salary (₹)</th>
                  <th className="p-2 text-left border">Leaves</th>
                  <th className="p-2 text-left border">Lunch (₹)</th>
                  <th className="p-2 text-left border">Sun (₹)</th>
                  <th className="p-2 text-left border">Advance (₹)</th>
                  <th className="p-2 text-left border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((m) => (
                  <tr key={m.id}>
                    <td className="p-2 border">{m.name}</td>
                    <td className="p-2 border">{m.phone}</td>
                    <td className="p-2 border">{m.email}</td>
                    <td className="p-2 border">{m.role}</td>
                    <td className="p-2 border">{typeof m.salary==='number'? m.salary : '-'}</td>
                    <td className="p-2 border">{typeof m.leaveDays==='number'? m.leaveDays : '-'}</td>
                    <td className="p-2 border">{typeof m.lunchAllowance==='number'? m.lunchAllowance : '-'}</td>
                    <td className="p-2 border">{typeof m.extraSundayAllowance==='number'? m.extraSundayAllowance : '-'}</td>
                    <td className="p-2 border">{typeof m.previousAdvance==='number'? m.previousAdvance : '-'}</td>
                    <td className="p-2 border">
                      <button onClick={() => editRow(m)} className="px-2 py-1 bg-blue-500 text-white rounded mr-1">Edit</button>
                      <button onClick={() => deleteRow(m.id)} className="px-2 py-1 bg-red-500 text-white rounded">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
