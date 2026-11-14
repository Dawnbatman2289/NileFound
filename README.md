# NileFound

A privacy-focused campus lost-and-found app for Nile University of Nigeria.

**Status:** working prototype; not launched and not yet validated with a student survey.

## Features

- Google sign-in and email/password authentication with verified Nile University email access.
- Email verification, password reset, and account-provider error handling.
- Lost and found item reporting with official campus locations and read-time 60-day expiry.
- Claim workflow with owner/security/admin moderation, restricted private subcollections, and approved handover contact lookup.
- Recipient-scoped notifications and a responsive feed with search-aware pagination and saved filters.
- Firebase Firestore rules with UID-based ownership, server timestamps, paginated lists (`limit <= 50`), and verified-user checks.
- Installable PWA manifest, self-hosted fonts, hashed-asset caching, and an offline navigation fallback.
- Admin and Campus Security Control Center for moderation, staff roles, custody records, and CSV exports.

## How it works

```mermaid
flowchart LR
  User[Verified campus user] --> App[React + Vite app]
  App --> Auth[Firebase Auth]
  App --> Firestore[Firestore]
```

## Security and privacy

Normal user access requires a verified `@nileuniversity.edu.ng` email. Ownership checks protect item changes, while reporter contact details, claim answers, and verification secrets live in restricted item subcollections. Item photos generate a tiny inline thumbnail (`thumbUrl <= 3 KB`) on feed docs while the full compressed image lives in `items/{id}/media/full` and is fetched on demand (never in Low-Data mode); student ID items block `thumbUrl`, `imageUrl`, and `media/full` in both Firestore rules and the UI, and deleting an item cleans up its private subcollections.

The Firebase web configuration contains public client identifiers. Protection comes from Firebase security rules and HTTP-referrer-restricted API-key settings; never commit service account keys or private credentials. To self-host on a different Firebase project, replace the project owner UID and email constants in `firestore.rules` alongside `firebase-applet-config.json`.

## Tech stack

- React 19
- TypeScript 7 (`strict: true`)
- Vite 8
- Tailwind CSS 4
- Firebase Auth and Firestore
- Motion and Lucide React

## Run locally

Requires Node.js `>=24.12.0`.

```bash
npm install
npm run dev
```

Create your own Firebase project, enable Google and Email/Password authentication, configure the Firebase web client values in `firebase-applet-config.json`, update the admin UID/email in `firestore.rules` and `scripts/bootstrap-admin.mjs`, and deploy rules plus composite indexes (`firestore.indexes.json`). On a fresh project, run `node scripts/bootstrap-admin.mjs <uid> <email>` with Firebase Admin credentials to provision the root `/admins/{uid}` and `/roles/{uid}` records. Then run:

```bash
npm test
npm run lint
npm run build
```

With Java installed locally, you can also run the Firestore emulator rules test suite:

```bash
npm run test:emulator
```

Deploy rules, composite indexes, and Hosting headers (`firebase.json` + `.firebaserc`):

```bash
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

## Project structure

- `src/components/` UI and workflows
- `src/services/` Firebase persistence
- `src/utils/` validation, filtering, matching, and exports
- `firestore.rules` and `firestore.indexes.json` security boundaries and query indexes
- `scripts/bootstrap-admin.mjs` one-off Admin SDK bootstrap helper for fresh deployments
- `.github/workflows/ci.yml` CI pipeline running lint, unit tests, and build checks
- `public/` PWA manifest, icons, service worker, and offline fallback

## Known limitations and roadmap

This prototype uses client-triggered expiry and read-time 60-day checks alongside Admin/Security Desk actions, and the service worker only caches static assets and fonts rather than private Firebase data. Broader browser testing, App Check enforcement, and student usability research remain outstanding.

## Contributing

Use focused patches, preserve security rules, add tests for rule changes, and do not commit secrets or personal data.

## License

MIT. See `LICENSE`.

## Author

Ayomide — Nile University of Nigeria.
