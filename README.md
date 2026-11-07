# NileFound - Campus Lost & Found Web App

Production-grade, privacy-conscious progressive web app engineered for students, security personnel, and administrators at Nile University of Nigeria, Abuja.

---

## 1. Stack & Visual Architecture

- **Frontend**: React 19, TypeScript, Vite 8, Progressive Web App (PWA)
- **Design System & Theme**:
  - **Background**: Deep Navy (`#0B1020`)
  - **Primary Action Accent**: Electric Lime (`#C6FF3D`) with subtle radar ping pulse on key report triggers
  - **Cards & Surfaces**: Muted Navy (`#141B33`) with 20px rounded corners and faint lime hover glow
  - **Typography**: Bricolage Grotesque (headings) & Inter (body text)
  - **Contrast**: Full WCAG AA compliant with minimum 44px thumb touch targets
- **Authentication**: Firebase Authentication (Single-Tap Google Sign-In)
- **Database**: Cloud Firestore with hardened field-level security rules
- **Storage**: Firebase Storage with client-side image compression (<100KB) and EXIF data scrubbing
- **Hosting**: Google AI Studio Preview & Production Runtime

---

## 2. Role-Based Access Control (RBAC) & Permissions

### Master Administrator (Sole Authority)
- **Authorized Email**: `ayomide2289@gmail.com`
- **Exclusive Privileges**:
  - The **only** account permitted to write to `/roles/{userId}` in Cloud Firestore.
  - The **only** account with access to the role provisioning interface in the Admin Control Center to grant or revoke Admin and Security roles.
  - Full override permissions to moderate items, approve/reject claim requests, and delete campus listings.
  - The **only** account permitted to see, test, and switch between simulated campus demo personas.

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
- Reports lost or found items with anti-theft secret questions.
- Answers finder anti-theft challenge questions to verify ownership.
- Can only edit or delete their own active reports (`authorId == request.auth.uid`).
- **Never sees demo accounts or simulation controls.**

---

## 3. Strict Demo Account Isolation (Admin Only)

To prevent confusion among students and maintain clean university records:
- **General Campus Users & Visitors**:
  - Demo accounts (Campus Administrator, Chidera Eze, Officer Musa) are **completely hidden and disabled**.
  - General visitors only see the official **Sign in with Google** interface.
- **Master Admin (`ayomide2289@gmail.com`)**:
  - Has exclusive access to the **Admin Persona Switcher** (available on the sign-in page and inside the Admin Control Center).
  - Can switch between test personas with one click:
    1. **Master Administrator**: `ayomide2289@gmail.com` (Root owner)
    2. **Campus Administrator**: `admin@nileuniversity.edu.ng` (Student Affairs custody)
    3. **Chidera Eze (Student)**: `chidera@nileuniversity.edu.ng` (Student reporting & claims)
    4. **Officer Musa (Security)**: `security.gate@nileuniversity.edu.ng` (Main Gate custody)
  - Whenever a test persona is active, a persistent top simulation banner indicates the simulated role and provides an instant **Return to Master Admin** button.

---

## 4. Spark Plan (Free Tier) Security Architecture

### Why Firebase Custom Claims Are Not Used
Firebase Auth Custom Claims (`setCustomUserClaims`) require the Firebase Admin SDK running in a trusted server environment or Firebase Cloud Functions. On the Firebase **Free Spark Plan**, Cloud Functions are not available (they require the Blaze Pay-As-You-Go plan).

### Secure Free-Tier Alternative Implemented
Instead of client-side role forgery, access is enforced through two layers:
1. **Root Email Hardening in Security Rules**:
   `request.auth.token.email == 'ayomide2289@gmail.com' && request.auth.token.email_verified == true`
2. **Server-Side Firestore Document Check (`/roles/{uid}`)**:
   Rules check `get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'admin'`. Only `ayomide2289@gmail.com` has permission to write to this path.

---

## 5. Anti-Theft Verification Flow

