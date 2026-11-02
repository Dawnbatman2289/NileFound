# NileFound - Campus Lost & Found Web App

Production-grade, privacy-conscious progressive web app engineered for students, security personnel, and administrators at Nile University of Nigeria, Abuja.

---

## 1. Stack & Architecture

- **Frontend**: React 19, TypeScript, Vite 8
- **Styling**: Tailwind CSS v4 (Nile Blue `#002B66` / `#0F3D78` primary branding)
- **Icons**: Lucide Icons
- **Authentication**: Firebase Authentication (Google Sign-In)
- **Database**: Cloud Firestore
- **Storage**: Firebase Storage (with strict client compression <100KB)
- **Hosting**: Google AI Studio Preview & Production Runtime

---

## 2. Role-Based Access Control (RBAC) & Permissions

### Master Administrator (Sole Authority)
- **Authorized Email**: `ayomide2289@gmail.com`
- **Exclusive Privileges**:
  - The **only** account permitted to write to `/roles/{userId}` in Cloud Firestore.
  - The **only** account with access to the role provisioning interface in the Admin Control Center to grant or revoke Admin and Security roles.
  - Full override permissions to moderate items, approve/reject claim requests, and delete campus listings.

### Campus Administrator
- Has access to the **Admin Control Center**.
- Approves or rejects ownership claim requests.
- Reviews custody records across campus buildings.
- Exports audit CSV reports for Nile University Student Affairs.
- Auto-expires listings older than 30 days.

### Campus Security Officer
- Manages physical custody of items handed in at the **Main Gate Security Post**, **Student Affairs Office**, and **Library Desk**.
- Reviews claimant verification answers during in-person handovers.

### Student / Campus Member
- Browses campus feed.
- Reports lost or found items.
- Answers finder anti-theft challenge questions to verify ownership.
- Can only edit or delete their own active reports (`authorId == request.auth.uid`).

---

## 3. Spark Plan (Free Tier) Security Architecture

### Why Firebase Custom Claims Are Not Used
Firebase Auth Custom Claims (`setCustomUserClaims`) require the Firebase Admin SDK running in a trusted server environment or Firebase Cloud Functions. On the Firebase **Free Spark Plan**, Cloud Functions are not available (they require the Blaze Pay-As-You-Go plan).

### Secure Free-Tier Alternative Implemented
Instead of client-side role forgery, access is enforced through two layers:
1. **Root Email Hardening in Security Rules**:
   `request.auth.token.email == 'ayomide2289@gmail.com' && request.auth.token.email_verified == true`
2. **Server-Side Firestore Document Check (`/roles/{uid}`)**:
   Rules check `get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'admin'`. Only `ayomide2289@gmail.com` has permission to write to this path.

---

## 4. Anti-Theft Verification Flow

To prevent opportunistic theft of valuable items (phones, power banks, Casio calculators, lab coats):
1. **Finders Create a Challenge**: When reporting a found item, the finder provides a public question (e.g. *"What is the inscription inside the battery compartment?"*) and a private answer stored in `/items/{itemId}/secrets/verification`.
2. **Public Feed Concealment**: Genuine answers are never returned to the public feed.
3. **Claimant Submission**: Claimants enter their answer, which is written to `/claims/{claimId}`.
4. **Admin Review**: Only administrators and campus security can compare the submitted answer against the secret answer to approve the return.

---

## 5. Automated PII Protection

- **Sensitive ID Cards**: Any item categorized as `student_id` is automatically flagged as sensitive. The photo is withheld from the feed, and the card must be deposited at the Main Gate Security Post.
- **Client-Side Redaction**: Titles, descriptions, and challenge questions are automatically scanned for phone numbers (+234 format), email addresses, and student matric numbers (e.g., `23/ENG/0481`). Posts containing raw PII are blocked with actionable advice.

---

## 6. How to Provision New Staff Roles

Only `ayomide2289@gmail.com` can perform this step:

1. Sign in to NileFound using `ayomide2289@gmail.com`.
2. Click **Admin Control Center** on the navigation bar.
3. Select the **Staff Roles & Security** tab.
4. Enter the user's **Firebase UID** and official university email.
5. Choose **Campus Security Officer** or **Administrator** and click **Assign Role**.
6. The role document is immediately saved to `/roles/{uid}` in Cloud Firestore.

---

## 7. Manual Firebase Console Checklist

Complete these steps in your [Firebase Console](https://console.firebase.google.com/):

- [ ] **Firestore Rules**: Ensure `firestore.rules` is deployed (deployed via system tool, verify under Firestore > Rules).
- [ ] **Storage Rules**: Paste contents of `storage.rules` into Firebase Storage > Rules.
- [ ] **Authentication Providers**: Ensure **Google** is enabled under Auth > Sign-in method.
- [ ] **Authorized Domains**: Add your AI Studio hosting domains (`ais-dev-*.run.app`, `ais-pre-*.run.app`) under Auth > Settings > Authorized domains.
- [ ] **API Key Restrictions**: In Google Cloud Console, restrict your Firebase Web API key (`AIzaSyCz...`) to HTTP referrers matching your application domains.
