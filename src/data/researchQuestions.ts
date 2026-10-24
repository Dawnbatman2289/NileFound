/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SurveyQuestion {
  id: string;
  category: 'lost_experience' | 'found_experience' | 'channel_behavior' | 'trust_security';
  question: string;
  type: 'single' | 'multi' | 'text';
  options: string[];
}

export const STAGE_1_SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'sq1',
    category: 'lost_experience',
    question: 'In the past 2 semesters at Nile University, how many personal items have you misplaced or lost?',
    type: 'single',
    options: ['None', '1 item', '2 to 3 items', '4 or more items']
  },
  {
    id: 'sq2',
    category: 'lost_experience',
    question: 'Which items are you most afraid of losing on campus? (Select top 2)',
    type: 'multi',
    options: [
      'Student ID card (re-issue fee & exam access barrier)',
      'Smartphone / Laptop',
      'Scientific calculator (Casio) during exams/tests',
      'Power bank / Charger',
      'Hostel or room keys',
      'Backpack / Lecture notes'
    ]
  },
  {
    id: 'sq3',
    category: 'channel_behavior',
    question: 'When you lose an item right now, where do you look or post first?',
    type: 'single',
    options: [
      'Department / Course WhatsApp group chats',
      'Nile Sub-groups / Status updates',
      'Walk back to the classroom/lab and look physically',
      'Ask the security post at the main gate',
      'Go to Student Affairs office',
      'Give up because chances of finding it feel zero'
    ]
  },
  {
    id: 'sq4',
    category: 'found_experience',
    question: 'If you pick up someone else\'s lost item (e.g. ID card or calculator), what stops you from returning it?',
    type: 'single',
    options: [
      'I don\'t know who owns it or which WhatsApp group to send it to',
      'Security desk is too far or I fear getting questioned/blamed',
      'WhatsApp messages get buried in hundreds of chats within 10 minutes',
      'Someone might claim it falsely just because it is valuable',
      'I always return items immediately with zero friction'
    ]
  },
  {
    id: 'sq5',
    category: 'trust_security',
    question: 'Would you trust an official student-built web app where claimants must answer a secret question before receiving contact details?',
    type: 'single',
    options: [
      'Yes, absolutely—secret questions stop fake claimants',
      'Yes, provided my phone number isn\'t publicly visible',
      'Maybe, if security or Student Affairs officially endorses it',
      'No, I prefer informal WhatsApp announcements'
    ]
  }
];

export const SECURITY_INTERVIEW_GUIDE = [
  {
    role: 'Chief Security Officer / Main Gate Security',
    keyQuestions: [
      'Where do guards physically store items handed over by students? (Is there a locked drawer, safe, or shelf?)',
      'What register or logbook currently records handed-over items? (Paper ledger, notebook, or memory?)',
      'What proof does a student have to show to retrieve a lost phone, bag, or ID card?',
      'How long are unclaimed items held before they are disposed of or relocated?',
      'Would security officers at the gate use a simple 2-button mobile dashboard (Log Item / Handover Claimed)?'
    ],
    riskToValidate: 'High friction or low digital literacy among rotating shift guards. If they do not log items, students will assume the app is out of date.'
  },
  {
    role: 'Dean of Student Affairs / Student Representative Council (SRC)',
    keyQuestions: [
      'What is the university\'s official policy regarding lost-and-found property?',
      'Can NileFound be integrated into the student portal or announced via official campus email broadcast?',
      'Can we restrict accounts strictly to @nileuniversity.edu.ng Google Workspace single-sign-on?',
      'Who bears liability if a high-value item is disputed or reported stolen?'
    ],
    riskToValidate: 'Administrative bureaucracy or refusal to endorse unofficial student tools unless vetted for student data privacy (NDPA 2023).'
  }
];

export const SUCCESS_METRICS = [
  {
    metric: 'Return Rate (%)',
    formula: '(Successfully Returned Items ÷ Total Reported Found Items) × 100',
    target: '>= 45% within 14 days',
    benchmark: 'WhatsApp informal channels estimated at < 15% return rate.'
  },
  {
    metric: 'Median Time-to-Return (Hours)',
    formula: 'Median(Timestamp of "Returned" - Timestamp of "Reported")',
    target: '< 24 Hours',
    benchmark: 'Currently takes 3-7 days of asking across 5 different group chats.'
  },
  {
    metric: 'False Claim Prevention Rate (%)',
    formula: '(Rejected / Disputed Claims ÷ Total Claim Attempts) × 100',
    target: '100% of unverified claims prevented from revealing finder contact',
    benchmark: 'In WhatsApp groups, anyone with the finder\'s number can call and lie.'
  },
  {
    metric: 'Weekly Active Finders (WAF)',
    formula: 'Count of unique students logging or checking found items weekly',
    target: '50+ active reports per week during exam and test periods',
    benchmark: 'Exam periods (Midterms/Finals) see 300% surge in lost calculators and IDs.'
  }
];
