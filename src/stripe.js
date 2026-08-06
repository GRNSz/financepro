import { S, save } from './state.js';
import { currentUser } from './firebase.js';

// Chave Pública de Produção do Stripe
export const STRIPE_PUBLISHABLE_KEY = 'pk_live_51U0WYiEOM2MTcccwvfY29Cjl1Py6EcPKvUnUIDKz6kgBKt2vfOTuKssS4n7DV5huB7ko0McD9zKAg6AKBMIlZXMo00TsEtVxtZ';

/**
 * Mapeamento dos produtos da Stripe para diferenciar Plus e Pro.
 * Substitua as propriedades 'monthlyLink' / 'yearlyLink' ou 'priceIdMonthly' / 'priceIdYearly'
 * com os links ou Price IDs criados no seu painel Stripe (Produtos -> Preços).
 */
export const STRIPE_PRODUCTS = {
  plus: {
    name: 'Plano Plus',
    monthlyLink: 'https://buy.stripe.com/8x26oH3x4gCd48d3CedjO00',
    yearlyLink:  'https://buy.stripe.com/8x26oH3x4gCd48d3CedjO00',
    priceIdMonthly: '',
    priceIdYearly:  ''
  },
  pro: {
    name: 'Plano Pro',
    monthlyLink: 'https://buy.stripe.com/6oU7sL8Ro99LbAFegSdjO01',
    yearlyLink:  'https://buy.stripe.com/6oU7sL8Ro99LbAFegSdjO01',
    priceIdMonthly: '',
    priceIdYearly:  ''
  }
};

/**
 * Redireciona o usuário para a página de checkout da Stripe correspondente ao plano selecionado.
 * Diferencia automaticamente entre o Plano PLUS e PRO (Mensal ou Anual).
 */
