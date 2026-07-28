'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const mockChartData = [
  { day: 'Seg', actual: 42, projected: 40 },
  { day: 'Ter', actual: 58, projected: 52 },
  { day: 'Qua', actual: 75, projected: 68 },
  { day: 'Qui', actual: 64, projected: 70 },
  { day: 'Sex', actual: 90, projected: 85 },
  { day: 'Sáb', actual: 48, projected: 50 },
  { day: 'Dom', actual: 35, projected: 38 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-800">
        <span className="inline-block bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md mb-1.5">
          {label}
        </span>
        <div className="flex items-center gap-2 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Actual: {payload[0].value} leads</span>
        </div>
        <div className="flex items-center gap-2 text-indigo-300 mt-1">
          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
          <span>AI Projected: {payload[1].value} leads</span>
        </div>
      </div>
    );
  }
  return null;
};

export const AnalyticsChart: React.FC = () => {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Volume de Leads & SLA Projetado</h3>
          <p className="text-xs text-slate-400">Tempo de resposta e distribuição em tempo real nesta semana</p>
        </div>

        {/* Legend Indicator Bullets */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-600"></span>
            <span className="text-slate-600">Actual Leads</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-slate-600">AI Projected</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorActual)" />
            <Area type="monotone" dataKey="projected" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorProjected)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
