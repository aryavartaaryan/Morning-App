import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDopRnKjDoy724qfo71YDi7eRSvOkdDrVI',
  authDomain: 'pranav-samadhaan.firebaseapp.com',
  projectId: 'pranav-samadhaan',
  storageBucket: 'pranav-samadhaan.firebasestorage.app',
  messagingSenderId: '475392538883',
  appId: '1:475392538883:web:f611e48e6a7dc72e731136',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Use AsyncStorage persistence so the session survives app restarts (no auto-logout)
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