export function ensureStripeLoaded() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = () => resolve(window.Stripe);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function redirectToStripeCheckout(plan, isYearly = false) {
  const prod = STRIPE_PRODUCTS[plan];
  if (!prod) {
    alert('Plano inválido.');
    return;
  }

  // Grava o checkout pendente no localStorage para garantir a ativação caso a Stripe redirecione sem query params
  try {
    localStorage.setItem('financepro_pending_stripe_checkout', JSON.stringify({
      plan: plan,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error('Erro ao gravar checkout pendente:', e);
  }

  const priceId = isYearly ? prod.priceIdYearly : prod.priceIdMonthly;
  const paymentLink = isYearly ? prod.yearlyLink : prod.monthlyLink;

  // 1. Se foi informado um Price ID
  if (priceId && priceId.trim() !== '') {
    try {
      await ensureStripeLoaded();
      if (window.Stripe) {
        const stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
        const email = currentUser?.email || '';
        const uid = currentUser?.uid || '';

        const sessionConfig = {
          lineItems: [{ price: priceId, quantity: 1 }],
          mode: 'subscription',
          successUrl: `${window.location.origin}${window.location.pathname}?stripe_status=success&plan=${plan}`,
          cancelUrl: `${window.location.origin}${window.location.pathname}?stripe_status=cancel`,
        };

        if (email) sessionConfig.customerEmail = email;
        if (uid) sessionConfig.clientReferenceId = uid;

        const result = await stripe.redirectToCheckout(sessionConfig);
        if (result.error) {
          alert(`Erro no checkout Stripe: ${result.error.message}`);
        }
        return;
      }
    } catch (err) {
      console.error('Erro ao redirecionar com Stripe.js:', err);
    }
  }

  // 2. Se houver um Link de Pagamento Direto (Stripe Payment Link)
  if (paymentLink && paymentLink.trim() !== '') {
    // Segurança: valida que o link pertence ao domínio oficial da Stripe (anti open-redirect)
    let parsedLink;
    try {
      parsedLink = new URL(paymentLink.trim());
    } catch {
      console.error('URL do Stripe inválida:', paymentLink);
      return;
    }
    const ALLOWED_STRIPE_DOMAINS = ['buy.stripe.com', 'checkout.stripe.com', 'stripe.com'];
    const isStripeUrl = ALLOWED_STRIPE_DOMAINS.some(d => parsedLink.hostname === d || parsedLink.hostname.endsWith('.' + d));
    if (!isStripeUrl) {
      console.error('URL de destino não é um domínio Stripe válido:', parsedLink.hostname);
      return;
    }

    const email = currentUser?.email || '';
    const uid   = currentUser?.uid   || '';

    // Anexa email do usuário e id de referência para vincular após o pagamento
    const separator = parsedLink.search ? '&' : '?';
    let targetUrl = paymentLink.trim();
    if (email) targetUrl += `${separator}prefilled_email=${encodeURIComponent(email)}`;
    if (uid)   targetUrl += `&client_reference_id=${encodeURIComponent(uid)}`;

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // Se nenhum link de pagamento for encontrado, exibe alerta e NÃO ativa nada
  alert(`Aviso: O link de checkout da Stripe para o ${prod.name} ainda não foi configurado.`);
}

// Flag para evitar que handleStripeReturn seja processado mais de uma vez por sessão
let stripeReturnProcessed = false;

/**
 * Captura o retorno do Stripe Checkout APENAS SE HOUVER CONFIRMAÇÃO DE SUCESSO.
 * Exige estritamente ?stripe_status=success&plan=... retornado pela Stripe.
 */
export function handleStripeReturn() {
  if (stripeReturnProcessed) return;

  const params = new URLSearchParams(window.location.search);
  const urlStatus = params.get('stripe_status');
  const urlPlan = params.get('plan');

  // Se o usuário cancelou ou voltou sem concluir o pagamento na Stripe, limpa pendências e sai imediatamente
  if (urlStatus === 'cancel' || (urlStatus && urlStatus !== 'success')) {
    localStorage.removeItem('financepro_pending_stripe_checkout');
    localStorage.removeItem('poupafy_pending_stripe_checkout');
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    return;
  }

  // ATIVAÇÃO ESTRITA: Exige ?stripe_status=success E um plano válido ('plus' ou 'pro')
  const VALID_PLANS = ['plus', 'pro'];
  if (urlStatus !== 'success' || !urlPlan || !VALID_PLANS.includes(urlPlan)) {
    // Se não há confirmação explícita de sucesso vinda da Stripe, descarta qualquer pendência local e NÃO ativa nada
    localStorage.removeItem('financepro_pending_stripe_checkout');
    localStorage.removeItem('poupafy_pending_stripe_checkout');
    return;
  }

  stripeReturnProcessed = true;
  const targetPlan = urlPlan;

  // Limpa os registros de checkout pendente
  localStorage.removeItem('financepro_pending_stripe_checkout');
  localStorage.removeItem('poupafy_pending_stripe_checkout');

  // Limpa os parâmetros de sucesso da URL
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);

  const expDays = targetPlan === 'pro' ? 365 : 30;
  const expiresAt = Date.now() + expDays * 24 * 60 * 60 * 1000;
  S.subscription = {
    plan: targetPlan,
    expiresAt: expiresAt,
    status: 'active',
    aiQueriesUsed: S.subscription?.aiQueriesUsed || 0,
    aiQueriesResetMonth: new Date().toISOString().substring(0, 7)
  };

  // Grava o registro de assinatura ativada por confirmação oficial
  try {
    localStorage.setItem('poupafy_active_subscription', JSON.stringify({
      plan: targetPlan,
      expiresAt: expiresAt,
      status: 'active'
    }));
  } catch (e) {
    console.error('Erro ao gravar poupafy_active_subscription:', e);
  }

  // Persiste localmente e dispara a sincronização com o Firestore na nuvem
  save();

  // Atualiza todos os elementos visuais da aplicação e navega para o Perfil
  if (window.renderSubscriptionInfo) window.renderSubscriptionInfo();
  if (window.renderDashboard) window.renderDashboard();
  if (window.renderPerfil) window.renderPerfil();

  // Redireciona para a tela de Perfil para o usuário ver o selo do plano ativo
  if (window.navigate) {
    window.navigate('perfil');
  }

  // Toast de comemoração
  setTimeout(() => {
    const planName = targetPlan === 'pro' ? 'Pro 🏆' : 'Plus 🚀';
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:16px 24px;border-radius:14px;font-size:14px;font-weight:700;box-shadow:0 12px 30px rgba(0,0,0,0.5);z-index:99999;animation:fadeup 0.4s ease;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.2);';
    toast.innerHTML = `🎉 <b>Assinatura Ativada!</b><br>Seu plano <b>${planName}</b> foi ativado com sucesso!`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 7000);
  }, 400);
}

// Link opcional do Portal do Cliente Stripe para gerenciar/cancelar assinaturas ativas na Stripe
export const STRIPE_CUSTOMER_PORTAL_URL = 'https://billing.stripe.com/p/login/test_...'; // Cole o link do seu portal Stripe se ativado

/**
 * Calcula o tempo restante da assinatura em dias e data formatada
 */
export function getSubscriptionTimeRemaining() {
  const expiresAt = S.subscription?.expiresAt;
  if (!expiresAt) return { days: 0, formattedDate: '—', hasTime: false };

  const diffMs = expiresAt - Date.now();
  const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const dateObj = new Date(expiresAt);
  const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;

  return { days, formattedDate, hasTime: days > 0 };
}

/**
 * Abre o Modal Glassmorphism de Confirmação de Cancelamento
 */
export function openCancelSubscriptionModal() {
  const currentPlan = S.subscription?.plan || 'free';
  if (currentPlan === 'free') {
    alert('Você está no Plano Gratuito.');
    return;
  }

  const { days, formattedDate } = getSubscriptionTimeRemaining();
  const daysEl = document.getElementById('cancel-days-remaining');
  const detailsEl = document.getElementById('cancel-period-details');

  if (daysEl) daysEl.textContent = `${days} ${days === 1 ? 'dia restante' : 'dias restantes'}`;
  if (detailsEl) detailsEl.textContent = `Acesso garantido até ${formattedDate}`;

  openM('m-cancel-subscription');
}

/**
 * Executa o cancelamento definitivo da assinatura
 */
export function cancelStripeSubscription() {
  const currentPlan = S.subscription?.plan || 'free';
  if (currentPlan === 'free') return;

  // Limpa o registro permanente de assinatura no localStorage
  localStorage.removeItem('poupafy_active_subscription');
  localStorage.removeItem('financepro_pending_stripe_checkout');
  localStorage.removeItem('poupafy_pending_stripe_checkout');

  // Cancela a assinatura localmente e na nuvem
  S.subscription = {
    plan: 'free',
    expiresAt: null,
    status: 'cancelled',
    aiQueriesUsed: 0,
    aiQueriesResetMonth: new Date().toISOString().substring(0, 7)
  };
  save();

  // Sincroniza com a nuvem (Firebase Firestore)
  if (currentUser && window.syncUserDataToCloud) {
    window.syncUserDataToCloud();
  }

  closeM('m-cancel-subscription');

  // Atualiza a interface
  if (window.renderSubscriptionInfo) window.renderSubscriptionInfo();
  if (window.renderPerfil) window.renderPerfil();

  // Toast Informativo em Glassmorphism
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:rgba(239,68,68,0.9);backdrop-filter:blur(12px);color:#fff;padding:16px 24px;border-radius:14px;font-size:13px;font-weight:700;box-shadow:0 12px 30px rgba(0,0,0,0.5);z-index:99999;animation:fadeup 0.4s ease;border:1px solid rgba(255,255,255,0.2);';
  toast.innerHTML = `⚠️ <b>Assinatura Cancelada na Stripe</b><br>As cobranças foram interrompidas e o plano foi alterado para Grátis.`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

if (typeof window !== 'undefined') {
  window.openCancelSubscriptionModal = openCancelSubscriptionModal;
  window.cancelStripeSubscription = cancelStripeSubscription;
}
