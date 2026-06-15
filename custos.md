# Análise de Custos de Infraestrutura e Operação: FinanceOS

Este documento detalha os custos operacionais necessários para hospedar, manter e escalar o aplicativo **FinanceOS** (Web, Windows e Android).

---

## 1. Detalhamento dos Componentes de Custo

### A. Domínio e Registro da Marca
- **Domínio `.com.br` (Registro.br)**: R$ 40,00 / ano
- **Domínio `.app` ou `.com` (opcional para internacionalização)**: ~R$ 80,00 - R$ 100,00 / ano
- **Custo anual básico**: **R$ 40,00 / ano** (~R$ 3,33 / mês)

### B. Hospedagem (Web App Frontend)
- **Serviço**: Firebase Hosting (ou Vercel / Netlify / GitHub Pages)
- **Plano Grátis (Spark)**:
  - Armazenamento: Até 10 GB
  - Transferência de dados: Até 360 MB / dia (~10 GB / mês)
  - SSL customizado gratuito.
- **Plano Pago (Blaze - Pay-as-you-go)**:
  - Transferência extra: $0.15 / GB
- **Custo Inicial**: **R$ 0,00 / mês** (a cota gratuita do Firebase é mais do que suficiente para o frontend até atingir dezenas de milhares de acessos mensais).

### C. Banco de Dados (Cloud Firestore)
- **Serviço**: Firebase Firestore
- **Plano Grátis (Spark)**:
  - Armazenamento de dados: 1 GB total.
  - Leituras (Reads): 50.000 / dia
  - Gravações (Writes): 20.000 / dia
  - Exclusões (Deletes): 20.000 / dia
- **Plano Pago (Blaze - Pay-as-you-go)**:
  - Armazenamento: $0.18 / GB / mês
  - Leituras adicionais: $0.06 por cada 100.000 leituras
  - Gravações adicionais: $0.18 por cada 100.000 gravações
- **Custo Inicial**: **R$ 0,00 / mês**.

### D. Autenticação (Firebase Authentication)
- **Serviço**: Firebase Auth (E-mail/Senha e Google Sign-in)
- **Plano**:
  - E-mail e Google Login: Totalmente **grátis** e ilimitados.
  - (Opcional) SMS/Telefone: Primeiro 10.000 SMS/mês são grátis, depois $0.01 a $0.06 por envio.
- **Custo**: **R$ 0,00 / mês** (utilizando e-mail e Google).

### E. Inteligência Artificial (Gemini API)
- **Serviço**: Google AI Studio (Gemini 1.5 Flash / 2.0 Flash)
- **Plano Grátis (Cota de Desenvolvimento)**:
  - Limite: 15 requisições por minuto (RPM) / 1.500 requisições por dia (RPD).
  - Custo: **R$ 0,00** (inclui os dados do usuário para fins de teste e início da operação).
- **Plano Pago (Pay-as-you-go - Produção)**:
  - Gemini 1.5 Flash: $0.075 / 1 milhão de tokens de entrada, $0.30 / 1 milhão de tokens de saída.
  - *Consumo médio estimado por pergunta (com histórico e contexto do usuário)*: ~2.000 tokens de entrada e ~300 tokens de saída.
  - Custo por pergunta: ~$0.00024 (cerca de R$ 0,0012 por pergunta).
- **Custo Inicial**: **R$ 0,00 / mês** (usando a cota grátis com limites).

### F. Contas de Desenvolvedor (Postagem em Lojas)
- **Google Play Store (Android)**: Taxa única de **$25,00** (cerca de R$ 130,00 a R$ 140,00) para criar a conta de desenvolvedor vitalícia.
- **Apple App Store (iOS - opcional futuro)**: Taxa anual de **$99,00 / ano** (cerca de R$ 550,00 / ano).
- **Custo Inicial (Apenas Android)**: **R$ 140,00 (taxa única)**.

### G. Gateway de Pagamentos (Mercado Pago)
- **Modelo**: Checkout Pro (Link de Pagamento).
- **Custo**: Sem mensalidade. O Mercado Pago cobra apenas uma taxa por transação aprovada:
  - Pix (Dinheiro cai na hora): **0,99%** por transação.
  - Cartão de Crédito (Recebimento em 14 dias): **3,99%** por transação.
  - Boleto Bancário: Taxa fixa de R$ 3,49 por boleto pago.

---

## 2. Projeção de Custos por Volume de Usuários

### Cenário A: Início (Até 100 usuários ativos diários)
- **Domínio**: R$ 3,33 / mês
- **Hospedagem & DB (Firebase)**: R$ 0,00 (dentro do plano grátis)
- **Autenticação**: R$ 0,00
- **Inteligência Artificial (Gemini)**: R$ 0,00 (dentro da cota grátis de 1.500 perguntas/dia)
- **Custo Mensal Total**: **R$ 3,33 / mês**

### Cenário B: Crescimento (Até 1.000 usuários ativos diários)
*Estimando que 30% dos usuários utilizem a IA diariamente e gerem cerca de 500 leituras/escritas por dia no DB.*
- **Domínio**: R$ 3,33 / mês
- **Hospedagem & DB (Firebase)**:
  - Leituras: 500.000/dia. Excede o limite grátis em 450.000/dia. Custo: R$ 1,35/dia (~R$ 40,50/mês).
  - Gravações: 100.000/dia. Excede em 80.000/dia. Custo: R$ 0,72/dia (~R$ 21,60/mês).
- **Inteligência Artificial (Gemini - Pago para evitar lentidão)**:
  - 300 perguntas/dia = ~9.000 perguntas/mês.
  - Custo estimado: 9.000 * R$ 0,0012 = R$ 10,80/mês.
- **Custo Mensal Total**: **R$ 76,23 / mês**
*Nota: Com 1.000 usuários, se apenas 2% assinarem o plano Plus (R$ 14,90/mês), a receita será de R$ 298,00/mês, cobrindo com folga a infraestrutura.*

### Cenário C: Escala (Até 10.000 usuários ativos diários)
*Estimando 200.000 gravações e 5.000.000 de leituras diárias no banco de dados. 3.000 perguntas de IA por dia.*
- **Domínio**: R$ 3,33 / mês
- **Hospedagem & DB (Firebase Blaze)**:
  - Leituras extras: ~R$ 450,00 / mês
  - Gravações extras: ~R$ 162,00 / mês
  - Armazenamento de dados (~20 GB): ~R$ 20,00 / mês
- **Inteligência Artificial (Gemini Pay-as-you-go)**:
  - 90.000 perguntas/mês: ~R$ 108,00 / mês
- **Custo Mensal Total**: **R$ 743,33 / mês**
*Nota: Com 10.000 usuários ativos e uma taxa de conversão conservadora de 1.5% para o plano Plus/Pro (média de R$ 19,90/assinante), a receita mensal estimada seria de R$ 2.985,00, deixando um lucro líquido operacional expressivo.*
