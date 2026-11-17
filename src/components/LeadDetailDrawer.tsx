import React, { useEffect, useState } from 'react';
import {
  Calendar,
  ExternalLink,
  History,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  addLeadHistoryEntry,
  deleteLeadFromCrm,
  subscribeToLeadHistory,
  updateLeadCommercialRecord,
} from '../lib/crmService';
import { hydratePlacesById } from '../lib/placesApi';
import {
  CrmHistoryEntry,
  CrmLead,
  CrmStatus,
  PlaceSearchResult,
  WebsiteClassification,
} from '../types/lead';
import { CrmStatusIndicator, WebsiteClassificationIndicator } from './StatusLabels';

interface LeadDetailDrawerProps {
  userId: string;
  lead: CrmLead | null;
  livePlace?: PlaceSearchResult;
  onCachePlaces: (places: PlaceSearchResult[]) => void;
  onClose: () => void;
}

export function LeadDetailDrawer({
  userId,
  lead,
  livePlace,
  onCachePlaces,
  onClose,
}: LeadDetailDrawerProps) {
  const [crmName, setCrmName] = useState('');
  const [crmStatus, setCrmStatus] = useState<CrmStatus>('novo');
  const [websiteClassification, setWebsiteClassification] =
    useState<WebsiteClassification>('SEM_SITE_INFORMADO_GOOGLE');
  const [contactDate, setContactDate] = useState('');
  const [contactChannel, setContactChannel] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [estimatedTicket, setEstimatedTicket] = useState('0');
  const [segment, setSegment] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [notes, setNotes] = useState('');

  const [history, setHistory] = useState<CrmHistoryEntry[]>([]);
  const [newLogNote, setNewLogNote] = useState('');
  const [newLogDate, setNewLogDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingLog, setAddingLog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [hydratingSingle, setHydratingSingle] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setCrmName(lead.crmName);
    setCrmStatus(lead.crmStatus);
    setWebsiteClassification(lead.websiteClassification);
    setContactDate(lead.contactDate || '');
    setContactChannel(lead.contactChannel || '');
    setCustomPhone(lead.customPhone || '');
    setEstimatedTicket(String(lead.estimatedTicket || 0));
    setSegment(lead.segment || '');
    setCity(lead.city || '');
    setState(lead.state || '');
    setNeighborhood(lead.neighborhood || '');
    setNotes(lead.notes || '');
    setNewLogDate(new Date().toISOString().slice(0, 10));
    setConfirmDelete(false);
    setSaveSuccess(null);

    const unsub = subscribeToLeadHistory(userId, lead.id, setHistory);

    if (!livePlace && lead.placeId) {
      setHydratingSingle(true);
      hydratePlacesById([lead.placeId])
        .then((res) => {
          const items = Object.values(res.items);
          if (items.length > 0) onCachePlaces(items);
        })
        .catch(() => {
          // falha silenciosa na hidratação opcional
        })
        .finally(() => setHydratingSingle(false));
    }

    return () => unsub();
  }, [lead?.id, userId]);

  if (!lead) return null;

  const mapsUrl =
    livePlace?.googleMapsUri ||
    `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(lead.placeId)}`;

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    try {
      const statusChanged = crmStatus !== lead.crmStatus;
      await updateLeadCommercialRecord(
        userId,
        lead,
        {
          crmName,
          crmStatus,
          websiteClassification,
          contactDate,
          contactChannel,
          customPhone,
          estimatedTicket: Number(estimatedTicket) || 0,
          segment,
          city,
          state,
          neighborhood,
          notes,
        },
        {
          actionType: statusChanged ? 'status_alterado' : 'dados_atualizados',
          note: statusChanged
            ? `Status atualizado para "${crmStatus}"${contactDate ? ` (contato em ${contactDate})` : ''}.`
            : 'Ficha comercial e observações atualizadas.',
        }
      );
      setSaveSuccess('Alterações salvas no CRM.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogNote.trim()) return;
    setAddingLog(true);
    try {
      await addLeadHistoryEntry(userId, lead, {
        actionType: 'contato_registrado',
        note: newLogNote.trim(),
        contactDate: newLogDate || undefined,
      });
      if (newLogDate) setContactDate(newLogDate);
      setNewLogNote('');
    } finally {
      setAddingLog(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteLeadFromCrm(userId, lead.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const formatTimestamp = (ts: unknown): string => {
    if (
      ts &&
      typeof ts === 'object' &&
      'toDate' in ts &&
      typeof (ts as { toDate: () => Date }).toDate === 'function'
    ) {
      return (ts as { toDate: () => Date }).toDate().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    }
    return 'Agora';
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-slate-950/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0A192F] text-white flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <CrmStatusIndicator status={crmStatus} />
              <WebsiteClassificationIndicator classification={websiteClassification} />
            </div>
            <h2 className="text-lg font-bold truncate font-display">{lead.crmName}</h2>
            <p className="text-xs font-mono text-slate-300 mt-0.5 truncate">
              Place ID: {lead.placeId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            aria-label="Fechar detalhes do lead"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Dados ao vivo do Google Maps */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700">
                Dados ao vivo do perfil Google Maps
              </span>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0A192F] hover:text-blue-600 underline"
              >
                <span>Abrir no Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {hydratingSingle ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Consultando detalhes atualizados via Place ID...</span>
              </div>
            ) : livePlace ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{livePlace.address || 'Endereço não informado'}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono tabular-nums">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{livePlace.phone || 'Telefone não informado no Google'}</span>
                </div>
                {livePlace.websiteUri && (
                  <div className="sm:col-span-2 truncate">
                    <span className="text-slate-500 mr-1.5">Website informado:</span>
                    <a
                      href={livePlace.websiteUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline"
                    >
                      {livePlace.websiteUri}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {lead.city || lead.neighborhood
                  ? `Localização cadastrada: ${[lead.neighborhood, lead.city, lead.state].filter(Boolean).join(', ')}`
                  : 'Clique no link ao lado para visualizar o perfil oficial no Google Maps.'}
              </p>
            )}
          </div>

          {/* Formulário CRM */}
          <form onSubmit={handleSaveRecord} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 font-display">
              Ficha comercial do CRM
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome de referência no CRM
                </label>
                <input
                  type="text"
                  value={crmName}
                  onChange={(e) => setCrmName(e.target.value)}
                  required
                  maxLength={180}
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Etapa comercial
                </label>
                <select
                  value={crmStatus}
                  onChange={(e) => setCrmStatus(e.target.value as CrmStatus)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="novo">Novo</option>
                  <option value="contatado">Contatado</option>
                  <option value="interessado">Interessado</option>
                  <option value="cliente">Cliente</option>
                  <option value="descartado">Descartado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Classificação do site
                </label>
                <select
                  value={websiteClassification}
                  onChange={(e) =>
                    setWebsiteClassification(e.target.value as WebsiteClassification)
                  }
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SEM_SITE_INFORMADO_GOOGLE">SEM SITE INFORMADO NO GOOGLE</option>
                  <option value="VERIFICADO_SEM_SITE">Verificado sem site próprio</option>
                  <option value="SITE_INFORMADO_GOOGLE">Site informado no Google</option>
                  <option value="VERIFICADO_COM_SITE">Verificado com site ativo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Data do contato
                </label>
                <input
                  type="date"
                  value={contactDate}
                  onChange={(e) => setContactDate(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Canal de abordagem
                </label>
                <select
                  value={contactChannel}
                  onChange={(e) => setContactChannel(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecionar canal...</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Telefone">Telefone</option>
                  <option value="E-mail">E-mail</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Presencial">Visita Presencial</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telefone anotado no CRM
                </label>
                <input
                  type="text"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder="Ex.: (11) 99999-0000"
                  maxLength={40}
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ticket estimado do projeto (R$)
                </label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={estimatedTicket}
                  onChange={(e) => setEstimatedTicket(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Segmento
                </label>
                <input
                  type="text"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  maxLength={100}
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cidade / UF
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Cidade"
                    maxLength={100}
                    className="col-span-2 h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="UF"
                    maxLength={50}
                    className="col-span-1 h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações comerciais
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={3000}
                  placeholder="Anote detalhes do atendimento, decisor, necessidade de site institucional ou landing page..."
                  className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {saveSuccess && (
              <div className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {saveSuccess}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover do CRM</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                  >
                    {deleting ? 'Removendo...' : 'Confirmar exclusão'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A192F] hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Salvar alterações</span>
              </button>
            </div>
          </form>

          {/* Registro de nova interação no Histórico Comercial */}
          <div className="border-t border-slate-200 pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900 font-display">
                Histórico comercial
              </h3>
            </div>

            <form
              onSubmit={handleAddHistory}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={newLogNote}
                    onChange={(e) => setNewLogNote(e.target.value)}
                    placeholder="Registrar novo contato, proposta enviada ou retorno..."
                    maxLength={1000}
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newLogDate}
                    onChange={(e) => setNewLogDate(e.target.value)}
                    className="w-full h-9 px-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addingLog || !newLogNote.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {addingLog ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Registrar no histórico</span>
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhuma movimentação registrada ainda para este lead.
                </p>
              ) : (
                history.map((entry) => (
                  <div
                    key={entry.id}
                    className="border border-slate-200 rounded-lg p-3.5 bg-white text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {entry.actionType === 'lead_criado'
                          ? 'Lead cadastrado'
                          : entry.actionType === 'status_alterado'
                            ? 'Etapa alterada'
                            : entry.actionType === 'contato_registrado'
                              ? 'Contato registrado'
                              : entry.actionType === 'observacao_adicionada'
                                ? 'Observação adicionada'
                                : 'Ficha atualizada'}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatTimestamp(entry.createdAt)}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{entry.note}</p>
                    {entry.contactDate && (
                      <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 pt-0.5 font-mono tabular-nums">
                        <Calendar className="w-3 h-3" />
                        <span>Data do contato: {entry.contactDate}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
