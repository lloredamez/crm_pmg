'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '@/features/socket/socket-provider';
import { useAuth } from '@/features/auth/auth-provider';
import { Zap, Users, UserCog, LogOut, Check, Settings, ChevronDown, Share2 } from 'lucide-react';
import { Channel } from '@/features/leads/types';
import { cn } from '@/lib/utils';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUserStatus: string;
  onStatusChange: (status: string) => void;
  onOpenSimulateModal: () => void;
  channels?: Channel[];
  selectedChannelCode?: string;
  onSelectChannel?: (channelCode: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUserStatus,
  onStatusChange,
  onOpenSimulateModal,
  channels = [],
  selectedChannelCode,
  onSelectChannel,
}) => {
  const { isConnected } = useSocket();
  const { user, logout, isAdmin, isManager } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChannelHovered, setIsChannelHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMouseEnterChannel = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsChannelHovered(true);
  };

  const handleMouseLeaveChannel = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsChannelHovered(false);
    }, 180);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: Zap },
    { id: 'leads', label: 'Leads / Clientes', icon: Users },
  ];

  if (isAdmin || isManager) {
    navItems.push({ id: 'users', label: 'Gestão de Usuários', icon: UserCog });
  }

  if (isAdmin) {
    navItems.push({ id: 'settings', label: 'Configurações', icon: Settings });
  }

  const selectedChannelObj = channels.find(
    (c) => c.code.toLowerCase() === selectedChannelCode?.toLowerCase()
  );

  const getRoleBadge = (role?: string) => {
    if (role === 'admin') return <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">👑 Admin</span>;
    if (role === 'manager') return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">👔 Gerente</span>;
    if (role === 'supervisor') return <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">👔 Supervisor</span>;
    return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">🎧 Atendente</span>;
  };

  const userInitial = user?.name ? user.name.trim()[0].toUpperCase() : '?';

  const statusConfig = {
    online: {
      label: 'Online',
      dotBg: 'bg-emerald-500',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    busy: {
      label: 'Ocupado',
      dotBg: 'bg-amber-500',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    offline: {
      label: 'Indisponível',
      dotBg: 'bg-slate-400',
      badgeBg: 'bg-slate-100 text-slate-600 border-slate-200',
    },
  };

  const currentStatusInfo = statusConfig[currentUserStatus as keyof typeof statusConfig] || statusConfig.offline;

  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 px-3 sm:px-4 py-3.5">
      <div className="w-full max-w-full mx-auto flex items-center justify-between gap-4">
        {/* Logo & Brand Badge */}
        <div className="flex items-center gap-3">
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
            const isLeadsItem = item.id === 'leads';

            if (isLeadsItem) {
              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={handleMouseEnterChannel}
                  onMouseLeave={handleMouseLeaveChannel}
                >
                  <button
                    onClick={() => setActiveTab('leads')}
                    className={cn(
                      'pill-tab flex items-center gap-1.5 text-[10px] transition-all cursor-pointer',
                      isActive ? 'pill-tab-active' : 'pill-tab-inactive'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', isActive ? 'text-brand-600' : 'text-slate-400')} />
                    <span>{item.label}</span>
                    {selectedChannelObj && (
                      <span className="font-semibold px-2 py-0.5 rounded-full text-[9px] bg-brand-100/90 text-brand-800 border border-brand-200/70 max-w-28 truncate">
                        {selectedChannelObj.name}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 text-slate-400 transition-transform duration-200',
                        isChannelHovered ? 'rotate-180 text-brand-600' : ''
                      )}
                    />
                  </button>

                  {/* Channel Dropdown Menu on Hover */}
                  {isChannelHovered && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1.5 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                            Canais da Loja
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Selecione o canal para filtrar os leads
                          </p>
                        </div>
                      </div>

                      {channels.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-slate-400">
                          Nenhum canal ativo associado à sua unidade
                        </div>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {channels.map((chan) => {
                            const isSelected =
                              chan.code.toLowerCase() === selectedChannelCode?.toLowerCase();
                            return (
                              <button
                                key={chan.id}
                                onClick={() => {
                                  onSelectChannel?.(chan.code);
                                  setActiveTab('leads');
                                  setIsChannelHovered(false);
                                }}
                                className={cn(
                                  'w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer',
                                  isSelected
                                    ? 'bg-brand-50 text-brand-900 font-semibold border border-brand-200 shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                )}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <Share2
                                    className={cn(
                                      'w-3.5 h-3.5 shrink-0',
                                      isSelected ? 'text-brand-600' : 'text-slate-400'
                                    )}
                                  />
                                  <div className="truncate">
                                    <span className="block truncate font-medium">{chan.name}</span>
                                    <span className="block text-[10px] text-slate-400 font-mono">
                                      {chan.code}
                                    </span>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-brand-600 stroke-2 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

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

        {/* User Actions & Avatar Menu */}
        <div className="flex items-center gap-3">
          {/* Trigger Mock Lead Button */}
          <button
            onClick={onOpenSimulateModal}
            className="bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs px-3.5 py-2 rounded-full shadow-sm shadow-brand-500/20 transition-all flex items-center gap-1.5"
          >
            + Simular
          </button>

          {/* User Avatar Circle with Status Popover */}
          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="relative group p-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
                title={`${user.name} (${currentStatusInfo.label})`}
              >
                {/* Circle with Initial */}
                <div className="w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center shadow-sm transition-all select-none">
                  {userInitial}
                </div>

                {/* Status Dot Indicator */}
                <span
                  className={cn(
                    'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ring-1 ring-slate-200 transition-colors',
                    currentStatusInfo.dotBg
                  )}
                />
              </button>

              {/* Popover Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200/80 shadow-xl rounded-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                  {/* User Profile Summary */}
                  <div className="p-3 bg-slate-50/80 rounded-xl mb-2 flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold text-base flex items-center justify-center shadow-xs select-none">
                        {userInitial}
                      </div>
                      <span
                        className={cn(
                          'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white',
                          currentStatusInfo.dotBg
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{user.name}</div>
                      <div className="text-[11px] text-slate-500 truncate mb-1">{user.email}</div>
                      <div>{getRoleBadge(user.role)}</div>
                    </div>
                  </div>

                  {/* Status Selection Section */}
                  <div className="px-1 py-1">
                    <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Status de Atendimento
                    </p>

                    <div className="space-y-1">
                      {/* Online */}
                      <button
                        onClick={() => {
                          onStatusChange('online');
                          setIsMenuOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors',
                          currentUserStatus === 'online'
                            ? 'bg-emerald-50 text-emerald-900 font-semibold'
                            : 'hover:bg-slate-100 text-slate-700'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                          <span>Online</span>
                        </div>
                        {currentUserStatus === 'online' && (
                          <Check className="w-4 h-4 text-emerald-600" />
                        )}
                      </button>

                      {/* Ocupado */}
                      <button
                        onClick={() => {
                          onStatusChange('busy');
                          setIsMenuOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors',
                          currentUserStatus === 'busy'
                            ? 'bg-amber-50 text-amber-900 font-semibold'
                            : 'hover:bg-slate-100 text-slate-700'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                          <span>Ocupado</span>
                        </div>
                        {currentUserStatus === 'busy' && (
                          <Check className="w-4 h-4 text-amber-600" />
                        )}
                      </button>

                      {/* Indisponível / Offline */}
                      <button
                        onClick={() => {
                          onStatusChange('offline');
                          setIsMenuOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors',
                          currentUserStatus === 'offline'
                            ? 'bg-slate-100 text-slate-900 font-semibold'
                            : 'hover:bg-slate-100 text-slate-700'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                          <span>Indisponível</span>
                        </div>
                        {currentUserStatus === 'offline' && (
                          <Check className="w-4 h-4 text-slate-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 my-1.5" />

                  {/* Logout Button */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair da conta</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
