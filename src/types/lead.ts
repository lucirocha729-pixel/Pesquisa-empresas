export type NavigationTab =
  | 'dashboard'
  | 'buscador'
  | 'leads'
  | 'crm'
  | 'configuracoes';

export type WebsiteClassification =
  | 'SEM_SITE_INFORMADO_GOOGLE'
  | 'SITE_INFORMADO_GOOGLE'
  | 'VERIFICADO_SEM_SITE'
  | 'VERIFICADO_COM_SITE';

export type CrmStatus =
  | 'novo'
  | 'contatado'
  | 'interessado'
  | 'cliente'
  | 'descartado';

export type CrmActionType =
  | 'lead_criado'
  | 'status_alterado'
  | 'contato_registrado'
  | 'observacao_adicionada'
  | 'dados_atualizados';

export interface SearchFilters {
  country: string;
  regionCode: string;
  state: string;
  city: string;
  neighborhood: string;
  segment: string;
  requestedCount: 10 | 20 | 40 | 60;
  onlyWithoutWebsite: boolean;
  onlyWithPhone: boolean;
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  websiteUri: string;
  hasWebsiteUri: boolean;
  websiteClassification: 'SEM_SITE_INFORMADO_GOOGLE' | 'SITE_INFORMADO_GOOGLE';
  googleMapsUri: string;
  rating: number | null;
  userRatingCount: number;
  businessStatus: string;
}

export interface SearchPageResponse {
  queryText: string;
  places: PlaceSearchResult[];
  nextPageToken: string | null;
  stats: {
    totalReturned: number;
    withoutWebsiteCount: number;
    withWebsiteCount: number;
    withPhoneCount: number;
  };
  rateLimitRemaining?: number;
}

export interface CrmLead {
  id: string;
  ownerId: string;
  placeId: string;
  crmName: string;
  segment: string;
  city: string;
  state: string;
  neighborhood: string;
  websiteClassification: WebsiteClassification;
  crmStatus: CrmStatus;
  notes: string;
  contactDate: string;
  contactChannel: string;
  customPhone: string;
  estimatedTicket: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CrmHistoryEntry {
  id: string;
  ownerId: string;
  leadId: string;
  actionType: CrmActionType;
  fromStatus: string;
  toStatus: string;
  note: string;
  contactDate: string;
  createdAt?: unknown;
}

export interface SearchLog {
  id: string;
  ownerId: string;
  queryText: string;
  country: string;
  state: string;
  city: string;
  neighborhood: string;
  segment: string;
  totalFound: number;
  withoutWebsiteCount: number;
  withWebsiteCount: number;
  withPhoneCount: number;
  createdAt?: unknown;
}

export interface ApiStatusInfo {
  placesApiConfigured: boolean;
  keySource: string | null;
  keyHint: string | null;
  endpoint: string;
  attributionId: string;
  rateLimitPerMinute: number;
  cachePolicy: string;
}
