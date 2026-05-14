# 🤝 Guia de Contribuição - Flance

Obrigado por seu interesse em contribuir para o Flance! Este documento descreve como você pode ajudar a tornar nosso projeto melhor.

## 📋 Índice

- [Código de Conduta](#código-de-conduta)
- [Como Contribuir](#como-contribuir)
- [Processo de Pull Request](#processo-de-pull-request)
- [Padrões de Código](#padrões-de-código)
- [Commits e Branches](#commits-e-branches)
- [Testes](#testes)
- [Documentação](#documentação)

---

## 🤝 Código de Conduta

### Nosso Compromisso

Temos o compromisso de manter uma comunidade aberta e acolhedora para todos. Esperamos que todos os contribuidores sejam respeitosos e profissionais.

### Comportamento Esperado

- Use linguagem respeitosa e inclusiva
- Seja receptivo a críticas construtivas
- Respeite opiniões diferentes
- Seja paciente e compreensivo
- Foque no que é melhor para a comunidade

### Comportamento Inaceitável

- Linguagem ou imagens ofensivas
- Assédio pessoal
- Spam ou self-promotion
- Ataques a pessoas ou ideias
- Qualquer forma de discriminação

---

## 💡 Como Contribuir

Existem várias maneiras de contribuir:

### 1. **Reportar Bugs** 🐛

Encontrou um bug? Abra uma issue!

**Antes de reportar:**
- Verifique se o bug já foi reportado em [Issues](https://github.com/seu-usuario/flance/issues)
- Teste se o bug persiste na versão mais recente

**Ao reportar, inclua:**
- Título descritivo do problema
- Descrição detalhada do comportamento
- Passos para reproduzir
- Comportamento esperado vs. observado
- Screenshots/logs se aplicável
- Ambiente (OS, Node.js version, navegador, etc)

### 2. **Sugerir Features** ✨

Tem uma ideia para melhorar? Adoraríamos ouvir!

**Ao sugerir:**
- Descreva a feature de forma clara
- Explique por quê esta feature seria útil
- Liste exemplos de como funcionaria
- Mencione projetos similares se existirem

### 3. **Submeter Pull Requests** 📝

Quer corrigir um bug ou implementar uma feature?

### 4. **Melhorar Documentação** 📚

- Corrigir typos
- Melhorar explicações
- Adicionar exemplos
- Traduzir documentação

### 5. **Revisar Pull Requests** 👀

- Teste as mudanças localmente
- Dê feedback construtivo
- Aponte melhorias

---

## 📋 Processo de Pull Request

### Step 1: Preparar

```bash
# 1. Fork o repositório
git clone https://github.com/ruzzi2603/flance.git
cd flance

# 2. Instale dependências
npm install

# 3. Crie uma branch
git checkout -b feature/sua-feature
```

### Step 2: Desenvolver

```bash
# Faça as alterações
npm run dev          # Inicie desenvolvimento
npm run test         # Execute testes
npm run lint         # Verifique linting
npm run typecheck    # Verifique tipos
```

### Step 3: Commit

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Formato
git commit -m "type(scope): description"

# Exemplos
git commit -m "feat(auth): adiciona recuperação de senha"
git commit -m "fix(jobs): corrige N+1 queries em proposals"
git commit -m "docs(readme): atualiza instruções de setup"
git commit -m "test(users): adiciona testes para validação de email"
git commit -m "refactor(api): simplifica estrutura de middlewares"
```

**Tipos válidos:**
- `feat:` Nova feature
- `fix:` Bug fix
- `docs:` Mudanças em documentação
- `style:` Formatação (espaços, virgulas, etc) - não afeta código
- `refactor:` Refatoração sem mudança de funcionalidade
- `perf:` Melhoria de performance
- `test:` Adição ou correção de testes
- `chore:` Dependências, config, builds
- `ci:` Mudanças em CI/CD

### Step 4: Push

```bash
git push origin feature/sua-feature
```

### Step 5: Pull Request

1. Abra um PR no [repositório principal](https://github.com/ruzzi2603/flance/pulls)
2. Preencha o template do PR
3. Aguarde revisão
4. Responda a feedback
5. Seu PR será mergeado após aprovação!

---

## 🎨 Padrões de Código

### TypeScript

✅ **Obrigatório:**
- Strict mode habilitado
- Tipos explícitos em funções/classes
- Sem `any` (exceto em casos excepcionais com comentário)
- Tipos compartilhados em `packages/types`

```typescript
// ✅ Bom
export async function getUser(id: string): Promise<User> {
  return prisma.user.findUnique({ where: { id } });
}

// ❌ Evitar
export async function getUser(id) {
  return prisma.user.findUnique({ where: { id } });
}

// ❌ Evitar (sem comentário justificando)
const data: any = await api.call();
```

### Formatação

- **Indentação:** 2 espaços
- **Linha máxima:** 100 caracteres
- **Aspas:** Duplas (`"`)
- **Semicolons:** Obrigatórios
- **Trailing commas:** Sim (exceto em TypeScript parameters)

```typescript
// ✅ Bom
const config = {
  host: "localhost",
  port: 3001,
  db: {
    user: "postgres",
  },
};

// ❌ Evitar
const config = { host: "localhost", port: 3001, db: { user: "postgres" } };
```

### Estrutura de Pastas

Mantenha a consistência com a estrutura existente:

```
modules/
└── feature/
    ├── feature.controller.ts       # HTTP handlers
    ├── feature.service.ts          # Business logic
    ├── feature.module.ts           # NestJS module
    ├── feature.spec.ts             # Unit tests
    ├── dto/
    │   ├── create-feature.dto.ts
    │   └── update-feature.dto.ts
    ├── entities/
    │   └── feature.entity.ts        # Response DTO
    └── __tests__/
        └── feature.e2e.spec.ts      # E2E tests
```

### Naming Conventions

```typescript
// Classes: PascalCase
export class UserService {}

// Functions/methods: camelCase
export function createUser() {}

// Constants: UPPER_SNAKE_CASE
export const DEFAULT_PAGE_SIZE = 10;

// Private properties: _camelCase
private _internalData: string;

// Booleans: is/has prefix
const isActive = true;
const hasPermission = false;
```

### Comentários

```typescript
// ✅ Bom - Explica POR QUE, não O QUÊ
// Usa compensação: database hit vs. memory para evitar N+1 queries
// Veja: https://github.com/prisma/prisma/issues/xxxx
const users = await prisma.user.findMany({
  include: { proposals: true }, // Eager load aqui é crítico
});

// ❌ Evitar - Estado óbvio
// Busca usuários
const users = await prisma.user.findMany();

// 📝 JSDoc para exports públicos
/**
 * Cria um novo usuário no banco de dados
 *
 * @param data - Dados do novo usuário
 * @returns Usuário criado com ID gerado
 * @throws ValidationError se dados inválidos
 * @example
 * const user = await createUser({ email: "user@flance.com" });
 */
export async function createUser(data: CreateUserDto): Promise<User> {
  // ...
}
```

---

## 🌿 Commits e Branches

### Nomes de Branch

Use prefixos consistentes:

```bash
# Features
git checkout -b feature/adiciona-autenticacao-github
git checkout -b feature/melhora-busca-jobs

# Bug fixes
git checkout -b fix/corrige-validacao-email
git checkout -b fix/problema-n-plus-1

# Documentação
git checkout -b docs/setup-guide
git checkout -b docs/api-reference

# Refatoração
git checkout -b refactor/reorganiza-services
git checkout -b refactor/simplifica-guards
```

### Commits Atômicos

Faça commits pequenos e lógicos:

```bash
# ✅ Bom - Cada commit é independente e testável
git commit -m "feat(auth): adiciona JWT strategy"
git commit -m "feat(auth): implementa refresh tokens"
git commit -m "test(auth): adiciona testes para tokens"

# ❌ Evitar - Muitas mudanças em um commit
git commit -m "feat: adiciona auth completa com JWT, refresh, recovery, etc"
```

### Mensagens de Commit

Siga [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Exemplos completos:**

```bash
feat(jobs): adiciona filtro avançado de categoria

- Adiciona enum JobCategory
- Implementa filtro no JobController
- Testa com múltiplas categorias

Closes #123
```

```bash
fix(proposals): resolve N+1 queries em findMany

O método findMany estava fazendo 1 query para proposals
e N queries para cada user associado.

Solução: Adicione eager loading com include: { user: true }

Fixes #456
```

---

## 🧪 Testes

### Executar Testes

```bash
npm run test              # Vitest watch mode
npm run test:coverage    # Com coverage report
npm run test:ui          # Interface visual
```

### Padrão de Testes

Use [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com):

```typescript
describe("UsersService", () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UsersService, PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe("findById", () => {
    it("deve retornar usuário por ID", async () => {
      // Arrange
      const userId = "123";
      const expectedUser = { id: userId, email: "test@flance.com" };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(expectedUser);

      // Act
      const result = await service.findById(userId);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it("deve lançar NotFoundException quando usuário não existe", async () => {
      // Arrange
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById("999")).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
```

### Cobertura Esperada

- Controllers: 80%+
- Services: 90%+
- Utils: 95%+
- Pipes/Guards: 85%+

---

## 📚 Documentação

### Atualize a Documentação

Se sua mudança afeta usuários finais, atualize:

- `README.md` - Instruções principais
- `docs/API.md` - Endpoints
- `CHANGELOG.md` - Release notes
- Comentários inline no código
- GitHub Wiki (se aplicável)

### Exemplo de Documentação

```typescript
/**
 * Busca propostas com filtros avançados
 *
 * @param filters - Critérios de busca
 * @param filters.status - Status da proposal (pending, accepted, rejected)
 * @param filters.jobId - ID do job (opcional)
 * @param filters.freelancerId - ID do freelancer (opcional)
 * @param pagination - Paginação
 * @param pagination.page - Número da página (1-indexed)
 * @param pagination.limit - Itens por página (máx 100)
 *
 * @returns Lista paginada de proposals
 * @throws UnauthorizedException Se usuário não tem acesso
 * @throws BadRequestException Se parâmetros inválidos
 *
 * @example
 * const proposals = await service.findMany(
 *   { status: "pending", jobId: "123" },
 *   { page: 1, limit: 10 }
 * );
 */
async findMany(
  filters: FindProposalsDto,
  pagination: PaginationDto
): Promise<PaginatedResponse<Proposal>> {
  // ...
}
```

---

## 🚀 Checklist Pré-Submissão

Antes de submeter seu PR, verifique:

- [ ] Código segue os padrões deste guia
- [ ] TypeScript sem erros (`npm run typecheck`)
- [ ] ESLint passa (`npm run lint`)
- [ ] Testes passam (`npm run test`)
- [ ] Testes adicionados para novas features
- [ ] Documentação atualizada
- [ ] Commits seguem Conventional Commits
- [ ] Branch está atualizado com `main`
- [ ] Nenhuma mudança acidental (debug code, logs, etc)
- [ ] Descrição clara do PR

---

## 📞 Precisa de Ajuda?

- 💬 **GitHub Discussions:** [Discussões do Flance](https://github.com/ruzzi2603/flance/discussions)
- 🐛 **Issues:** [Abra uma issue](https://github.com/ruzzi2603/flance/issues)
- 📧 **Email:** contato@flance.com
- 💻 **Discord:** [Comunidade Flance](https://discord.gg/flance)

---

## 🙏 Agradecimentos

Todos os contribuidores são heróis! Seu tempo e expertise ajudam a tornar o Flance melhor para todos.

---

<div align="center">

**Obrigado por contribuir! 🎉**

Made with ❤️ by the Flance Community

</div>
