import * as XLSX from 'xlsx';
import { CrmLead, CrmStatus, WebsiteClassification } from '../types/lead';

const STATUS_LABELS: Record<CrmStatus, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  interessado: 'Interessado',
  cliente: 'Cliente',
  descartado: 'Descartado',
};

const SITE_CLASSIFICATION_LABELS: Record<WebsiteClassification, string> = {
  SEM_SITE_INFORMADO_GOOGLE: 'SEM SITE INFORMADO NO GOOGLE',
  SITE_INFORMADO_GOOGLE: 'Site informado no Google',
  VERIFICADO_SEM_SITE: 'Verificado sem site próprio',
  VERIFICADO_COM_SITE: 'Verificado com site ativo',
};

interface ExportableCrmRow {
  'Place ID (Google)': string;
  'Nome de Referência (CRM)': string;
  Segmento: string;
  Cidade: string;
  Estado: string;
  Bairro: string;
  'Classificação de Site': string;
  'Status Comercial': string;
  'Data do Contato': string;
  'Canal de Contato': string;
  'Telefone Anotado no CRM': string;
  'Ticket Estimado (R$)': number;
  'Observações Comerciais': string;
  'Link Direto Google Maps': string;
}

/**
 * Em conformidade com os Termos de Serviço do Google Maps Platform,
 * exportamos apenas o Place ID (identificador permitido), o link oficial
 * construído a partir do place_id e os registros próprios inseridos no CRM.
 */
function buildExportRows(leads: CrmLead[]): ExportableCrmRow[] {
  return leads.map((lead) => ({
    'Place ID (Google)': lead.placeId,
    'Nome de Referência (CRM)': lead.crmName,
    Segmento: lead.segment || '',
    Cidade: lead.city || '',
    Estado: lead.state || '',
    Bairro: lead.neighborhood || '',
    'Classificação de Site':
      SITE_CLASSIFICATION_LABELS[lead.websiteClassification] || lead.websiteClassification,
    'Status Comercial': STATUS_LABELS[lead.crmStatus] || lead.crmStatus,
    'Data do Contato': lead.contactDate || '',
    'Canal de Contato': lead.contactChannel || '',
    'Telefone Anotado no CRM': lead.customPhone || '',
    'Ticket Estimado (R$)': Number(lead.estimatedTicket || 0),
    'Observações Comerciais': lead.notes || '',
    'Link Direto Google Maps': `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(lead.placeId)}`,
  }));
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[;"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportLeadsToCsv(leads: CrmLead[], filenamePrefix = 'leads-crm-brasil'): void {
  const rows = buildExportRows(leads);
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]) as Array<keyof ExportableCrmRow>;
  const lines = [
    headers.map((h) => escapeCsvCell(h)).join(';'),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(';')),
  ];

  // BOM UTF-8 para abertura correta de acentos no Excel em pt-BR
  const csvContent = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateTag = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${dateTag}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportLeadsToExcel(leads: CrmLead[], filenamePrefix = 'leads-crm-brasil'): void {
  const rows = buildExportRows(leads);
  if (rows.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 28 }, // Place ID
    { wch: 32 }, // Nome CRM
    { wch: 24 }, // Segmento
    { wch: 18 }, // Cidade
    { wch: 10 }, // Estado
    { wch: 18 }, // Bairro
    { wch: 28 }, // Classificação
    { wch: 16 }, // Status
    { wch: 14 }, // Data
    { wch: 16 }, // Canal
    { wch: 18 }, // Telefone CRM
    { wch: 18 }, // Ticket
    { wch: 42 }, // Observações
    { wch: 48 }, // Link Maps
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CRM Leads');

  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}-${dateTag}.xlsx`);
}
