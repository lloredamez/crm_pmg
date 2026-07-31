'use client';

import React, { useState } from 'react';
import { DispositionManagement } from '@/components/settings/disposition-management';
import { UnitManagement } from '@/components/settings/unit-management';
import { Settings, Tag, Store, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';

export const SettingsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('dispositions');

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-3xl p-12 border border-slate-100 text-center max-w-md mx-auto my-12">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-900 text-base mb-1">Acesso Restrito</h3>
        <p className="text-xs text-slate-500">
          O módulo de configurações é exclusivo para Administradores do sistema.
        </p>
      </div>
    );
  }

  const subTabs = [
    { id: 'dispositions', label: 'Tabulações & Estouro', icon: Tag },
    { id: 'units', label: 'Lojas & Unidades', icon: Store },
  ];

  return (
    <div className="space-y-6">
      {/* Settings Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-slate-100 shadow-xs overflow-x-auto">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sub-Tab Content Rendering */}
      {activeSubTab === 'dispositions' && <DispositionManagement />}
      {activeSubTab === 'units' && <UnitManagement />}
    </div>
  );
};
