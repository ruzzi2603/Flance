/**
 * LOADING SKELETON - Componentes de loading placeholder
 *
 * Propósito: Mostrar loading state enquanto dados são carregados
 *
 * Benefícios:
 * - UX melhor (não vê branco em branco)
 * - Indica que algo está acontecendo
 * - Reduz percepção de lentidão
 *
 * Uso:
 * {isLoading ? (
 *   <ProposalSkeleton />
 * ) : (
 *   <ProposalCard proposal={proposal} />
 * )}
 */

'use client';

export const ProposalSkeleton = () => (
  <div className="space-y-4 p-4 border rounded-lg animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
    <div className="h-4 bg-gray-200 rounded w-full"></div>
    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
    <div className="flex gap-2 mt-4">
      <div className="h-8 bg-gray-200 rounded w-24"></div>
      <div className="h-8 bg-gray-200 rounded w-24"></div>
    </div>
  </div>
);

export const ChatMessageSkeleton = () => (
  <div className="space-y-2 p-3 bg-gray-50 rounded animate-pulse">
    <div className="h-3 bg-gray-200 rounded w-full"></div>
    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
  </div>
);

export const JobCardSkeleton = () => (
  <div className="space-y-3 p-4 border rounded-lg animate-pulse">
    <div className="h-5 bg-gray-200 rounded w-2/3"></div>
    <div className="h-4 bg-gray-200 rounded w-full"></div>
    <div className="h-4 bg-gray-200 rounded w-full"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  </div>
);

/**
 * LOADING OVERLAY - Mostrado em topo da página durante operações
 *
 * Uso:
 * {isSubmitting && <LoadingOverlay message="Enviando proposta..." />}
 */
export const LoadingOverlay = ({ message = "Carregando..." }: { message?: string }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-700 font-medium">{message}</p>
    </div>
  </div>
);

/**
 * TOAST NOTIFICATION - Feedback de ação (sucesso, erro, info)
 *
 * Contexto global:
 * - Criar context para gerenciar múltiplos toasts
 * - Auto-dismiss após 3-5 segundos
 * - Permitir dismiss manual
 *
 * Uso:
 * const { showToast } = useToast();
 * showToast({ type: 'success', message: 'Proposta enviada!' });
 * showToast({ type: 'error', message: 'Erro ao enviar' });
 */
export const Toast = ({
  type = 'info',
  message,
  onDismiss,
}: {
  type?: 'success' | 'error' | 'info' | 'warning';
  message: string;
  onDismiss?: () => void;
}) => {
  const colors = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'ℹ',
  };

  return (
    <div
      className={`
        fixed top-4 right-4 max-w-md p-4 rounded-lg border
        ${colors[type]}
        shadow-lg z-40
        animate-fade-in
      `}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl font-bold flex-shrink-0">{icons[type]}</span>
        <div className="flex-1">
          <p className="font-medium">{message}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};
