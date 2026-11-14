import React from 'react';
import type { User } from '../../types/index.ts';

interface SignedInCardProps {
  currentUser: User;
  onNavigateToFeed: () => void;
  onSignOut: () => void;
}

export const SignedInCard: React.FC<SignedInCardProps> = ({
  currentUser,
  onNavigateToFeed,
  onSignOut,
}) => (
  <div className="bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] p-5 border border-[#C4BBAF] dark:border-[#3E3931] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
    <div className="flex items-center gap-3.5">
      <div className="w-10 h-10 rounded-full bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] font-bold flex items-center justify-center text-sm border border-[#0F6E6E]/20">
        {currentUser.name.charAt(0)}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-sm">{currentUser.name}</span>
        <span
          className={`text-xs font-sans font-medium px-2 py-0.5 rounded-[10px] border ${
            currentUser.role === 'admin'
              ? 'bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border-[#0F6E6E]/30'
              : currentUser.role === 'security'
              ? 'bg-[#EDF7F1] dark:bg-[#0E2417] text-[#1B5633] dark:text-[#75CE9A] border-[#2F7D4F]/30'
              : 'bg-[#FAF6EF] dark:bg-[#141311] text-[#4A443C] dark:text-[#CEC7BB] border-[#C4BBAF] dark:border-[#3E3931]'
          }`}
        >
          {currentUser.role}
        </span>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <button type="button" onClick={onNavigateToFeed} className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-sm font-medium px-4 py-2 rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus shadow-xs">
        Go to Feed
      </button>
      <button type="button" onClick={onSignOut} className="bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#4A443C] dark:text-[#CEC7BB] text-sm font-medium px-4 py-2 rounded-[10px] border border-[#857C70] dark:border-[#787065] transition-colors min-h-[44px] cursor-pointer btn-campus">
        Sign Out
      </button>
    </div>
  </div>
);
