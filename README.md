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
cp .env.example .env   # preencha DATABASE_URL/DIRECT_URL (Supabase → aba "Prisma"
                        # em Connect/Database) e um JWT_SECRET aleatório
npm install
npx prisma migrate dev # cria as tabelas no Supabase
npx prisma db seed     # popula com admin, filial e itens fictícios
npm run dev            # http://localhost:3001
```

### Frontend

```bash
cd web
cp .env.example .env
npm install
npm run dev             # http://localhost:5173
```

## Login de teste (dados do seed)

Os usuários e senhas reais ficam definidos em `api/prisma/seed.ts` (não
neste README). Formato:

| Perfil | Usuário            | Senha        |
| ------ | ------------------ | ------------ |
| Admin  | `<usuario-admin>`  | `<senha>`    |
| Filial | `filial-<nome>`    | `<senha>`    |

## Estágios do pedido

`Recebido` → `Em andamento` → `Enviado` → `Entregue`

Os três primeiros são avançados pelo admin, na Administração ("Gestão de
pedidos"). Enquanto o pedido está em `Recebido` ou `Em andamento`, o admin
pode ajustar os itens/quantidades (adicionar, remover, alterar) pra refletir
o que realmente será enviado — nem sempre o que a filial pediu é o que a
central tem em estoque. Ao marcar como `Enviado`, o estoque dos itens é
baixado e o pedido não pode mais ser editado. O último estágio
(`Entregue`) só é setado quando o supervisor da filial confirma o
recebimento na tela "Meus pedidos".

## Fluxo de trabalho

O desenvolvimento acontece na branch `dev`; a `main` reflete o que já foi
revisado. Pra levar uma mudança da `dev` pra `main`:

1. Commite e dê push normalmente estando na `dev`.
2. Abra um Pull Request no GitHub (`base: main` ← `compare: dev`).
3. Peça revisão de outro dev antes do merge.
4. Depois de aprovado, faça o merge (Squash and merge).
