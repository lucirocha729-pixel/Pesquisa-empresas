import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    let friendly = error.message;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.error && parsed.operationType) {
        friendly = `Erro de permissão ou validação ao acessar os dados (${parsed.operationType} em "${parsed.path || 'coleção'}"): ${parsed.error}`;
      }
    } catch {
      // mantém mensagem original
    }
    return { hasError: true, errorMessage: friendly };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
            <div className="w-11 h-11 rounded-lg bg-red-50 text-red-700 flex items-center justify-center mb-5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              Ocorreu uma falha inesperada
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              {this.state.errorMessage || 'Não foi possível concluir a operação solicitada.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0A192F] text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Recarregar plataforma
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
