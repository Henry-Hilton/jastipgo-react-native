# JasTipGo

JasTipGo is a React Native app for the Universitas Surabaya final project. A single account can switch between Penitip and Jastiper from the Akun tab. The project uses the Expo SDK 58 already installed in the starter.

## Run

```powershell
npm ci
npm start
```

Scan the QR code with a compatible Expo Go on Android or iOS. For the browser, run `npm run web`. Use a phone to test taking the check-in selfie and collecting GPS coordinates.

The app defaults to `https://ubaya.fun/flutter/160423172`, the existing course-hosted PHP API. The shorter path `https://ubaya.fun/160423172` currently returns 404. If the instructor provides a different API path, copy `.env.example` to `.env.local`, update `EXPO_PUBLIC_API_BASE_URL`, and restart Expo. API URLs are public build settings. Accounts, balances, and orders belong to the configured server.

## Demo flow

1. Register two accounts. On the seller account, open Akun and switch to Jastiper.
2. Open a trip, then add a product with a photo, price, stock, and multiple categories. Trip and product edit forms load the saved values from the server.
3. On the buyer account, combine product, trip or destination, and category filters. Save a favorite, request another product, and top up the demo balance.
4. Approve the request on the seller account and enter its price, stock, categories, and photo. The approved item appears in the catalog.
5. Add items to the buyer cart and pay with the balance. Open the seller trip to see the shopping summary.
6. Advance the order from paid to purchased to delivered on the seller account. Confirm receipt on the buyer account to release payment, then leave a review.
7. On the trip dates, start the live trip and check in with a selfie and current GPS location on a phone. The buyer's trip screen fetches new check-ins every 15 seconds while open.
8. Check the activity inbox in Akun. The three extra features are favorites, verified reviews, and the inbox.

Session restoration uses AsyncStorage, the React Native persistence approach covered in Week 5. Authentication uses expiring bearer sessions. The backend enforces ownership and roles, checks stock, and records checkout and settlement in database transactions.

## PHP/MySQL

`backend/` contains the PHP API and MySQL schema reused from the existing JasTipGo backend. The app communicates with `api.php` and uploads Base64 photos to `uploadimage.php`. `image.php` serves the normalized PNGs from `images/[user_id]/`.

For a separate installation, import `backend/schema.sql` into a MySQL 8 or MariaDB database. Copy `backend/config.example.php` to `backend/config.php` and enter the database credentials. PHP 8.1+ needs PDO MySQL and GD, a writable `images/` directory, and support for at least 12 MB POST bodies. Serve the API over HTTPS in production. Keep SQL, credentials, and local tooling private and block direct access to raw uploads. Use the packaged PHP router for a local development server.

```powershell
php -S 127.0.0.1:8091 -t backend backend/router.php
```

Set `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8091` for a browser on the same computer. A phone needs an API URL reachable from the phone.

## Checks

```powershell
npm run lint
npx tsc --noEmit
npx expo export --platform web
npx expo export --platform android
```

The native map uses react-native-maps and its platform map providers. Standalone Android builds need a Google Maps API key configured through the react-native-maps Expo config plugin. The browser map uses [OpenStreetMap](https://www.openstreetmap.org/copyright). Product and check-in images come from users.

The assignment calls for a ZIP named `JasTipGo_[NRP1]_[NRP2]_[NRP3].zip` with the project folder. Omit `node_modules`, build output, credentials, and uploads from the ZIP.
