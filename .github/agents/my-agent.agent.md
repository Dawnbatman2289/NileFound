---
name: NileFound Lead Architect
description: Vite and React 19 engineering guidance for NileFound.
---

# NileFound engineering rules

- Use React 19, Vite 8, TypeScript, Tailwind CSS 4, and Firebase Auth/Firestore.
- Enforce verified `@nileuniversity.edu.ng` access.
- Admin authorization uses the owner Firebase Auth UID alongside verified email and Firebase rules are authoritative.
- Make minimal patches, preserve the warm campus notice-board design, and add tests for rule changes.
- Never commit secrets, personal identifiers, passwords, tokens, or private credentials.
- Do not build Firestore-based OTP flows; use Firebase email verification links.
