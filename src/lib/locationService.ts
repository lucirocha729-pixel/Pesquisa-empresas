export interface NeighborhoodOption {
  name: string;
  subtitle: string;
  placeId: string;
}

interface IbgeMunicipio {
  id: number;
  nome: string;
}

// Cache em memória da sessão para municípios do IBGE por UF
const ibgeCitiesCache = new globalThis.Map<string, string[]>();

export async function fetchIbgeCitiesByUf(uf: string): Promise<string[]> {
  const cleanUf = uf.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cleanUf)) {
    return [];
  }

  const cached = ibgeCitiesCache.get(cleanUf);
  if (cached) {
    return cached;
  }

  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(cleanUf)}/municipios`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('Erro de rede ao consultar os municípios na API oficial do IBGE.');
  }

  if (!response.ok) {
    throw new Error(`A API do IBGE retornou erro (${response.status}) ao carregar os municípios de ${cleanUf}.`);
  }

  const raw = (await response.json()) as IbgeMunicipio[];
  if (!Array.isArray(raw)) {
    throw new Error('Formato inesperado recebido da API de localidades do IBGE.');
  }

  const cities = Array.from(
    new Set(
      raw
        .map((m) => (m?.nome || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  ibgeCitiesCache.set(cleanUf, cities);
  return cities;
}

export async function fetchNeighborhoodSuggestions(params: {
  country: string;
  regionCode: string;
  state: string;
  city: string;
  query: string;
}): Promise<NeighborhoodOption[]> {
  const response = await fetch('/api/places/neighborhoods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (response.status === 429 || data?.errorCode === 'QUOTA_EXCEEDED') {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }

  if (!response.ok) {
    throw new Error(
      data?.message || 'Não foi possível buscar bairros na Google Places API (New).'
    );
  }

  return Array.isArray(data?.neighborhoods) ? data.neighborhoods : [];
}
