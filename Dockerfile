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
FROM nginx:alpine

# Copia os arquivos compilados do estágio anterior para o diretório padrão do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Expõe a porta padrão do servidor web
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
