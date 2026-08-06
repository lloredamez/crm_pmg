'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Clock, Users, CheckCircle2, XCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface KpiCardsProps {
  totalLeads: number;
  assignedLeads: number;
  convertedLeads: number;
  lostLeads?: number;
  totalValorLiberado?: number;
  valorLiberadoAtivos?: number;
  valorLiberadoConvertidos?: number;
  valorLiberadoPerdidos?: number;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  totalLeads,
  assignedLeads,
  convertedLeads,
  lostLeads = 0,
  totalValorLiberado = 0,
  valorLiberadoAtivos = 0,
  valorLiberadoConvertidos = 0,
  valorLiberadoPerdidos = 0,
}) => {
  const cards = [
    {
      title: 'Total Leads',
      value: totalLeads.toString(),
      badge: '+12%',
      badgeType: 'mint',
      subtitle: `Total Liberado: ${formatCurrency(totalValorLiberado)}`,
      icon: Users,
    },
    {
      title: 'Atendimentos Ativos SLA',
      value: assignedLeads.toString(),
      badge: '+4',
      badgeType: 'mint',
      subtitle: `Total Liberado: ${formatCurrency(valorLiberadoAtivos)}`,
      icon: Clock,
    },
    {
      title: 'Leads Convertidos',
      value: convertedLeads.toString(),
      badge: '+8.4%',
      badgeType: 'mint',
      subtitle: `Total Liberado: ${formatCurrency(valorLiberadoConvertidos)}`,
      icon: CheckCircle2,
    },
    {
      title: 'Leads Perdidos',
      value: lostLeads.toString(),
      badge: '-5.2%',
      badgeType: 'pink',
      subtitle: `Total Perdido: ${formatCurrency(valorLiberadoPerdidos)}`,
      icon: XCircle,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 font-medium text-xs tracking-wide uppercase">{card.title}</span>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-600">
                <Icon className="w-4 h-4 text-brand-600" />
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{card.value}</h3>
              {/*<span
                className={
                  card.badgeType === 'mint'
                    ? 'badge-mint'
                    : 'badge-pink'
                }
              >
                {card.badgeType === 'mint' ? (
                  <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-rose-600" />
                )}
                {card.badge}
              </span>*/
            }</div>

            <p className="text-slate-400 text-xs mt-2 font-normal">{card.subtitle}</p>
          </div>
        );
      })}
    </div>
  );
};
