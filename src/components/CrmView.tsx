import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ExternalLink,
  KanbanSquare,
  List,
  Search,
} from 'lucide-react';
import { updateLeadStatusAction } from '../lib/crmService';
import { CrmLead, CrmStatus, NavigationTab, PlaceSearchResult } from '../types/lead';
import {
  CRM_STATUS_META,
  CrmStatusIndicator,
  WebsiteClassificationIndicator,
} from './StatusLabels';

interface CrmViewProps {
  userId: string;
  leads: CrmLead[];
  placesCache: Record<string, PlaceSearchResult>;
  onOpenLeadDetail: (lead: CrmLead) => void;
  onNavigate: (tab: NavigationTab) => void;
}

const KANBAN_COLUMNS: CrmStatus[] = ['novo', 'contatado', 'interessado', 'cliente'];

export function CrmView({
  userId,
  leads,
  placesCache,
  onOpenLeadDetail,
  onNavigate,
}: CrmViewProps) {
  const [viewMode, setViewMode] = useState<'kanban' | 'lista'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [movingId, setMovingId] = useState<string | null>(null);

  const filteredLeads = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.crmName.toLowerCase().includes(q) ||
        l.segment.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.notes.toLowerCase().includes(q)
    );
  }, [leads, searchTerm]);

  const handleStageChange = async (lead: CrmLead, nextStatus: CrmStatus) => {
    if (nextStatus === lead.crmStatus) return;
    setMovingId(lead.id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await updateLeadStatusAction(userId, lead, nextStatus, {
        contactDate:
          nextStatus === 'contatado' && !lead.contactDate ? today : lead.contactDate,
      });
    } finally {
      setMovingId(null);
    }
  };

  if (leads.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <KanbanSquare className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 font-display">
          Seu funil CRM ainda não possui leads
        </h3>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Encontre empresas no Buscador de Empresas e salve as melhores oportunidades para gerenciar etapas, datas de contato e propostas.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('buscador')}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-[#0A192F] text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Prospectar no Buscador</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar CRM */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display">
            Pipeline Comercial (CRM)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Clique em qualquer cartão para editar observações, registrar data de contato e acompanhar o histórico comercial.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar no CRM..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KanbanSquare className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                viewMode === 'lista'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Visualização Kanban */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {KANBAN_COLUMNS.map((stage) => {
            const stageLeads = filteredLeads.filter((l) => l.crmStatus === stage);
            const meta = CRM_STATUS_META[stage];
            const stageTicket = stageLeads.reduce(
              (acc, l) => acc + (Number(l.estimatedTicket) || 0),
              0
            );

            return (
              <div
                key={stage}
                className="bg-slate-100/80 border border-slate-200 rounded-xl p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 font-display">
                      {meta.label}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {stageLeads.length}
                    </span>
                  </div>
                  {stageTicket > 0 && (
                    <span className="text-[11px] font-mono tabular-nums text-emerald-700 font-semibold">
                      {stageTicket.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  {stageLeads.length === 0 ? (
                    <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center text-xs text-slate-400">
                      Nenhum lead em {meta.label.toLowerCase()}
                    </div>
                  ) : (
                    stageLeads.map((lead) => {
                      const live = placesCache[lead.placeId];
                      return (
                        <div
                          key={lead.id}
                          className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5 hover:border-slate-300 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => onOpenLeadDetail(lead)}
                            className="w-full text-left cursor-pointer group"
                          >
                            <div className="font-semibold text-sm text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                              {lead.crmName}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 truncate">
                              {[lead.segment, lead.city].filter(Boolean).join(' · ') || 'Sem segmento'}
                            </div>
                          </button>

                          <div className="pt-0.5">
                            <WebsiteClassificationIndicator
                              classification={lead.websiteClassification}
                            />
                          </div>

                          {lead.notes && (
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {lead.notes}
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <Calendar className="w-3 h-3" />
                              {lead.contactDate || 'Sem data'}
                            </span>
                            {live?.phone || lead.customPhone ? (
                              <span className="font-mono tabular-nums text-slate-700 truncate max-w-[115px]">
                                {lead.customPhone || live?.phone}
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <select
                              value={lead.crmStatus}
                              disabled={movingId === lead.id}
                              onChange={(e) =>
                                handleStageChange(lead, e.target.value as CrmStatus)
                              }
                              aria-label={`Mover ${lead.crmName} para etapa`}
                              className="h-7 px-2 text-[11px] font-medium bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                              <option value="novo">Mover: Novo</option>
                              <option value="contatado">Mover: Contatado</option>
                              <option value="interessado">Mover: Interessado</option>
                              <option value="cliente">Mover: Cliente</option>
                              <option value="descartado">Mover: Descartado</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => onOpenLeadDetail(lead)}
                              className="text-xs font-semibold text-[#0A192F] hover:text-blue-600 cursor-pointer"
                            >
                              Abrir
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Visualização em Lista Detalhada */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredLeads.map((lead) => {
              const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(lead.placeId)}`;
              return (
                <div
                  key={lead.id}
                  className="p-4 md:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/70"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenLeadDetail(lead)}
                        className="text-sm font-bold text-slate-900 hover:text-blue-700 text-left cursor-pointer"
                      >
                        {lead.crmName}
                      </button>
                      <CrmStatusIndicator status={lead.crmStatus} />
                      <WebsiteClassificationIndicator
                        classification={lead.websiteClassification}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{lead.segment || 'Sem segmento'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{[lead.neighborhood, lead.city, lead.state].filter(Boolean).join(', ') || 'Sem cidade'}</span>
                      {lead.contactDate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">Contato: {lead.contactDate}</span>
                        </>
                      )}
                    </div>
                    {lead.notes && (
                      <p className="text-xs text-slate-600 line-clamp-1">{lead.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      <span>Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onOpenLeadDetail(lead)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0A192F] hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      Gerenciar Lead
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
