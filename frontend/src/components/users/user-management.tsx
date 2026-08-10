import React, { useState, useEffect } from 'react';
import { User } from '@/features/leads/types';
import { useAuth } from '@/features/auth/auth-provider';
import { ShieldCheck, UserCheck, Headset, UserPlus, Building2, CheckCircle2, Pencil, X, Trash2, Power, AlertTriangle } from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { toggleUserActive, deleteUser } from '@/features/leads/api';

interface UserManagementProps {
  users: User[];
  onRefresh: () => void;
}

interface UnitItem {
  id: string;
  name: string;
  code: string;
}

export const UserManagement: React.FC<UserManagementProps> = ({ users, onRefresh }) => {
  const { token, user: currentUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('attendant');
  const [maxLeads, setMaxLeads] = useState(10);
  const [unitId, setUnitId] = useState<string>('');
  const [selectedManagedUnits, setSelectedManagedUnits] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('attendant');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editMaxLeads, setEditMaxLeads] = useState(10);
  const [editUnitId, setEditUnitId] = useState<string>('');
  const [editSelectedManagedUnits, setEditSelectedManagedUnits] = useState<string[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  // Delete User State
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const API_URL = getApiUrl();

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/users/units/all`);
      if (res.ok) {
        const data = await res.json();
        setUnits(data);
        if (data.length > 0) {
          setUnitId(data[0].id);
          setSelectedManagedUnits(data.map((u: UnitItem) => u.id));
        }
      }
    } catch (e) {
      console.error("Erro ao buscar unidades:", e);
    }
  };

  const handleUnitToggle = (id: string) => {
    if (selectedManagedUnits.includes(id)) {
      setSelectedManagedUnits(selectedManagedUnits.filter((uId) => uId !== id));
    } else {
      setSelectedManagedUnits([...selectedManagedUnits, id]);
    }
  };

  const handleEditUnitToggle = (id: string) => {
    if (editSelectedManagedUnits.includes(id)) {
      setEditSelectedManagedUnits(editSelectedManagedUnits.filter((uId) => uId !== id));
    } else {
      setEditSelectedManagedUnits([...editSelectedManagedUnits, id]);
    }
  };

  const startEditing = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditCpf(user.cpf || '');
    setEditPassword('');
    setEditRole(user.role);
    setEditIsActive(user.is_active !== false);
    setEditMaxLeads(user.max_simultaneous_leads);
    setEditUnitId(user.unit_id || (units.length > 0 ? units[0].id : ''));
    setEditSelectedManagedUnits(user.managed_unit_ids || []);
    setEditMessage(null);
  };

  const handleToggleActive = async (u: User) => {
    try {
      await toggleUserActive(u.id);
      setMessage(`Status da conta de "${u.name}" alterado com sucesso!`);
      onRefresh();
    } catch (err: any) {
      setMessage(`Erro: ${err.message}`);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingLoading(true);
    try {
      await deleteUser(userToDelete.id);
      setMessage(`Usuário "${userToDelete.name}" excluído com sucesso! Leads ativos retornaram ao balde.`);
      setUserToDelete(null);
      onRefresh();
    } catch (err: any) {
      setMessage(`Erro ao excluir: ${err.message}`);
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const payload: any = {
        name,
        email,
        cpf: cpf.trim() || null,
        password,
        role,
        max_simultaneous_leads: Number(maxLeads),
      };

      if (role === 'manager') {
        payload.managed_unit_ids = selectedManagedUnits;
      } else if (role === 'supervisor' || role === 'attendant') {
        payload.unit_id = unitId || null;
      }

      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao cadastrar usuário');
      }

      setMessage(`Usuário ${name} cadastrado com sucesso!`);
      setName('');
      setEmail('');
      setCpf('');
      setPassword('');
      onRefresh();
    } catch (err: any) {
      setMessage(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditLoading(true);
    setEditMessage(null);

    try {
      const payload: any = {
        name: editName,
        email: editEmail,
        cpf: editCpf.trim() || null,
        role: editRole,
        is_active: editIsActive,
        max_simultaneous_leads: Number(editMaxLeads),
      };

      if (editPassword.trim()) {
        payload.password = editPassword;
      }

      if (editRole === 'manager') {
        payload.managed_unit_ids = editSelectedManagedUnits;
        payload.unit_id = null;
      } else if (editRole === 'supervisor' || editRole === 'attendant') {
        payload.unit_id = editUnitId || null;
        payload.managed_unit_ids = [];
      } else {
        payload.unit_id = null;
        payload.managed_unit_ids = [];
      }

      const res = await fetch(`${API_URL}/api/v1/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao atualizar usuário');
      }

      setMessage(`Usuário ${editName} atualizado com sucesso!`);
      setEditingUser(null);
      onRefresh();
    } catch (err: any) {
      setEditMessage(`Erro: ${err.message}`);
    } finally {
      setEditLoading(false);
    }
  };

  const getRoleBadge = (r: string) => {
    if (r === 'admin') {
      return (
        <span className="badge-purple">
          <ShieldCheck className="w-3 h-3" /> Admin
        </span>
      );
    }
    if (r === 'manager') {
      return (
        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <Building2 className="w-3 h-3" /> Gerente
        </span>
      );
    }
    if (r === 'supervisor') {
      return (
        <span className="badge-mint">
          <UserCheck className="w-3 h-3" /> Supervisor
        </span>
      );
    }
    return (
      <span className="badge-slate">
        <Headset className="w-3 h-3" /> Atendente
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Gerenciamento de Equipe & Perfis</h2>
          <p className="text-xs text-slate-400">Cadastre, inative, ative e administre administradores, gerentes, supervisores e atendentes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Create User */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-slate-900 text-sm">Cadastrar Novo Integrante</h3>
          </div>

          {message && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs rounded-2xl mb-4 font-medium flex items-center justify-between">
              <span>{message}</span>
              <button onClick={() => setMessage(null)} className="text-indigo-400 hover:text-indigo-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo</label>
              <input
                type="text"
                required
                placeholder="Ex: Pedro Henrique"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Corporativo</label>
              <input
                type="email"
                required
                placeholder="pedro@crmleads.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">CPF</label>
              <input
                type="text"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Senha Inicial</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Perfil / Nível de Acesso</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                <option value="attendant">🎧 Atendente (Atendimento e Leads próprios)</option>
                <option value="supervisor">👔 Supervisor (Gestão de Fila e SLA da Unidade)</option>
                <option value="manager">🏢 Gerente (Controle Regional / Múltiplas Unidades)</option>
                <option value="admin">👑 Administrador (Acesso Total)</option>
              </select>
            </div>

            {/* Unidades para Gerente (Múltipla Seleção) */}
            {role === 'manager' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Unidades Sob Gestão do Gerente</label>
                <div className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto">
                  {units.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                      <input
                        type="checkbox"
                        checked={selectedManagedUnits.includes(u.id)}
                        onChange={() => handleUnitToggle(u.id)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span>{u.name} ({u.code})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Unidade Única para Supervisor / Atendente */}
            {(role === 'supervisor' || role === 'attendant') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unidade Atribuída</label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Capacidade SLA apenas para Atendentes */}
            {role === 'attendant' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Capacidade Máxima Leads Simultâneos</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxLeads}
                  onChange={(e) => setMaxLeads(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl shadow-sm shadow-brand-500/20 transition-all"
            >
              {loading ? 'Cadastrando...' : 'Salvar Novo Integrante'}
            </button>
          </form>
        </div>

        {/* List of Users */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm lg:col-span-2">
          <h3 className="font-bold text-slate-900 text-sm mb-4">Integrantes Cadastrados na Plataforma ({users.length})</h3>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Nome / E-mail</th>
                  <th className="py-3 px-4">CPF</th>
                  <th className="py-3 px-4">Perfil</th>
                  <th className="py-3 px-4">Unidade(s)</th>
                  <th className="py-3 px-4">Conta</th>
                  <th className="py-3 px-4">Presença</th>
                  <th className="py-3 px-4">Capacidade SLA</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {users.map((u) => {
                  let unitLabel = '-';
                  if (u.role === 'manager' && u.managed_unit_ids && u.managed_unit_ids.length > 0) {
                    const matched = units.filter((unit) => u.managed_unit_ids?.includes(unit.id));
                    unitLabel = matched.map((m) => m.code).join(', ') || `${u.managed_unit_ids.length} unidades`;
                  } else if (u.unit_id) {
                    const matched = units.find((unit) => unit.id === u.unit_id);
                    unitLabel = matched ? matched.code : 'Atribuída';
                  }

                  const isActive = u.is_active !== false;

                  return (
                    <tr key={u.id} className={`hover:bg-slate-50/60 ${!isActive ? 'bg-slate-50/40 opacity-75' : ''}`}>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {!isActive && (
                            <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded">Inativo</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-normal">{u.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {u.cpf || '-'}
                      </td>
                      <td className="py-3 px-4">{getRoleBadge(u.role)}</td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        <span className="bg-slate-100 border border-slate-200 text-[10px] px-2 py-0.5 rounded-md">
                          {unitLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            Ativo
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[11px] font-semibold ${
                          !isActive ? 'text-slate-400' : u.status === 'online' ? 'text-emerald-600' : u.status === 'busy' ? 'text-amber-600' : 'text-slate-400'
                        }`}>
                          {!isActive ? '⚪ Inativo' : u.status === 'online' ? '🟢 Online' : u.status === 'busy' ? '🟡 Ocupado' : '⚪ Offline'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {u.role === 'attendant' ? (
                          `${u.max_simultaneous_leads} leads`
                        ) : (
                          <span className="text-slate-400 font-normal text-[11px]">N/A (Controle)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => startEditing(u)}
                          title="Editar Integrante"
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-brand-600 font-medium text-xs bg-slate-100 hover:bg-slate-200/80 px-2 py-1 rounded-lg transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          title={isActive ? "Inativar Usuário" : "Ativar Usuário"}
                          className={`inline-flex items-center gap-1 font-medium text-xs px-2 py-1 rounded-lg transition-colors ${
                            isActive
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {isActive ? 'Inativar' : 'Ativar'}
                        </button>
                        {currentUser?.id !== u.id && (
                          <button
                            onClick={() => setUserToDelete(u)}
                            title="Excluir Usuário"
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-medium text-xs bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl max-w-md w-full space-y-4 relative my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900 text-sm">Editar Integrante</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl font-medium">
                {editMessage}
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pedro Henrique"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Corporativo</label>
                <input
                  type="email"
                  required
                  placeholder="pedro@crmleads.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CPF</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={editCpf}
                  onChange={(e) => setEditCpf(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status da Conta</label>
                <select
                  value={editIsActive ? 'active' : 'inactive'}
                  onChange={(e) => setEditIsActive(e.target.value === 'active')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                >
                  <option value="active">🟢 Ativo (Acesso Liberado)</option>
                  <option value="inactive">🔴 Inativo (Acesso Bloqueado e Fora da Distribuição)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nova Senha <span className="font-normal text-slate-400">(opcional, deixe em branco para manter)</span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Perfil / Nível de Acesso</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                >
                  <option value="attendant">🎧 Atendente (Atendimento e Leads próprios)</option>
                  <option value="supervisor">👔 Supervisor (Gestão de Fila e SLA da Unidade)</option>
                  <option value="manager">🏢 Gerente (Controle Regional / Múltiplas Unidades)</option>
                  <option value="admin">👑 Administrador (Acesso Total)</option>
                </select>
              </div>

              {/* Unidades para Gerente (Múltipla Seleção) */}
              {editRole === 'manager' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Unidades Sob Gestão do Gerente</label>
                  <div className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto">
                    {units.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={editSelectedManagedUnits.includes(u.id)}
                          onChange={() => handleEditUnitToggle(u.id)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span>{u.name} ({u.code})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Unidade Única para Supervisor / Atendente */}
              {(editRole === 'supervisor' || editRole === 'attendant') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unidade Atribuída</label>
                  <select
                    value={editUnitId}
                    onChange={(e) => setEditUnitId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Capacidade SLA apenas para Atendentes */}
              {editRole === 'attendant' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Capacidade Máxima Leads Simultâneos</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editMaxLeads}
                    onChange={(e) => setEditMaxLeads(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="w-1/2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl shadow-sm shadow-brand-500/20 transition-all"
                >
                  {editLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete User Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl max-w-md w-full space-y-4 relative">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-2xl border border-red-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Excluir Integrante</h3>
                <p className="text-xs text-slate-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              Tem certeza que deseja excluir permanentemente o integrante <strong className="text-slate-900">{userToDelete.name}</strong> ({userToDelete.email})?
              <br />
              <span className="text-amber-700 font-medium mt-1 block">
                ⚠️ Leads ativos atribuídos a este usuário retornarão para o Balde de Leads da sua unidade.
              </span>
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={deletingLoading}
                className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={deletingLoading}
                className="w-1/2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl shadow-sm shadow-red-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {deletingLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

