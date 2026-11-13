/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Static campus item catalog categories and proximity clusters.
 * Kept separate from dev-only demo items so production builds never bundle demo records.
 */

export const CAMPUS_CLUSTERS: Record<string, string[]> = {
  stem_cluster: [
    'Ubangi House (STEM Labs)',
    'Ubangi House (STEM Laboratories & Environmental Sciences)',
    'Volta Building (Health Sciences)',
    'Volta Academic Building',
    'Congo House (Engineering & Computing)',
    'Congo House',
  ],
  admin_law_cluster: [
    'Nile House (Admin)',
    'Nile House (Administration & Security Office)',
    'Limpopo Bay (Law & Postgrad)',
    'Limpopo Bay (Faculty of Law & Postgraduate Studies)',
    'Niger House',
    'Niger House (Faculty of Arts & Social Sciences)',
    'Student Centre',
    'Nile Student Centre',
    'Nile Main Library',
  ],
  residential_cluster: [
    'Red Volta Hostel',
    'Blue Nile Hostel',
    'Orange Hostel',
    'Zambezi Hostel',
    'Lake Chad Hostel',
    'Asokoro Hostel',
    'Victoria Estate Hostels',
    'Moat Haven Estate',
    'Sports Complex',
    'Central Cafeteria',
  ],
};

export const CATEGORIES = [
  { id: 'student_id', label: 'Student ID Card', icon: 'CreditCard', sensitive: true },
  { id: 'phone_tech', label: 'Phone / Laptop / Charger / Earbuds', icon: 'Smartphone', sensitive: false },
  { id: 'power_bank', label: 'Power Bank', icon: 'BatteryCharging', sensitive: false },
  { id: 'calculator', label: 'Scientific Calculator (Casio)', icon: 'Calculator', sensitive: false },
  { id: 'flash_drive', label: 'Flash Drive / Hard Drive', icon: 'HardDrive', sensitive: false },
  { id: 'keys', label: 'Hostel / Padlock Keys', icon: 'Key', sensitive: false },
  { id: 'bag_backpack', label: 'Bag / Backpack', icon: 'Briefcase', sensitive: false },
  { id: 'lab_coat_clothing', label: 'Lab Coat / Jacket', icon: 'Shirt', sensitive: false },
  { id: 'books_notes', label: 'Textbook / Lecture Notes', icon: 'BookOpen', sensitive: false },
  { id: 'other', label: 'Other Item', icon: 'Package', sensitive: false },
] as const;
