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

const Loader = ({ className = "" }: { className?: string }) => (
  <div className={`loader ${className}`}></div>
);

const LoaderWrap = ({ className = "" }: { className?: string }) => (
  <div className={`loader-wrap ${className}`}>
    <Loader />
  </div>
);

export const ProposalSkeleton = () => <LoaderWrap className="border rounded-lg" />;

export const ChatMessageSkeleton = () => <LoaderWrap className="rounded" />;

export const JobCardSkeleton = () => <LoaderWrap className="border rounded-lg" />;

/**
 * LOADING OVERLAY - Mostrado em topo da página durante operações
 *
 * Uso:
 * {isSubmitting && <LoadingOverlay message="Enviando proposta..." />}
 */
export const LoadingOverlay = ({ message = "Carregando..." }: { message?: string }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 text-center">
      <div className="flex justify-center mb-4">
        <Loader />
      </div>
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
