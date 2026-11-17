# Especificação de Segurança Firestore — Lead Finder Brasil

## 1. Invariantes de Dados

1. **Isolamento por Proprietário (PII & CRM)**: Um usuário autenticado (`email_verified == true`) só pode ler, listar, criar, atualizar e excluir documentos dentro de `/users/{userId}` onde `userId == request.auth.uid` e `data.ownerId == request.auth.uid`.
2. **Integridade Relacional (Master Gate)**: Um registro em `/users/{userId}/leads/{leadId}/history/{historyId}` não pode existir sem que o lead pai `/users/{userId}/leads/{leadId}` exista e pertença ao mesmo usuário (`ownerId == request.auth.uid`).
3. **Imutabilidade de Identidade e Tempo**: Campos `id`, `ownerId`, `placeId`, `leadId` e `createdAt` são imutáveis após a criação. Todos os `createdAt` e `updatedAt` devem ser exatamente `request.time`.
4. **Conformidade de Schema e Tamanhos**: Nenhuma chave extra ("shadow fields") é aceita (`keys().hasOnly(...)` e `affectedKeys().hasOnly(...)`), e toda string possui limite máximo `.size()`.
5. **Conformidade Google Maps Platform**: Nenhuma coleção de CRM armazena dumps de campos de diretório de terceiros; apenas `placeId` e metadados próprios do CRM são persistidos.

## 2. "Dirty Dozen" Payloads (Vetores de Ataque Bloqueados)

1. **Identity Spoofing em Lead**: Criar lead em `/users/uidA/leads/lead1` com `ownerId: "uidB"` → `PERMISSION_DENIED`.
2. **Cross-Tenant Read/List**: Usuário `uidB` tentando `get` ou `list` em `/users/uidA/leads` → `PERMISSION_DENIED`.
3. **Unverified Email Bypass**: Usuário autenticado com `email_verified: false` tentando gravar em `/users/uidA/leads/lead1` → `PERMISSION_DENIED`.
4. **Shadow Field Injection**: Criar lead incluindo campo não declarado `isAdmin: true` ou `rawGoogleDump: "..."` → `PERMISSION_DENIED`.
5. **Timestamp Forgery**: Criar lead com `createdAt: Timestamp(2020-01-01)` diferente de `request.time` → `PERMISSION_DENIED`.
6. **ID Poisoning**: Criar documento com ID contendo `/` ou >128 caracteres (`a`.repeat(200)) → `PERMISSION_DENIED`.
7. **Orphan History Write**: Criar histórico em `/users/uidA/leads/leadInexistente/history/h1` sem lead pai existente → `PERMISSION_DENIED`.
8. **Immutable Field Tampering**: Atualizar `placeId`, `ownerId` ou `createdAt` em um lead existente → `PERMISSION_DENIED`.
9. **Enum Bypass (`crmStatus`)**: Atualizar `crmStatus` para `"vip_hacker"` fora da lista permitida → `PERMISSION_DENIED`.
10. **Value Poisoning (`notes` / `estimatedTicket`)**: Enviar `notes` com >3000 caracteres ou `estimatedTicket: -500` ou tipo string → `PERMISSION_DENIED`.
11. **History Mutation**: Tentar `update` em um registro imutável de `/history/{historyId}` → `PERMISSION_DENIED`.
12. **Negative Search Metrics**: Criar `searchLogs` com `withoutWebsiteCount: -1` ou `totalFound: "cem"` → `PERMISSION_DENIED`.
