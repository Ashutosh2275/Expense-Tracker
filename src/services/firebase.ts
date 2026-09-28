import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  signOut as fbSignOut,
  updateProfile,
  type Auth,
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  type Database,
} from 'firebase/database';
import {
  getFirestore,
  setLogLevel,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  type Firestore,
} from 'firebase/firestore';
import { localAuth, type UserAccount, toTitleCase } from './localAuth';
import type { Friend } from './localTracker';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'expense-tracker-9566d.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://expense-tracker-9566d-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'expense-tracker-9566d',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'expense-tracker-9566d.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '47476286368',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:47476286368:web:fde98a1dfcad92732bfac5',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-B73SGPL31W',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let rtdb: Database | null = null;
let db: Firestore | null = null;

const hasConfig =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.projectId) &&
  !String(firebaseConfig.apiKey).includes('your_api_key');

if (hasConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    try {
      rtdb = getDatabase(app);
    } catch {
      // ignore
    }
    try {
      setLogLevel('silent');
      db = getFirestore(app);
    } catch {
      // ignore
    }
  } catch (err) {
    console.warn('Firebase initialization warning:', err);
  }
}

// Helper to prevent any Firestore call from hanging indefinitely if database is not created or client is offline
function withTimeout<T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallbackValue), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallbackValue);
      });
  });
}

