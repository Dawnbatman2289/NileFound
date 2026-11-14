import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { HoldingLocation } from '../../types/index.ts';

interface FoundVerificationSectionProps {
  isFoundStudentId: boolean;
  verificationQuestion: string;
  verificationAnswer: string;
  holdingLocation: HoldingLocation;
  fieldClass: string;
  onChangeQuestion: (value: string) => void;
  onChangeAnswer: (value: string) => void;
  onChangeHoldingLocation: (value: HoldingLocation) => void;
}

const SUGGESTIONS = [
  { label: 'Phone wallpaper', text: 'What image is set as the lock screen wallpaper?' },
  { label: 'Cover mark', text: 'What scratch or sticker is on the back or inside cover?' },
  { label: 'Inside pocket', text: 'What small specific item is inside the front compartment?' },
  { label: 'Keychain text', text: 'What text or initials are on the key ring?' },
];

export const FoundVerificationSection: React.FC<FoundVerificationSectionProps> = ({
  isFoundStudentId,
  verificationQuestion,
  verificationAnswer,
  holdingLocation,
  fieldClass,
  onChangeQuestion,
  onChangeAnswer,
  onChangeHoldingLocation,
}) => (
  <div className="space-y-3.5 bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-4">
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[#0F6E6E] dark:text-[#199595] font-semibold text-sm">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span>Ask the owner one thing only they would know</span>
      </div>
      <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">
        Pick a private detail not visible in any photo. Claimants must answer this before handover details are released.
      </p>

      <div className="space-y-1.5 pt-1">
        <span className="text-sm font-medium text-[#5C554C] dark:text-[#A8A095] block">Quick suggestions:</span>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((sug) => (
            <button
              key={sug.label}
              type="button"
              onClick={() => onChangeQuestion(sug.text)}
              className="text-sm bg-white dark:bg-[#1E1C18] text-[#4A443C] dark:text-[#CEC7BB] border border-[#857C70] dark:border-[#787065] hover:border-[#0F6E6E] hover:text-[#0F6E6E] px-3 py-1.5 min-h-[44px] rounded-[10px] font-medium transition-colors cursor-pointer btn-campus"
            >
              + {sug.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 space-y-3">
        <div>
          <label htmlFor="report-question" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
            Verification Question (Shown to claimants)
          </label>
          <input
            id="report-question"
            type="text"
            value={verificationQuestion}
            onChange={(e) => onChangeQuestion(e.target.value)}
            placeholder="e.g. What image is on the lock screen?"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="report-answer" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
            Correct Answer (Private — only you and security/admin see this)
          </label>
          <input
            id="report-answer"
            type="text"
            value={verificationAnswer}
            onChange={(e) => onChangeAnswer(e.target.value)}
            placeholder="e.g. A photo of a black car with Abuja plate"
            className={fieldClass}
          />
          <span className="text-sm text-[#5C554C] dark:text-[#A8A095] mt-1 block">
            Stored in a private Firestore subcollection and never written to browser draft storage.
          </span>
        </div>
      </div>
    </div>

    <div className="pt-2 border-t border-[#C4BBAF] dark:border-[#3E3931]">
      <label htmlFor="report-holding" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
        Item Physical Custody
      </label>
      {isFoundStudentId ? (
        <div className="bg-white dark:bg-[#1E1C18] border border-[#C4BBAF] dark:border-[#3E3931] text-[#0F6E6E] dark:text-[#199595] rounded-[10px] p-3 text-sm font-medium">
          Dropped at Main Gate Security Post (Mandatory for student IDs)
        </div>
      ) : (
        <select
          id="report-holding"
          value={holdingLocation}
          onChange={(e) => onChangeHoldingLocation(e.target.value as HoldingLocation)}
          className={`${fieldClass} cursor-pointer`}
        >
          <option value="finder_holding">I am keeping it safe myself</option>
          <option value="security_main_gate">Dropped at Main Campus Gate Security Post</option>
          <option value="library_desk">Handed to Central Library Front Desk</option>
          <option value="student_affairs_office">Deposited at Student Affairs Office</option>
          <option value="faculty_officer">Given to Faculty Officer</option>
        </select>
      )}
    </div>
  </div>
);
