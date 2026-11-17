import React from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Globe,
  GlobeLock,
  PhoneCall,
  Search,
  Users,
} from 'lucide-react';
import { CrmLead, NavigationTab, SearchLog } from '../types/lead';
import { CRM_STATUS_META } from './StatusLabels';
import { ViraAppLogo } from './ViraAppLogo';

interface DashboardViewProps {
  leads: CrmLead[];
  searchLogs: SearchLog[];
  sessionStats: {
    totalSearched: number;
    withoutWebsite: number;
    withWebsite: number;
  };
  onNavigate: (tab: NavigationTab) => void;
}

export function DashboardView({
  leads,
  searchLogs,
  sessionStats,
  onNavigate,
}: DashboardViewProps) {
  // Consolida métricas reais: histórico de buscas persistido + buscas da sessão atual
  const totalResearchedHistory = searchLogs.reduce((acc, s) => acc + (s.totalFound || 0), 0);
  const withoutWebsiteHistory = searchLogs.reduce((acc, s) => acc + (s.withoutWebsiteCount || 0), 0);
  const withWebsiteHistory = searchLogs.reduce((acc, s) => acc + (s.withWebsiteCount || 0), 0);

  const totalEmpresasPesquisadas =
    totalResearchedHistory > 0 ? totalResearchedHistory : sessionStats.totalSearched;
  const empresasSemSite =
    totalResearchedHistory > 0 ? withoutWebsiteHistory : sessionStats.withoutWebsite;
  const empresasComSite =
    totalResearchedHistory > 0 ? withWebsiteHistory : sessionStats.withWebsite;

  const totalLeadsCrm = leads.length;
  const leadsContatados = leads.filter((l) =>
    ['contatado', 'interessado', 'cliente'].includes(l.crmStatus)
  ).length;
  const oportunidadesConvertidas = leads.filter((l) => l.crmStatus === 'cliente').length;

  const pipelineCounts = {
    novo: leads.filter((l) => l.crmStatus === 'novo').length,
    contatado: leads.filter((l) => l.crmStatus === 'contatado').length,
    interessado: leads.filter((l) => l.crmStatus === 'interessado').length,
    cliente: leads.filter((l) => l.crmStatus === 'cliente').length,
    descartado: leads.filter((l) => l.crmStatus === 'descartado').length,
  };

  const potentialRevenue = leads
    .filter((l) => l.crmStatus !== 'descartado')
    .reduce((acc, l) => acc + (Number(l.estimatedTicket) || 0), 0);

  const kpis = [
    {
      label: 'Total de empresas pesquisadas',
      value: totalEmpresasPesquisadas,
      icon: Building2,
      detail: `${searchLogs.length} buscas registradas`,
      accent: 'text-slate-900',
    },
    {
      label: 'Empresas sem site informado',
      value: empresasSemSite,
      icon: GlobeLock,
      detail:
        totalEmpresasPesquisadas > 0
          ? `${Math.round((empresasSemSite / totalEmpresasPesquisadas) * 100)}% do total pesquisado`
          : 'Aguardando primeira pesquisa',
      accent: 'text-emerald-700',
    },
    {
      label: 'Empresas com site informado',
      value: empresasComSite,
      icon: Globe,
      detail: 'Com websiteUri no perfil Google',
      accent: 'text-slate-900',
    },
    {
      label: 'Total de leads encontrados',
      value: totalLeadsCrm,
      icon: Users,
      detail: 'Leads salvos no seu CRM',
      accent: 'text-slate-900',
    },
    {
      label: 'Leads contatados',
      value: leadsContatados,
      icon: PhoneCall,
      detail:
        totalLeadsCrm > 0
          ? `${Math.round((leadsContatados / totalLeadsCrm) * 100)}% da carteira abordada`
          : 'Nenhum contato registrado',
      accent: 'text-blue-800',
    },
    {
      label: 'Oportunidades convertidas',
      value: oportunidadesConvertidas,
      icon: CheckCircle2,
      detail:
        potentialRevenue > 0
          ? `Pipeline ativo: ${potentialRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
          : 'Contratos fechados no CRM',
      accent: 'text-emerald-700',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Cabeçalho de boas-vindas e CTA */}
      <div className="bg-gradient-to-r from-[#0A192F] via-[#0F2444] to-[#143361] text-white rounded-xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border border-blue-900/30">
        <div className="max-w-2xl space-y-3">
          <ViraAppLogo variant="dark" size="md" showSubtitle />
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-1.5 font-display">
              Visão geral da prospecção comercial
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Acompanhe em tempo real o volume de empresas analisadas no Google Maps, identifique perfis sem site informado e gerencie a evolução das negociações no CRM.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('buscador')}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
        >
          <Search className="w-4 h-4" />
          <span>Nova pesquisa de empresas</span>
        </button>
      </div>

      {/* Grid de 6 KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <span className="text-sm font-medium text-slate-600 leading-snug">
                  {kpi.label}
                </span>
                <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className={`text-3xl font-bold tracking-tight tabular-nums font-display ${kpi.accent}`}>
                  {kpi.value.toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">{kpi.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline CRM + Histórico de Buscas */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Funil do CRM */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-display">
                Distribuição do funil CRM
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Progresso comercial dos leads salvos
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('crm')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0A192F] hover:text-blue-600 whitespace-nowrap cursor-pointer"
            >
              <span>Abrir CRM</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {(['novo', 'contatado', 'interessado', 'cliente', 'descartado'] as const).map(
              (status) => {
                const count = pipelineCounts[status];
                const pct = totalLeadsCrm > 0 ? Math.round((count / totalLeadsCrm) * 100) : 0;
                const meta = CRM_STATUS_META[status];
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-700">{meta.label}</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          status === 'cliente'
                            ? 'bg-emerald-600'
                            : status === 'interessado'
                              ? 'bg-amber-500'
                              : status === 'contatado'
                                ? 'bg-blue-600'
                                : status === 'novo'
                                  ? 'bg-[#0A192F]'
                                  : 'bg-slate-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Últimas pesquisas realizadas */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-display">
                Pesquisas recentes realizadas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Métricas agregadas das buscas no Google Places API (New)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('buscador')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0A192F] hover:text-blue-600 whitespace-nowrap cursor-pointer"
            >
              <span>Pesquisar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {searchLogs.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
              <Search className="w-7 h-7 text-slate-400 mx-auto mb-2.5" />
              <p className="text-sm font-medium text-slate-700">
                Nenhuma pesquisa registrada ainda
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Utilize o Buscador de Empresas para consultar negócios reais por cidade e segmento.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('buscador')}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#0A192F] text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Ir para o Buscador
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-2.5 pr-4">Segmento / Região</th>
                    <th className="py-2.5 px-3 text-right">Analisadas</th>
                    <th className="py-2.5 px-3 text-right">Sem site</th>
                    <th className="py-2.5 pl-3 text-right">Com telefone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {searchLogs.slice(0, 6).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-900 truncate max-w-xs">
                          {log.segment || log.queryText}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">
                          {[log.neighborhood, log.city, log.state].filter(Boolean).join(' · ') || log.country}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                        {log.totalFound}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        {log.withoutWebsiteCount}
                      </td>
                      <td className="py-3 pl-3 text-right font-mono tabular-nums text-slate-600">
                        {log.withPhoneCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
