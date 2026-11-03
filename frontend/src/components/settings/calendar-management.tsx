'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
  Power,
  RefreshCw,
  Search,
  Sparkles,
  SunMedium,
  Moon,
  CalendarDays,
  ShieldCheck
} from 'lucide-react';
import {
  CalendarConfig,
  Holiday,
  CalendarStatus,
} from '@/features/calendar/types';
import {
  fetchCalendarConfig,
  updateCalendarConfig,
  fetchCalendarStatus,
  fetchHolidays,
  createHoliday,
  toggleHolidayStatus,
  deleteHoliday,
} from '@/features/calendar/api';

export const CalendarManagement: React.FC = () => {
  const [config, setConfig] = useState<CalendarConfig | null>(null);
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form states for configuration
  const [pauseWeekends, setPauseWeekends] = useState<boolean>(true);
  const [pauseHolidays, setPauseHolidays] = useState<boolean>(true);
  const [pauseNight, setPauseNight] = useState<boolean>(true);
  const [startHour, setStartHour] = useState<number>(7);
  const [endHour, setEndHour] = useState<number>(19);

  // Modal state for new holiday
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newDate, setNewDate] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newType, setNewType] = useState<string>('national');
  const [newRecurring, setNewRecurring] = useState<boolean>(false);
  const [creatingHoliday, setCreatingHoliday] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cfgData, statusData, holidaysData] = await Promise.all([
        fetchCalendarConfig(),
        fetchCalendarStatus(),
        fetchHolidays(),
      ]);
      setConfig(cfgData);
      setStatus(statusData);
      setHolidays(holidaysData);

      setPauseWeekends(cfgData.pause_on_weekends);
      setPauseHolidays(cfgData.pause_on_holidays);
      setPauseNight(cfgData.pause_night_shift);
      setStartHour(cfgData.work_start_hour);
      setEndHour(cfgData.work_end_hour);
    } catch (err: any) {
      console.error('Erro ao carregar configurações de calendário:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      const updated = await updateCalendarConfig({
        pause_on_weekends: pauseWeekends,
        pause_on_holidays: pauseHolidays,
        pause_night_shift: pauseNight,
        work_start_hour: Number(startHour),
        work_end_hour: Number(endHour),
      });
      setConfig(updated);
      const updatedStatus = await fetchCalendarStatus();
      setStatus(updatedStatus);
      setStatusMessage('Configurações de calendário atualizadas com sucesso!');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(`Falha ao salvar configurações: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newName.trim()) return;

    try {
      setCreatingHoliday(true);
      const created = await createHoliday({
        date: newDate,
        name: newName.trim(),
        holiday_type: newType,
        is_recurring: newRecurring,
        is_active: true,
      });
      setHolidays((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
      setIsModalOpen(false);
      setNewDate('');
      setNewName('');
      setNewType('national');
      setNewRecurring(false);
      const updatedStatus = await fetchCalendarStatus();
      setStatus(updatedStatus);
    } catch (err: any) {
      alert(`Erro ao cadastrar feriado: ${err.message}`);
    } finally {
      setCreatingHoliday(false);
    }
  };

  const handleToggleHoliday = async (id: string) => {
    try {
      const updated = await toggleHolidayStatus(id);
      setHolidays((prev) => prev.map((h) => (h.id === id ? updated : h)));
      const updatedStatus = await fetchCalendarStatus();
      setStatus(updatedStatus);
    } catch (err: any) {
      alert(`Erro ao alterar status do feriado: ${err.message}`);
    }
  };

  const handleDeleteHoliday = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente remover o feriado "${name}"?`)) return;
    try {
      await deleteHoliday(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      const updatedStatus = await fetchCalendarStatus();
      setStatus(updatedStatus);
    } catch (err: any) {
      alert(`Erro ao remover feriado: ${err.message}`);
    }
  };

  const filteredHolidays = holidays.filter((h) => {
    const term = search.toLowerCase();
    return h.name.toLowerCase().includes(term) || h.date.includes(term);
  });

  const formatDateDisplay = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 min-h-[300px]">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">Carregando calendário e expediente...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Live Status Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <CalendarDays className="w-5 h-5" />
            </span>
            <h2 className="text-base font-bold text-slate-900">Calendário de Operação & Feriados</h2>
          </div>
          <p className="text-xs text-slate-500">
            Defina as regras automáticas de pausa do robô de SLA para fins de semana, feriados e expediente de trabalho.
          </p>
        </div>

        {/* Live Status Pill */}
        {status && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
            status.is_paused 
              ? 'bg-amber-50/70 border-amber-200/80 text-amber-900' 
              : 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
          }`}>
            <div className={`p-2 rounded-xl ${status.is_paused ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {status.is_paused ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {status.is_paused ? 'Worker Pausado' : 'Worker Ativo'}
                </span>
                {status.is_paused && status.reason && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-900">
                    {status.reason}
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-75 mt-0.5">
                Horário local: {status.current_time} (Brasília)
              </p>
            </div>
          </div>
        )}
      </div>

      {statusMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {statusMessage}
        </div>
      )}

      {/* Grid: Regras do Worker & Cadastro de Feriados */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card de Configurações das Pausas */}
        <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <Clock className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Regras de Pausa Automática
            </h3>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-5">
            {/* Toggle Finais de Semana */}
            <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="space-y-0.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                  <span>Pausar aos Finais de Semana</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Desativa o robô de SLA aos sábados e domingos inteiros.
                </p>
              </div>
              <input
                type="checkbox"
                checked={pauseWeekends}
                onChange={(e) => setPauseWeekends(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded-md border-slate-300 focus:ring-brand-500 mt-1 cursor-pointer"
              />
            </div>

            {/* Toggle Feriados */}
            <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="space-y-0.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                  <span>Pausar em Feriados</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Desativa o robô em todas as datas de feriados ativos cadastrados.
                </p>
              </div>
              <input
                type="checkbox"
                checked={pauseHolidays}
                onChange={(e) => setPauseHolidays(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded-md border-slate-300 focus:ring-brand-500 mt-1 cursor-pointer"
              />
            </div>

            {/* Toggle Noite */}
            <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="space-y-0.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                  <span>Pausar no Horário Noturno</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Congela contagens e estouros fora do expediente de atendimento.
                </p>
              </div>
              <input
                type="checkbox"
                checked={pauseNight}
                onChange={(e) => setPauseNight(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded-md border-slate-300 focus:ring-brand-500 mt-1 cursor-pointer"
              />
            </div>

            {/* Horário de Expediente */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-800 block">
                Janela de Expediente Diário
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-medium text-slate-500 block mb-1 flex items-center gap-1">
                    <SunMedium className="w-3.5 h-3.5 text-amber-500" /> Início:
                  </span>
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(Number(e.target.value))}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-slate-500 block mb-1 flex items-center gap-1">
                    <Moon className="w-3.5 h-3.5 text-indigo-500" /> Fim:
                  </span>
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(Number(e.target.value))}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {savingConfig ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
              {savingConfig ? 'Salvando...' : 'Salvar Regras de Expediente'}
            </button>
          </form>
        </div>

        {/* Card de Feriados Cadastrados */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Feriados Cadastrados ({holidays.length})
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Dias em que o sistema congelará o timer e não moverá leads para o balde.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar feriado..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Feriado</span>
              </button>
            </div>
          </div>

          {/* Lista/Tabela de Feriados */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Feriado</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3 text-center">Recorrência</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filteredHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      Nenhum feriado encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredHolidays.map((holiday) => (
                    <tr key={holiday.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {formatDateDisplay(holiday.date)}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900">
                        {holiday.name}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-100 text-slate-600">
                          {holiday.holiday_type === 'national' ? 'Nacional' : holiday.holiday_type === 'regional' ? 'Regional' : 'Custom'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {holiday.is_recurring ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 inline-flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Anual
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Data única</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleHoliday(holiday.id)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full cursor-pointer transition-all ${
                            holiday.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}
                        >
                          {holiday.is_active ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleDeleteHoliday(holiday.id, holiday.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remover feriado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Adicionar Novo Feriado */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-brand-600" />
                Cadastrar Novo Feriado
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateHoliday} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Data do Feriado
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nome do Feriado
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aniversário da Cidade, Carnaval..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Tipo de Feriado
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="national">Nacional</option>
                    <option value="regional">Estadual / Regional</option>
                    <option value="custom">Municipal / Customizado</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRecurring}
                      onChange={(e) => setNewRecurring(e.target.checked)}
                      className="w-4 h-4 text-brand-600 rounded-md border-slate-300 focus:ring-brand-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-slate-700">
                      Repete todo ano
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingHoliday || !newDate || !newName.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {creatingHoliday ? 'Cadastrando...' : 'Cadastrar Feriado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

