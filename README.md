# 💸 FinanceOS - Controle Financeiro Premium

[![Vite Build](https://img.shields.io/badge/Vite-5.x-blueviolet?logo=vite)](https://vitejs.dev/)
[![Firebase Support](https://img.shields.io/badge/Firebase-v10.x-orange?logo=firebase)](https://firebase.google.com/)
[![Docker Deployment](https://img.shields.io/badge/Docker-Supported-blue?logo=docker)](https://www.docker.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](https://opensource.org/licenses/ISC)

O **FinanceOS** é um web app premium e elegante de controle financeiro pessoal, desenvolvido sob a arquitetura **Offline-First**. Ele funciona de maneira totalmente local com cache inteligente do navegador e sincroniza em tempo real com o Firestore (Firebase) assim que o login é efetuado.

Seu design é responsivo, polido e moderno, oferecendo uma experiência digna de aplicativo nativo de celular.

---

## ✨ Recursos Principais

### 📊 Dashboard & Saúde Financeira
- **Resumo Inteligente:** KPIs de saldo geral consolidado, receitas, despesas e dinheiro economizado.
- **Gráficos Interativos:** Fluxo de caixa visual alimentado pelo Chart.js (com filtros de período).
- **Regra 50/30/20:** Diagnóstico automático do seu estilo de vida com base nas categorias de gastos (Necessidades, Desejos e Poupança).

### 📋 Lançamentos Avançados
- **Lançamentos Fáceis:** Cadastro de receitas/despesas com categorias personalizadas, contas bancárias e cartões de crédito.
- **Parcelamento Inteligente:** Divisão de compras parceladas distribuídas automaticamente nos meses futuros.
- **Recorrência Periódica:** Agendamento automático de despesas/receitas fixas semanais e mensais para os próximos 6 meses.
- **Tags & Projetos:** Marcadores para agrupar despesas de projetos específicos (ex: `reforma`, `viagem`).
- **Conversão de Câmbio:** Registre transações internacionais em moedas como USD/EUR e acompanhe o valor convertido na moeda padrão (BRL).

### 📅 Agenda & Calendário
- **Visualização em Grade:** Acompanhe o vencimento de contas de forma visual dia a dia.
- **Integração Google Agenda:** Atalho direto para agendar despesas pendentes no calendário do Google com um clique.
- **Exportação (.ICS):** Baixe o calendário de despesas de qualquer período para integrar em apps externos (como Outlook ou Apple Calendar).

### 🏆 Gamificação & Poupança (Novo!)
- **Prateleira de Selos:** Conquiste distintivos exclusivos (Poupador Fiel, Agente Secreto, etc.) baseados em hábitos reais.
- **Desafio das 52 Semanas:** Desafio progressivo de poupança com multiplicadores customizáveis (1x, 2x, 5x e 10x) e geração automática de lançamentos financeiros.

### 🛡️ Privacidade & Configurações
- **Modo Stealth:** Esconda todos os saldos e valores da tela instantaneamente com um clique (privacidade em público).
- **Notificações Push:** Alertas no navegador para contas a vencer.
- **Exportação e Importação:** Backup completo em formato JSON ou relatórios automatizados gerados em PDF e CSV.

---

## 🛠️ Arquitetura e Tecnologias

- **Frontend:** Vanilla HTML5, Vanilla CSS3 (Custom Properties e temas dinâmicos) e Javascript Moderno (ESModules).
- **Ferramenta de Build:** [Vite](https://vite.dev/) para empacotamento ultrarrápido.
- **Bando de Dados & Auth:** [Firebase Firestore](https://firebase.google.com/) para nuvem (sincronização opcional) e cache seguro no `localStorage` local.
- **Gráficos:** [Chart.js](https://www.chartjs.org/).
- **Relatórios:** [jsPDF](https://github.com/parallax/jsPDF) e [SheetJS](https://sheetjs.com/).

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [npm](https://www.npmjs.com/)

### 1. Clonar o Repositório e Instalar Dependências
```bash
# Clone este repositório
git clone https://github.com/seu-usuario/controle-financeiro.git

# Acesse o diretório
cd "controle-financeiro"

# Instale as dependências
npm install
```

### 2. Rodar o Servidor de Desenvolvimento (Vite)
```bash
npm run dev
```
O projeto estará disponível por padrão em `http://localhost:5173`.

### 3. Compilar para Produção
```bash
npm run build
```
Os arquivos otimizados serão compilados dentro da pasta `/dist`.

---

## 🐳 Executando com Docker

Se preferir rodar em um ambiente isolado com Nginx:

```bash
# Construir a imagem e iniciar o container
docker compose up -d --build
```
O aplicativo estará disponível na porta `8080`: `http://localhost:8080`.

---

## 📱 Futuro Lançamento: APK Android

Estamos trabalhando ativamente para expandir o **FinanceOS** para dispositivos móveis! Em breve, lançaremos um instalador **APK nativo para Android** utilizando empacotadores híbridos (Capacitor/Cordova), permitindo o uso com suporte completo a notificações push nativas do sistema operacional, widget na tela inicial e acesso offline offline-first ainda mais fluido.

Acompanhe as próximas releases no GitHub para ter acesso ao APK assim que disponível!

---

## 📝 Licença

Este projeto é distribuído sob a licença **ISC**. Veja o arquivo `LICENSE` para mais detalhes (caso aplicável).
