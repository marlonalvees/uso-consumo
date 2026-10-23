# Uso e Consumo

Sistema interno para as filiais pedirem itens de uso e consumo (papel A4,
cloro, espanador etc.). Cada filial tem um login próprio de supervisor e faz
pedidos pelo celular, numa tela no estilo de app de delivery; a central
acompanha tudo num quadro de pedidos, com o estágio de cada pedido evoluindo
de **Recebido** até **Entregue** (confirmado pelo próprio supervisor). Dá pra
instalar o site na tela inicial do celular e receber notificações.

A central também controla estoque e compras: inventário por contagem,
pedidos de compra que só entram no estoque quando chegam, custo médio
automático, sugestão de estoque mínimo pelo consumo e relatórios.

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
- `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (opcionais): chaves
  das notificações push. Gere uma vez com `npx web-push generate-vapid-keys` e
  não troque depois (os aparelhos inscritos param de receber). Sem elas o
  sistema funciona normalmente, só sem push.

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

`Recebido` → `Em separação` → `Enviado` → `Entregue` (ou `Cancelado`)

No banco, "Em separação" continua com o valor `EM_ANDAMENTO`.

- **Recebido → Em separação → Enviado**: a central avança no quadro da
  Gestão de pedidos. Iniciar a separação pode ser desfeito (volta pra
  Recebido). Ao marcar como `Enviado`, o estoque dos itens é baixado e o custo
  de cada item fica guardado no pedido (o consumo dos meses passados não muda
  quando o custo do produto muda depois).
- **Ajustes da central**: o admin pode mudar itens e quantidades em qualquer
  estágio, com o motivo de cada corte ("Sem estoque" etc.) e uma observação
  pra filial. A filial vê o que pediu, o que vai e por quê. Depois do envio, a
  diferença volta ou sai do estoque automaticamente.
- **Estoque negativo**: nenhuma operação confere saldo (envio, ajuste de
  pedido, ajuste avulso). O estoque nem sempre está atualizado, então ele pode
  ficar negativo; o inventário por contagem corrige.
- **Entregue**: só quando o supervisor confirma o recebimento, item a item.
  Dá pra marcar o que faltou ou chegou avariado (com foto e observação); a
  central é avisada e vê tudo no relatório de divergências.
- **Cancelado**: o supervisor cancela enquanto o pedido está em Recebido; a
  central cancela com motivo até antes do envio.

Cada **filial** só pode ter um pedido aberto (Recebido ou Em separação) por
vez. Enquanto ele está em Recebido, qualquer supervisor da filial adiciona
itens a ele em vez de abrir outro; depois que a central envia, a filial já
pode fazer o próximo pedido. O admin não tem essa trava.

**Pendências**: o que a central cortou de um pedido enviado e o que faltou ou
chegou avariado no recebimento aparece pra filial como pendência no próximo
pedido (dá pra pedir de novo com um toque ou dispensar).

Todas as mudanças ficam no histórico do pedido (quem fez e quando).

## Estoque e compras

- **Inventário**: a central digita o que contou e o sistema lança a diferença.
  A contagem pode ser cega (sem mostrar o saldo do sistema); diferença grande
  pede justificativa. A curva ABC (pelo valor consumido) diz o que contar com
  mais frequência.
- **Pedido de compra**: a recomendação gera o pedido ao fornecedor (e a
  mensagem de WhatsApp). Ele fica "a caminho" e só entra no estoque quando é
  recebido, conferindo quantidade e custo de cada item. O que está a caminho
  não aparece de novo na recomendação.
- **Custo médio**: o custo do produto é recalculado a cada compra recebida com
  custo unitário (custo médio ponderado).
- **Mínimo e ideal pelo consumo**: Produtos → "Sugerir mínimo pelo consumo"
  calcula pelo consumo dos últimos 90 dias e pelo prazo de entrega do
  fornecedor (mínimo = consumo no prazo + estoque de segurança).

## Filiais

Em Cadastros → Filiais a central define, por filial:

- **Estoque ideal** de cada item: a filial informa quanto tem e o pedido é
  calculado sozinho ("Pedir pelo estoque ideal").
- **Cota mensal**: só informativa (a filial vê quanto já consumiu no mês e
  quanto o pedido vai somar; nada é bloqueado).

## App no celular e notificações

O site é instalável (PWA): no Android, "Adicionar à tela inicial"/"Instalar";
no iPhone, Compartilhar → "Adicionar à Tela de Início". Com as chaves VAPID
configuradas, cada pessoa ativa as notificações no próprio aparelho (menu
lateral, "Mais" ou "Minha filial"):

- a central recebe "pedido novo" (e, com o site aberto, toca um som e mostra
  o contador no título da aba);
- a filial recebe quando o pedido entra em separação, é enviado, ajustado ou
  cancelado.

No iPhone, o push só funciona com o app adicionado à tela inicial (iOS 16.4
ou mais novo).

## Fluxo de trabalho

O desenvolvimento acontece na branch `dev`; a `main` reflete o que já foi
revisado. Pra levar uma mudança da `dev` pra `main`:

1. Commite e dê push normalmente estando na `dev`.
2. Abra um Pull Request no GitHub (`base: main` ← `compare: dev`).
3. Peça revisão de outro dev antes do merge.
4. Depois de aprovado, faça o merge (Squash and merge).
