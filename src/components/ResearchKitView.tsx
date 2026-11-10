/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ClipboardCopy, 
  Check, 
  HelpCircle, 
  Users, 
  ShieldAlert, 
  FileText, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { STAGE_1_SURVEY_QUESTIONS, SECURITY_INTERVIEW_GUIDE } from '../data/researchQuestions.ts';
import { NILEFOUND_STRIDE_THREATS } from '../data/threatModel.ts';
import { Shield, Lock } from 'lucide-react';

export const ResearchKitView: React.FC = () => {
  const [copiedSurvey, setCopiedSurvey] = useState(false);
  const [copiedSecurity, setCopiedSecurity] = useState(false);
  const [activeTab, setActiveTab] = useState<'student_survey' | 'security_script' | 'unknowns_matrix' | 'stride_threats'>('student_survey');

  // Interactive survey runner
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submittedCount, setSubmittedCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const handleCopySurvey = () => {
    const text = `📋 NILE UNIVERSITY LOST & FOUND - STAGE 1 STUDENT SURVEY\n` +
      `Hey guys! I'm Ayomide (100L Computer Engineering). I am designing an installable campus app to solve lost IDs, calculators, power banks, and keys at Nile Uni. Please take 60 seconds to answer 5 quick questions:\n\n` +
      STAGE_1_SURVEY_QUESTIONS.map((q, idx) => {
        return `Q${idx + 1}: ${q.question}\nOptions:\n` + q.options.map(opt => `  [ ] ${opt}`).join('\n') + `\n`;
      }).join('\n') +
      `\nThank you! Responses will directly shape the NileFound MVP.`;

    navigator.clipboard.writeText(text);
    setCopiedSurvey(true);
    setTimeout(() => setCopiedSurvey(false), 2500);
  };

  const handleCopySecurity = () => {
    const text = `🛡️ NILE UNIVERSITY SECURITY & STUDENT AFFAIRS DISCOVERY SCRIPT\n\n` +
      SECURITY_INTERVIEW_GUIDE.map(sec => {
        return `Role: ${sec.role}\nKey Questions:\n` +
          sec.keyQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n') +
          `\nCore Unknown to Validate: ${sec.riskToValidate}\n\n`;
      }).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedSecurity(true);
    setTimeout(() => setCopiedSecurity(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Mentor Header Callout */}
      <div className="bg-emerald-900 text-white rounded-[20px] p-5 border border-emerald-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          <span>Stage 1 Field Research Deliverables (Define & Research)</span>
        </div>
        <h2 className="text-lg font-bold">Ayomide's Campus Discovery Toolkit</h2>
        <p className="text-xs text-emerald-100/90 leading-relaxed max-w-2xl">
          Senior engineers never write production code based on assumptions. We validate the actual ground reality at Nile University first. Use these ready-to-run scripts to discover real student habits, security protocols, and administrative hurdles.
        </p>
      </div>

      {/* Sub tabs */}
      <div className="flex border-b border-stone-200 gap-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('student_survey')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'student_survey'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>1-Page Student Survey & Interactive Test</span>
        </button>

        <button
          onClick={() => setActiveTab('security_script')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'security_script'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Security & Student Affairs Script</span>
        </button>

        <button
          onClick={() => setActiveTab('unknowns_matrix')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'unknowns_matrix'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Assumption vs. Reality Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('stride_threats')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'stride_threats'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-amber-600" />
          <span>AppSec STRIDE Threat Model</span>
        </button>
      </div>

      {/* Tab 1: Student Survey */}
      {activeTab === 'student_survey' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-[20px] border border-stone-200">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Student Survey Questionnaire (5 Questions, &lt; 2 mins)</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Copy to paste into WhatsApp course groups or Google Forms. Or test it below.
              </p>
            </div>
            <button
              onClick={handleCopySurvey}
              className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-[12px] text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              {copiedSurvey ? (
                <>
                  <Check className="w-3.5 h-3.5 text-amber-300" />
                  <span>Copied for WhatsApp!</span>
                </>
              ) : (
                <>
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  <span>Copy Survey Script</span>
                </>
              )}
            </button>
          </div>

          {/* Interactive Survey Simulation */}
          <div className="bg-white rounded-[20px] border border-stone-200 p-5 space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Live Interactive Survey Runner
              </span>
              <span className="text-xs text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full font-medium border border-stone-200">
                {submittedCount === 0 ? 'No recorded responses yet' : `${submittedCount} Recorded Student Response${submittedCount > 1 ? 's' : ''}`}
              </span>
            </div>

            <div className="space-y-6">
              {STAGE_1_SURVEY_QUESTIONS.map((q, idx) => (
                <div key={q.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 leading-snug">{q.question}</h4>
                      <span className="text-xs text-stone-400 uppercase tracking-wider">
                        {q.category.replace('_', ' ')} • {q.type === 'multi' ? 'Multiple choice' : 'Single select'}
                      </span>
                    </div>
                  </div>

                  <div className="pl-7 space-y-1.5">
                    {q.options.map((opt, oIdx) => {
                      const isSelected = q.type === 'multi'
                        ? Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt)
                        : answers[q.id] === opt;

                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => {
                            if (q.type === 'multi') {
                              const curr = (answers[q.id] as string[]) || [];
                              const next = curr.includes(opt)
                                ? curr.filter(x => x !== opt)
                                : [...curr, opt];
                              setAnswers({ ...answers, [q.id]: next });
                            } else {
                              setAnswers({ ...answers, [q.id]: opt });
                            }
                          }}
                          className={`w-full text-left text-xs p-2 rounded-[12px] border transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-medium'
                              : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedCount(prev => prev + 1);
                    setAnswers({});
                    setNotice('Sample survey response logged.');
                  }}
                  className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold px-4 py-2 rounded-[12px]"
                >
                  Record Another Test Response
                </button>
              </div>
              {notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Security & Student Affairs Interview Guide */}
      {activeTab === 'security_script' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-[20px] border border-stone-200">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Security & Administrative Discovery Guide</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Questions to ask at the Main Campus Gate security post and Student Affairs (Block A).
              </p>
            </div>
            <button
              onClick={handleCopySecurity}
              className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-[12px] text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              {copiedSecurity ? (
                <>
                  <Check className="w-3.5 h-3.5 text-amber-300" />
                  <span>Copied Script!</span>
                </>
              ) : (
                <>
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  <span>Copy Interview Script</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SECURITY_INTERVIEW_GUIDE.map((guide, idx) => (
              <div key={idx} className="bg-white rounded-[20px] border border-stone-200 p-5 space-y-4">
                <div className="border-b border-stone-100 pb-2">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Stakeholder {idx + 1}</span>
                  <h4 className="font-bold text-stone-900 text-sm mt-0.5">{guide.role}</h4>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-stone-700">Crucial Discovery Questions:</p>
                  <ul className="space-y-2 text-xs text-stone-600">
                    {guide.keyQuestions.map((q, qIdx) => (
                      <li key={qIdx} className="flex items-start gap-2 bg-stone-50 p-2 rounded border border-stone-100">
                        <span className="font-bold text-emerald-700 text-xs mt-0.5">{qIdx + 1}.</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-3 text-xs text-amber-950">
                  <span className="font-bold block text-amber-900 text-xs">Primary Risk to Validate:</span>
                  <p className="mt-0.5 text-xs leading-relaxed">{guide.riskToValidate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Assumptions vs Reality */}
      {activeTab === 'unknowns_matrix' && (
        <div className="bg-white rounded-[20px] border border-stone-200 p-5 space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="font-bold text-stone-900 text-sm">Ayomide's Unknowns & Reality Validation Tracker</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Every hypothesis we must test before writing backend authentication and database tables.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-100 text-stone-700 border-b border-stone-200">
                  <th className="py-2.5 px-3 font-semibold">Hypothesis / Assumption</th>
                  <th className="py-2.5 px-3 font-semibold">How to Verify on Campus</th>
                  <th className="py-2.5 px-3 font-semibold">Architectural Impact</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-stone-700">
                <tr>
                  <td className="py-3 px-3 font-medium text-stone-900">
                    Students always use official <code className="bg-stone-100 px-1 py-0.5 rounded">@nileuniversity.edu.ng</code> Google accounts.
                  </td>
                  <td className="py-3 px-3">
                    Check if 100L freshers receive active institutional emails in their first semester.
                  </td>
                  <td className="py-3 px-3">
                    If freshers don't have it yet, strict email domain gating locks out 100L students who lose the most items!
                  </td>
                  <td className="py-3 px-3">
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold">Needs Check</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-medium text-stone-900">
                    Security post at the Main Gate has a secure locked locker for student belongings.
                  </td>
                  <td className="py-3 px-3">
                    Walk to Main Gate security post, politely ask the on-duty guard: "If someone brings a lost iPhone, where does it stay overnight?"
                  </td>
                  <td className="py-3 px-3">
                    If items are kept in an open cardboard box or handed over shift-to-shift without records, items risk going missing.
                  </td>
                  <td className="py-3 px-3">
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold">Needs Check</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-medium text-stone-900">
                    Finders will willingly drop items at security rather than keeping them.
                  </td>
                  <td className="py-3 px-3">
                    Survey Question #4 tests student fear of getting blamed or interrogated by guards.
                  </td>
                  <td className="py-3 px-3">
                    Must support dual custody: "I am keeping it safe" vs "Dropped at security".
                  </td>
                  <td className="py-3 px-3">
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-bold">Validated</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-medium text-stone-900">
                    Student Affairs will allow an un-vetted student app to access official student databases.
                  </td>
                  <td className="py-3 px-3">
                    Meet Faculty Officer or SRC Director of Socials/Welfare.
                  </td>
                  <td className="py-3 px-3">
                    Zero official database integration needed for v1. Zero dependency on IT staff.
                  </td>
                  <td className="py-3 px-3">
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-bold">Resolved (Autonomous)</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: STRIDE AppSec Threat Model */}
      {activeTab === 'stride_threats' && (
        <div className="bg-white rounded-[20px] border border-stone-200 p-5 space-y-5">
          <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-800" />
                <h3 className="font-bold text-stone-900 text-sm">STRIDE Threat Modeling (DevSecOps Framework)</h3>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Application security analysis grounded in OWASP Top 10, ASVS, and the Nigeria Data Protection Act 2023.
              </p>
            </div>
            <span className="text-xs font-mono bg-stone-100 text-stone-700 px-2.5 py-1 rounded-[10px] font-semibold border border-stone-200 self-start sm:self-auto">
              DevSecOps Audit
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {NILEFOUND_STRIDE_THREATS.map((t, idx) => (
              <div key={idx} className="bg-stone-50 border border-stone-200 rounded-[20px] p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                      {t.category}
                    </span>
                    <span className={`text-xs font-bold px-1.5 py-0.2 rounded uppercase ${
                      t.impactLevel === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {t.impactLevel} Impact
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-stone-800 leading-snug">
                    {t.threatDescription}
                  </p>

                  <div className="text-xs text-stone-600 bg-white p-2.5 rounded-[12px] border border-stone-200 space-y-1">
                    <strong className="text-stone-700 block">Campus Real-World Scenario:</strong>
                    <p className="italic text-stone-600 leading-relaxed">{t.campusContext}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200/80 space-y-1">
                  <strong className="text-xs text-emerald-900 block font-bold">
                    Technical Defense & Countermeasure:
                  </strong>
                  <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                    {t.technicalCountermeasure}
                  </p>
                  <span className="text-xs text-stone-400 font-mono block pt-0.5">
                    Ref: {t.owaspReference}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
