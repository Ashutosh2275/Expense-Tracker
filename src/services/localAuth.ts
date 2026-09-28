export interface UserAccount {
  id: string;
  username: string; // Stored in Title Case (first letter capital, other letters small)
  email?: string;
  password?: string; // Strictly numeric or standard password
}

const USERS_STORAGE_KEY = 'tracker_local_users';
const CURRENT_USER_KEY = 'tracker_current_user';

/**
 * Format string so the first letter of each word is capital and other letters are small.
 * e.g. "ASHUTOSH" -> "Ashutosh", "ashutosh" -> "Ashutosh"
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

let cachedUsers: UserAccount[] | null = null;
let cachedRaw: string | null = null;
const userIndex = new Map<string, UserAccount>();

function refreshIndex(users: UserAccount[]) {
  userIndex.clear();
  for (const u of users) {
    if (u.username) userIndex.set(u.username.toLowerCase(), u);
    if (u.email) userIndex.set(u.email.toLowerCase(), u);
  }
}

export function getStoredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      cachedUsers = [];
      cachedRaw = null;
      userIndex.clear();
      return [];
    }
    if (raw === cachedRaw && cachedUsers) {
      return cachedUsers;
    }
    cachedRaw = raw;
    cachedUsers = JSON.parse(raw);
    refreshIndex(cachedUsers || []);
    return cachedUsers || [];
  } catch {
    return [];
  }
}

export function saveUsers(users: UserAccount[]): void {
  cachedUsers = users;
  cachedRaw = JSON.stringify(users);
  localStorage.setItem(USERS_STORAGE_KEY, cachedRaw);
  refreshIndex(users);
}

export const localAuth = {
  getStoredUsers,
  saveUsers,

  getCurrentUser(): UserAccount | null {
    try {
      const raw = localStorage.getItem(CURRENT_USER_KEY);
      if (!raw) return null;
      const sessionUser: UserAccount = JSON.parse(raw);
      
      getStoredUsers();
      const canonical = userIndex.get(sessionUser.username.toLowerCase());
      
      const username = toTitleCase(canonical ? canonical.username : sessionUser.username);
      const id = canonical ? canonical.id : sessionUser.id;

      return { id, username, password: canonical?.password || sessionUser.password };
    } catch {
      return null;
    }
  },

  /**
   * Single-step login and automatic registration:
   * - Password must be numbers only.
   * - Strict password checking (no random passwords accepted).
   * - First registered casing locks the account Title Case.
   */
  authenticate(usernameInput: string, passwordInput?: string): UserAccount {
    const cleanUser = usernameInput.trim();
    // Enforce numbers-only password
    const cleanPass = passwordInput ? passwordInput.trim().replace(/\D/g, '') : '';

    if (!cleanUser) {
      throw new Error('Please enter a username');
    }
    if (!cleanPass) {
      throw new Error('Numeric password is required');
    }

    const users = getStoredUsers();
    const normalizedKey = cleanUser.toLowerCase();
    const formattedUsername = toTitleCase(cleanUser);

    // Check if account already exists (case-insensitively)
    const existingIndex = users.findIndex(
      (u) => u.username.toLowerCase() === normalizedKey
    );

    if (existingIndex !== -1) {
      const existing = users[existingIndex];
      // If legacy user had no password, lock it to this password
      if (!existing.password) {
        existing.password = cleanPass;
        saveUsers(users);
      } else if (existing.password !== cleanPass) {
        // STRICT verification: reject any incorrect password
        throw new Error('Incorrect password');
      }

      const canonicalTitleCase = toTitleCase(existing.username);
      const session = { id: existing.id, username: canonicalTitleCase, password: existing.password };
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session));
      return session;
    }

    // New unique user: register with Title Case username and numeric password
    const deterministicId = 'usr_' + normalizedKey.replace(/[^a-z0-9_]/g, '');
    const newUser: UserAccount = {
      id: deterministicId,
      username: formattedUsername, // Capital first letter, rest lowercase
      password: cleanPass,
    };

    users.push(newUser);
    saveUsers(users);

    const session = { id: newUser.id, username: newUser.username, password: newUser.password };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session));
    return session;
  },

  setCurrentUser(session: UserAccount): void {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session));
  },

  register(username: string, email: string, password: string): UserAccount {
    const cleanUser = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser) throw new Error('Please enter a username');
    if (!cleanEmail) throw new Error('Please enter an email address');
    if (!cleanPass) throw new Error('Please enter a password');

    const users = getStoredUsers();
    // Strict uniqueness check on BOTH Username and Email Address (1 unique email <-> 1 unique username)
    if (users.some((u) => u.username.toLowerCase() === cleanUser.toLowerCase())) {
      throw new Error('This username is already taken. Please choose another username.');
    }
    if (users.some((u) => u.email && u.email.toLowerCase() === cleanEmail)) {
      throw new Error('This email address is already registered. Please sign in or use another email.');
    }

    const newUser: UserAccount = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      username: toTitleCase(cleanUser),
      email: cleanEmail,
      password: cleanPass,
    };

    users.push(newUser);
    saveUsers(users);

    this.setCurrentUser(newUser);
    return newUser;
  },

  login(identifier: string, password: string): UserAccount {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanId) throw new Error('Please enter your email or username');
    if (!cleanPass) throw new Error('Please enter your password');

    getStoredUsers();
    const user = userIndex.get(cleanId);

    if (!user) {
      throw new Error('User not found. Please register first.');
    }

    if (user.password && user.password !== cleanPass) {
      throw new Error('Incorrect password');
    }

    this.setCurrentUser(user);
    return user;
  },

  resetPassword(email: string, newPass: string): void {
    const cleanEmail = email.trim().toLowerCase();
    const users = getStoredUsers();
    const user = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
    if (!user) {
      throw new Error('No account found with this email');
    }
    user.password = newPass.trim();
    saveUsers(users);
  },

  signIn(username: string, password?: string): UserAccount {
    return this.authenticate(username, password);
  },

  signUp(username: string, password?: string): UserAccount {
    return this.authenticate(username, password);
  },

  signOut(): void {
    localStorage.removeItem(CURRENT_USER_KEY);
  },
};
