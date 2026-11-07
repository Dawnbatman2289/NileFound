/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Stage 3 Architectural Options & Decision Matrix
 */

export interface SolutionOption {
  id: string;
  name: string;
  stack: string;
  description: string;
  scores: {
    freeTierLimits: number; // 1-10 (25% weight)
    offlineBandwidth: number; // 1-10 (25% weight)
    privacyRls: number; // 1-10 (20% weight)
    developerErgonomics: number; // 1-10 (15% weight)
    marketability: number; // 1-10 (15% weight)
  };
  monthlyHostingCostNgn: number;
  freeTierCaveats: string[];
  pros: string[];
  cons: string[];
}

export const SOLUTION_OPTIONS: SolutionOption[] = [
  {
    id: 'option-a',
    name: 'Option A: Decoupled Jamstack PWA (Recommended)',
    stack: 'React (Vite PWA) + Firebase (Firestore, Auth, Storage) + AI Studio hosting',
    description: 'React PWA using Firebase Firestore, Authentication, Storage, and security rules without server-side functions.',
    scores: {
      freeTierLimits: 9,
      offlineBandwidth: 10,
      privacyRls: 10,
      developerErgonomics: 9,
      marketability: 10
    },
    monthlyHostingCostNgn: 0,
    freeTierCaveats: [
      'Firebase Spark limits reads, writes, and storage usage, so queries must remain bounded.',
      'Storage uploads are compressed and restricted to verified users and approved image types.',
      'AI Studio hosting serves the static application; no server-side functions are required.'
    ],
    pros: [
      'Firestore Security Rules protect student data at the database boundary.',
      'Firebase Auth, Firestore, and Storage share one security model.',
      'The client remains compatible with the Spark plan and a static hosting environment.'
    ],
    cons: [
      'Requires careful query limits and rule validation.',
      'Complex relational reporting is less direct than in a SQL database.'
    ]
  },
  {
    id: 'option-b',
    name: 'Option B: Full-Stack Node.js Monolith',
    stack: 'Node.js (Express) + PostgreSQL on Render/Railway + React SPA',
    description: 'Single centralized backend server handling API routes, sessions, file uploads, and PostgreSQL database connections.',
    scores: {
      freeTierLimits: 5,
      offlineBandwidth: 7,
      privacyRls: 7,
      developerErgonomics: 7,
      marketability: 8
    },
    monthlyHostingCostNgn: 0,
    freeTierCaveats: [
      'Render free tier spins down after 15 minutes of inactivity; cold starts take 50+ seconds on slow campus connections!',
      'Railway no longer offers a permanent free tier ($5 one-time credit expires).',
      'Free Postgres on Render expires after 90 days or deletes data if un-upgraded.'
    ],
    pros: [
      'Familiar traditional full-stack mental model for a 100L student.',
      'Full control over custom Express middleware and rate limiting.'
    ],
    cons: [
      'Painful 50s cold starts frustrate students trying to report items quickly.',
      'Unreliable database retention on ephemeral free server tiers.',
      'Heavier memory footprint requires maintaining a live server process.'
    ]
  },
  {
    id: 'option-c',
    name: 'Option C: Firebase Serverless (NoSQL)',
    stack: 'React (Vite PWA) + Firebase Firestore + Firebase Auth + Firebase Hosting',
    description: 'Document database (NoSQL) with Firebase client SDKs, security rules, and Google authentication.',
    scores: {
      freeTierLimits: 8,
      offlineBandwidth: 8,
      privacyRls: 7,
      developerErgonomics: 8,
      marketability: 7
    },
    monthlyHostingCostNgn: 0,
    freeTierCaveats: [
      'Firestore free tier limits writes to 20,000/day and reads to 50,000/day.',
      'Spam attacks or unoptimized client queries can burn through daily read quotas quickly.',
      'No SQL support: complex queries (e.g. proximity + category + date) require redundant indexing.'
    ],
    pros: [
      'Built-in offline cache in the Firebase JavaScript SDK.',
      'Seamless integration with Google accounts (@nileuniversity.edu.ng).'
    ],
    cons: [
      'NoSQL lacks relational joins; matching lost vs. found items is harder to query.',
      'Firebase security rules syntax has a steep, idiosyncratic learning curve compared to standard SQL.'
    ]
  },
  {
    id: 'option-d',
    name: 'Option D: No-Code / Low-Code Platform',
    stack: 'Glide / AppSheet + Google Sheets / Airtable backend',
    description: 'Drag-and-drop mobile wrapper built on top of a shared Google Sheet or Airtable database.',
    scores: {
      freeTierLimits: 3,
      offlineBandwidth: 4,
      privacyRls: 2,
      developerErgonomics: 5,
      marketability: 2
    },
    monthlyHostingCostNgn: 0,
    freeTierCaveats: [
      'Free plans limit app to 25-50 rows or 10 active users before requiring paid tiers ($25-$99/mo).',
      'Cannot implement custom canvas image compression (<100KB), draining student data bundles.',
      'Severe NDPA privacy risk: Google Sheets backend exposes raw rows to sheet editors.'
    ],
    pros: [
      'Built in 2 hours with zero coding.'
    ],
    cons: [
      'Does not count as an engineering portfolio piece for a Computer Engineering student.',
      'No fine-grained access control or asymmetric verification logic.',
      'Fails when row count exceeds 100 items.'
    ]
  }
];

export function calculateWeightedScore(scores: SolutionOption['scores']): number {
  return Number((
    scores.freeTierLimits * 0.25 +
    scores.offlineBandwidth * 0.25 +
    scores.privacyRls * 0.20 +
    scores.developerErgonomics * 0.15 +
    scores.marketability * 0.15
  ).toFixed(2));
}