To prevent opportunistic theft of valuable items (phones, power banks, Casio calculators, lab coats):
1. **Finders Create a Challenge**: When reporting a found item, the finder provides a public question (e.g. *"What is the inscription inside the battery compartment?"*) and a private answer stored in `/items/{itemId}/secrets/verification`.
2. **Public Feed Concealment**: Genuine answers are never returned to the public feed.
3. **Claimant Submission**: Claimants enter their answer, which is written to `/claims/{claimId}`.
4. **Admin Review**: Only administrators and campus security can compare the submitted answer against the secret answer to approve the return.

---

## 6. Automated PII Protection

- **Sensitive ID Cards**: Any item categorized as `student_id` is automatically flagged as sensitive. The photo is withheld from the feed, and the card must be deposited at the Main Gate Security Post.
- **Client-Side Redaction**: Titles, descriptions, and challenge questions are automatically scanned for phone numbers (+234 format), email addresses, and student matric numbers (e.g., `23/ENG/0481`). Posts containing raw PII are blocked with actionable advice.

---

## 7. Real-Time Notification System & Admin Alerts

NileFound includes a multi-channel notification architecture designed to work reliably on campus network conditions:

### 1. In-App Notification Center & Sound Alerts
- **Campus Bell Trigger**: Located in the top header with real-time unread badges.
- **Web Audio Chimes**: Generates pleasant, low-latency synthetic two-tone chime (`playNotificationChime()`) using the Web Audio API without downloading external audio files or consuming mobile bandwidth.
- **Desktop & Mobile Push Alerts**: Integrates native HTML5 browser notifications with one-tap user permission.

### 2. Dedicated Root Admin Desk (`ayomide2289@gmail.com`)
- **Exclusive Operational Visibility**: High-priority alerts for new reports (e.g. sensitive ID card deposits, laptops, phones) and ownership claim submissions are marked `forAdminOnly: true`.
- **Targeted Notification Filtering**: Standard students only see public lost & found updates. Only `ayomide2289@gmail.com` and authorized staff have access to the **Admin Alerts** tab.
- **Direct University Email Dispatch**:
  - One-click **Dispatch Email** formats a complete incident brief with timestamps in WAT (West Africa Time), physical custody location, reporter contact details, and direct link to the NileFound Admin Desk.
  - Automatically addresses dispatches to `ayomide2289@gmail.com` using zero-quota client-side mailto protocols.
  - Keeps an audit registry under the **Email Log** tab with re-open capabilities.

---

## 8. Understanding the GCP "Token Service API" Message

If you previously encountered a Google Cloud error:
> *"Missing required permission serviceusage.services.enable on project kempt-coyote-nc70r"*

**What caused it**:
This message appeared when attempting to manually open a GCP link for `securetoken.googleapis.com` on the auto-provisioned cloud project. In AI Studio container environments, cloud project service enablement is managed by the system rather than end-user IAM accounts.

**How NileFound resolves this**:
1. Single-tap **Google Sign-In** with automatic token caching is used instead of email/password token generation.
2. The application includes resilient offline fallback mode so you and your students can always navigate, report items, and audit custody smoothly without getting blocked by transient network or GCP service propagation delays.

---

## 8. How to Provision New Staff Roles

Only `ayomide2289@gmail.com` can perform this step:

1. Sign in to NileFound using `ayomide2289@gmail.com`.
2. Click **Admin Control Center** on the navigation bar.
3. Select the **Staff Roles & Security** tab.
4. Enter the user's **Firebase UID** and official university email.
5. Choose **Campus Security Officer** or **Administrator** and click **Assign Role**.
6. The role document is immediately saved to `/roles/{uid}` in Cloud Firestore.

---

## 9. Manual Firebase Console Checklist

Complete these steps in your [Firebase Console](https://console.firebase.google.com/):

- [ ] **Firestore Rules**: Ensure `firestore.rules` is deployed (deployed via system tool, verify under Firestore > Rules).
- [ ] **Storage Rules**: Paste contents of `storage.rules` into Firebase Storage > Rules.
- [ ] **Authentication Providers**: Ensure **Google** is enabled under Auth > Sign-in method.
- [ ] **Authorized Domains**: Add your AI Studio hosting domains (`ais-dev-*.run.app`, `ais-pre-*.run.app`) under Auth > Settings > Authorized domains.
- [ ] **API Key Restrictions**: In Google Cloud Console, restrict your Firebase Web API key (`AIzaSyCz...`) to HTTP referrers matching your application domains.
