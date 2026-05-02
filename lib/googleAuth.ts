/**
 * Google OAuth authentication using expo-auth-session + Firebase JS SDK v12.
 *
 * ──────────────────────────────────────────────────────────────────────
 * SETUP REQUIRED (one-time — Google Cloud Console + Firebase):
 * ──────────────────────────────────────────────────────────────────────
 * 1. Firebase Console → Authentication → Sign-in method → Enable Google
 * 2. console.cloud.google.com → APIs & Services → Credentials
 *    Create THREE separate OAuth 2.0 Client IDs:
 *      a) Web application type   → paste below as GOOGLE_WEB_CLIENT_ID
 *      b) Android type           → package: com.onesutra.app
 *                                  SHA-1: cd android && ./gradlew signingReport
 *                                  → paste below as GOOGLE_ANDROID_CLIENT_ID
 *      c) iOS type               → bundle: com.onesutra.app
 *                                  → paste below as GOOGLE_IOS_CLIENT_ID
 * 3. Re-download google-services.json after adding SHA-1 → android/app/
 * 4. Rebuild: npx expo run:android (or run:ios)
 * ──────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
    GoogleAuthProvider,
    signInWithCredential,
    signOut as firebaseSignOut,
    getAdditionalUserInfo,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '@/lib/firebase';
import { store, KEYS } from '@/lib/storage';

// ── OAuth Client IDs ─────────────────────────────────────────────────────────
// Replace each placeholder with the real value from Google Cloud Console.
// All three end in .apps.googleusercontent.com

/** Web application type — drives the Firebase token exchange on all platforms */
export const GOOGLE_WEB_CLIENT_ID =
    '475392538883-pjdnncu9pt6bd41qvetn4ehmg60d1jus.apps.googleusercontent.com';

/** Android type — must include com.onesutra.app package + correct SHA-1 */
export const GOOGLE_ANDROID_CLIENT_ID =
    '475392538883-6ja9mvphv6lhgpk7f4cdebrbar1ru601.apps.googleusercontent.com';

/** iOS type — must use bundle ID com.onesutra.app */
export const GOOGLE_IOS_CLIENT_ID =
    'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';

// Dismisses the OAuth browser tab on Android after the redirect completes
WebBrowser.maybeCompleteAuthSession();

// ── Types ────────────────────────────────────────────────────────────────────

export interface GoogleSignInResult {
    success: true;
    user: {
        uid: string;
        email: string | null;
        displayName: string | null;
        photoURL: string | null;
    };
    isNewUser: boolean;
}

export interface GoogleSignInError {
    success: false;
    error: 'cancelled' | 'in_progress' | 'network_error' | 'unknown';
    message: string;
}

export type GoogleAuthResult = GoogleSignInResult | GoogleSignInError;

// ── Save / update user document in Firestore ─────────────────────────────────

export const saveUserToDatabase = async (
    user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null },
    isNewUser: boolean,
) => {
    const userRef = doc(db, 'users', user.uid);

    if (isNewUser) {
        await setDoc(
            userRef,
            {
                uid: user.uid,
                email: user.email ?? '',
                name: user.displayName ?? '',
                photoURL: user.photoURL ?? '',
                provider: 'google',
                createdAt: serverTimestamp(),
                onboardingComplete: false,
                location: null,
                prakriti: null,
                timezone: null,
                brahma_muhurta: null,
            },
            { merge: false },
        );
    } else {
        await setDoc(
            userRef,
            { lastLoginAt: serverTimestamp() },
            { merge: true },
        );
    }
};

// ── Sign-out — clears Firebase session + all local user data ─────────────────

export const googleSignOut = async (): Promise<{ success: boolean; message?: string }> => {
    try {
        await firebaseSignOut(auth);
        await AsyncStorage.removeItem('google_id_token');
        await Promise.all([
            store.remove(KEYS.auth),
            store.remove(KEYS.dosha),
            store.remove(KEYS.pledge),
            store.remove(KEYS.location),
            store.remove(KEYS.welcomeSeen),
            store.remove(KEYS.alarmSettings),
            store.remove(KEYS.prakritiAnswers),
        ]);
        return { success: true };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Sign-out failed';
        return { success: false, message: msg };
    }
};

