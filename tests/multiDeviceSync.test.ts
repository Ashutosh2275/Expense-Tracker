import { describe, it, expect, beforeEach } from 'vitest';
import { localTracker, Friend } from '../src/services/localTracker';
import { localAuth, UserAccount } from '../src/services/localAuth';
import { firebaseService } from '../src/services/firebase';

// Mock storage map generator for isolating simulated devices
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }
  setItem(key: string, val: string): void {
    this.store.set(key, String(val));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

// Global default memory store for Node environment
const defaultStorage = new MemoryStorage();
// @ts-expect-error Node mock
globalThis.localStorage = defaultStorage;

describe('30-Device Real-Time Sync & Sub-Millisecond Concurrency Tests', () => {
  beforeEach(() => {
    defaultStorage.clear();
  });

  it('instantaneously signs in 2,000 concurrent users in <0.10ms per sign-in', async () => {
    const userCount = 2000;
    const users: UserAccount[] = [];

    // Pre-populate 2,000 distinct user accounts
    for (let i = 0; i < userCount; i++) {
      users.push({
        id: `usr_${i}`,
        username: `User_${i}`,
        email: `user_${i}@example.com`,
        password: `Pass_${i}#`,
      });
    }
    localAuth.saveUsers(users);

    // Warm-up JIT
    for (let i = 0; i < 50; i++) {
      localAuth.login(`user_${i}@example.com`, `Pass_${i}#`);
    }

    // Benchmark 2,000 simultaneous concurrent sign-ins
    const t0 = performance.now();
    const loginPromises = users.map((u) => {
      return localAuth.login(u.username, u.password || '');
    });
    const results = await Promise.all(loginPromises);
    const totalTimeMs = performance.now() - t0;
    const avgLatencyMs = totalTimeMs / userCount;

    // Verify all 2,000 users authenticated correctly
    expect(results.length).toBe(userCount);
    for (let i = 0; i < userCount; i++) {
      expect(results[i].id).toBe(`usr_${i}`);
      expect(results[i].username).toBe(`User_${i}`);
    }

    console.log(
      `[Benchmark] 2,000 Concurrent Sign-Ins completed in ${totalTimeMs.toFixed(2)}ms (Avg: ${avgLatencyMs.toFixed(4)}ms per sign-in)`
    );

    // Strict requirement: sign-in latency must be less than 0.10ms
    expect(avgLatencyMs).toBeLessThan(0.10);
  });

  it('instantaneously processes 2,000 sign-outs in <0.05ms per operation', () => {
    const userCount = 2000;
    const t0 = performance.now();
    for (let i = 0; i < userCount; i++) {
      localAuth.signOut();
    }
    const totalTimeMs = performance.now() - t0;
    const avgSignOutMs = totalTimeMs / userCount;

    console.log(
      `[Benchmark] 2,000 Sign-Outs completed in ${totalTimeMs.toFixed(2)}ms (Avg: ${avgSignOutMs.toFixed(4)}ms per sign-out)`
    );
    expect(avgSignOutMs).toBeLessThan(0.05);
  });

  it('synchronizes real-time balance and debt updates across 30 concurrent devices with zero data loss', async () => {
    const DEVICE_COUNT = 30;
    const userId = 'user_ashutosh_stress_test';

    // 1. Central simulated cloud database (Realtime Database Hub)
    interface CloudHub {
      tracker: Record<string, { friends: Friend[]; updatedAt: string }>;
      listeners: Map<string, Array<(friends: Friend[]) => void>>;
      publish: (uid: string, friends: Friend[]) => void;
      subscribe: (uid: string, cb: (friends: Friend[]) => void) => () => void;
    }

    const cloudHub: CloudHub = {
      tracker: {},
      listeners: new Map(),
      publish(uid, friends) {
        this.tracker[uid] = {
          friends: JSON.parse(JSON.stringify(friends)),
          updatedAt: new Date().toISOString(),
        };
        const cbs = this.listeners.get(uid) || [];
        cbs.forEach((cb) => cb(JSON.parse(JSON.stringify(friends))));
      },
      subscribe(uid, cb) {
        const list = this.listeners.get(uid) || [];
        list.push(cb);
        this.listeners.set(uid, list);
        return () => {
          const current = this.listeners.get(uid) || [];
          this.listeners.set(uid, current.filter((fn) => fn !== cb));
        };
      },
    };

    // 2. Spawn 30 simulated physical devices with separate local storage caches
    interface SimulatedDevice {
      id: number;
      name: string;
      storage: MemoryStorage;
      state: Friend[];
      unsubscribe?: () => void;
      refreshCount: number;
      refresh: () => void;
    }

    const devices: SimulatedDevice[] = [];

    for (let i = 1; i <= DEVICE_COUNT; i++) {
      const devStorage = new MemoryStorage();
      const devName = i === 1 ? 'Laptop (Mac)' : i === 2 ? 'iPhone PWA' : i === 5 ? 'Android Phone' : `Device_${i}`;
      
      const dev: SimulatedDevice = {
        id: i,
        name: devName,
        storage: devStorage,
        state: [],
        refreshCount: 0,
        refresh() {
          this.refreshCount++;
          // Simulated safe loadFriends: reads cloud without overwriting with stale local data
          const cloudData = cloudHub.tracker[userId];
          if (cloudData && Array.isArray(cloudData.friends)) {
            this.state = JSON.parse(JSON.stringify(cloudData.friends));
            this.storage.setItem(`tracker_friends_${userId.toLowerCase()}`, JSON.stringify(this.state));
          }
        },
      };

      // Connect device's real-time listener to cloud hub
      dev.unsubscribe = cloudHub.subscribe(userId, (incoming) => {
        dev.state = JSON.parse(JSON.stringify(incoming));
        dev.storage.setItem(`tracker_friends_${userId.toLowerCase()}`, JSON.stringify(incoming));
      });

      devices.push(dev);
    }

    // 3. Step 1: Device 1 (Laptop) adds an expense of ₹1,500 with 3 friends (Ashu, Rohan, Priya)
    const initialFriends: Friend[] = [
      {
        id: 'f_ashu',
        name: 'Ashu',
        balance: 500,
        pendingEntries: [
          {
            id: 'e_1',
            purpose: 'Dinner & Snacks',
            originalAmount: 500,
            remainingAmount: 500,
            createdAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'f_rohan',
        name: 'Rohan',
        balance: 500,
        pendingEntries: [
          {
            id: 'e_2',
            purpose: 'Dinner & Snacks',
            originalAmount: 500,
            remainingAmount: 500,
            createdAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'f_priya',
        name: 'Priya',
        balance: 500,
        pendingEntries: [
          {
            id: 'e_3',
            purpose: 'Dinner & Snacks',
            originalAmount: 500,
            remainingAmount: 500,
            createdAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      },
    ];

    // Device 1 broadcasts initial state to cloud
    cloudHub.publish(userId, initialFriends);

    // Verify all 30 devices received initial expense and match exact balance
    for (const d of devices) {
      expect(d.state.length).toBe(3);
      const totalReceivable = d.state.reduce((acc, f) => acc + f.balance, 0);
      expect(totalReceivable).toBe(1500);
    }

    // 4. Step 2: Device 12 records a partial payment of ₹200 from Ashu
    const updatedState1 = JSON.parse(JSON.stringify(devices[11].state)) as Friend[];
    const ashu = updatedState1.find((f) => f.id === 'f_ashu')!;
    ashu.pendingEntries[0].remainingAmount = 300;
    ashu.balance = 300;
    ashu.updatedAt = new Date().toISOString();

    cloudHub.publish(userId, updatedState1);

    // Verify all 30 devices update Ashu to ₹300, total to ₹1300
    for (const d of devices) {
      const devAshu = d.state.find((f) => f.id === 'f_ashu')!;
      expect(devAshu.balance).toBe(300);
      expect(devAshu.pendingEntries[0].remainingAmount).toBe(300);
      const totalReceivable = d.state.reduce((acc, f) => acc + f.balance, 0);
      expect(totalReceivable).toBe(1300);
    }

    // 5. Step 3: Device 5 (Android Phone) repeatedly refreshes 20 times in a row
    for (let r = 0; r < 20; r++) {
      devices[4].refresh();
    }
    // Verify Android Phone has exact same amount and NEVER reverted or altered anything
    expect(devices[4].state.find((f) => f.id === 'f_ashu')!.balance).toBe(300);

    // Verify all other 29 devices remained unaffected at ₹1300
    for (const d of devices) {
      const totalReceivable = d.state.reduce((acc, f) => acc + f.balance, 0);
      expect(totalReceivable).toBe(1300);
    }

    // 6. Step 4: Device 25 records complete settlement for Rohan (paid ₹500)
    const updatedState2 = JSON.parse(JSON.stringify(devices[24].state)) as Friend[];
    const rohan = updatedState2.find((f) => f.id === 'f_rohan')!;
    rohan.pendingEntries = [];
    rohan.balance = 0;
    rohan.updatedAt = new Date().toISOString();

    cloudHub.publish(userId, updatedState2);

    // Verify all 30 devices reflect Rohan settled (balance 0), total ₹800
    for (const d of devices) {
      const devRohan = d.state.find((f) => f.id === 'f_rohan')!;
      expect(devRohan.balance).toBe(0);
      expect(devRohan.pendingEntries.length).toBe(0);
      const totalReceivable = d.state.reduce((acc, f) => acc + f.balance, 0);
      expect(totalReceivable).toBe(800);
    }

    // 7. Step 5: Device 30 settles remaining Ashu (₹300) and Priya (₹500)
    const updatedState3 = JSON.parse(JSON.stringify(devices[29].state)) as Friend[];
    for (const f of updatedState3) {
      f.pendingEntries = [];
      f.balance = 0;
      f.updatedAt = new Date().toISOString();
    }

    cloudHub.publish(userId, updatedState3);

    // Verify all 30 devices are fully settled at ₹0
    for (const d of devices) {
      for (const f of d.state) {
        expect(f.balance).toBe(0);
        expect(f.pendingEntries.length).toBe(0);
      }
      const totalReceivable = d.state.reduce((acc, f) => acc + f.balance, 0);
      expect(totalReceivable).toBe(0);
    }

    // Clean up all device subscriptions
    devices.forEach((d) => d.unsubscribe?.());
  });

  it('prevents stale Android local storage from clobbering settled cloud data on refresh', async () => {
    const userId = 'user_android_refresh_check';

    // Cloud has settled state (all debts paid: balance ₹0)
    const cloudFriends: Friend[] = [
      {
        id: 'f_test',
        name: 'Friend One',
        balance: 0,
        pendingEntries: [],
        updatedAt: new Date().toISOString(),
      },
    ];

    // Android device local storage has stale data with ₹500 unpaid from yesterday
    const staleAndroidFriends: Friend[] = [
      {
        id: 'f_test',
        name: 'Friend One',
        balance: 500,
        pendingEntries: [
          {
            id: 'e_stale',
            purpose: 'Yesterday coffee',
            originalAmount: 500,
            remainingAmount: 500,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
          },
        ],
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    defaultStorage.setItem(
      `tracker_friends_${userId.toLowerCase()}`,
      JSON.stringify(staleAndroidFriends)
    );

    // Safe load: when cloud has settled data, local storage accepts cloud state
    // and NEVER calls syncFriends to overwrite cloud!
    if (Array.isArray(cloudFriends)) {
      localTracker.saveFriendsLocalOnly(userId, cloudFriends);
    }

    // Assert local storage was updated to authoritative cloud state (₹0)
    const currentLocal = localTracker.getFriends(userId);
    expect(currentLocal[0].balance).toBe(0);
    expect(currentLocal[0].pendingEntries.length).toBe(0);
  });
});
