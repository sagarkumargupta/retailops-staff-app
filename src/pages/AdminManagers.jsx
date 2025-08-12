import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';

export default function AdminManagers() {
  const [stores, setStores] = useState([]);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    const ss = await getDocs(collection(db, 'stores'));
    setStores(ss.docs.map((d) => ({ id: d.id, ...d.data() })));
    const ii = await getDocs(collection(db, 'invites'));
    setInvites(ii.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    loadData();
  }, []);

  const onToggleStore = (id) => {
    setSelectedStoreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const storeIdToLabel = useMemo(
    () => Object.fromEntries(stores.map((s) => [s.id, `${s.brand || ''} — ${s.name || ''}`])),
    [stores]
  );

  const createInvite = async (e) => {
    e.preventDefault();
    setMsg('');
    if (!email) {
      setMsg('Enter email');
      return;
    }
    if (selectedStoreIds.length === 0) {
      setMsg('Select at least one store');
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, 'invites'), {
        email: String(email).toLowerCase().trim(),
        role: 'MANAGER',
        storeIds: selectedStoreIds,
        createdAt: serverTimestamp(),
      });
      setEmail('');
      setSelectedStoreIds([]);
      setMsg('✅ Invite created. When the user signs up/logs in with this email, they will be promoted to MANAGER and assigned stores.');
      loadData();
    } catch (err) {
      console.error(err);
      setMsg('❌ Failed: ' + (err.code || err.message));
    } finally {
      setBusy(false);
    }
  };

  const removeInvite = async (id) => {
    if (!confirm('Delete this invite?')) return;
    await deleteDoc(doc(db, 'invites', id));
    loadData();
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4">Admin → Managers (Invites)</h2>

      <form onSubmit={createInvite} className="bg-white rounded shadow p-4 mb-6">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-sm mb-1">Manager Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@example.com"
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Assign Stores</label>
            <div className="grid md:grid-cols-2 gap-2 max-h-48 overflow-auto p-2 border rounded">
              {stores.map((s) => (
                <label key={s.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedStoreIds.includes(s.id)}
                    onChange={() => onToggleStore(s.id)}
                  />
                  <span>{s.brand} — {s.name}</span>
                </label>
              ))}
              {stores.length === 0 && (
                <div className="text-sm text-gray-500">No stores found. Add stores first.</div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <button disabled={busy} className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-60">
            {busy ? 'Creating…' : 'Create Invite'}
          </button>
        </div>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </form>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Assigned Stores</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 && (
              <tr>
                <td colSpan={3} className="p-3 text-center text-gray-500">No pending invites</td>
              </tr>
            )}
            {invites.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-2">{i.email}</td>
                <td className="p-2">
                  {(i.storeIds || []).map((sid) => (
                    <span key={sid} className="inline-block mr-2 mb-1 px-2 py-0.5 rounded border">
                      {storeIdToLabel[sid] || sid}
                    </span>
                  ))}
                </td>
                <td className="p-2">
                  <button onClick={() => removeInvite(i.id)} className="px-3 py-1 rounded bg-red-600 text-white">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


