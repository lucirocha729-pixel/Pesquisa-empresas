import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Info,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { updateLeadStatusAction } from '../lib/crmService';
import { exportLeadsToCsv, exportLeadsToExcel } from '../lib/exportUtils';
import { hydratePlacesById } from '../lib/placesApi';
import { CrmLead, CrmStatus, NavigationTab, PlaceSearchResult } from '../types/lead';
import { WebsiteClassificationIndicator } from './StatusLabels';

interface LeadsTableViewProps {
  userId: string;
  leads: CrmLead[];
  placesCache: Record<string, PlaceSearchResult>;
  onCachePlaces: (places: PlaceSearchResult[]) => void;
  onOpenLeadDetail: (lead: CrmLead) => void;
  onNavigate: (tab: NavigationTab) => void;
}

const PAGE_SIZE = 15;

export function LeadsTableView({
  userId,
  leads,
  placesCache,
  onCachePlaces,
  onOpenLeadDetail,
  onNavigate,
}: LeadsTableViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | CrmStatus>('todos');
  const [siteFilter, setSiteFilter] = useState<'todos' | 'sem_site' | 'com_site'>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const [hydrateNote, setHydrateNote] = useState<string | null>(null);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== 'todos' && lead.crmStatus !== statusFilter) return false;
      const isWithoutSite =
        lead.websiteClassification === 'SEM_SITE_INFORMADO_GOOGLE' ||
        lead.websiteClassification === 'VERIFICADO_SEM_SITE';
      if (siteFilter === 'sem_site' && !isWithoutSite) return false;
      if (siteFilter === 'com_site' && isWithoutSite) return false;

      if (!q) return true;
      return (
        lead.crmName.toLowerCase().includes(q) ||
        lead.segment.toLowerCase().includes(q) ||
        lead.city.toLowerCase().includes(q) ||
        lead.neighborhood.toLowerCase().includes(q) ||
        lead.placeId.toLowerCase().includes(q)
      );
    });
  }, [leads, searchQuery, statusFilter, siteFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLeads = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, safePage]);

  const handleQuickStatusChange = async (lead: CrmLead, nextStatus: CrmStatus) => {
    if (nextStatus === lead.crmStatus) return;
    setUpdatingId(lead.id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await updateLeadStatusAction(userId, lead, nextStatus, {
        contactDate:
          nextStatus === 'contatado' && !lead.contactDate ? today : lead.contactDate,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleHydrateVisiblePage = async () => {
    const missingIds = paginatedLeads
      .map((l) => l.placeId)
      .filter((id) => !placesCache[id]);

    const targetIds =
      missingIds.length > 0 ? missingIds : paginatedLeads.map((l) => l.placeId);

    if (targetIds.length === 0) return;

    setHydrating(true);
    setHydrateNote(null);
    try {
      const res = await hydratePlacesById(targetIds);
      const list = Object.values(res.items);
      if (list.length > 0) {
        onCachePlaces(list);
        setHydrateNote(`${list.length} registros atualizados em tempo real via Google Places.`);
      } else {
        setHydrateNote('Nenhum detalhe adicional retornado no momento.');
      }
    } catch (err) {
      setHydrateNote(
        err instanceof Error ? err.message : 'Erro ao consultar detalhes no Google Places.'
      );
    } finally {
      setHydrating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Barra de ações e exportação */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-display">
              Lista de leads salvos
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Base própria no Firestore vinculada por <code className="font-mono">placeId</code>, com atualização sob demanda via Google Places.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleHydrateVisiblePage}
              disabled={hydrating || paginatedLeads.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              {hydrating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Sincronizar página com Google</span>
            </button>

            <button
              type="button"
              onClick={() => exportLeadsToCsv(filteredLeads)}
              disabled={filteredLeads.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={() => exportLeadsToExcel(filteredLeads)}
              disabled={filteredLeads.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filtrar por nome, segmento, cidade ou Place ID..."
              className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'todos' | CrmStatus);
                setCurrentPage(1);
              }}
              aria-label="Filtrar por status comercial"
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos os status comerciais</option>
              <option value="novo">Novo</option>
              <option value="contatado">Contatado</option>
              <option value="interessado">Interessado</option>
              <option value="cliente">Cliente</option>
              <option value="descartado">Descartado</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={siteFilter}
              onChange={(e) => {
                setSiteFilter(e.target.value as 'todos' | 'sem_site' | 'com_site');
                setCurrentPage(1);
              }}
              aria-label="Filtrar por status do site"
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos os status de site</option>
              <option value="sem_site">Sem site informado / verificado</option>
              <option value="com_site">Com site informado</option>
            </select>
          </div>
        </div>

        {hydrateNote && (
          <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {hydrateNote}
          </div>
        )}
      </div>

      {/* Aviso de conformidade da exportação */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 flex items-start gap-2.5 text-xs text-slate-600">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p>
          Conformidade de exportação: os arquivos CSV e Excel incluem exclusivamente os dados próprios do seu CRM (nome de referência, segmento, etapa, observações, data de contato, telefone anotado) e o <code className="font-mono">placeId</code> + link oficial do Maps, respeitando os Termos de Uso do Google Maps Platform.
        </p>
      </div>

      {/* Tabela de Leads */}
      {leads.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <SlidersHorizontal className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 font-display">
            Sua lista de leads está vazia
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Pesquise empresas no Buscador e salve os potenciais clientes para acompanhar telefone, website e etapa comercial aqui.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('buscador')}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-[#0A192F] text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Ir para o Buscador de Empresas</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Nome da empresa</th>
                  <th className="py-3 px-4">Segmento</th>
                  <th className="py-3 px-4">Cidade</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Website</th>
                  <th className="py-3 px-4">Status do site</th>
                  <th className="py-3 px-4">Link do Maps</th>
                  <th className="py-3 px-4">Status comercial</th>
                  <th className="py-3 px-4 text-right">CRM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedLeads.map((lead) => {
                  const live = placesCache[lead.placeId];
                  const displayPhone = lead.customPhone || live?.phone || '';
                  const liveWebsite = live?.websiteUri || '';
                  const mapsUrl =
                    live?.googleMapsUri ||
                    `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(lead.placeId)}`;

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900 max-w-[220px]">
                        <div className="truncate" title={lead.crmName}>
                          {lead.crmName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-[160px] truncate">
                        {lead.segment || live?.category || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {[lead.city, lead.state].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {displayPhone ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-slate-800">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {displayPhone}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {live ? 'Não informado' : 'Sincronize p/ ver'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[180px]">
                        {liveWebsite ? (
                          <a
                            href={liveWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline max-w-[170px] truncate"
                          >
                            <span className="truncate">{liveWebsite}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <WebsiteClassificationIndicator
                          classification={lead.websiteClassification}
                        />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#0A192F] hover:text-blue-600 underline"
                        >
                          <span>Abrir Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          value={lead.crmStatus}
                          disabled={updatingId === lead.id}
                          onChange={(e) =>
                            handleQuickStatusChange(lead, e.target.value as CrmStatus)
                          }
                          aria-label={`Alterar status de ${lead.crmName}`}
                          className="h-8 px-2 text-xs font-medium bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="novo">Novo</option>
                          <option value="contatado">Contatado</option>
                          <option value="interessado">Interessado</option>
                          <option value="cliente">Cliente</option>
                          <option value="descartado">Descartado</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenLeadDetail(lead)}
                          className="px-3 py-1.5 text-xs font-semibold text-[#0A192F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <span className="font-mono tabular-nums">
              {filteredLeads.length} leads · Página {safePage} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                <span>Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