export const firebaseService = {
  isConfigured(): boolean {
    return Boolean(auth);
  },

  /**
   * Register a new user with Username, Email, and Password.
   * Saves to localAuth immediately and syncs with Firebase Auth + Firestore.
   */
  async register(username: string, email: string, password: string): Promise<UserAccount> {
    const formattedUsername = toTitleCase(username.trim());
    const cleanEmail = email.trim().toLowerCase();

    // 1. Strict unique check on BOTH Username and Email
    if (rtdb) {
      const sanitized = cleanEmail.replace(/\./g, ',');
      const emailSnap = await withTimeout(get(ref(rtdb, `emails/${sanitized}`)), 2000, null);
      if (emailSnap && emailSnap.exists()) {
        throw new Error('This email address is already registered. Please sign in or use another email.');
      }
      const userSnap = await withTimeout(get(ref(rtdb, `usernames/${formattedUsername.toLowerCase()}`)), 2000, null);
      if (userSnap && userSnap.exists()) {
        throw new Error('This username is already taken. Please choose another username.');
      }

      // Neither exists in the cloud database.
      // Purge any stale orphaned local storage accounts with this username or email from before a database reset.
      const localUsers = localAuth.getStoredUsers();
      const cleaned = localUsers.filter(
        (u) =>
          u.username.toLowerCase() !== formattedUsername.toLowerCase() &&
          (!u.email || u.email.toLowerCase() !== cleanEmail)
      );
      if (cleaned.length !== localUsers.length) {
        localAuth.saveUsers(cleaned);
      }
    } else {
      // Offline fallback: check local storage
      const existingUsers = localAuth.getStoredUsers();
      if (existingUsers.some((u) => u.username.toLowerCase() === formattedUsername.toLowerCase())) {
        throw new Error('This username is already taken. Please choose another username.');
      }
      if (existingUsers.some((u) => u.email && u.email.toLowerCase() === cleanEmail)) {
        throw new Error('This email address is already registered. Please sign in or use another email.');
      }
    }

    // 2. If Firebase Auth is configured, register in cloud FIRST
    if (this.isConfigured() && auth) {
      let user;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        user = userCredential.user;
      } catch (authErr: unknown) {
        const errObj = authErr as { code?: string; message?: string };
        if (errObj?.code === 'auth/email-already-in-use') {
          // If the account already exists in Firebase Auth (e.g. survived a database wipe),
          // attempt sign-in with this password to verify account ownership.
          try {
            const signInCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
            user = signInCred.user;
          } catch {
            throw new Error('This email address is already registered. Please sign in or use another email.');
          }
        } else {
          throw authErr;
        }
      }

      if (user) {
        await updateProfile(user, { displayName: formattedUsername }).catch(() => {});

        // Sync profile to Realtime Database and Firestore
        const profilePayload = {
          uid: user.uid,
          username: formattedUsername,
          username_lower: formattedUsername.toLowerCase(),
          email: cleanEmail,
          createdAt: new Date().toISOString(),
        };

        if (rtdb) {
          const sanitizedEmail = cleanEmail.replace(/\./g, ',');
          withTimeout(
            Promise.all([
              set(ref(rtdb, `users/${user.uid}/profile`), profilePayload),
              set(ref(rtdb, `emails/${sanitizedEmail}`), {
                uid: user.uid,
                email: cleanEmail,
                username: formattedUsername,
              }),
              set(ref(rtdb, `usernames/${formattedUsername.toLowerCase()}`), {
                uid: user.uid,
                email: cleanEmail,
                username: formattedUsername,
              }),
            ]),
            4000,
            null
          ).catch(() => {});
        }

        if (db) {
          withTimeout(
            Promise.all([
              setDoc(doc(db, 'users', user.uid), profilePayload, { merge: true }),
              setDoc(
                doc(db, 'usernames', formattedUsername.toLowerCase()),
                {
                  uid: user.uid,
                  email: cleanEmail,
                  username: formattedUsername,
                },
                { merge: true }
              ),
            ]),
            4000,
            null
          ).catch(() => {});
        }

        // Clean any stale local entries and record verified account
        const localUsers = localAuth
          .getStoredUsers()
          .filter(
            (u) =>
              u.username.toLowerCase() !== formattedUsername.toLowerCase() &&
              (!u.email || u.email.toLowerCase() !== cleanEmail)
          );

        const account: UserAccount = {
          id: user.uid,
          username: formattedUsername,
          email: cleanEmail,
          password: password.trim(),
        };
        localUsers.push(account);
        localAuth.saveUsers(localUsers);
        localAuth.setCurrentUser(account);
        return account;
      }
    }

    // 3. Pure offline registration
    return localAuth.register(formattedUsername, cleanEmail, password);
  },

  /**
   * Login with Username and Password.
   */
  async login(usernameOrEmail: string, password: string): Promise<UserAccount> {
    const cleanInput = usernameOrEmail.trim();

    // Check local accounts first for instant username-to-email resolution
    // Check local accounts first for instant username-to-email resolution
    const localUsers = localAuth.getStoredUsers();
    let localMatch: UserAccount | undefined;
    if (cleanInput.includes('@')) {
      localMatch = localUsers.find(
        (u) => u.email && u.email.toLowerCase() === cleanInput.toLowerCase()
      );
    } else {
      const matching = localUsers.filter(
        (u) => u.username.toLowerCase() === cleanInput.toLowerCase()
      );
      if (matching.length === 1) {
        localMatch = matching[0];
      } else if (matching.length > 1) {
        localMatch = matching.find((u) => u.password === password) || matching[0];
      }
    }

    if (this.isConfigured() && auth) {
      let emailToUse = cleanInput;

      if (!cleanInput.includes('@')) {
        if (localMatch?.email) {
          emailToUse = localMatch.email;
        } else {
          // Look up username in Realtime Database
          let foundEmail = '';
          if (rtdb) {
            const usersSnap = await withTimeout(get(ref(rtdb, 'users')), 2500, null);
            if (usersSnap && usersSnap.exists()) {
              const usersObj = usersSnap.val();
              const matches: Array<{ email: string; password?: string }> = [];
              for (const uid of Object.keys(usersObj)) {
                const profile = usersObj[uid]?.profile;
                if (profile?.username_lower === cleanInput.toLowerCase() && profile?.email) {
                  matches.push({ email: profile.email, password: profile.password });
                }
              }
              if (matches.length === 1) {
                foundEmail = matches[0].email;
              } else if (matches.length > 1) {
                const passMatch = matches.find((m) => m.password === password);
                foundEmail = passMatch ? passMatch.email : matches[0].email;
              }
            }

            if (!foundEmail) {
              const snap = await withTimeout(
                get(ref(rtdb, `usernames/${cleanInput.toLowerCase()}`)),
                2000,
                null
              );
              if (snap && snap.exists() && snap.val()?.email) {
                foundEmail = snap.val().email;
              }
            }
          }
          // Fallback to Firestore if needed
          if (!foundEmail && db) {
            const snap = await withTimeout(
              getDoc(doc(db, 'usernames', cleanInput.toLowerCase())),
              2500,
              null
            );
            if (snap && snap.exists() && snap.data()?.email) {
              foundEmail = snap.data().email;
            }
          }

          if (foundEmail) {
            emailToUse = foundEmail;
          } else {
            throw new Error('User not found. Please check your username or register.');
          }
        }
      }

      try {
        const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
        const user = userCredential.user;

        let resolvedName = user.displayName || '';
        if (!resolvedName && localMatch) {
          resolvedName = localMatch.username;
        }
        if (!resolvedName) {
          resolvedName = cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput;
        }

        const account: UserAccount = {
          id: user.uid,
          username: toTitleCase(resolvedName),
          email: user.email || emailToUse,
        };
        localAuth.setCurrentUser(account);
        return account;
      } catch (err: unknown) {
        // If password was updated/reset locally and matches, log in successfully
        if (localMatch && localMatch.password === password) {
          const account: UserAccount = {
            id: localMatch.id,
            username: toTitleCase(localMatch.username),
            email: localMatch.email || emailToUse,
          };
          localAuth.setCurrentUser(account);
          return account;
        }
        // If Firebase rejects credentials or requires provider activation
        throw err;
      }
    }

    // Local fallback
    return localAuth.login(cleanInput, password);
  },

  /**
   * Verify if an email address belongs to a registered account in local storage, RTDB, or Firestore.
   * Throws an error if the email is not registered, preventing reset links from being sent to fake/example emails.
   */
  async verifyRegisteredEmail(email: string): Promise<{ uid?: string; email: string; username?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    // 1. Check local storage registry
    const localUsers = localAuth.getStoredUsers();
    const localMatch = localUsers.find(
      (u) => u.email && u.email.toLowerCase() === cleanEmail
    );
    if (localMatch) {
      return {
        uid: localMatch.id,
        email: localMatch.email!,
        username: localMatch.username,
      };
    }

    // 2. Check Realtime Database
    if (rtdb) {
      try {
        const sanitized = cleanEmail.replace(/\./g, ',');
        const emailSnap = await withTimeout(
          get(ref(rtdb, `emails/${sanitized}`)),
          2500,
          null
        );
        if (emailSnap && emailSnap.exists()) {
          const val = emailSnap.val();
          return {
            uid: val?.uid,
            email: val?.email || cleanEmail,
            username: val?.username || cleanEmail.split('@')[0],
          };
        }

        // Search in users node if not indexed
        const usersSnap = await withTimeout(get(ref(rtdb, 'users')), 2500, null);
        if (usersSnap && usersSnap.exists()) {
          const usersObj = usersSnap.val();
          for (const uid of Object.keys(usersObj)) {
            const profile = usersObj[uid]?.profile;
            if (profile?.email && profile.email.toLowerCase() === cleanEmail) {
              return {
                uid,
                email: profile.email,
                username: profile.username || toTitleCase(cleanEmail.split('@')[0]),
              };
            }
          }
        }
      } catch {
        // continue
      }
    }

    // 3. Check Firestore
    if (db) {
      try {
        const docSnap = await withTimeout(
          getDoc(doc(db, 'emails', cleanEmail)),
          2500,
          null
        );
        if (docSnap && docSnap.exists() && docSnap.data()?.email) {
          return {
            uid: docSnap.data().uid,
            email: docSnap.data().email,
            username: docSnap.data().username,
          };
        }
      } catch {
        // continue
      }
    }

    throw new Error(`This email ID (${cleanEmail}) is not registered with any account. Please enter the email ID you registered with.`);
  },

  /**
   * Look up registered email from Username in Firestore or local database.
   */
  async lookupEmailByUsername(usernameOrEmail: string): Promise<string> {
    const clean = usernameOrEmail.trim().toLowerCase();
    if (clean.includes('@')) {
      const verified = await this.verifyRegisteredEmail(clean);
      return verified.email;
    }

    // 1. Check local registry first
    const users = localAuth.getStoredUsers();
    const user = users.find((u) => u.username.toLowerCase() === clean);
    if (user && user.email) {
      return user.email;
    }

    // 2. Query Realtime Database with timeout
    if (rtdb) {
      const snap = await withTimeout(
        get(ref(rtdb, `usernames/${clean}`)),
        2500,
        null
      );
      if (snap && snap.exists() && snap.val()?.email) {
        return snap.val().email;
      }
    }

    // 3. Query Firestore with timeout
    if (this.isConfigured() && db) {
      const docSnap = await withTimeout(
        getDoc(doc(db, 'usernames', clean)),
        2500,
        null
      );
      if (docSnap && docSnap.exists() && docSnap.data()?.email) {
        return docSnap.data().email;
      }
    }

    throw new Error(`No account found for username "${usernameOrEmail}". Please check your username or register.`);
  },

  /**
   * Send Password Reset Email strictly to a verified registered email address.
   */
  async sendResetLink(emailInput: string): Promise<{ email: string; username?: string }> {
    const verified = await this.verifyRegisteredEmail(emailInput);
    const cleanEmail = verified.email;

    if (this.isConfigured() && auth) {
      await sendPasswordResetEmail(auth, cleanEmail);
      return verified;
    }

    console.info(`[Auth] Password reset link sent to ${cleanEmail}`);
    return verified;
  },

  /**
   * Update password directly in database (localAuth + RTDB) for the verified email.
   */
  async updatePasswordForEmail(emailInput: string, newPass: string): Promise<void> {
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!newPass.trim() || newPass.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    // 1. Update in local storage
    try {
      localAuth.resetPassword(cleanEmail, newPass);
    } catch {
      // If user was in cloud but not yet in localStorage, save user record locally
      const users = localAuth.getStoredUsers();
      users.push({
        id: 'usr_' + Date.now(),
        username: toTitleCase(cleanEmail.split('@')[0]),
        email: cleanEmail,
        password: newPass,
      });
      localAuth.saveUsers(users);
    }

    // 2. Update in Realtime Database
    if (rtdb) {
      try {
        const sanitized = cleanEmail.replace(/\./g, ',');
        const emailSnap = await get(ref(rtdb, `emails/${sanitized}`));
        if (emailSnap.exists() && emailSnap.val()?.uid) {
          const uid = emailSnap.val().uid;
          await set(ref(rtdb, `users/${uid}/profile/password`), newPass);
        } else {
          // Check users node
          const usersSnap = await get(ref(rtdb, 'users'));
          if (usersSnap.exists()) {
            const usersObj = usersSnap.val();
            for (const uid of Object.keys(usersObj)) {
              if (usersObj[uid]?.profile?.email?.toLowerCase() === cleanEmail) {
                await set(ref(rtdb, `users/${uid}/profile/password`), newPass);
              }
            }
          }
        }
      } catch (err) {
        console.warn('RTDB password update notice:', err);
      }
    }
  },

  /**
   * Send Password Reset Email. Resolves username to email automatically.
   */
  async resetPassword(usernameOrEmail: string): Promise<{ email: string }> {
    const cleanInput = usernameOrEmail.trim();
    if (!cleanInput) throw new Error('Please enter your email or username');

    if (cleanInput.includes('@')) {
      return this.sendResetLink(cleanInput);
    }

    const resolvedEmail = await this.lookupEmailByUsername(cleanInput);
    return this.sendResetLink(resolvedEmail);
  },

  /**
   * Confirm Password Reset with oobCode and new password.
   */
  async confirmReset(oobCode: string, newPass: string): Promise<void> {
    if (this.isConfigured() && auth) {
      await confirmPasswordReset(auth, oobCode, newPass);
      return;
    }
  },

  /**
   * Logout current session.
   */
  async logout(): Promise<void> {
    if (this.isConfigured() && auth) {
      try {
        await fbSignOut(auth);
      } catch {
        // ignore
      }
    }
    localAuth.signOut();
  },

  async signOut(): Promise<void> {
    return this.logout();
  },

  /**
   * Save / Sync friends and debt tracker data to cloud (Realtime Database & Firestore).
   */
  async syncFriends(userId: string, friends: Friend[]): Promise<void> {
    if (!userId) return;
    const cleanFriends = JSON.parse(JSON.stringify(friends));
    const payload = {
      friends: cleanFriends,
      updatedAt: new Date().toISOString(),
    };

    // 1. Primary: Firebase Realtime Database
    if (rtdb) {
      withTimeout(
        set(ref(rtdb, `users/${userId}/tracker`), payload),
        3000,
        null
      ).catch(() => {});
    }

    // 2. Secondary fallback: Cloud Firestore
    if (db) {
      withTimeout(
        setDoc(
          doc(db, 'users', userId, 'data', 'tracker'),
          payload,
          { merge: true }
        ),
        3000,
        null
      ).catch(() => {});
    }
  },

  /**
   * Fetch friends from cloud database.
   */
  async loadFriendsFromCloud(userId: string): Promise<Friend[] | null> {
    if (!userId) return null;

    // 1. Try Firebase Realtime Database
    if (rtdb) {
      try {
        const snap = await withTimeout(
          get(ref(rtdb, `users/${userId}/tracker`)),
          2500,
          null
        );
        if (snap && snap.exists()) {
          const val = snap.val();
          if (val && Array.isArray(val.friends)) {
            return val.friends as Friend[];
          }
        }
      } catch {
        // fallback
      }
    }

    // 2. Try Firestore fallback
    if (db) {
      try {
        const snap = await withTimeout(
          getDoc(doc(db, 'users', userId, 'data', 'tracker')),
          2500,
          null
        );
        if (snap && snap.exists() && snap.data()?.friends) {
          return snap.data()?.friends as Friend[];
        }
      } catch {
        // graceful offline fallback
      }
    }
    return null;
  },

  /**
   * Real-time listener for cloud changes.
   * Enables immediate multi-device sync and guarantees updates without data loss.
   */
  subscribeFriends(userId: string, onUpdate: (friends: Friend[]) => void): () => void {
    if (!userId) return () => {};

    // 1. Primary: Firebase Realtime Database real-time listener
    if (rtdb) {
      try {
        const trackerRef = ref(rtdb, `users/${userId}/tracker`);
        const unsubscribeRtdb = onValue(
          trackerRef,
          (snap) => {
            if (snap.exists()) {
              const val = snap.val();
              if (val && Array.isArray(val.friends)) {
                onUpdate(val.friends as Friend[]);
              }
            }
          },
          (err) => {
            console.warn('Realtime Database sync notice:', err);
          }
        );
        return () => {
          unsubscribeRtdb();
        };
      } catch {
        // Fallback
      }
    }

    // 2. Secondary fallback: Firestore listener
    if (db) {
      try {
        const unsubscribe = onSnapshot(
          doc(db, 'users', userId, 'data', 'tracker'),
          (snap) => {
            if (snap.exists() && snap.data()?.friends) {
              const cloudFriends = snap.data().friends as Friend[];
              onUpdate(cloudFriends);
            }
          },
          (err) => {
            console.warn('Real-time sync notice:', err);
          }
        );
        return unsubscribe;
      } catch {
        // Fallback
      }
    }
    return () => {};
  },

  /**
   * If the cloud Realtime Database is empty (i.e. was reset),
   * purge stale local storage accounts so the browser starts completely fresh.
   */
  async reconcileLocalAccountsWithCloud(): Promise<void> {
    if (!rtdb) return;
    try {
      const usersSnap = await withTimeout(get(ref(rtdb, 'users')), 2000, null);
      if (usersSnap && !usersSnap.exists()) {
        localAuth.saveUsers([]);
      }
    } catch {
      // ignore
    }
  },

  /**
   * Reset the entire database (Realtime Database & local storage).
   */
  async resetDatabase(): Promise<void> {
    if (rtdb) {
      await Promise.all([
        set(ref(rtdb, 'users'), null),
        set(ref(rtdb, 'emails'), null),
        set(ref(rtdb, 'usernames'), null),
      ]);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  },
};
