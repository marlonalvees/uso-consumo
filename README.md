# Uso e Consumo

Sistema interno para as filiais pedirem itens de uso e consumo (papel A4,
cloro, espanador etc. — lista fictícia por enquanto). Cada filial tem um
login próprio de supervisor e faz pedidos pelo celular; a central acompanha
tudo em uma dashboard, com o estágio de cada pedido evoluindo de
**Recebido** até **Entregue** (confirmado pelo próprio supervisor).

A central também controla estoque: cada produto tem fornecedor e estoque
mínimo cadastrados, compras dão entrada no estoque, pedidos enviados dão
saída, e há um relatório de recomendação de compra baseado no estoque
mínimo de cada item.

## Estrutura

```
uso-consumo/
├── web/   → Frontend (React + Vite + TypeScript + Tailwind + React Router)
└── api/   → Backend  (Node.js + Express + TypeScript + Prisma + Supabase/Postgres)
```

## Como rodar

### Backend

```bash
cd api
cp .env.example .env   # preencha as variáveis (veja abaixo)
npm install
npx prisma generate    # gera o client do Prisma em src/generated
npm run dev            # http://localhost:3001
```

- `DATABASE_URL`/`DIRECT_URL`: Supabase → aba "Prisma" em Connect/Database.
- `JWT_SECRET`: em produção, o mesmo do hub (é com ele que a API confere os
  tokens). Localmente pode ser qualquer valor, desde que os tokens de teste
  sejam gerados com ele (veja [Login](#login)).
- `CORS_ORIGINS`: endereços do front liberados, separados por vírgula e sem
  espaço. Se ficar vazio, valem o hub e o `http://localhost:5173`.

O banco já existe no Supabase. Pra aplicar uma migration nova, use
`npx prisma migrate deploy`. **Não rode `prisma migrate dev` nem
`prisma migrate reset` apontando pro Supabase:** o schema `public` é do hub e
está na lista de schemas do Prisma, então esses comandos podem querer resetar
o banco.

`npx prisma db seed` cadastra as embalagens e os itens fictícios de
`prisma/itemsCatalog.ts` (as categorias Papelaria e Limpeza vêm das
migrations). Usuários e filiais vêm do hub, não do seed.

### Frontend

```bash
cd web
cp .env.example .env
npm install
npm run dev             # http://localhost:5173
```

- `VITE_API_URL`: endereço da API terminando em `/api` (ex.:
  `http://localhost:3001/api`).
- `VITE_HUB_URL`: endereço do hub, pra onde o site manda quem não está
  logado. Se ficar vazio, o site mostra o erro na tela em vez de redirecionar
  (útil em desenvolvimento).

## Login

O sistema não tem login próprio: quem faz o login é o hub, que grava no
navegador um cookie `token` com um JWT. A API confere esse token com o
`JWT_SECRET` e lê dele o usuário (`sub`), as permissões e as filiais
(`branchs`):

- o usuário precisa ter a permissão do módulo `uso_consumo`;
- `access: "admin"` é a central; qualquer outro valor é supervisor de filial,
  que só enxerga e faz pedidos pras filiais que estão no token.

Pra testar sem o hub, gere um token assinado com o `JWT_SECRET` do `api/.env`
(é o mesmo script do `npm run dev:token`):

```bash
cd api
npx ts-node scripts/issue-dev-token.ts --admin                  # admin
npx ts-node scripts/issue-dev-token.ts --branches=1,2 --user=7  # supervisor das filiais 1 e 2
```

Use o token no header `Authorization: Bearer <token>` (curl/Postman) ou crie
um cookie `token` em `http://localhost:5173` pelo DevTools. O usuário e as
filiais precisam existir nas tabelas `users` e `branchs` do hub.

## Estágios do pedido

`Recebido` → `Em andamento` → `Enviado` → `Entregue`

Os três primeiros são avançados pelo admin, na Administração ("Gestão de
pedidos"). O admin pode ajustar os itens/quantidades (adicionar, remover,
alterar) pra refletir o que realmente será enviado — nem sempre o que a
filial pediu é o que a central tem em estoque. Ao marcar como `Enviado`, o
estoque dos itens é baixado; se algum item não tiver estoque suficiente, o
envio é bloqueado até o pedido ser ajustado ou o estoque receber entrada.
Depois de enviado, o admin ainda pode ajustar os itens, e a diferença volta
ou sai do estoque automaticamente. O último estágio (`Entregue`) só é setado
quando o supervisor da filial confirma o recebimento na tela "Meus pedidos".

Cada supervisor só pode ter um pedido em aberto por vez: pra fazer outro, o
anterior precisa chegar a `Entregue`. Enquanto o pedido está em `Recebido`,
quem fez ainda pode editá-lo. O admin não tem a trava de um pedido por vez.

## Fluxo de trabalho

O desenvolvimento acontece na branch `dev`; a `main` reflete o que já foi
revisado. Pra levar uma mudança da `dev` pra `main`:

1. Commite e dê push normalmente estando na `dev`.
2. Abra um Pull Request no GitHub (`base: main` ← `compare: dev`).
3. Peça revisão de outro dev antes do merge.
4. Depois de aprovado, faça o merge (Squash and merge).
