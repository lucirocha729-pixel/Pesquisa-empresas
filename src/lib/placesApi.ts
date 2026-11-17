import {
  ApiStatusInfo,
  PlaceSearchResult,
  SearchFilters,
  SearchPageResponse,
} from '../types/lead';

export class PlacesApiError extends Error {
  public errorCode: string;
  public httpStatus: number;

  constructor(message: string, errorCode = 'PLACES_API_ERROR', httpStatus = 500) {
    super(message);
    this.name = 'PlacesApiError';
    this.errorCode = errorCode;
    this.httpStatus = httpStatus;
  }
}

function checkQuotaResponse(status: number, errorCode?: string) {
  if (status === 429 || errorCode === 'QUOTA_EXCEEDED') {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

export async function fetchApiConfigStatus(): Promise<ApiStatusInfo> {
  const response = await fetch('/api/config/status');
  if (!response.ok) {
    throw new PlacesApiError('Não foi possível consultar o status da configuração no servidor.');
  }
  return response.json();
}

export async function testPlacesApiConnection(): Promise<{ ok: boolean; message: string }> {
  const response = await fetch('/api/places/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  checkQuotaResponse(response.status, data?.errorCode);
  if (!response.ok || !data.ok) {
    throw new PlacesApiError(
      data?.message || 'Falha ao validar conexão com a Google Places API (New).',
      data?.errorCode,
      response.status
    );
  }
  return data;
}

export async function searchPlaces(
  filters: SearchFilters,
  pageToken?: string
): Promise<SearchPageResponse> {
  const response = await fetch('/api/places/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      country: filters.country,
      regionCode: filters.regionCode,
      state: filters.state,
      city: filters.city,
      neighborhood: filters.neighborhood,
      segment: filters.segment,
      requestedCount: filters.requestedCount,
      pageToken: pageToken || '',
    }),
  });

  const data = await response.json();
  checkQuotaResponse(response.status, data?.errorCode);

  if (!response.ok) {
    throw new PlacesApiError(
      data?.message || 'Erro ao pesquisar empresas no Google Places.',
      data?.errorCode,
      response.status
    );
  }

  return data as SearchPageResponse;
}

export async function hydratePlacesById(
  placeIds: string[]
): Promise<{ items: Record<string, PlaceSearchResult>; apiConfigured?: boolean }> {
  if (placeIds.length === 0) return { items: {} };

  const response = await fetch('/api/places/hydrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeIds }),
  });

  const data = await response.json();
  checkQuotaResponse(response.status, data?.errorCode);

  return {
    items: (data?.items || {}) as Record<string, PlaceSearchResult>,
    apiConfigured: data?.apiConfigured,
  };
}
