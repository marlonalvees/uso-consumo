FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./

RUN npm ci

COPY . .

# Valores fake só para satisfazer o `prisma.config.ts` no momento do generate/build.
# A conexão real usa o DATABASE_URL/DIRECT_URL passados em runtime (env_file do compose).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DIRECT_URL="postgresql://build:build@localhost:5432/build"

RUN npx prisma generate && npm run build && cp -r src/generated dist/generated

EXPOSE 3001

CMD ["npm", "start"]
