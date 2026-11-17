import {
  ApiStatusInfo,
  PlaceSearchResult,
  SearchFilters,
  SearchPageResponse,
} from '../types/lead';
import { HttpClientError, safeFetchJson } from './httpClient';

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

function rethrowPlacesError(error: unknown, fallbackMessage: string): never {
  if (error instanceof PlacesApiError) {
    throw error;
  }
  if (error instanceof HttpClientError) {
    checkQuotaResponse(error.status, error.errorCode);
    throw new PlacesApiError(error.message, error.errorCode, error.status);
  }
  throw new PlacesApiError(
    error instanceof Error ? error.message : fallbackMessage,
    'PLACES_API_ERROR',
    500
  );
}

export async function fetchApiConfigStatus(): Promise<ApiStatusInfo> {
  try {
    const { status, data } = await safeFetchJson<ApiStatusInfo & { message?: string; errorCode?: string }>(
      '/api/config/status',
      { headers: { Accept: 'application/json' } },
      'consultar a configuração do servidor'
    );
    if (status >= 400) {
      throw new PlacesApiError(
        data?.message || 'Não foi possível consultar o status da configuração no servidor.',
        data?.errorCode || 'CONFIG_ERROR',
        status
      );
    }
    return data;
  } catch (error) {
    rethrowPlacesError(error, 'Não foi possível consultar o status da configuração no servidor.');
  }
}

export async function testPlacesApiConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const { status, data } = await safeFetchJson<{
      ok: boolean;
      message: string;
      errorCode?: string;
    }>(
      '/api/places/test',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
      'testar conexão com a Google Places API'
    );

    checkQuotaResponse(status, data?.errorCode);
    if (status >= 400 || !data.ok) {
      throw new PlacesApiError(
        data?.message || 'Falha ao validar conexão com a Google Places API (New).',
        data?.errorCode || 'PLACES_TEST_ERROR',
        status
      );
    }
    return data;
  } catch (error) {
    rethrowPlacesError(error, 'Falha ao validar conexão com a Google Places API (New).');
  }
}

export async function searchPlaces(
  filters: SearchFilters,
  pageToken?: string
): Promise<SearchPageResponse> {
  try {
    const { status, data } = await safeFetchJson<
      SearchPageResponse & { errorCode?: string; message?: string }
    >(
      '/api/places/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
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
      },
      'pesquisar empresas'
    );

    checkQuotaResponse(status, data?.errorCode);

    if (status >= 400) {
      throw new PlacesApiError(
        data?.message || 'Erro ao pesquisar empresas no Google Places.',
        data?.errorCode || 'PLACES_SEARCH_ERROR',
        status
      );
    }

    return data as SearchPageResponse;
  } catch (error) {
    rethrowPlacesError(error, 'Erro ao pesquisar empresas no Google Places.');
  }
}

export async function hydratePlacesById(
  placeIds: string[]
): Promise<{ items: Record<string, PlaceSearchResult>; apiConfigured?: boolean }> {
  if (placeIds.length === 0) return { items: {} };

  try {
    const { status, data } = await safeFetchJson<{
      items?: Record<string, PlaceSearchResult>;
      apiConfigured?: boolean;
      errorCode?: string;
      message?: string;
    }>(
      '/api/places/hydrate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ placeIds }),
      },
      'atualizar detalhes da empresa'
    );

    checkQuotaResponse(status, data?.errorCode);

    if (status >= 400) {
      throw new PlacesApiError(
        data?.message || 'Erro ao consultar detalhes no Google Places.',
        data?.errorCode || 'HYDRATE_ERROR',
        status
      );
    }

    return {
      items: (data?.items || {}) as Record<string, PlaceSearchResult>,
      apiConfigured: data?.apiConfigured,
    };
  } catch (error) {
    rethrowPlacesError(error, 'Erro ao consultar detalhes no Google Places.');
  }
}
