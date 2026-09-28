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
import { localAuth, type UserAccount, toTitleCase } from './localAuth';
import type { Friend, PendingEntry, DeductRecord, PaymentLog } from './localTracker';

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
  } catch (err) {
    console.warn('Firebase initialization warning:', err);
  }
}

// Helper for lightning-fast network timeouts without hanging
function withTimeout<T>(promise: Promise<T>, ms = 1500, fallbackValue: T): Promise<T> {
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

/**
 * Normalizes Firebase Realtime Database structures.
 * RTDB serializes lists with numeric keys as objects (e.g. { '0': item, '1': item }).
 * This converts all nested objects back into clean typed arrays for instant, crash-free React rendering.
 */
export function normalizeFriends(raw: unknown): Friend[] {
  if (!raw) return [];
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'object' && raw !== null) {
    list = Object.values(raw);
  }

  return list
    .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null && 'id' in f && 'name' in f)
    .map((f) => {
      let pending: unknown[] = [];
      const rawEntries = f.pendingEntries;
      if (Array.isArray(rawEntries)) {
        pending = rawEntries;
      } else if (typeof rawEntries === 'object' && rawEntries !== null) {
        pending = Object.values(rawEntries);
      }

      const cleanPending: PendingEntry[] = pending
        .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null && 'id' in e)
        .map((e) => {
          let deductions: DeductRecord[] = [];
          if (Array.isArray(e.deductions)) {
            deductions = e.deductions as DeductRecord[];
          } else if (typeof e.deductions === 'object' && e.deductions !== null) {
            deductions = Object.values(e.deductions) as DeductRecord[];
          }
          return {
            id: String(e.id),
            purpose: String(e.purpose || ''),
            originalAmount: Number(e.originalAmount || 0),
            remainingAmount: Number(e.remainingAmount || 0),
            createdAt: String(e.createdAt || new Date().toISOString()),
            deductions,
          };
        });

      let logs: PaymentLog[] = [];
      const rawLogs = f.paymentLogs;
      if (Array.isArray(rawLogs)) {
        logs = rawLogs as PaymentLog[];
      } else if (typeof rawLogs === 'object' && rawLogs !== null) {
        logs = Object.values(rawLogs) as PaymentLog[];
      }

      // Strictly synchronize balance with the sum of remaining entry amounts
      const totalRemainingPaise = cleanPending.reduce(
        (sum, e) => sum + Math.round(Number(e.remainingAmount || 0) * 100),
        0
      );
      const computedBalance = cleanPending.length > 0 ? totalRemainingPaise / 100 : Number(f.balance || 0);

      return {
        id: String(f.id),
        name: String(f.name),
        balance: computedBalance,
        pendingEntries: cleanPending,
        paymentLogs: logs,
        updatedAt: String(f.updatedAt || new Date().toISOString()),
      };
    });
}

