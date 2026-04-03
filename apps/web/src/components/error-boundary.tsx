/**
 * ERROR BOUNDARY - React Component wrapper para capturar erros
 *
 * Propósito: Evitar que um erro em qualquer componente derrube toda a app
 *
 * Behavior:
 * - Captura erros em render, lifecycle, constructors de child components
 * - Mostra UI de fallback amigável
 * - Loga erro para debugging
 *
 * Uso:
 * <ErrorBoundary>
 *   <SomeFaultyComponent />
 * </ErrorBoundary>
 *
 * IMPORTANTE:
 * - ErrorBoundary são class components (não hooks)
 * - Não capturam erros em event handlers (usar try/catch)
 * - Não capturam erros em setTimeout/promises (usar window.onerror)
 */

'use client';

import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * Update state para marcar que erro ocorreu
   * Chamado quando child component lança erro
   */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Log do erro (pode ser enviado a serviço de monitoring)
   */
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Error caught:', error, info);

    // TODO: Enviar para serviço de error tracking (Sentry, Rollbar)
    // analyticsService.trackError({
    //   error: error.message,
    //   stack: error.stack,
    //   componentStack: info.componentStack,
    //   timestamp: new Date().toISOString(),
    // });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center min-h-screen p-4 bg-red-50">
            <div className="max-w-md w-full text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Algo deu errado
              </h1>
              <p className="text-gray-600 mb-6">
                Desculpe, ocorreu um erro inesperado. Tente recarregar a página.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Recarregar Página
              </button>
              {process.env.NODE_ENV !== 'production' && this.state.error && (
                <details className="mt-4 text-left bg-white p-4 rounded border border-red-200">
                  <summary className="cursor-pointer font-mono text-sm text-red-600">
                    Detalhes do erro (dev only)
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto max-h-60 whitespace-pre-wrap">
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
