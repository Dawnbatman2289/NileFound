# NileFound

A privacy-focused campus lost-and-found app for Nile University of Nigeria.

**Status:** working prototype; not launched and not yet validated with a student survey.

## Features

- Google sign-in and email/password authentication with verified Nile University email access.
- Email verification, password reset, and account-provider error handling.
- Lost and found item reporting with official campus locations.
- Claim workflow with owner/admin moderation and restricted private details.
- Recipient-scoped notifications and a responsive feed with debounced search and saved filters.
- Firebase Firestore and Storage rules with UID-based ownership and verified-user checks.
- Installable PWA manifest, hashed-asset caching, and an offline navigation fallback.
- Admin Control Center for moderation, roles, private item details, and audit views.

## How it works

```mermaid
flowchart LR
  User[Verified campus user] --> App[React + Vite app]
  App --> Auth[Firebase Auth]
  App --> Firestore[Firestore]
  App --> Storage[Firebase Storage]
```

## Security and privacy

The app requires a verified Nile University email for normal user access. Ownership checks protect item changes, while reporter contact information, claim details, and verification answers are kept in restricted item subcollections. Student ID details are withheld from the public feed. Firebase rules—not the UI—enforce the access boundary.

The Firebase web configuration contains public client identifiers. Protection comes from Firebase rules and domain-restricted API-key settings; never commit private credentials.

## Tech stack

- React 19
- TypeScript 7
- Vite 8
- Tailwind CSS 4
- Firebase Auth, Firestore, and Storage
- Motion and Lucide React

## Run locally

```bash
npm install
npm run dev
```

Create your own Firebase project, enable Google and Email/Password authentication, configure the Firebase web client values, and deploy the Firestore and Storage rules. Then run:

```bash
npm test
npm run lint
npx vite build
```

## Project structure

- `src/components/` UI and workflows
- `src/services/` Firebase persistence
- `src/utils/` validation, filtering, matching, and exports
- `firestore.rules` and `storage.rules` security boundaries
- `public/` PWA manifest, service worker, and offline fallback

## Known limitations and roadmap

This prototype has no Cloud Functions or server-side email service. The feed currently loads the latest 20 items rather than providing full pagination, and the service worker only provides static-asset caching and an offline navigation fallback; it does not cache private Firebase data. Broader browser testing, App Check enforcement, and student usability research remain outstanding.

## Screenshots

Screenshots belong in `docs/screenshots/`. This repository currently includes a placeholder note rather than generated or private AI Studio media.

## Contributing

Use focused patches, preserve security rules, add tests for rule changes, and do not commit secrets or personal data.

## License

MIT. See `LICENSE`.

## Author

NileFound project author — Nile University of Nigeria.
