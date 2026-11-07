/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Stage 3 Architecture Matrix & Career Mentorship Hub
 * Layout: Sub-tab navigation between Stage 3 Decision Matrix and Student Career Strategy.
 * Main Action: Evaluate architectural tradeoffs, inspect free-tier limits, and pitch strategy.
 */

import React, { useState } from 'react';
import { 
  Trophy, 
  Briefcase, 
  CheckCircle2, 
  Lightbulb, 
  Layers, 
  Server, 
  ShieldCheck, 
  AlertTriangle,
  ArrowRight,
  Database,
  Globe
} from 'lucide-react';
import { SOLUTION_OPTIONS, calculateWeightedScore } from '../data/decisionMatrix.ts';

export const CareerGuideView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'decision_matrix' | 'career_strategy'>('decision_matrix');
  const [selectedOptionId, setSelectedOptionId] = useState<string>('option-a');

  const selectedOption = SOLUTION_OPTIONS.find((o) => o.id === selectedOptionId) || SOLUTION_OPTIONS[0];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-emerald-900 text-white rounded-xl p-5 border border-emerald-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
          <Layers className="w-4 h-4" />
          <span>Stage 3: Ideate & Decide (Engineering Architecture)</span>
        </div>
        <h2 className="text-lg font-bold">System Architecture & Technical Decision Hub</h2>
        <p className="text-xs text-emerald-100/90 leading-relaxed max-w-2xl">
          Senior engineers never choose a tech stack based on hype. We evaluate real constraints: free-tier longevity, cold-start latencies, mobile data consumption, and local African employment value.
        </p>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-stone-200 gap-2 text-xs">
        <button
          onClick={() => setActiveSubTab('decision_matrix')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'decision_matrix'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Stage 3 Weighted Decision Matrix</span>
        </button>

        <button
          onClick={() => setActiveSubTab('career_strategy')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'career_strategy'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Competitions & 100L CV Impact</span>
        </button>
      </div>

      {/* TAB 1: STAGE 3 ARCHITECTURAL DECISION MATRIX */}
      {activeSubTab === 'decision_matrix' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3.5 py-2.5 rounded-lg font-medium flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded">
              Draft Note
            </span>
            <span>AI-generated draft, not independent analysis</span>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SOLUTION_OPTIONS.map((opt) => {
              const weightedScore = calculateWeightedScore(opt.scores);
              const isSelected = opt.id === selectedOptionId;
              const isRecommended = opt.id === 'option-a';

              return (
                <button
                  key={opt.id}
                  onClick={() => setSelectedOptionId(opt.id)}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? 'border-emerald-700 bg-white shadow-md ring-2 ring-emerald-600/30'
                      : 'border-stone-200 bg-white/70 hover:bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      {isRecommended ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Recommended
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-stone-500 uppercase">
                          Alternative
                        </span>
                      )}
                      <span className="text-xs font-mono font-bold text-stone-800">
                        {weightedScore} / 10
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-stone-900 leading-snug">{opt.name}</h4>
                    <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                      {opt.stack}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
                    <span className="text-stone-500">Cost:</span>
                    <strong className="text-emerald-700 font-mono">₦0 / mo</strong>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Deep Dive on Selected Option */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-5">
            <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                  Deep Architectural Inspection
                </span>
                <h3 className="font-bold text-stone-900 text-base mt-0.5">{selectedOption.name}</h3>
                <p className="text-xs text-stone-500 mt-0.5 font-mono">{selectedOption.stack}</p>
              </div>

              <div className="text-right self-start sm:self-auto">
                <span className="text-[10px] font-bold text-stone-400 block uppercase">Weighted Score</span>
                <span className="text-2xl font-extrabold text-emerald-800 font-mono">
                  {calculateWeightedScore(selectedOption.scores)} <span className="text-xs text-stone-500">/ 10</span>
                </span>
              </div>
            </div>

            {/* Score Breakdown Bars */}
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider block">
                Criteria Evaluation (Weighted Scoring):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between text-stone-700 mb-1">
                    <span>Free-Tier Longevity & Limits (25%):</span>
                    <strong className="font-mono text-emerald-800">{selectedOption.scores.freeTierLimits}/10</strong>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-700 h-full rounded-full" style={{ width: `${selectedOption.scores.freeTierLimits * 10}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-stone-700 mb-1">
                    <span>Offline & Low-Bandwidth Suitability (25%):</span>
                    <strong className="font-mono text-emerald-800">{selectedOption.scores.offlineBandwidth}/10</strong>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-700 h-full rounded-full" style={{ width: `${selectedOption.scores.offlineBandwidth * 10}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-stone-700 mb-1">
                    <span>Data Privacy & Row-Level Security (20%):</span>
                    <strong className="font-mono text-emerald-800">{selectedOption.scores.privacyRls}/10</strong>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-700 h-full rounded-full" style={{ width: `${selectedOption.scores.privacyRls * 10}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-stone-700 mb-1">
                    <span>Developer Ergonomics for 100L (15%):</span>
                    <strong className="font-mono text-emerald-800">{selectedOption.scores.developerErgonomics}/10</strong>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-700 h-full rounded-full" style={{ width: `${selectedOption.scores.developerErgonomics * 10}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-stone-700 mb-1">
                    <span>Nigerian Tech Marketability (15%):</span>
                    <strong className="font-mono text-emerald-800">{selectedOption.scores.marketability}/10</strong>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-700 h-full rounded-full" style={{ width: `${selectedOption.scores.marketability * 10}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pros and Cons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Advantages:</span>
                <ul className="space-y-1.5 text-xs text-stone-700">
                  {selectedOption.pros.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-rose-900 uppercase tracking-wide">Trade-offs & Drawbacks:</span>
                <ul className="space-y-1.5 text-xs text-stone-700">
                  {selectedOption.cons.map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5"></span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAREER & PITCH STRATEGY */}
      {activeSubTab === 'career_strategy' && (
        <div className="space-y-5">
          {/* Competitions Open to Nigerian Tech Students */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <div className="border-b border-stone-100 pb-2">
              <h3 className="font-bold text-stone-900 text-sm">Competitions & Grants to Target</h3>
              <p className="text-xs text-stone-500 mt-0.5">Where NileFound will stand out against standard submissions.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Annual Flagship</span>
                <h4 className="font-bold text-stone-900 text-xs">Google Solution Challenge</h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Aligns with <strong>UN SDG 11 (Sustainable Cities & Communities)</strong>. Highlight client-side image compression (&lt;100KB) and offline IndexedDB resilience.
                </p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">National Student Body</span>
                <h4 className="font-bold text-stone-900 text-xs">NACOS National Software Exhibition</h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Nigeria Association of Computing Students annual convention software competition. University-wide utility projects regularly win top honors.
                </p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Innovation & Funding</span>
                <h4 className="font-bold text-stone-900 text-xs">NITDA / CcHUB University Challenge</h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  NITDA and Co-Creation Hub look for hyper-local African infrastructure solutions that don't depend on expensive cloud servers.
                </p>
              </div>
            </div>
          </div>

          {/* Resume Bullet Points for 100L CV */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <div className="border-b border-stone-100 pb-2 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-stone-900 text-sm">How to Write This on Your Resume / LinkedIn</h3>
                <p className="text-xs text-stone-500 mt-0.5">Engineering impact points recruiters at Paystack, Flutterwave, or Moniepoint look for:</p>
              </div>
              <Briefcase className="w-4 h-4 text-emerald-700" />
            </div>

            <div className="bg-stone-900 text-emerald-300 font-mono text-xs p-4 rounded-xl space-y-3 leading-relaxed border border-stone-800">
              <p className="text-stone-300">
                <strong className="text-amber-400">Project: NileFound (Campus Lost & Found Verification PWA)</strong> | React, TypeScript, PWA, Tailwind CSS
              </p>
              <ul className="list-disc list-inside space-y-2 text-stone-300 pl-1">
                <li>
                  Engineered an installable offline-first Progressive Web App (PWA) addressing lost campus property across 12 Nile University buildings.
                </li>
                <li>
                  Implemented client-side HTML5 canvas image compression, reducing photo payloads from &gt;4MB to &lt;95KB (-97% bandwidth) before cellular transmission.
                </li>
                <li>
                  Designed an asynchronous IndexedDB offline storage layer to preserve report drafts and image blobs across weak network drops.
                </li>
                <li>
                  Enforced Nigeria Data Protection Act (NDPA) 2023 compliance with zero public phone/email leakage and an asymmetric secret-verification challenge preventing fraudulent claims.
                </li>
              </ul>
            </div>
          </div>

          {/* Elevator Pitch to Student Affairs */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wide">
              <Lightbulb className="w-4 h-4 text-emerald-700" />
              <span>The 60-Second Student Affairs Pitch Script</span>
            </div>
            <blockquote className="text-xs text-emerald-950 font-medium italic border-l-4 border-emerald-600 pl-3 leading-relaxed">
              "Sir/Ma, every week dozens of students lose ID cards and calculators during exams, and announce them fruitlessly across 50 chaotic WhatsApp groups. Our security guards at the gate keep recovered items in drawers with no central log. NileFound gives Nile University an installable, official web app where finders log items in 15 seconds, sensitive ID photos are protected, and claims require answering a secret detail—cutting ID replacement queues at Student Affairs and making our campus safer at zero cost to the university."
            </blockquote>
          </div>
        </div>
      )}
    </div>
  );
};
