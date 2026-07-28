'use client';

import React from 'react';
import { useSocket } from '@/features/socket/socket-provider';
import { useAuth } from '@/features/auth/auth-provider';
import { Zap, Users, Radio, UserCog, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUserStatus: string;
  onStatusChange: (status: string) => void;
  onOpenSimulateModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUserStatus,
  onStatusChange,
  onOpenSimulateModal,
}) => {
  const { isConnected } = useSocket();
  const { user, logout, isAdmin } = useAuth();

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: Zap },
    { id: 'leads', label: 'Leads/Clientes', icon: Users },
    //{ id: 'projects', label: 'Projects', icon: FolderKanban },
    //{ id: 'inbox', label: 'Inbox', icon: Inbox },
    //{ id: 'analytics', label: 'Analytics', icon: BarChart2 },
  ];

  if (isAdmin) {
    navItems.push({ id: 'users', label: 'Gestão de Usuários', icon: UserCog });
  }

  const getRoleBadge = (role?: string) => {
    if (role === 'admin') return <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">👑 Admin</span>;
    if (role === 'supervisor') return <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">👔 Supervisor</span>;
    return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">🎧 Atendente</span>;
  };

  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo & Brand Badge */}
        <div className="flex items-center gap-3">
          {/*<div className="w-10 h-10 rounded-2xl bg-line-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-brand-500/20">
            <Zap className="w-5 h-5" />
          </div>*/}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 tracking-tight text-lg">Lead CRM</span>
            </div>
          </div>
        </div>

        {/* Pill Nav Tabs */}
        <nav className="hidden md:flex items-center bg-slate-100/70 p-1.5 rounded-full border border-slate-200/50">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'pill-tab flex items-center gap-2 text-[10px]',
                  isActive ? 'pill-tab-active' : 'pill-tab-inactive'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-brand-600' : 'text-slate-400')} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Status Selector & User Actions */}
        <div className="flex items-center gap-3">
          {/* Real-time Indicator }
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-small text-slate-600">
            <Radio className={cn("w-3 h-3", isConnected ? "text-emerald-500 animate-pulse" : "text-slate-400")} />
            {isConnected ? "Real-time" : "Offline"}
          </div> */}

          {/* User Status Selector */}
          <select
            value={currentUserStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-full border outline-none cursor-pointer transition-colors",
              currentUserStatus === 'online' && "bg-emerald-50 text-emerald-700 border-emerald-300",
              currentUserStatus === 'busy' && "bg-amber-50 text-amber-700 border-amber-300",
              currentUserStatus === 'offline' && "bg-slate-100 text-slate-600 border-slate-300"
            )}
          >
            <option value="online">🟢 Online</option>
            <option value="busy">🟡 Ocupado</option>
            <option value="offline">⚪ Offline</option>
          </select>

          {/* Trigger Mock Lead Button */}
          <button
            onClick={onOpenSimulateModal}
            className="bg-brand-600 hover:bg-brand-700 text-black font-medium text-xs px-3.5 py-2 rounded-full shadow-sm shadow-brand-500/20 transition-all flex items-center gap-1.5"
          >
            + Simular
          </button>

          {/* Logged User Info & Logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="text-right hidden xl:block">
                <div className="text-xs font-bold text-slate-900 leading-tight">{user.name}</div>
                <div>{getRoleBadge(user.role)}</div>
              </div>
              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
                title="Sair da Conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
