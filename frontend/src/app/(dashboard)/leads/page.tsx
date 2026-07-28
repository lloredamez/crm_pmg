'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/auth-provider';
import { Header } from '@/components/layout/header';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { AnalyticsChart } from '@/components/dashboard/analytics-chart';
import { LeadTable } from '@/components/leads/lead-table';
import { LeadModal } from '@/components/leads/lead-modal';
import { SimulateLeadModal } from '@/components/leads/simulate-lead-modal';
import { UserManagement } from '@/components/users/user-management';
import { fetchLeads, fetchUsers, updateUserStatus, reassignLead, bulkReassignLeads } from '@/features/leads/api';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
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

  // Fetch Leads with Role Filter
  const attendantFilterId = isAttendant || filterOnlyMyLeads ? user?.id : undefined;

  const { data: leadsData, refetch: refetchLeads } = useQuery({
    queryKey: ['leads', page, statusFilter, searchQuery, attendantFilterId],
    queryFn: () =>
      fetchLeads({
        page,
        limit: 10,
        status: statusFilter,
        search: searchQuery,
        attendant_id: attendantFilterId,
      }),
    enabled: !!user,
  });

  // Listen to Socket real-time updates to invalidate queries automatically
  useEffect(() => {
    if (!socket) return;

    const handleLeadsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    };

    socket.on('leads:updated', handleLeadsUpdated);

    return () => {
      socket.off('leads:updated', handleLeadsUpdated);
    };
  }, [socket, queryClient]);

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
  const assignedLeadsCount = leads.filter((l) => l.status === 'assigned' || l.status === 'in_progress').length;
  const convertedLeadsCount = leads.filter((l) => l.status === 'converted').length;
  const expiredSlaCount = leads.filter((l) => l.status === 'expired').length;

  return (
    <div className="min-h-screen bg-slate-50/50">
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
        {/* Render User Management if activeTab is 'users' and user is Admin */}
        {activeTab === 'users' && isAdmin ? (
          <UserManagement users={users} onRefresh={refetchUsers} />
        ) : (
          <>
            {/* KPI Summary Cards */}
            <KpiCards
              totalLeads={total}
              assignedLeads={assignedLeadsCount}
              convertedLeads={convertedLeadsCount}
              slaExpiredCount={expiredSlaCount}
            />

            {/* Role Filter Notice */}
            {isSupervisor && (
              <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-slate-100 mb-6 text-xs text-slate-600">
                <span className="font-semibold">
                  Exibindo visão de Supervisor: {filterOnlyMyLeads ? 'Meus Leads Atribuídos' : 'Todos os Leads da Equipe'}
                </span>
                <button
                  onClick={() => setFilterOnlyMyLeads(!filterOnlyMyLeads)}
                  className="text-brand-600 hover:text-brand-700 font-bold hover:underline"
                >
                  {filterOnlyMyLeads ? 'Ver Todos da Equipe' : 'Filtrar Somente Meus Leads'}
                </button>
              </div>
            )}

            {/* Analytics Section */}
            {activeTab === 'overview' || activeTab === 'analytics' ? (
              <AnalyticsChart />
            ) : null}

            {/* Data Grid Section */}
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
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
                setPage(1);
              }}
              onOpenLeadModal={(lead) => setSelectedLead(lead)}
              onReassignSingle={handleReassignSingle}
              onBulkReassign={handleBulkReassign}
            />
          </>
        )}
      </main>

      {/* Modals */}
      <LeadModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onRefresh={refetchLeads}
      />

      <SimulateLeadModal
        isOpen={isSimulateModalOpen}
        onClose={() => setIsSimulateModalOpen(false)}
        onSuccess={refetchLeads}
      />
    </div>
  );
}
