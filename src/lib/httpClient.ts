export class HttpClientError extends Error {
  public readonly status: number;
  public readonly errorCode: string;

  constructor(message: string, status = 500, errorCode = 'HTTP_ERROR') {
    super(message);
    this.name = 'HttpClientError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

function getFriendlyStatusMessage(status: number, contextLabel: string): {
  message: string;
  errorCode: string;
} {
  switch (status) {
    case 404:
      return {
        errorCode: 'ENDPOINT_NOT_FOUND',
        message: `O serviço de ${contextLabel} não foi encontrado no servidor (erro 404). Verifique se o backend está ativo.`,
      };
    case 429:
      return {
        errorCode: 'RATE_LIMITED',
        message: `Limite temporário de consultas atingido ao ${contextLabel}. Aguarde alguns instantes e tente novamente.`,
      };
    case 502:
      return {
        errorCode: 'BAD_GATEWAY',
        message: `Não foi possível comunicar com o serviço externo de ${contextLabel} (erro 502). Tente novamente.`,
      };
    case 503:
      return {
        errorCode: 'SERVICE_UNAVAILABLE',
        message: `O serviço de ${contextLabel} está temporariamente indisponível (erro 503). Tente novamente em instantes.`,
      };
    case 504:
      return {
        errorCode: 'GATEWAY_TIMEOUT',
        message: `Tempo limite esgotado ao ${contextLabel} (erro 504). Tente novamente.`,
      };
    default:
      if (status >= 500) {
        return {
          errorCode: 'INTERNAL_SERVER_ERROR',
          message: `Erro interno no servidor ao ${contextLabel} (erro ${status}). Tente novamente.`,
        };
      }
      return {
        errorCode: 'INVALID_RESPONSE',
        message: `Resposta inválida recebida do servidor ao ${contextLabel} (HTTP ${status}).`,
      };
  }
}

function looksLikeHtmlOrPlainError(text: string, contentType: string): boolean {
  const trimmed = text.trimStart().toLowerCase();
  if (contentType.includes('text/html') || contentType.includes('text/plain')) {
    return !trimmed.startsWith('{') && !trimmed.startsWith('[');
  }
  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('the page ') ||
    trimmed.startsWith('a server error')
  );
}

export async function safeFetchJson<T>(
  input: string,
  init: RequestInit,
  contextLabel: string
): Promise<{ status: number; data: T }> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new HttpClientError(
      `Falha de conexão ao ${contextLabel}. Verifique sua internet ou se o servidor está acessível.`,
      0,
      'NETWORK_ERROR'
    );
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let rawText = '';
  try {
    rawText = await response.text();
  } catch {
    throw new HttpClientError(
      `Não foi possível ler a resposta do servidor ao ${contextLabel}.`,
      response.status || 500,
      'READ_ERROR'
    );
  }

  const isJsonContentType =
    contentType.includes('application/json') || contentType.includes('+json');

  if (!rawText.trim()) {
    if (!response.ok) {
      const friendly = getFriendlyStatusMessage(response.status, contextLabel);
      throw new HttpClientError(friendly.message, response.status, friendly.errorCode);
    }
    throw new HttpClientError(
      `O servidor retornou uma resposta vazia ao ${contextLabel}.`,
      response.status,
      'EMPTY_RESPONSE'
    );
  }

  if (looksLikeHtmlOrPlainError(rawText, contentType) || (!isJsonContentType && !response.ok)) {
    const friendly = getFriendlyStatusMessage(response.status || 502, contextLabel);
    throw new HttpClientError(friendly.message, response.status || 502, friendly.errorCode);
  }

  let parsed: T;
  try {
    parsed = JSON.parse(rawText) as T;
  } catch {
    const friendly = getFriendlyStatusMessage(
      response.ok ? 502 : response.status,
      contextLabel
    );
    throw new HttpClientError(friendly.message, response.status || 502, friendly.errorCode);
  }

  return { status: response.status, data: parsed };
}
