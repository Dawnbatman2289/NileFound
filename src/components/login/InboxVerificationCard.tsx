import React from 'react';

interface InboxVerificationCardProps {
  cooldown: number;
  onResend: () => void;
  onConfirmVerified: () => void;
  onSignOut: () => void;
}

export const InboxVerificationCard: React.FC<InboxVerificationCardProps> = ({
  cooldown,
  onResend,
  onConfirmVerified,
  onSignOut,
}) => (
  <div className="space-y-4 text-center">
    <h3 className="font-serif font-bold text-base text-[#1F1B16] dark:text-[#F5F1EA]">Check your inbox</h3>
    <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB]">
      Verify your email address before posting, claiming, or reading campus items.
    </p>
    <p className="text-sm text-[#5C554C] dark:text-[#A8A095]">
      Check your spam or junk folder if the email does not arrive.
    </p>
    <button
      type="button"
      onClick={onResend}
      disabled={cooldown > 0}
      className="w-full min-h-[44px] bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] border border-[#857C70] dark:border-[#787065] rounded-[10px] text-sm font-medium cursor-pointer transition-colors"
    >
      {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
    </button>
    <button type="button" onClick={onConfirmVerified} className="w-full min-h-[44px] bg-[#0F6E6E] hover:bg-[#0C5656] text-white rounded-[10px] text-sm font-medium cursor-pointer transition-colors">
      I have verified
    </button>
    <button type="button" onClick={onSignOut} className="text-sm text-[#0F6E6E] dark:text-[#199595] underline cursor-pointer min-h-[44px] px-2">
      Wrong email? Use a different one
    </button>
  </div>
);
