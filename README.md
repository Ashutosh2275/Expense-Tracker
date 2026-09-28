# 🪙 Expense Tracker • Personal & Free PWA

A mobile-first, iPhone & Android optimized **Progressive Web App (PWA)** to track shared expenses, debts, and pending settlements between you and your friends.

> **Zero Cost Guarantee**: Built to operate comfortably within permanently free tiers (**₹0 / $0 per month**) using React, Vite, Tailwind CSS, and Firebase Realtime Database + Firebase Authentication.

---

## ✨ Features

- **Personal Financial Clarity**:
  - Instantly see who owes you money (**in green `+`**) and whom you owe (**in red `-`**).
  - High-precision currency arithmetic avoiding floating-point rounding drift.
  - Automatically settles and purges debts from the database once balances reach ₹0.

- **Cloud & Multi-Device Sync**:
  - Powered by **Firebase Realtime Database** for live, instant updates across devices.
  - Dual-layer offline fallback with browser local storage reconciliation.

- **Secure Authentication**:
  - **1-to-1 Tied Unique Identity**: Every username and email is strictly unique in the cloud database.
  - Case-insensitive Title Case username formatting.
  - **Verified Forgot Password Flow**: Verifies registered email address in the database, sends a Firebase reset link, and provides inline password updates.

- **Native PWA Experience**:
  - Installable directly to your iOS or Android home screen with custom icons.
  - Service worker precaching for fast loading and offline usage.
  - Safe-area inset support for modern mobile screens.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS |
| **Icons** | Lucide React |
| **State & Data** | Zustand, Custom React Hooks |
| **Backend & Cloud** | Firebase Realtime Database, Firebase Authentication |
| **Offline & PWA** | `vite-plugin-pwa`, Workbox, LocalStorage cache |
| **Testing** | Vitest (19 passing unit & integration tests) |
| **Deployment** | Netlify / Vercel (Static SPA with `_redirects`) |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- `npm` (version 9 or higher)

### 1. Clone the Repository
```bash
git clone https://github.com/Ashutosh2275/Expense-Tracker.git
cd Expense-Tracker
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Firebase credentials (or use the built-in defaults):
```bash
cp .env.example .env
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing

Run the automated test suite powered by Vitest:
```bash
npm run test
```

All 19 test suites validate:
- Exact 1-paise split distribution across participants
- Contact debt and balance computations
- Full settlement lifecycles and balance zeroing
- Authentication uniqueness and credential handling

---

## 📦 Production Build & Netlify Deployment

### Build the Application
```bash
npm run build
```
This generates the optimized production artifacts in the `dist/` directory.

### Deploy to Netlify
1. Go to [Netlify Drop](https://app.netlify.com/drop).
2. Drag and drop the **`dist`** folder into Netlify.
3. Your app is immediately live with HTTPS, service worker caching, and SPA redirect rules.

---

## 📱 Installing on Mobile (PWA)

### iOS (Safari)
1. Open the deployed website in Safari.
2. Tap the **Share** button (rectangle with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.

### Android (Chrome)
1. Open the deployed website in Google Chrome.
2. Tap the three dots menu in the top right.
3. Tap **Install app** or **Add to Home screen**.

---

## 📄 License
This project is open-source and free for personal use under the MIT License.