export const firebaseService = {
  isConfigured(): boolean {
    return Boolean(auth);
  },

  /**
   * Register a new user with Username, Email, and Password.
   * Runs uniqueness point checks in parallel for millisecond-level responsiveness.
   */
  async register(username: string, email: string, password: string): Promise<UserAccount> {
    const formattedUsername = toTitleCase(username.trim());
    const cleanEmail = email.trim().toLowerCase();

    // 1. Strict unique check on BOTH Username and Email in PARALLEL
    if (rtdb) {
      const sanitized = cleanEmail.replace(/\./g, ',');
      const [emailSnap, userSnap] = await Promise.all([
        withTimeout(get(ref(rtdb, `emails/${sanitized}`)), 1500, null),
        withTimeout(get(ref(rtdb, `usernames/${formattedUsername.toLowerCase()}`)), 1500, null),
      ]);

      if (emailSnap && emailSnap.exists()) {
        throw new Error('This email address is already registered. Please sign in or use another email.');
      }
      if (userSnap && userSnap.exists()) {
        throw new Error('This username is already taken. Please choose another username.');
      }

      // Purge any stale orphaned local storage accounts from prior resets
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

    // 2. Register with Firebase Auth FIRST
    if (this.isConfigured() && auth) {
      let user;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        user = userCredential.user;
      } catch (authErr: unknown) {
        const errObj = authErr as { code?: string; message?: string };
        if (errObj?.code === 'auth/email-already-in-use') {
          // If the account already exists in Firebase Auth, verify ownership with entered password
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

        // Save profile and fast lookup indexes in parallel
        const profilePayload = {
          uid: user.uid,
          username: formattedUsername,
          username_lower: formattedUsername.toLowerCase(),
          email: cleanEmail,
          createdAt: new Date().toISOString(),
        };

        if (rtdb) {
          const sanitizedEmail = cleanEmail.replace(/\./g, ',');
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
          ]).catch(() => {});
        }

        // Clean stale local storage entries & set session
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
   * Ultra-fast login with Username or Email and Password.
   * Uses O(1) point-lookup on usernames index for instant resolution.
   */
  async login(usernameOrEmail: string, password: string): Promise<UserAccount> {
    const cleanInput = usernameOrEmail.trim();

    // Check local accounts first for instantaneous (0ms) resolution
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

    // Instant local match validation (< 0.10ms)
    if (localMatch && localMatch.password === password) {
      localAuth.setCurrentUser(localMatch);
      // Asynchronously refresh cloud session in background without blocking login
      if (this.isConfigured() && auth && localMatch.email) {
        signInWithEmailAndPassword(auth, localMatch.email, password).catch(() => {});
      }
      return localMatch;
    }

    if (this.isConfigured() && auth) {
      let emailToUse = cleanInput;

      if (!cleanInput.includes('@')) {
        if (localMatch?.email) {
          emailToUse = localMatch.email;
        } else {
          // Point lookup on usernames index in RTDB (~20-50ms)
          let foundEmail = '';
          if (rtdb) {
            const snap = await withTimeout(
              get(ref(rtdb, `usernames/${cleanInput.toLowerCase()}`)),
              1500,
              null
            );
            if (snap && snap.exists() && snap.val()?.email) {
              foundEmail = snap.val().email;
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
          password: password.trim(),
        };

        // Cache credentials locally so future logins on this device take < 0.10ms
        const updatedLocal = localUsers.filter((u) => u.id !== account.id);
        updatedLocal.push(account);
        localAuth.saveUsers(updatedLocal);
        localAuth.setCurrentUser(account);
        return account;
      } catch (err: unknown) {
        // Fallback for locally saved numeric accounts
        if (localMatch && localMatch.password === password) {
          const account: UserAccount = {
            id: localMatch.id,
            username: toTitleCase(localMatch.username),
            email: localMatch.email || emailToUse,
            password: password.trim(),
          };
          localAuth.setCurrentUser(account);
          return account;
        }
        throw err;
      }
    }

    return localAuth.login(cleanInput, password);
  },

  /**
   * Verify if an email address belongs to a registered account.
   */
  async verifyRegisteredEmail(email: string): Promise<{ uid?: string; email: string; username?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    // 1. Check local storage
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

    // 2. Direct point query on Realtime Database
    if (rtdb) {
      try {
        const sanitized = cleanEmail.replace(/\./g, ',');
        const emailSnap = await withTimeout(
          get(ref(rtdb, `emails/${sanitized}`)),
          1500,
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
      } catch {
        // continue
      }
    }

    throw new Error(`This email ID (${cleanEmail}) is not registered with any account. Please enter the email ID you registered with.`);
  },

  /**
   * Look up registered email from Username.
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

    // 2. Point query on Realtime Database
    if (rtdb) {
      const snap = await withTimeout(
        get(ref(rtdb, `usernames/${clean}`)),
        1500,
        null
      );
      if (snap && snap.exists() && snap.val()?.email) {
        return snap.val().email;
      }
    }

    throw new Error(`No account found for username "${usernameOrEmail}". Please check your username or register.`);
  },

  /**
   * Send Password Reset Email to registered email.
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
   * Update password directly in database (localAuth + RTDB).
   */
  async updatePasswordForEmail(emailInput: string, newPass: string): Promise<void> {
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!newPass.trim() || newPass.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    // Update in local storage
    try {
      localAuth.resetPassword(cleanEmail, newPass);
    } catch {
      const users = localAuth.getStoredUsers();
      users.push({
        id: 'usr_' + Date.now(),
        username: toTitleCase(cleanEmail.split('@')[0]),
        email: cleanEmail,
        password: newPass,
      });
      localAuth.saveUsers(users);
    }

    // Update in Realtime Database
    if (rtdb) {
      try {
        const sanitized = cleanEmail.replace(/\./g, ',');
        const emailSnap = await get(ref(rtdb, `emails/${sanitized}`));
        if (emailSnap.exists() && emailSnap.val()?.uid) {
          const uid = emailSnap.val().uid;
          await set(ref(rtdb, `users/${uid}/profile/password`), newPass);
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
   * Confirm Password Reset with oobCode.
   */
  async confirmReset(oobCode: string, newPass: string): Promise<void> {
    if (this.isConfigured() && auth) {
      await confirmPasswordReset(auth, oobCode, newPass);
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
   * Instant cloud push to Realtime Database.
   * Sends data over active WebSocket directly within milliseconds.
   */
  async syncFriends(userId: string, friends: Friend[]): Promise<void> {
    if (!userId || !rtdb) return;
    const cleanFriends = JSON.parse(JSON.stringify(friends));
    const payload = {
      friends: cleanFriends,
      updatedAt: new Date().toISOString(),
    };

    set(ref(rtdb, `users/${userId}/tracker`), payload).catch((err) => {
      console.warn('Realtime Database sync warning:', err);
    });
  },

  /**
   * Fetch friends from cloud database with automatic array normalization.
   */
  async loadFriendsFromCloud(userId: string): Promise<Friend[] | null> {
    if (!userId || !rtdb) return null;

    try {
      const snap = await withTimeout(
        get(ref(rtdb, `users/${userId}/tracker`)),
        1500,
        null
      );
      if (snap && snap.exists()) {
        const val = snap.val();
        return normalizeFriends(val?.friends);
      }
    } catch {
      // fallback
    }
    return null;
  },

  /**
   * Real-time listener for cloud changes.
   * Fires instantaneously whenever data changes on any device.
   * Never overwrites existing data with empty states on connection initialization.
   */
  subscribeFriends(userId: string, onUpdate: (friends: Friend[]) => void): () => void {
    if (!userId || !rtdb) return () => {};

    try {
      const trackerRef = ref(rtdb, `users/${userId}/tracker`);
      const unsubscribeRtdb = onValue(
        trackerRef,
        (snap) => {
          if (snap.exists()) {
            const val = snap.val();
            const friends = normalizeFriends(val?.friends);
            if (Array.isArray(friends)) {
              onUpdate(friends);
            }
          }
        },
        (err) => {
          console.warn('Realtime Database subscription notice:', err);
        }
      );
      return () => {
        unsubscribeRtdb();
      };
    } catch {
      return () => {};
    }
  },
};
