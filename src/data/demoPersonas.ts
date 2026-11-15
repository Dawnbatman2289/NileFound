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
    badge: 'Student (Claimant)',
    initial: 'C',
    badgeClass: 'bg-white dark:bg-[#1E1C18] text-[#4A443C] dark:text-[#CEC7BB] border-[#857C70] dark:border-[#787065]',
    buttonLabel: 'Switch to Chidera (Student)',
    description: 'Test claiming items, sending handover chat messages, and reporting lost belongings.',
    user: { id: 'demo-student-chidera', name: 'Chidera Eze', email: 'chidera@nileuniversity.edu.ng', role: 'student', matricNumber: '23/ENG/0481', department: 'Computer Engineering', isAdmin: false },
  },
  {
    badge: 'Finder',
    initial: 'T',
    badgeClass: 'bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] border-[#E8A317]/30',
    buttonLabel: 'Switch to Tunde (Finder)',
    description: 'Test reviewing incoming claims on your found item, replying in handover chat, and marking items returned.',
    user: { id: 'demo-student-tunde', name: 'Tunde Bakare', email: 'tunde.b@nileuniversity.edu.ng', role: 'student', matricNumber: '22/LAW/0194', department: 'Law', isAdmin: false },
  },
  {
    badge: 'University Staff',
    initial: 'N',
    badgeClass: 'bg-[#FAF6EF] dark:bg-[#1E1C18] text-[#7A5000] dark:text-[#F9CF7C] border-[#C4BBAF] dark:border-[#3E3931]',
    buttonLabel: 'Switch to Staff (Dr. Ngozi)',
    description: 'Test reporting missing campus items or logging found office items using a Nile University staff email.',
    user: { id: 'demo-staff-ngozi', name: 'Dr. Ngozi Okafor', email: 'n.okafor@nileuniversity.edu.ng', role: 'staff', department: 'Faculty of Engineering', isAdmin: false },
  },
  {
    badge: 'Security Officer',
    initial: 'M',
    badgeClass: 'bg-[#EDF7F1] dark:bg-[#0E2417] text-[#1B5633] dark:text-[#75CE9A] border-[#2F7D4F]/30',
    buttonLabel: 'Switch to Security Persona',
    description: 'Test physical custody logging at Main Gate, verifying claims, and handover confirmations.',
    user: { id: 'demo-security-musa', name: 'Officer Musa', email: 'security.gate@nileuniversity.edu.ng', role: 'security', department: 'Campus Security & Safety', isAdmin: false },
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
