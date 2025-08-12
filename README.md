# RetailOps – Final (with Rokar Entry)

This build includes:
- React + Vite + Tailwind
- Firebase Auth + Firestore
- Admin pages: Stores, Managers (invites), Employees
- **Bulk Upload** (Jan Excel format) with deterministic doc IDs
- **Rokar Entry** form (per day, per store). Opening auto-fills from previous day's **closingBalance**. Closing computed.
- **Admin Seed** page for January JSON (optional).

## Run
```bash
npm install
npm run dev
# open http://localhost:5173
```

## Firebase Rules (paste & publish)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function role() {
      return request.auth != null
        ? get(/databases/$(db)/documents/users/$(request.auth.uid)).data.role
        : null;
    }

    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /rokar/{docId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && role() in ['ADMIN','MANAGER'];
    }

    match /stores/{storeId} {
      allow read: if request.auth != null;
      match /staff/{staffId} {
        allow read: if request.auth != null;
      }
    }

    match /invites/{inviteId} {
      allow read, write: if request.auth != null && role() == 'ADMIN';
    }
  }
}
```

## Make yourself ADMIN
- Sign up/login once.
- Firestore → `users/{your-uid}` → set `role: "ADMIN"`.
- Sign out/in.

## Usage
- **My Stores**: add stores.
- **Rokar Entry**: pick store + date, fill numbers, save. One doc per (storeId + date).
- **Bulk Upload**: select store, import January Excel. Deterministic IDs prevent duplicates.
- **Admin Managers**: invite managers by email and assign stores.
- **Admin Employees**: add staff list for each store.
