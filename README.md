# 🔌 CablePull Tracker — React Native App

A native Android app for low-voltage field technicians to track cable pulls across IDF closets on active job sites.
Track rough pull / terminated / tested status across single, double, triple, and quad drops — then export polished PDF and Excel reports to share with project managers.

---

## 📋 Features

### Drop Management
- ✅ Add **Single, Double, Triple, and Quad** cable drops
- ✅ **Custom drop types** — label drops by device (Camera, Card Reader, WAP, etc.)
- ✅ Track **Rough Pull / Terminated / Tested** status per drop
- ✅ **Patched** status with per-cable tracking
- ✅ **Mark as Complete** override — manually mark a drop done regardless of individual status flags
- ✅ **Attention flags** — tag drops that need a second look
- ✅ Free-text **notes** per drop
- ✅ **Duplicate cable ID detection** — flags conflicting IDs within the same IDF and drop type
- ✅ **Last updated** timestamp auto-stamped on every save

### Projects & Organization
- ✅ Organize drops into **Projects**
- ✅ **Project Groups** — bundle multiple projects under a single group for multi-site jobs
- ✅ **Archive** completed projects
- ✅ **IDF closet management** — assign drops to named IDF closets per project
- ✅ **Drop templates** — save common drop configurations for quick reuse

### Importing
- ✅ **Bulk Import** — generate a numbered range of cable IDs at once (e.g. C-001 through C-120)
- ✅ Configurable grouping (Single / Double / Triple / Quad) and zero-padding on bulk import
- ✅ Assign IDF closet and custom drop type during bulk import

### Search, Filter & Sort
- ✅ Search drops by cable ID, notes, or type
- ✅ Filter by IDF closet
- ✅ Filter by status: Complete, Incomplete, Terminated, Rough Only, Patched, Attention, Notes
- ✅ Sort and lock drop order

### Dashboard & Stats
- ✅ Live **progress dashboard** per project — drop counts, completion %, per-stage stats
- ✅ Group-level stats across all bundled projects

### Export
- ✅ **Export to PDF** — grouped by IDF, with summary stats, drop types breakdown, By IDF progress overview, and attention flags callout section
- ✅ **Export to Excel (.xlsx)** — multi-sheet workbook with Cable Drops, Project Summary, and By IDF Breakdown sheets
- ✅ **Group Excel export** — Portfolio Dashboard + per-project sheets in a single workbook
- ✅ Excel exports include **print headers/footers**, **formula cell protection**, and **live formulas** (Yes/No dropdowns stay editable)
- ✅ **Last Updated** column reflects the most recent change to each drop

### General
- ✅ Data persists **on-device** — no internet or account required
- ✅ Works fully **offline**

---

## 📁 File Structure

```
CablePullTracker/
├── App.js                        ← Root entry point, state management, navigation
├── app.json                      ← Expo app config
├── package.json                  ← Dependencies
├── babel.config.js               ← Babel config
├── eas.json                      ← Build config (APK/AAB)
└── src/
    ├── theme.js                  ← Colors & style constants
    ├── utils.js                  ← Shared helpers (uid, today, etc.)
    ├── exportUtils.js            ← PDF & single-project XLSX export
    ├── exportGroupUtils.js       ← Group-level XLSX export (portfolio workbook)
    ├── components/
    │   ├── DropCard.js           ← Expandable drop card with status controls
    │   ├── ProjectCard.js        ← Project summary card with stats & actions
    │   ├── BulkImportModal.js    ← Bulk cable ID import modal
    │   ├── TabBar.js             ← Bottom navigation bar
    │   └── Toast.js             ← In-app notification toast
    └── screens/
        ├── ProjectsScreen.js     ← Projects list, groups, archiving
        ├── DropsScreen.js        ← Drop list, filters, search, sort
        ├── DashboardScreen.js    ← Stats overview & export
        └── SettingsScreen.js     ← IDF closet & custom type management
```

---

## 🛠 Setup Instructions

### Step 1 — Install Node.js

Download and install Node.js (LTS version) from:
👉 https://nodejs.org

Verify it installed:
```
node --version
npm --version
```

### Step 2 — Install Expo CLI

```
npm install -g expo-cli eas-cli
```

### Step 3 — Set up the project

Navigate to the project folder and install dependencies:
```
cd path/to/CablePullTracker
npm install
```

---

## 📱 Option A — Run on Your Phone (No Build Needed)

The fastest way to test the app on a real device.

1. Install **Expo Go** from the Google Play Store.
2. In your terminal, run:
   ```
   npx expo start
   ```
3. Scan the QR code with the **Expo Go** app.
4. The app loads instantly. ✅

> ⚠️ Your phone and computer must be on the same Wi-Fi network.

---

## 📦 Option B — Build a Real APK

Produces a standalone `.apk` that installs like a normal app — no Expo Go needed.

```bash
# 1. Create a free account at https://expo.dev, then log in:
eas login

# 2. Configure the build (first time only):
eas build:configure

# 3. Build the APK:
eas build --platform android --profile preview
```

The build runs in Expo's cloud (free tier, ~5–15 min). When complete you'll get a download link for the `.apk`.

To install: download the `.apk` to your Android phone, open it, and allow installation from unknown sources when prompted.

---

## 🐛 Common Issues

| Problem | Fix |
|---------|-----|
| `npm install` fails | Verify Node.js is installed correctly |
| QR code won't scan | Confirm phone and computer are on the same Wi-Fi |
| Build fails | Run `eas diagnostics` to check your setup |
| App won't install | Enable "Install unknown apps" in Android Settings → Security |