// ── Hook: useGoogleAuth ───────────────────────────────────────────────────────
//
// Usage inside a React component:
//
//   const { promptAsync, loading } = useGoogleAuth({
//     onResult: (result) => {
//       if (result.success) {
//         result.isNewUser
//           ? router.replace('/(auth)/onboarding')
//           : router.replace('/(tabs)');
//       }
//     },
//   });
//
//   <TouchableOpacity onPress={promptAsync} disabled={loading}>…</TouchableOpacity>
// ─────────────────────────────────────────────────────────────────────────────

interface UseGoogleAuthOptions {
    onResult: (result: GoogleAuthResult) => void;
}

export function useGoogleAuth({ onResult }: UseGoogleAuthOptions) {
    // Tracks whether the OAuth flow is actively in progress.
    // Using useState (not derived from request/response) so the button is only
    // disabled AFTER the user taps it — not on initial render when request is prepared.
    const [pending, setPending] = useState(false);

    // Keep onResult in a ref so the useEffect below never captures a stale closure
    const onResultRef = useRef(onResult);
    useEffect(() => { onResultRef.current = onResult; }, [onResult]);

    const [, response, nativePromptAsync] = Google.useAuthRequest({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        androidClientId: GOOGLE_ANDROID_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID,
    });

    // Public promptAsync — guards against double-taps and manages the loading flag
    const promptAsync = async () => {
        if (pending) return;
        setPending(true);
        try {
            await nativePromptAsync();
        } catch {
            // nativePromptAsync itself threw (very rare) — reset loading
            setPending(false);
        }
    };

    useEffect(() => {
        if (!response) return;
        setPending(false);

        if (response.type === 'cancel' || response.type === 'dismiss') {
            onResultRef.current({ success: false, error: 'cancelled', message: 'Sign in was cancelled' });
            return;
        }

        if (response.type === 'error') {
            const errMsg = response.error?.message ?? 'Authentication error';
            if (errMsg.toLowerCase().includes('network')) {
                onResultRef.current({
                    success: false,
                    error: 'network_error',
                    message: 'No internet connection. Please check your connection and try again.',
                });
            } else {
                onResultRef.current({ success: false, error: 'unknown', message: errMsg });
            }
            return;
        }

        if (response.type !== 'success') return;

        (async () => {
            try {
                const { id_token, access_token } = response.params;

                if (!id_token && !access_token) {
                    onResultRef.current({
                        success: false,
                        error: 'unknown',
                        message: 'No token received from Google.',
                    });
                    return;
                }

                const credential = GoogleAuthProvider.credential(id_token ?? null, access_token ?? null);
                const result = await signInWithCredential(auth, credential);
                const firebaseUser = result.user;
                const additionalInfo = getAdditionalUserInfo(result);
                const isNewUser = additionalInfo?.isNewUser ?? false;

                await AsyncStorage.setItem(
                    'google_id_token',
                    JSON.stringify({ uid: firebaseUser.uid, ts: Date.now() }),
                );

                try {
                    await saveUserToDatabase(
                        {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName,
                            photoURL: firebaseUser.photoURL,
                        },
                        isNewUser,
                    );
                } catch (dbErr) {
                    console.warn('[GoogleAuth] Firestore save failed:', dbErr);
                }

                await store.setJSON(KEYS.auth, {
                    uid: firebaseUser.uid,
                    name: firebaseUser.displayName ?? '',
                    email: firebaseUser.email ?? '',
                    photoURL: firebaseUser.photoURL ?? '',
                });

                if (!isNewUser) {
                    try {
                        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
                        if (snap.exists()) {
                            const data = snap.data();
                            if (data?.prakriti) {
                                await store.setJSON(KEYS.dosha, {
                                    prakritiAssessment: { prakriti: { primary: data.prakriti } },
                                });
                            }
                        }
                    } catch {
                        // Offline — AuthGuard's Firestore fallback handles this
                    }
                }

                onResultRef.current({
                    success: true,
                    user: {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName,
                        photoURL: firebaseUser.photoURL,
                    },
                    isNewUser,
                });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Google sign-in failed';
                if (msg.includes('popup-closed') || msg.includes('cancelled')) {
                    onResultRef.current({ success: false, error: 'cancelled', message: msg });
                } else if (msg.toLowerCase().includes('network')) {
                    onResultRef.current({
                        success: false,
                        error: 'network_error',
                        message: 'No internet connection. Please check your connection and try again.',
                    });
                } else {
                    console.error('[GoogleAuth] signInWithCredential error:', err);
                    onResultRef.current({ success: false, error: 'unknown', message: msg });
                }
            }
        })();
    }, [response]);

    return { promptAsync, loading: pending };
}
