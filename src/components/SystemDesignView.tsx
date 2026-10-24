/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Stage 4 & 5 System Design & Prototype Hub
 * Layout: Multi-tab engineering workspace featuring SQL DDL, Standalone Prototype, QA Edge Cases, and Rollout Strategy.
 * Main Action: Review technical specifications, copy database migrations, and launch single-file prototype.
 */

import React, { useState } from 'react';
import { 
  Database, 
  Code2, 
  CheckCircle2, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Sparkles,
  FileCode,
  Terminal,
  Flag
} from 'lucide-react';
import { NILEFOUND_SQL_SCHEMA } from '../data/databaseSchemaSql.ts';

export const SystemDesignView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sql_schema' | 'prototype_demo' | 'qa_protocol' | 'rollout_plan'>('sql_schema');
  const [copiedSql, setCopiedSql] = useState(false);

  const handleCopySql = () => {
    navigator.clipboard.writeText(NILEFOUND_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-emerald-900 text-white rounded-xl p-5 border border-emerald-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
          <Terminal className="w-4 h-4" />
          <span>Stage 4 & 5: System Design, Database Schema & Prototype</span>
        </div>
        <h2 className="text-lg font-bold">Production Blueprint & Student Affairs Prototype</h2>
        <p className="text-xs text-emerald-100/90 leading-relaxed max-w-2xl">
          Everything specified in your technical feasibility analysis: PostgreSQL schema with Row-Level Security, the standalone single-file prototype for Student Services Centre (Room 101), usability test protocols, and phased campus rollout.
        </p>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-stone-200 gap-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('sql_schema')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'sql_schema'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>PostgreSQL Schema & RLS Policies</span>
        </button>

        <button
          onClick={() => setActiveTab('prototype_demo')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'prototype_demo'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <FileCode className="w-3.5 h-3.5 text-amber-600" />
          <span>Single-File HTML Prototype</span>
        </button>

        <button
          onClick={() => setActiveTab('qa_protocol')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'qa_protocol'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>QA Edge Cases & Usability Test</span>
        </button>

        <button
          onClick={() => setActiveTab('rollout_plan')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'rollout_plan'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Phased Campus Rollout (Ubangi to Hostels)</span>
        </button>
      </div>

      {/* TAB 1: PostgreSQL DDL & RLS Policies */}
      {activeTab === 'sql_schema' && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">PostgreSQL 15 Relational DDL & Supabase RLS Policies</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                5 core relational tables with Row-Level Security enforcing NDPA 2023 compliance at the database engine level.
              </p>
            </div>
            <button
              onClick={handleCopySql}
              className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              {copiedSql ? (
                <>
                  <Check className="w-3.5 h-3.5 text-amber-300" />
                  <span>Copied Migration!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy SQL Migration</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-stone-900 text-stone-100 font-mono text-xs p-4 rounded-xl overflow-x-auto max-h-[500px] border border-stone-800 scrollbar-thin">
            <pre className="text-emerald-300/90 leading-relaxed">{NILEFOUND_SQL_SCHEMA}</pre>
          </div>
        </div>
      )}

      {/* TAB 2: Single-File HTML Prototype */}
      {activeTab === 'prototype_demo' && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-5">
          <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Standalone Single-File HTML Prototype</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Self-contained demonstration app (Tailwind CDN + in-memory localStorage) created for Student Affairs in Room 101.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/prototype.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Launch Prototype in New Tab</span>
              </a>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 space-y-2">
            <p className="font-semibold text-emerald-950">Why this prototype is crucial for your pitch:</p>
            <p className="text-emerald-800 leading-relaxed">
              Before Student Affairs or Campus Security grants permission to link to official university emails, you can open this single file from a flash drive on any computer in the Student Services Centre with zero installation. It demonstrates the complete reporting, search, hidden verification, and admin purging workflow offline!
            </p>
          </div>

          <div className="border border-stone-200 rounded-xl overflow-hidden shadow-xs h-[550px] bg-stone-100">
            <iframe
              src="/prototype.html"
              title="Standalone Prototype Demo"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}

      {/* TAB 3: QA Edge Cases & Usability Test Protocol */}
      {activeTab === 'qa_protocol' && (
        <div className="space-y-5">
          {/* Usability Testing 3 Tasks */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <div className="border-b border-stone-100 pb-2">
              <h3 className="font-bold text-stone-900 text-sm">Usability Testing Protocol (5 Nile Students)</h3>
              <p className="text-xs text-stone-500 mt-0.5">Scenario-based testing across distinct university faculties.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2">
                <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px] uppercase">
                  Task 1: Log Misplaced Calculator
                </span>
                <p className="text-stone-700 font-medium">
                  Log a misplaced scientific calculator at Ubangi STEM Lab while throttling network to simulated 3G.
                </p>
                <div className="border-t border-stone-200 pt-1 text-[11px] text-stone-500">
                  Target: <strong>&lt; 90 seconds</strong> completion time • Checks IndexedDB offline cache.
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2">
                <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px] uppercase">
                  Task 2: Locate ID Card & Claim
                </span>
                <p className="text-stone-700 font-medium">
                  Locate a found Student ID card on the public feed and submit an ownership claim with hidden attribute.
                </p>
                <div className="border-t border-stone-200 pt-1 text-[11px] text-stone-500">
                  Target: <strong>&lt; 45 seconds</strong> • Verifies blur filter & frictionless navigation.
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2">
                <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px] uppercase">
                  Task 3: Review Claim & Relay
                </span>
                <p className="text-stone-700 font-medium">
                  Review a pending claim as finder/admin, validate the answer, and initiate secure WhatsApp contact.
                </p>
                <div className="border-t border-stone-200 pt-1 text-[11px] text-stone-500">
                  Target: <strong>&lt; 30 seconds</strong> • Confirms double opt-in WhatsApp revelation.
                </div>
              </div>
            </div>
          </div>

          {/* Edge Case Failure Matrix */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <div className="border-b border-stone-100 pb-2">
              <h3 className="font-bold text-stone-900 text-sm">Edge Case Failure Handling Matrix</h3>
              <p className="text-xs text-stone-500 mt-0.5">Automated technical handling strategies for real campus anomalies.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-700 border-b border-stone-200">
                    <th className="py-2.5 px-3 font-semibold">Edge Case Scenario</th>
                    <th className="py-2.5 px-3 font-semibold">System Failure Risk</th>
                    <th className="py-2.5 px-3 font-semibold">Automated Engineering Strategy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  <tr>
                    <td className="py-3 px-3 font-semibold text-stone-900">Duplicate Item Reporting</td>
                    <td className="py-3 px-3 text-rose-700">Multiple finders report same lost item, cluttering feed.</td>
                    <td className="py-3 px-3">Rule-based proximity engine flags duplicate candidates if S(q, d) &gt;= 0.85 on location, category, and date window.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-semibold text-stone-900">Incorrect Verification Response</td>
                    <td className="py-3 px-3 text-rose-700">Brute-force guessing attacks on secret verification answers.</td>
                    <td className="py-3 px-3">Claim state sets to REJECTED. System enforces maximum 3 claim attempts per user per item within 24 hours.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-semibold text-stone-900">Network Loss Mid-Upload</td>
                    <td className="py-3 px-3 text-rose-700">Phone upload stalls halfway on fluctuating 3G cellular network.</td>
                    <td className="py-3 px-3">Image blob remains serialized in IndexedDB offline storage queue. Upload retries automatically via Exponential Backoff upon online event.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-semibold text-stone-900">Spam / Abusive Submissions</td>
                    <td className="py-3 px-3 text-rose-700">Bad actors submit profane or spam posts.</td>
                    <td className="py-3 px-3">Client rate limiting (max 3 posts per hour per verified user). Admin console features single-click purge and account suspension flags.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Phased Campus Rollout Plan */}
      {activeTab === 'rollout_plan' && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-5">
          <div className="border-b border-stone-100 pb-2">
            <h3 className="font-bold text-stone-900 text-sm">Phased Campus Rollout Plan (Nile University of Nigeria)</h3>
            <p className="text-xs text-stone-500 mt-0.5">Structured 3-phase deployment strategy ensuring high adoption and operational stability.</p>
          </div>

          <div className="space-y-4">
            <div className="bg-stone-50 border-l-4 border-emerald-600 p-4 rounded-r-xl space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-stone-900 text-xs">Phase 1: Controlled Pilot (Weeks 1 to 4)</h4>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Faculty Pilot</span>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed">
                Deploy exclusively within the <strong>Ubangi STEM Laboratory Building</strong> and the <strong>Faculty of Computing / Software Engineering</strong> departments. Post physical QR code flyers linking to the PWA in computer laboratories and study lounges.
              </p>
            </div>

            <div className="bg-stone-50 border-l-4 border-amber-500 p-4 rounded-r-xl space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-stone-900 text-xs">Phase 2: Residential Expansion (Weeks 5 to 8)</h4>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Hostel Expansion</span>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed">
                Expand coverage to <strong>Male and Female On-Campus Hostels</strong> and the <strong>Limpopo Bay Law Faculty building</strong>. Onboard hostel security officers and reception desk personnel to record physical items deposited at residential desks.
              </p>
            </div>

            <div className="bg-stone-50 border-l-4 border-stone-900 p-4 rounded-r-xl space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-stone-900 text-xs">Phase 3: Campus-Wide Institutional Adoption (Weeks 9+)</h4>
                <span className="text-[10px] font-bold bg-stone-200 text-stone-800 px-2 py-0.5 rounded">University Wide</span>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed">
                Transfer master administrative access to the <strong>Student Services Centre (Room 101)</strong> and <strong>Nile House Security Administration</strong>. Embed NileFound onboarding links into orientation packages for incoming undergraduate students.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
