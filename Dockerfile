# Estágio de Build
FROM node:20-alpine AS build

WORKDIR /app

# Copia os arquivos de definição de pacotes
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia todos os arquivos do projeto
COPY . .

# Compila o app de produção usando o Vite
RUN npm run build

# Estágio de Produção
FROM caddy:alpine

# Copia os arquivos compilados do estágio anterior para o diretório padrão do Caddy
COPY --from=build /app/dist /usr/share/caddy

# Copia a configuração padrão do Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Expõe as portas padrão (HTTP e HTTPS)
EXPOSE 80 443

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
