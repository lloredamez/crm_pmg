'use client';

import React, { useState, useEffect } from 'react';
import { Lead, Message } from '@/features/leads/types';
import { fetchMessages, sendMessage, updateLeadStatus } from '@/features/leads/api';
import { formatDate, formatPhone } from '@/lib/utils';
import { X, Send, Phone, Mail, Clock, CheckCircle2, User } from 'lucide-react';

interface LeadModalProps {
  lead: Lead | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const LeadModal: React.FC<LeadModalProps> = ({ lead, onClose, onRefresh }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsgContent, setNewMsgContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (lead) {
      loadMessages();
    }
  }, [lead]);

  const loadMessages = async () => {
    if (!lead) return;
    try {
      const data = await fetchMessages(lead.id);
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !newMsgContent.trim()) return;

    setIsSending(true);
    try {
      await sendMessage(lead.id, newMsgContent, 'outbound');
      setNewMsgContent('');
      await loadMessages();
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;
    try {
      await updateLeadStatus(lead.id, newStatus);
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-100 text-brand-700 font-bold flex items-center justify-center">
              {lead.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{lead.name}</h3>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>{formatPhone(lead.phone)}</span>
                {lead.email && <span>• {lead.email}</span>}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lead Info Pill Bar */}
        <div className="px-5 py-3 bg-indigo-50/50 border-b border-indigo-100/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-4 text-slate-600">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-brand-600" />
              Atribuído: {formatDate(lead.assigned_at)}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-brand-600" />
              Atendente: {lead.current_attendant?.name || 'Não alocado'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStatusChange('converted')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-3 py-1 rounded-full flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3" /> Converter Lead
            </button>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-50/30">
          {messages.length > 0 ? (
            messages.map((msg) => {
              const isOutbound = msg.direction === 'outbound';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                      isOutbound
                        ? 'bg-brand-600 text-white rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <span
                      className={`text-[10px] mt-1 block text-right ${
                        isOutbound ? 'text-indigo-200' : 'text-slate-400'
                      }`}
                    >
                      {formatDate(msg.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Nenhuma mensagem trocada ainda com este lead. Digite abaixo para iniciar interação.
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex items-center gap-3">
          <input
            type="text"
            placeholder="Digite sua mensagem para o WhatsApp do cliente..."
            value={newMsgContent}
            onChange={(e) => setNewMsgContent(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
          <button
            type="submit"
            disabled={isSending || !newMsgContent.trim()}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white p-2.5 rounded-full shadow-sm shadow-brand-500/20 flex items-center justify-center transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
