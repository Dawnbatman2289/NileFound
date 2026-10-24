/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  Clock, 
  ShieldCheck, 
  Users, 
  DollarSign, 
  HelpCircle,
  Award
} from 'lucide-react';
import { SUCCESS_METRICS } from '../data/researchQuestions.ts';

export const MetricsView: React.FC = () => {
  // Interactive campus simulation sliders
  const [estimatedMonthlyLost, setEstimatedMonthlyLost] = useState(80);
  const [reportingRatePct, setReportingRatePct] = useState(65);
  const [returnSuccessPct, setReturnSuccessPct] = useState(55);
  const [idCardCostNgn, setIdCardCostNgn] = useState(5000); // ₦5,000 ID re-issue fee

  // Derived metrics
  const monthlyReported = Math.round((estimatedMonthlyLost * reportingRatePct) / 100);
  const monthlyReturned = Math.round((monthlyReported * returnSuccessPct) / 100);
  const studentMoneySavedNgn = monthlyReturned * idCardCostNgn;
  const whatsappBaselineReturned = Math.round(estimatedMonthlyLost * 0.12); // ~12% in unstructured WhatsApp

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-emerald-900 text-white rounded-xl p-5 border border-emerald-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
          <TrendingUp className="w-4 h-4" />
          <span>Stage 1 Metric Framework & Campus ROI Calculator</span>
        </div>
        <h2 className="text-lg font-bold">Defining Measurable Engineering Success</h2>
        <p className="text-xs text-emerald-100/90 leading-relaxed max-w-2xl">
          In senior engineering, a feature is only "done" if we can measure its impact. Here are the 4 core North Star metrics for NileFound, plus an interactive impact calculator to show Student Affairs.
        </p>
      </div>

      {/* 4 Core Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {SUCCESS_METRICS.map((m, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-stone-200 p-4 space-y-2 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              Metric #{idx + 1}
            </span>
            <h4 className="font-bold text-stone-900 text-sm">{m.metric}</h4>
            <div className="bg-stone-50 p-2 rounded text-[11px] font-mono text-stone-700 border border-stone-100">
              {m.formula}
            </div>
            <div className="pt-1">
              <span className="text-[10px] font-bold text-emerald-900 block">Target:</span>
              <p className="text-xs font-semibold text-emerald-700">{m.target}</p>
            </div>
            <p className="text-[10px] text-stone-500 italic border-t border-stone-100 pt-1">
              Baseline: {m.benchmark}
            </p>
          </div>
        ))}
      </div>

      {/* Interactive Campus Impact & Student Money Saved Simulator */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-5">
        <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">Campus Impact Simulator (Exploratory Scenario Model)</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Simulate potential outcomes based on adjustable assumptions (to be validated during pilot).
            </p>
          </div>
          <span className="text-xs bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full font-bold self-start sm:self-auto">
            Exploratory Model (Not Verified Facts)
          </span>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
          <div>
            <div className="flex justify-between text-xs font-semibold text-stone-700 mb-1">
              <span>Estimated Lost Items / Month:</span>
              <span className="text-emerald-700 font-bold">{estimatedMonthlyLost}</span>
            </div>
            <input
              type="range"
              min={20}
              max={250}
              value={estimatedMonthlyLost}
              onChange={(e) => setEstimatedMonthlyLost(Number(e.target.value))}
              className="w-full accent-emerald-700"
            />
            <span className="text-[10px] text-stone-400">Assumed monthly volume</span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-stone-700 mb-1">
              <span>Finder Reporting Rate (%):</span>
              <span className="text-emerald-700 font-bold">{reportingRatePct}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={95}
              value={reportingRatePct}
              onChange={(e) => setReportingRatePct(Number(e.target.value))}
              className="w-full accent-emerald-700"
            />
            <span className="text-[10px] text-stone-400">Assumed proportion logged</span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-stone-700 mb-1">
              <span>Return Success Rate (%):</span>
              <span className="text-emerald-700 font-bold">{returnSuccessPct}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={95}
              value={returnSuccessPct}
              onChange={(e) => setReturnSuccessPct(Number(e.target.value))}
              className="w-full accent-emerald-700"
            />
            <span className="text-[10px] text-stone-400">Assumed claim verification rate</span>
          </div>
        </div>

        {/* Projected Impact Output Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-1">
            <span className="text-[11px] font-bold text-emerald-800 uppercase">Simulated Reunited / Mo</span>
            <div className="text-3xl font-extrabold text-emerald-950 font-mono">
              {monthlyReturned}
            </div>
            <p className="text-[11px] text-emerald-700 font-medium">
              Calculated projection from slider assumptions
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-1">
            <span className="text-[11px] font-bold text-amber-900 uppercase">Simulated Money Saved / Mo</span>
            <div className="text-3xl font-extrabold text-amber-950 font-mono">
              ₦{(studentMoneySavedNgn).toLocaleString()}
            </div>
            <p className="text-[11px] text-amber-800 font-medium">
              Based on assumed ₦5,000 ID replacement cost
            </p>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-center space-y-1">
            <span className="text-[11px] font-bold text-stone-700 uppercase">Pilot Target Window</span>
            <div className="text-3xl font-extrabold text-stone-900 font-mono">
              &lt; 24 hrs
            </div>
            <p className="text-[11px] text-stone-500 font-medium">
              Target assumption to be validated during pilot
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
