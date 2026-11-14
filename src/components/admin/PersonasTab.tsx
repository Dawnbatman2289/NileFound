import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { User } from '../../types/index.ts';
import type { DemoPersonaOption } from '../../data/demoPersonas.ts';
import { ADMIN_CARD } from './adminStyles.ts';

interface PersonasTabProps {
  devPersonas: DemoPersonaOption[];
  onSwitchPersona?: (user: User) => void;
  onSuccessNotice: (msg: string) => void;
}

export const PersonasTab: React.FC<PersonasTabProps> = ({
  devPersonas,
  onSwitchPersona,
  onSuccessNotice,
}) => (
  <div className="space-y-6">
    <div className={`${ADMIN_CARD} p-6 space-y-2`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-serif font-bold text-base flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#0F6E6E] dark:text-[#199595]" />
          Development Persona Switcher
        </h3>
        <span className="text-xs bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/30 font-mono font-bold px-2.5 py-0.5 rounded-full">
          Dev mode only
        </span>
      </div>
      <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">
        Preview the interface locally as a student, security officer, or administrator. Disabled in production builds.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {devPersonas.map((persona) => (
        <div key={persona.user.id} className={`${ADMIN_CARD} p-5 space-y-4 hover:border-[#0F6E6E]/40 transition-colors flex flex-col justify-between`}>
          <div className="space-y-2.5 min-w-0">
            <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center font-bold text-sm border ${persona.badgeClass}`}>
              {persona.initial}
            </div>
            <div className="min-w-0">
              <h4 className="font-serif font-bold text-sm">{persona.user.name.replace(/ \(.*\)$/, '')}</h4>
              <span className="text-xs font-mono font-bold uppercase text-[#0F6E6E] dark:text-[#199595]">{persona.badge}</span>
              <p className="text-xs text-[#5C554C] dark:text-[#A8A095] font-mono truncate">{persona.user.email}</p>
            </div>
            <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">{persona.description}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onSwitchPersona?.(persona.user);
              onSuccessNotice(`Switched persona to ${persona.user.name}.`);
            }}
            className="w-full py-2.5 px-4 bg-[#FAF6EF] dark:bg-[#28241F] hover:bg-[#E7F3F3] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[10px] text-sm font-semibold border border-[#857C70] dark:border-[#787065] transition-colors cursor-pointer min-h-[44px] btn-campus"
          >
            {persona.buttonLabel}
          </button>
        </div>
      ))}
    </div>
  </div>
);
