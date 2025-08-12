import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';

export default function useUserProfile() {
  const [user] = useAuthState(auth);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(!!user);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) { setProfile(null); setLoading(false); return; }
      setLoading(true);

      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);

      // consume invite by email
      let inviteData = null;
      if (user.email) {
        const invQ = query(collection(db, 'invites'), where('email', '==', user.email.toLowerCase()));
        const invSnap = await getDocs(invQ);
        if (!invSnap.empty) {
          const iDoc = invSnap.docs[0];
          inviteData = { id: iDoc.id, ...iDoc.data() };
        }
      }

      const base = { email: user.email || '', displayName: user.email?.split('@')[0] || 'User', role: 'SALESMAN', stores: [] };
      let next = base;
      if (snap.exists()) next = { ...base, ...snap.data() };
      if (inviteData) { next.role = inviteData.role || 'MANAGER'; next.stores = inviteData.storeIds || []; }

      await setDoc(userRef, next, { merge: true });
      if (inviteData?.id) await deleteDoc(doc(db, 'invites', inviteData.id));

      if (!cancelled) { setProfile(next); setLoading(false); }
    };
    run();
    return () => { cancelled = true; };
  }, [user]);

  return { user, profile, loading };
}