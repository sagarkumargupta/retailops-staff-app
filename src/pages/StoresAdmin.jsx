// src/pages/StoresAdmin.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';

const DEFAULT_STORES = [
  { brand: 'Mufti', name: 'Mufti Bettiah', city: 'Bettiah' },
  { brand: 'Mufti', name: 'Mufti Motihari', city: 'Motihari' },
  { brand: 'Mufti', name: 'Mufti Raxaul', city: 'Raxaul' },
];

export default function StoresAdmin() {
  const [stores, setStores] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ brand: '', name: '', city: '', address: '', storeCode: '' });
  const [msg, setMsg] = useState('');

  const load = async () => {
    const snap = await getDocs(collection(db, 'stores'));
    setStores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { load(); }, []);

  const onChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const reset = () => { setEditingId(null); setForm({ brand: '', name: '', city: '', address: '', storeCode: '' }); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await updateDoc(doc(db, 'stores', editingId), form);
      else await addDoc(collection(db, 'stores'), { ...form, createdAt: serverTimestamp() });
      setMsg('✅ Saved'); reset(); load();
    } catch (err) {
      console.error(err); setMsg('❌ Failed: ' + (err.code || err.message));
    }
  };

  const editRow = (row) => {
    setEditingId(row.id);
    setForm({
      brand: row.brand || '', name: row.name || '', city: row.city || '',
      address: row.address || '', storeCode: row.storeCode || ''
    });
  };

  const remove = async (id) => {
    if (!confirm('Delete store?')) return;
    await deleteDoc(doc(db, 'stores', id));
    load();
  };

  const importDefaults = async () => {
    let added = 0;
    for (const s of DEFAULT_STORES) {
      if (stores.some(x => (x.name || '').toLowerCase() === s.name.toLowerCase())) continue;
      await addDoc(collection(db, 'stores'), { ...s, createdAt: serverTimestamp() });
      added++;
    }
    setMsg(added ? `Added ${added}` : 'Already added');
    load();
  };

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-semibold">My Stores</h2>
        <button onClick={importDefaults} className="px-3 py-2 rounded bg-slate-800 text-white">
          Add Default Stores
        </button>
      </div>

      <form onSubmit={save} className="grid md:grid-cols-3 gap-3 bg-white rounded shadow p-4 mb-6">
        <input name="brand" value={form.brand} onChange={onChange} placeholder="Brand" className="p-2 border rounded" />
        <input name="name" value={form.name} onChange={onChange} placeholder="Store Name" className="p-2 border rounded" />
        <input name="city" value={form.city} onChange={onChange} placeholder="City" className="p-2 border rounded" />
        <input name="address" value={form.address} onChange={onChange} placeholder="Address" className="p-2 border rounded md:col-span-2" />
        <input name="storeCode" value={form.storeCode} onChange={onChange} placeholder="Store Code" className="p-2 border rounded" />
        <div className="md:col-span-3 flex gap-2">
          <button className="bg-green-600 text-white px-4 py-2 rounded">{editingId ? 'Update' : 'Add Store'}</button>
          {editingId && <button type="button" onClick={reset} className="px-4 py-2 rounded border">Cancel</button>}
        </div>
      </form>

      {msg && <p className="mb-4">{msg}</p>}

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Brand</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">City</th>
              <th className="p-2 text-left">Code</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stores.length === 0 && (
              <tr><td colSpan={5} className="p-3 text-center text-gray-500">No stores yet</td></tr>
            )}
            {stores.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-2">{s.brand}</td>
                <td className="p-2">{s.name}</td>
                <td className="p-2">{s.city}</td>
                <td className="p-2">{s.storeCode || '-'}</td>
                <td className="p-2">
                  <button onClick={() => editRow(s)} className="px-3 py-1 rounded border mr-2">Edit</button>
                  <button onClick={() => remove(s.id)} className="px-3 py-1 rounded bg-red-600 text-white">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
