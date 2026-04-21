/**
 * FLANCE TYPES - Single source of truth para tipos compartilhados
 *
 * Propósito: Compartilhar tipos entre API e Frontend
 * Benefícios:
 * - Reduz duplicação
 * - Garante consistência
 * - Facilitamanutenção
 * - Melhor type safety
 *
 * Importar em:
 * - API: modules de autenticação, usuários, jobs
 * - Web: src/services/*.ts, src/hooks/*.ts
 *
 * Adicionar tipos aqui ao invés de inline nos módulos!
 */

// ============= AUTH & USER =============

export type UserRole = "CLIENT" | "FREELANCER";

/**
 * Usuário autenticado (retornado por /auth/me)
 * Contém apenas dados públicos, nunca password hash
 */
export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  headline?: string;
  services?: string;
  servicesTags?: string[];
  needs?: string;
  bio?: string;
}

/**
 * Perfil público de freelancer
 * Exibido em listagens e detalhes
 */
export interface PublicFreelancerProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  headline?: string;
  services?: string;
  servicesTags?: string[];
  bio?: string;
}

/**
 * Perfil público de empresa/agência
 */
export interface PublicCompanyProfile {
  id: string;
  ownerId: string;
  name: string;
  avatarUrl?: string;
  headline?: string;
  companyName?: string;
  companyDescription?: string;
  companyCity?: string;
  companyWebsite?: string;
  companyPhotos?: string[];
  planTier?: string;
}

// ============= JOBS =============

export type JobStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED";
export type BudgetType = "FIXED" | "RANGE" | "NEGOTIABLE";

/**
 * Job/Projeto para listagem
 */
export interface JobEntity {
  id: string;
  title: string;
  description: string;
  budgetType: BudgetType;
  budget: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  category: string;
  status: JobStatus;
  clientId: string;
  clientName?: string;
  clientAvatarUrl?: string;
  createdAt: string;
}

/**
 * Job com detalhes completos (para página de detalhes)
 */
export interface JobDetail extends JobEntity {
  proposals?: ProposalSummary[];
  proposalCount?: number;
}

// ============= PROPOSALS =============

export type ProposalStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";

/**
 * Proposta para listagem e respostas
 * IMPORTANTE: Este tipo é duplicado em API (proposals.service.ts)
 * TODO: Consolidar em uma única definição
 */
export interface ProposalSummary {
  id: string;
  status: ProposalStatus;
  text: string;
  bidAmount: number;
  createdAt: string;
  job: {
    id: string;
    title: string;
    category: string;
    clientId: string;
  };
  freelancer: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  conversationId?: string | null;
  lastMessage?: {
    id: string;
    body: string;
    createdAt: string;
    senderId: string;
  } | null;
}

// ============= CHAT =============

/**
 * Conversa entre cliente e freelancer
 */
export interface ConversationSummary {
  id: string;
  company: { id: string; name: string; location?: string | null };
  jobId?: string;
  clientId: string;
  freelancerId: string;
  client: { id: string; name: string; avatarUrl?: string | null };
  freelancer: { id: string; name: string; avatarUrl?: string | null };
  lastMessage?: MessageEntity | null;
  updatedAt: string;
  proposalId?: string;
}

/**
 * Mensagem única no chat
 */
export interface MessageEntity {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string; // Para exibição
  senderAvatar?: string; // Para exibição
  body: string;
  createdAt: string;
  // TODO v2: fileUrl, voiceUrl, status (sent/delivered/read)
}

// ============= AI & MATCHING =============

/**
 * Freelancer com dados para matching
 * Usado pela IA para calcular scores
 */
export interface FreelancerForMatching {
  id: string;
  skills: string[];
  experience?: number; // anos
  rating?: number; // 0-5
}

/**
 * Resultado do matching entre job e freelancer
 */
export interface MatchResult {
  freelancerId: string;
  score: number; // 0-1
  matchedSkills: string[];
  reasoning?: string; // Para debug
}

// ============= PAYMENTS (ESCROW) =============

export type EscrowStatus = "PENDING" | "RELEASED" | "REFUNDED";

/**
 * Transação de escrow
 * TODO v1.1: Integrar com Stripe Connect
 */
export interface EscrowTransaction {
  id: string;
  jobId: string;
  amount: number;
  currency: string; // BRL, USD, etc
  status: EscrowStatus;
  createdAt: string;
  releasedAt?: string;
}

// ============= API RESPONSES =============

/**
 * Resposta de sucesso padrão
 * TODOS endpoints devem retornar este formato
 *
 * Exemplo:
 * {
 *   "success": true,
 *   "data": { ... },
 *   "timestamp": "2026-03-29T10:30:00Z"
 * }
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Resposta de erro padrão
 *
 * Exemplo:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "VALIDATION_ERROR",
 *     "message": "Email inválido",
 *     "statusCode": 400
 *   },
 *   "timestamp": "2026-03-29T10:30:00Z"
 * }
 */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    path?: string;
    details?: unknown;
  };
  timestamp: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  service: "flance-api";
  status: "ok";
  version: string;
}

// ============= PAGINATION =============

/**
 * Resposta com paginação
 *
 * Uso:
 * GET /jobs?limit=20&offset=0
 * Response: ApiSuccess<PaginatedResponse<JobEntity>>
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============= SUBSCRIPTION PLANS =============

export type PlanTier = "FREE" | "BASIC" | "PRO" | "PREMIUM";

export interface PlanDetails {
  tier: PlanTier;
  monthlyPrice: number;
  currency: string;
  features: string[];
  maxProposalsPerMonth?: number;
  maxJobsPerMonth?: number;
  priority?: boolean;
  featured?: boolean;
}

// ============= NOTIFICATIONS (WebSocket) =============

/**
 * Events emitidos via WebSocket
 *
 * Padrão:
 * socket.on('proposal.created', (data) => { ... })
 */
export interface WebSocketEvents {
  "proposal.created": { proposalId: string; jobId: string };
  "proposal.updated": { proposalId: string; status: ProposalStatus; conversationId?: string };
  "message.created": { conversationId: string; message: MessageEntity };
  "user.online": { userId: string };
  "user.offline": { userId: string };
}
