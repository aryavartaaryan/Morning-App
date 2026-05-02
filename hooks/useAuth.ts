import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { store, KEYS } from '@/lib/storage';
import { googleSignOut } from '@/lib/googleAuth';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  prakriti?: string;
  createdAt?: number;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile(data);
          await store.setJSON(KEYS.auth, data);
          // Keep KEYS.dosha in sync so AuthGuard has prakriti on reinstall
          if (data.prakriti) {
            const existing = await store.getJSON<{ prakritiAssessment?: { prakriti?: { primary?: string } } }>(KEYS.dosha);
            if (!existing?.prakritiAssessment?.prakriti?.primary) {
              await store.setJSON(KEYS.dosha, {
                prakritiAssessment: { prakriti: { primary: data.prakriti } },
              });
            }
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userRef = doc(db, 'users', cred.user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      await store.setJSON(KEYS.auth, data);
      // Ensure prakriti is in KEYS.dosha so AuthGuard routes correctly after reinstall
      if (data.prakriti) {
        await store.setJSON(KEYS.dosha, {
          prakritiAssessment: { prakriti: { primary: data.prakriti } },
        });
      }
    } else {
      const fallback = {
        uid: cred.user.uid,
        name: cred.user.displayName || email.split('@')[0],
        email,
        createdAt: serverTimestamp(),
      };
      await setDoc(userRef, fallback);
      await store.setJSON(KEYS.auth, { ...fallback, createdAt: Date.now() });
    }
    return cred.user;
  };

  const signUp = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const profile: UserProfile = {
      uid: cred.user.uid,
      name,
      email,
      createdAt: Date.now(),
    };
    await setDoc(doc(db, 'users', cred.user.uid), { ...profile, createdAt: serverTimestamp() });
    await store.setJSON(KEYS.auth, profile);
    return cred.user;
  };

  const signOut = async () => {
    // googleSignOut handles both Firebase signOut and Google token revocation.
    // Works correctly for email/password users too (just calls Firebase signOut).
    await googleSignOut();
    setProfile(null);
  };

  return { user, profile, loading, signIn, signUp, signOut, googleSignOut };
}

// Re-export for direct import by screens that only need sign-out
export { googleSignOut } from '@/lib/googleAuth';
