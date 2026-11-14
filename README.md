# Hisab

A Splitwise-style expense splitter for Android. **No accounts, no phone numbers, no emails**: friends are just names, and all data stays on the phone.

## Features (v0.1)
- Groups (trip, home, couple, friends, other) with a currency each
- People added by **name only**; add them while creating a group or an expense
- Expenses with category, date, notes, edit and delete
- Split **equally, by exact amounts, by percentages, by shares, or by adjustment**
- **Multiple payers** for one expense
- Balances per group, **Simplify group debts** toggle, per-person balances and an overall balance
- **Settle up** with suggested payments, recorded as payments
- Non-group expenses between people
- Activity feed, share a group summary as text (WhatsApp friendly)
- Light and dark theme, INR default, 13 currencies
- Backup and restore (JSON) and CSV export

## Get the APK (no Android Studio needed)
1. Create a new private repository on GitHub and push this folder to the `main` branch.
2. Open the repo's **Actions** tab. The **Build Android APK** workflow runs on every push (about 5 minutes). You can also run it by hand with *Run workflow*.
3. When it finishes, open the repo's **Releases** page on your phone, download `hisab.apk` from **Hisab (latest build)** and install it. Allow "install unknown apps" for your browser when asked.

## Build locally instead
Needs Node 22, JDK 21 and Android Studio (or the Android SDK).
```bash
npm install
npm test
npm run android:sync        # builds the web app and copies it into android/
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
Open the `android/` folder in Android Studio to run on an emulator or a USB-connected phone.

## Develop in the browser
```bash
npm run dev
```

## Project layout
- `src/lib/split.ts` split maths (integer minor units, remainders handled so totals always match)
- `src/lib/balances.ts`, `summary.ts` who owes whom, simplified debts, per-person balances
- `src/lib/store.ts` local storage persistence (data never leaves the device)
- `src/screens/` one file per screen
- `android/` the Capacitor Android project

The APK is a **debug** build, signed with the fixed key in `android/keystore/` so new versions install over old ones. That is fine for your own use and for sharing with friends. Publishing on the Play Store needs a release keystore.
