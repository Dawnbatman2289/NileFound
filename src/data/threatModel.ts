/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound AppSec Threat Model (STRIDE Framework)
 * Incorporating AppSec & DevSecOps standards from Security-Phoenix-demo/security-skills
 */

export interface ThreatModelEntry {
  category: 'Spoofing' | 'Tampering' | 'Repudiation' | 'Information Disclosure' | 'Denial of Service' | 'Elevation of Privilege';
  threatDescription: string;
  impactLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  campusContext: string;
  technicalCountermeasure: string;
  owaspReference: string;
}

export const NILEFOUND_STRIDE_THREATS: ThreatModelEntry[] = [
  {
    category: 'Spoofing',
    threatDescription: 'Attacker creates a fake account pretending to be an owner or a campus security guard.',
    impactLevel: 'HIGH',
    campusContext: 'Student pretends to own a misplaced Oraimo power bank by creating a duplicate claim.',
    technicalCountermeasure: 'University email domain gating (@nileuniversity.edu.ng) + asymmetric verification challenges required before contact disclosure.',
    owaspReference: 'OWASP M1: Improper Platform Usage / Broken Authentication'
  },
  {
    category: 'Tampering',
    threatDescription: 'Malicious user tampers with the reported item status or injects script tags into item descriptions (XSS).',
    impactLevel: 'HIGH',
    campusContext: 'Attacker alters contact URL to redirect student to a phishing or payment page.',
    technicalCountermeasure: 'DOMPurify sanitization on text fields + Supabase Row-Level Security (RLS) policies allowing updates only by author or admin.',
    owaspReference: 'OWASP A03:2021 Injection / Cross-Site Scripting'
  },
  {
    category: 'Repudiation',
    threatDescription: 'Student collects their laptop from the Main Gate security desk and later claims security stole it.',
    impactLevel: 'CRITICAL',
    campusContext: 'Main Gate guards risk disciplinary action if there is no indisputable digital trail.',
    technicalCountermeasure: 'Handover requires a 4-digit one-time PIN (OTP) displayed on the student\'s phone and keyed into the guard\'s dashboard, creating an immutable audit log.',
    owaspReference: 'OWASP ASVS V10: Malicious Code and Transaction Non-Repudiation'
  },
  {
    category: 'Information Disclosure',
    threatDescription: 'Public disclosure of Personally Identifiable Information (PII) violating the Nigeria Data Protection Act (NDPA) 2023.',
    impactLevel: 'CRITICAL',
    campusContext: 'Found student ID cards revealing full name, photograph, and matriculation number on open campus groups.',
    technicalCountermeasure: 'Automatic photo blur filter on sensitive categories + partial matric masking (e.g. 23/....) + zero public phone number exposure.',
    owaspReference: 'OWASP M6: Insecure Authorization / Privacy By Design'
  },
  {
    category: 'Denial of Service',
    threatDescription: 'Spammer floods the database with massive image uploads to exhaust Supabase/Cloudflare free-tier quotas.',
    impactLevel: 'MEDIUM',
    campusContext: 'A prankster submits 20MB uncompressed video clips, exhausting bandwidth and crashing low-end Android browsers.',
    technicalCountermeasure: 'Strict client-side canvas downsampling (<100KB) + cloud upload hard gate at 200KB + client rate limiting (max 3 reports per hour per device).',
    owaspReference: 'OWASP A04:2021 Insecure Design / Rate Limiting'
  },
  {
    category: 'Elevation of Privilege',
    threatDescription: 'Student modifies their browser localStorage or JWT token to assign themselves the "admin" role.',
    impactLevel: 'HIGH',
    campusContext: 'Student gains access to all secret verification answers and approves false claims.',
    technicalCountermeasure: 'Server-authoritative role verification in Postgres database via custom claims or an `admin_users` table; client state is treated as untrusted presentation only.',
    owaspReference: 'OWASP A01:2021 Broken Access Control'
  }
];
