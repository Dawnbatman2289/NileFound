/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Development-only test personas for local role previewing.
 */

import { User } from '../types/index.ts';

export interface DemoPersonaOption {
  badge: string;
  initial: string;
  badgeClass: string;
  buttonLabel: string;
  description: string;
  user: User;
}

export const DEV_TEST_PERSONAS: DemoPersonaOption[] = [
  {
    badge: 'Student',
    initial: 'U',
    badgeClass: 'bg-white dark:bg-[#1E1C18] text-[#4A443C] dark:text-[#CEC7BB] border-[#857C70] dark:border-[#787065]',
    buttonLabel: 'Switch to Student Persona',
    description: 'Test reporting items with challenge questions, filtering the campus feed, and submitting claim answers.',
    user: { id: 'demo-student-chidera', name: 'Chidera Eze (Student)', email: 'chidera@nileuniversity.edu.ng', role: 'student', matricNumber: '23/ENG/0481', department: 'Computer Engineering', isAdmin: false },
  },
  {
    badge: 'Security Officer',
    initial: 'S',
    badgeClass: 'bg-[#EDF7F1] dark:bg-[#0E2417] text-[#1B5633] dark:text-[#75CE9A] border-[#2F7D4F]/30',
    buttonLabel: 'Switch to Security Persona',
    description: 'Test physical custody logging at Main Gate, verifying claims, and handover confirmations.',
    user: { id: 'demo-security-musa', name: 'Officer Musa (Main Gate)', email: 'security.gate@nileuniversity.edu.ng', role: 'security', department: 'Campus Security & Safety', isAdmin: false },
  },
  {
    badge: 'Admin',
    initial: 'A',
    badgeClass: 'bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border-[#0F6E6E]/30',
    buttonLabel: 'Switch to Campus Admin',
    description: 'Test claim resolution workflows, CSV audit exporting, and general campus operations.',
    user: { id: 'demo-admin', name: 'Campus Administrator', email: 'admin@nileuniversity.edu.ng', role: 'admin', matricNumber: 'ADMIN-01', department: 'Student Affairs', isAdmin: true },
  },
];
