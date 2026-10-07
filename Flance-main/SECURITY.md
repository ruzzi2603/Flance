# 🔐 Política de Segurança - Flance

## Reportando Vulnerabilidades

Se você descobrir uma vulnerabilidade de segurança, **por favor NÃO abra uma issue pública**. 
Em vez disso, envie um relatório privado para manter a segurança de todos os usuários.

### Como Reportar

**Email:** [security@flance.com](mailto:security@flance.com)
**GitHub:** [Relatório Privado](https://github.com/ruzzi2603/flance/security/advisories/new)

**PGP Key:** (opcional - adicione se tiver)

**Informações a incluir:**
1. Descrição clara da vulnerabilidade
2. Passos para reproduzir
3. Impacto potencial
4. Seu nome e afiliação (opcional)
5. Preferência de divulgação coordenada

Esperamos responder em **48 horas**.

---

## Processo de Divulgação Coordenada

1. **Reporte:** Você reporta a vulnerabilidade
2. **Confirmação:** Confirmamos em até 48h
3. **Investigação:** Investigamos e trabalhamos em fix
4. **Fix & Review:** Implementamos correção
5. **Release:** Lançamos patch de segurança
6. **Divulgação:** Anunciamos ao público
7. **Credit:** Você recebe crédito (se desejar)

**Timeline típico:** 30-90 dias

---

## Boas Práticas de Segurança

### Para Usuários

✅ **Faça:**
- Use senhas fortes (min 12 caracteres, mix de tipos)
- Ative autenticação de dois fatores (quando disponível)
- Não compartilhe seu JWT token
- Logoff em dispositivos compartilhados
- Mantenha seu navegador atualizado

❌ **NÃO Faça:**
- Compartilhe suas credenciais
- Use senhas em código/chat
- Clique em links suspeitos
- Desabilite verificações de segurança
- Configure CORS com "*"

### Para Desenvolvedores

✅ **Deve-se:**
- Usar `.env` local e NUNCA commitar secrets
- Validar entrada em servidor E cliente
- Usar HTTPS em produção
- Manter dependências atualizadas
- Fazer code review antes de merge
- Testar cases de segurança
- Usar rate limiting
- Logar eventos sensíveis

❌ **NÃO Se Deve:**
- Usar senhas em URL query params
- Confiar em validação apenas do cliente
- Expor informações de erro detalhadas
- Commitar `.env` ou secrets
- Usar `eval()` ou `innerHTML` com input
- Desabilitar SSL/TLS verification
- Logar dados sensíveis

---

## Segurança na Arquitetura

### Backend Security

#### Autenticação
- ✅ JWT com RS256/HS256
- ✅ Refresh tokens com expiration
- ✅ Password hashing com bcryptjs (10 rounds)
- ✅ Session invalidation on logout
- ✅ Rate limiting em login

#### Autorização
- ✅ Role-based access control (RBAC)
- ✅ Guards em rotas sensíveis
- ✅ Validação de ownership
- ✅ Least privilege principle

#### Validação
- ✅ Input validation com Zod
- ✅ Type safety com TypeScript
- ✅ SQL injection protection (Prisma ORM)
- ✅ XSS protection (sanitização output)
- ✅ CSRF tokens para state-changing operations

#### Comunicação
- ✅ HTTPS/TLS obrigatório em produção
- ✅ CORS restritivo
- ✅ HSTS headers (Helmet.js)
- ✅ Content Security Policy
- ✅ X-Frame-Options
- ✅ X-Content-Type-Options

#### Data Protection
- ✅ Criptografia em trânsito (TLS)
- ✅ Hashing irreversível para senhas
- ✅ Tokens com expiration
- ✅ Secure cookies (httpOnly, sameSite)
- ✅ GDPR compliance (planos de data deletion)

### Frontend Security

- ✅ CSP headers
- ✅ XSS protection
- ✅ CSRF tokens
- ✅ Secure token storage (httpOnly cookies)
- ✅ Input validation
- ✅ Error handling sem detalhes

### Database Security

- ✅ Prepared statements (Prisma)
- ✅ Least privilege users
- ✅ Encrypted connections
- ✅ Backups cifrados
- ✅ SQL injection protected
- ✅ Row-level security preparado

---

## Checklist de Segurança para Releases

Antes de lançar uma versão, verifique:

### Code
- [ ] Sem secrets hardcoded
- [ ] Sem `console.log` com dados sensíveis
- [ ] Sem comentários com credenciais
- [ ] TypeScript sem `any`
- [ ] Dependencies atualizadas
- [ ] Security scan passed (`npm audit`)

### Configuration
- [ ] JWT_SECRET min 32 chars
- [ ] CORS_ORIGIN específico
- [ ] Database password strong
- [ ] Email credentials seguras
- [ ] API keys rotacionadas
- [ ] Environment variables validadas

### Deployment
- [ ] HTTPS/TLS ativado
- [ ] Helmet.js ativado
- [ ] Rate limiting ativado
- [ ] Logging habilitado
- [ ] Monitoring ativado
- [ ] Backups funcionando
- [ ] WAF configurado (opcional)
- [ ] DDoS protection (CloudFlare, etc)

### Testing
- [ ] SQL injection tests
- [ ] XSS tests
- [ ] CSRF tests
- [ ] Authentication tests
- [ ] Authorization tests
- [ ] Rate limiting tests
- [ ] Error handling tests

---

## Dependências de Segurança

Monitoramos e atualizamos regularmente:

```json
{
  "security-critical": [
    "@prisma/client",
    "@nestjs/*",
    "jsonwebtoken",
    "bcryptjs",
    "helmet",
    "passport"
  ],
  "high-priority": [
    "express",
    "next.js",
    "axios",
    "lodash"
  ]
}
```

**Política:**
- Critical: Patch em 24 horas
- High: Patch em 1 semana
- Medium: Patch em 2 semanas
- Low: Patch em próxima release

---

## Conformidade & Padrões

### Padrões Seguidos

- ✅ **OWASP Top 10:** Proteção contra vulnerabilidades comuns
- ✅ **CWE/SANS:** Top 25 most dangerous software weaknesses
- ✅ **GDPR:** Proteção de dados de usuários
- ✅ **NIST Cybersecurity:** Melhores práticas
- ✅ **PCI DSS:** Para futura integração de pagamentos

### Auditorias

- 🔄 Code review em todo pull request
- 🔄 Dependency scanning automático
- 🔄 Static security analysis (quando implementado)
- 📅 Security audits trimestrais (planejado)

---

## Incident Response

### Se Descobrirmos uma Vulnerabilidade

1. **Isolate:** Desabilitar funcionalidade afetada se necessário
2. **Assess:** Determinar impacto e gravidade
3. **Fix:** Desenvolver patch de emergência
4. **Test:** Testar completamente
5. **Release:** Lançar versão de security
6. **Notify:** Comunicar para usuários afetados
7. **Review:** Post-mortem e melhorias

### Contato para Incidentes

**Email:** [security@flance.com](mailto:security@flance.com)
**Telefone:** (disponível para casos críticos)
**24/7 Support:** Sim, para vulnerabilidades críticas

---

## Reconhecimentos

Agradecemos a todos que responsavelmente reportaram vulnerabilidades:

- [Empty - Seja o primeiro! 🎉]

> Veja [SECURITY_RESEARCHERS.md](./SECURITY_RESEARCHERS.md) para lista completa de contribuidores de segurança

---

## Recursos de Segurança

### Documentação
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity](https://www.nist.gov/cyberframework)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/sql-injection)

### Ferramentas
- `npm audit` - Vulnerability scanner
- `snyk` - Dependency scanning
- `dependabot` - Automated updates
- `sonarqube` - Code quality & security
- `burp suite` - Penetration testing

### Comunidades
- [OWASP](https://owasp.org)
- [Cert.org](https://www.cert.org)
- [CVE Details](https://www.cvedetails.com)
- [Security Stack Exchange](https://security.stackexchange.com)

---

## Atualizações de Política

Esta política é revisada:
- ✅ Trimestralmente
- ✅ Após incidentes
- ✅ Com mudanças de arquitetura
- ✅ Em conformidade com novos padrões

**Última atualização:** 2026-03-29
**Próxima revisão:** 2026-06-29

---

<div align="center">

**Segurança é responsabilidade de todos.**

Se você tem dúvidas, envie um email: [security@flance.com](mailto:security@flance.com)

</div>
