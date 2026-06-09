# 🔌 CablePull Tracker — React Native App

A native Android app for tracking cable pulls across IDF closets.
Tracks rough pull / terminated / tested status, supports double drops, and exports PDF + Excel reports.

---

## 📁 File Structure

```
CablePullTracker/
├── App.js                        ← Root entry point
├── app.json                      ← Expo app config
├── package.json                  ← Dependencies
├── babel.config.js               ← Babel config
├── eas.json                      ← Build config (APK/AAB)
└── src/
    ├── theme.js                  ← Colors & constants
    ├── utils.js                  ← Helpers
    ├── exportUtils.js            ← PDF & XLSX export logic
    ├── components/
    │   ├── DropCard.js           ← Expandable drop card
    │   ├── TabBar.js             ← Bottom navigation
    │   └── Toast.js              ← Notification toast
    └── screens/
        ├── DropsScreen.js        ← Main drop list
        ├── DashboardScreen.js    ← Stats & export
        └── SettingsScreen.js     ← IDF management
```

---

## 🛠 Setup Instructions (Step by Step)

### Step 1 — Install Node.js
Download and install Node.js (LTS version) from:
👉 https://nodejs.org

Verify it installed:
```
node --version
npm --version
```

### Step 2 — Install Expo CLI
Open a terminal (Command Prompt on Windows, Terminal on Mac) and run:
```
npm install -g expo-cli eas-cli
```

### Step 3 — Set up this project
Navigate to your project folder in the terminal:
```
cd path/to/CablePullTracker
```

Install all dependencies:
```
npm install
```

---

## 📱 Option A — Run Immediately on Your Phone (No Build Needed)

This is the fastest way to test the app on your Android device.

1. Install **Expo Go** from the Google Play Store on your Android phone.
2. In your terminal, run:
   ```
   npx expo start
   ```
3. A QR code will appear in the terminal.
4. Open the **Expo Go** app on your phone and scan the QR code.
5. The app will load on your phone instantly! ✅

> ⚠️ Your phone and computer must be on the same Wi-Fi network.

---

## 📦 Option B — Build a Real APK (Installs like a Normal App)

This creates an `.apk` file you can install on any Android phone without Expo Go.

### Step 1 — Create a free Expo account
Sign up at: https://expo.dev

### Step 2 — Log in from your terminal
```
eas login
```

### Step 3 — Configure the build (first time only)
```
eas build:configure
```
When asked "Which platforms would you like to configure?", choose **Android**.

### Step 4 — Build the APK
```
eas build --platform android --profile preview
```
- This uploads your code to Expo's servers and builds it in the cloud (free tier).
- It takes about 5–15 minutes.
- When done, you'll get a **download link** for your `.apk` file.

### Step 5 — Install on your Android phone
1. Download the `.apk` file to your Android phone.
2. Open it — Android will ask to allow installation from unknown sources.
3. Tap **Install**. Done! ✅

The app icon will appear on your home screen.

---

## 🔄 Making Updates

After changing any code:
- If using **Expo Go**: changes appear live (just save the file).
- If using **APK**: re-run `eas build --platform android --profile preview` to get a new APK.

---

## 🏗 Building for the Play Store (Optional)

To publish to the Google Play Store:
```
eas build --platform android --profile production
```
This produces an `.aab` file for Play Store submission.
You'll need a Google Play Developer account ($25 one-time fee).

---

## 🐛 Common Issues

| Problem | Fix |
|---|---|
| `npm install` fails | Make sure Node.js is installed correctly |
| QR code won't scan | Make sure phone and computer are on same Wi-Fi |
| Build fails | Run `eas diagnostics` to check your setup |
| App won't install | Enable "Install unknown apps" in Android Settings → Security |

---

## 📋 Features

- ✅ Add single or double cable drops
- ✅ Track Rough Pull / Terminated / Tested per drop
- ✅ Assign drops to IDF closets
- ✅ Add free-text field notes
- ✅ Search and filter drops
- ✅ Progress stats dashboard
- ✅ Export to PDF (share/print)
- ✅ Export to Excel (.xlsx)
- ✅ Data persists on device (no internet required)
- ✅ Manage custom IDF closet list
