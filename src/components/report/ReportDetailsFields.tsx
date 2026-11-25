/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Report type switch, category selector, title, and description fields.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ItemCategory, ItemType } from '../../types/index.ts';
import { CATEGORIES } from '../../config/catalog.ts';

interface ReportDetailsFieldsProps {
  reportType: ItemType;
  category: ItemCategory | '';
  title: string;
  description: string;
  isFoundStudentId: boolean;
  fieldClass: string;
  onSelectLost: () => void;
  onSelectFound: () => void;
  onChangeCategory: (category: ItemCategory) => void;
  onChangeTitle: (title: string) => void;
  onChangeDescription: (description: string) => void;
}

export const ReportDetailsFields: React.FC<ReportDetailsFieldsProps> = ({
  reportType,
  category,
  title,
  description,
  isFoundStudentId,
  fieldClass,
  onSelectLost,
  onSelectFound,
  onChangeCategory,
  onChangeTitle,
  onChangeDescription,
}) => (
  <>
    <div className="grid grid-cols-2 gap-2 bg-[#FAF6EF] dark:bg-[#141311] p-1.5 rounded-[10px] border border-[#857C70] dark:border-[#787065]">
      <button
        type="button"
        onClick={onSelectLost}
        className={`py-2 text-sm font-semibold rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus ${reportType === 'lost' ? 'bg-[#E8A317] text-[#1F1B16] shadow-xs' : 'text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'}`}
      >
        I Lost Something
      </button>
      <button
        type="button"
        onClick={onSelectFound}
        className={`py-2 text-sm font-semibold rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus ${reportType === 'found' ? 'bg-[#2F7D4F] text-white shadow-xs' : 'text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'}`}
      >
        I Found Something
      </button>
    </div>

    <div>
      <label htmlFor="report-category" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
        Item Category <span className="text-[#0F6E6E]">*</span>
      </label>
      <select
        id="report-category"
        required
        value={category}
        onChange={(e) => onChangeCategory(e.target.value as ItemCategory)}
        className={`${fieldClass} pr-8 cursor-pointer`}
      >
        <option value="" disabled>Select an item category...</option>
        {CATEGORIES.map((cat) => (
          <option key={cat.id} value={cat.id}>{cat.label}</option>
        ))}
      </select>
    </div>

    {isFoundStudentId && (
      <div className="bg-[#FEF7E9] dark:bg-[#2B210A] border border-[#E8A317]/40 p-3.5 rounded-[10px] space-y-1">
        <div className="flex items-center gap-2 text-[#7A5000] dark:text-[#F9CF7C] font-semibold text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Found Student ID Card Protocol</span>
        </div>
        <p className="text-sm text-[#7A5000] dark:text-[#F9CF7C] leading-relaxed">
          Do not type the student's name or matric number into any field. Hand the physical card to the Main Gate Security Post immediately.
        </p>
      </div>
    )}

    <div>
      <label htmlFor="report-title" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
        Item Title <span className="text-[#0F6E6E]">*</span>
      </label>
      <input
        id="report-title"
        type="text"
        value={title}
        onChange={(e) => onChangeTitle(e.target.value)}
        placeholder={
          isFoundStudentId
            ? 'A student ID card was found'
            : reportType === 'lost'
              ? 'e.g. Casio fx-991EX Calculator with red sticker'
              : 'e.g. Black Anker 20,000mAh Power Bank'
        }
        className={fieldClass}
        required
      />
    </div>

    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <label htmlFor="report-description" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB]">
          Detailed Description <span className="text-[#0F6E6E]">*</span>
        </label>
        <span className="text-sm text-[#5C554C] dark:text-[#A8A095]">No phone or matric numbers</span>
      </div>
      <textarea
        id="report-description"
        rows={3}
        value={description}
        onChange={(e) => onChangeDescription(e.target.value)}
        placeholder={
          reportType === 'lost'
            ? 'Describe physical condition, stickers, case color, where you last had it...'
            : isFoundStudentId
              ? 'Describe where on campus it was found. Do not type names or matric numbers.'
              : 'Describe general color, model, and location found without revealing private marks.'
        }
        className="w-full text-base sm:text-sm px-3.5 py-2.5 rounded-[10px] border border-[#857C70] dark:border-[#787065] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#5C554C] dark:placeholder:text-[#A8A095] focus:border-[#0F6E6E]"
        required
      />
    </div>
  </>
);
