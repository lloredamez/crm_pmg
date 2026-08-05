'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/auth-provider';
import { Header } from '@/components/layout/header';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { AttendantPerformanceTable } from '@/components/dashboard/attendant-performance-table';
import { AnalyticsChart } from '@/components/dashboard/analytics-chart';
import { LeadTable } from '@/components/leads/lead-table';
import { LeadModal } from '@/components/leads/lead-modal';
import { LeadDetailsModal } from '@/components/leads/lead-details-modal';
import { TabulateLeadModal } from '@/components/leads/tabulate-lead-modal';
import { SimulateLeadModal } from '@/components/leads/simulate-lead-modal';
import { UserManagement } from '@/components/users/user-management';
import { SettingsPage } from '@/components/settings/settings-page';
import { fetchLeads, fetchUsers, updateUserStatus, reassignLead, bulkReassignLeads, revealLead } from '@/features/leads/api';
import { Lead, User } from '@/features/leads/types';
import { useSocket } from '@/features/socket/socket-provider';

export default function LeadsDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { user, isLoading: isAuthLoading, isAttendant, isSupervisor, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState('leads');
  const [currentUserStatus, setCurrentUserStatus] = useState('online');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [bancoFilter, setBancoFilter] = useState('all');
  const [tabelaFilter, setTabelaFilter] = useState('all');
  const [selectedAttendantFilter, setSelectedAttendantFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedDetailsLead, setSelectedDetailsLead] = useState<Lead | null>(null);
  const [selectedTabulateLead, setSelectedTabulateLead] = useState<Lead | null>(null);
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [filterOnlyMyLeads, setFilterOnlyMyLeads] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    }
  }, [isAuthLoading, user, router]);

  // Sync user status state
  useEffect(() => {
    if (user?.status) {
      setCurrentUserStatus(user.status);
    }
  }, [user]);

  // Fetch Users
  const { data: users = [], refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: !!user,
  });

  // Fetch Leads with Role & Custom Header Filters
  const activeAttendantId = isAttendant
    ? user?.id
    : selectedAttendantFilter !== 'all'
    ? selectedAttendantFilter
    : undefined;

  const { data: leadsData, refetch: refetchLeads } = useQuery({
    queryKey: ['leads', page, statusFilter, searchQuery, activeAttendantId, bancoFilter, tabelaFilter, activeTab],
    queryFn: () =>
      fetchLeads({
        page,
        limit: activeTab === 'overview' ? 500 : 10,
        status: activeTab === 'overview' ? 'all' : statusFilter,
        search: activeTab === 'overview' ? undefined : searchQuery,
        attendant_id: activeTab === 'overview' ? undefined : activeAttendantId,
        banco: activeTab === 'overview' ? undefined : bancoFilter,
        tabela: activeTab === 'overview' ? undefined : tabelaFilter,
      }),
    enabled: !!user,
    refetchInterval: 5000, // Automatic real-time polling fallback
  });

  // Listen to Socket real-time updates to invalidate queries and refetch automatically
  useEffect(() => {
    if (!socket) return;

    if (user?.id) {
      socket.emit('join_attendant', { user_id: user.id });
    }

    const handleRefreshData = () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.refetchQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      refetchLeads();
      refetchUsers();
    };

    socket.on('leads:updated', handleRefreshData);
    socket.on('lead:assigned', handleRefreshData);
    socket.on('lead:timeout_removed', handleRefreshData);
    socket.on('lead:reassigned', handleRefreshData);

    return () => {
      socket.off('leads:updated', handleRefreshData);
      socket.off('lead:assigned', handleRefreshData);
      socket.off('lead:timeout_removed', handleRefreshData);
      socket.off('lead:reassigned', handleRefreshData);
    };
  }, [socket, user?.id, queryClient, refetchLeads, refetchUsers]);

  // Keep open modal lead details synced with latest WebSocket / Query updates
  useEffect(() => {
    if (leadsData?.items) {
      if (selectedDetailsLead) {
        const updated = leadsData.items.find((l: Lead) => l.id === selectedDetailsLead.id);
        if (updated) setSelectedDetailsLead(updated);
      }
      if (selectedTabulateLead) {
        const updated = leadsData.items.find((l: Lead) => l.id === selectedTabulateLead.id);
        if (updated) setSelectedTabulateLead(updated);
      }
    }
  }, [leadsData]);



  const handleStatusChange = async (newStatus: string) => {
    setCurrentUserStatus(newStatus);
    if (user) {
      try {
        await updateUserStatus(user.id, newStatus);
        queryClient.invalidateQueries({ queryKey: ['users'] });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleReassignSingle = async (leadId: string, attendantId: string) => {
    try {
      await reassignLead(leadId, attendantId);
      refetchLeads();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkReassign = async (leadIds: string[], attendantId: string) => {
    try {
      await bulkReassignLeads(leadIds, attendantId);
      refetchLeads();
    } catch (e) {
      console.error(e);
    }
  };

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">
        Carregando sessão do CRM...
      </div>
    );
  }

  const leads = leadsData?.items || [];
  const total = leadsData?.total || 0;
  const pages = leadsData?.pages || 1;

  // Compute KPI metrics dynamically
  const activeLeads = leads.filter((l) => l.status === 'assigned' || l.status === 'in_progress');
  const convertedLeadsList = leads.filter((l) => l.status === 'converted');
  const assignedLeadsCount = activeLeads.length;
  const convertedLeadsCount = convertedLeadsList.length;
  const expiredSlaCount = leads.filter((l) => l.status === 'expired').length;

  const totalValorLiberado = leads.reduce((sum, l) => sum + (l.valor_liberado || 0), 0);
  const valorLiberadoAtivos = activeLeads.reduce((sum, l) => sum + (l.valor_liberado || 0), 0);
  const valorLiberadoConvertidos = convertedLeadsList.reduce((sum, l) => sum + (l.valor_liberado || 0), 0);

  const handleRevealLead = async (lead: Lead) => {
    if (lead.is_revealed) return;
    try {
      await revealLead(lead.id);
      refetchLeads();
    } catch (err) {
      console.error('Erro ao revelar lead:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUserStatus={currentUserStatus}
        onStatusChange={handleStatusChange}
        onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
      />

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Render Settings Page if activeTab is 'settings' and user is Admin */}
        {activeTab === 'settings' && isAdmin ? (
          <SettingsPage />
        ) : activeTab === 'users' && (isAdmin || isSupervisor) ? (
          <UserManagement users={users} onRefresh={refetchUsers} />
        ) : (
          <>
            {/* KPI Summary Cards */}
            <KpiCards
              totalLeads={total}
              assignedLeads={assignedLeadsCount}
              convertedLeads={convertedLeadsCount}
              slaExpiredCount={expiredSlaCount}
              totalValorLiberado={totalValorLiberado}
              valorLiberadoAtivos={valorLiberadoAtivos}
              valorLiberadoConvertidos={valorLiberadoConvertidos}
            />

            {/* Role Filter Notice */}
            {user?.role === 'supervisor' && (
              <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-slate-100 mb-6 text-xs text-slate-600">
                <span className="font-semibold">
                  Visão de Supervisor: Exibindo todos os leads da sua unidade / loja
                </span>
              </div>
            )}

            {/* Dashboard View (Overview): Tabela de Desempenho por Atendente */}
            {activeTab === 'overview' ? (
              <AttendantPerformanceTable leads={leads} users={users} />
            ) : activeTab === 'analytics' ? (
              <AnalyticsChart />
            ) : (
              /* Leads View: Tabela de Gerenciamento de Leads */
              <LeadTable
                leads={leads}
                users={users}
                total={total}
                page={page}
                pages={pages}
                onPageChange={setPage}
                statusFilter={statusFilter}
                onStatusFilterChange={(st) => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                bancoFilter={bancoFilter}
                onBancoFilterChange={(b) => {
                  setBancoFilter(b);
                  setPage(1);
                }}
                tabelaFilter={tabelaFilter}
                onTabelaFilterChange={(t) => {
                  setTabelaFilter(t);
                  setPage(1);
                }}
                attendantFilter={selectedAttendantFilter}
                onAttendantFilterChange={(attId) => {
                  setSelectedAttendantFilter(attId);
                  setPage(1);
                }}
                searchQuery={searchQuery}
                onSearchChange={(q) => {
                  setSearchQuery(q);
                  setPage(1);
                }}
                onOpenLeadModal={(lead) => setSelectedLead(lead)}
                onOpenDetailsModal={(lead) => setSelectedDetailsLead(lead)}
                onOpenTabulateModal={(lead) => setSelectedTabulateLead(lead)}
                onRevealLead={handleRevealLead}
                onReassignSingle={handleReassignSingle}
                onBulkReassign={handleBulkReassign}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <LeadModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onRefresh={refetchLeads}
      />

      <LeadDetailsModal
        lead={selectedDetailsLead}
        isOpen={!!selectedDetailsLead}
        onClose={() => setSelectedDetailsLead(null)}
        onRefresh={refetchLeads}
      />

      <TabulateLeadModal
        lead={selectedTabulateLead}
        isOpen={!!selectedTabulateLead}
        onClose={() => setSelectedTabulateLead(null)}
        onSuccess={refetchLeads}
      />

      <SimulateLeadModal
        isOpen={isSimulateModalOpen}
        onClose={() => setIsSimulateModalOpen(false)}
        onSuccess={refetchLeads}
      />
    </div>
  );
}
