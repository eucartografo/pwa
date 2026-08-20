// ══════════════════════════════════════════════════════════
//  APP PRINCIPAL — autenticação, navegação, ciclo de vida
// ══════════════════════════════════════════════════════════

const App = (() => {

  let _currentPage = 'painel';
  let _token = null;

  const PAGE_TITLES = {
    painel: 'Painel', contas: 'Contas', receitas: 'Receitas',
    despesas: 'Despesas', orcamento: 'Orçamento', cartao: 'Cartão',
    dividas: 'Dívidas', metas: 'Metas',
  };

  const PAGE_RENDERERS = {
    painel:    Pages.renderPainel,
    contas:    Pages.renderContas,
    receitas:  Pages.renderReceitas,
    despesas:  Pages.renderDespesas,
    orcamento: Pages.renderOrcamento,
    cartao:    Pages.renderCartao,
    dividas:   Pages.renderDividas,
    metas:     Pages.renderMetas,
  };

  // ── Navegação ─────────────────────────────────────────
  function navigateTo(page) {
    if (page === _currentPage) return;

    // Atualiza estado visual
    document.querySelectorAll('.nav-item, .bn-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;

    _currentPage = page;
    loadPage(page);
  }

  function loadPage(page) {
    const el = document.getElementById(`page-${page}`);
    const renderer = PAGE_RENDERERS[page];
    if (renderer) renderer(el);
  }

  // ── Autenticação Google ───────────────────────────────
  function initGoogleAuth() {
    // Aguarda o script GSI carregar
    const tryInit = () => {
      if (typeof google === 'undefined') {
        setTimeout(tryInit, 200); return;
      }

      google.accounts.id.initialize({
        client_id: CONFIG.CLIENT_ID,
        callback: handleCredential,
        auto_select: true,
      });

      google.accounts.id.renderButton(
        document.getElementById('google-btn-container'),
        { theme: 'outline', size: 'large', width: 280, text: 'signin_with', shape: 'pill' }
      );

      // Tenta login automático
      google.accounts.id.prompt();
    };
    tryInit();
  }

  function handleCredential(response) {
    const payload = parseJwt(response.credential);

    // Verificar se é um e-mail autorizado
    if (!CONFIG.ALLOWED_EMAILS.includes(payload.email)) {
      alert(`Acesso negado.\n\nEste app é exclusivo da família.\nConta usada: ${payload.email}`);
      return;
    }

    // Obter token de acesso para a Sheets API
    google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      callback: (tokenResponse) => {
        _token = tokenResponse.access_token;
        Sheets.setToken(_token);
        onLoginSuccess(payload);
      }
    }).requestAccessToken();
  }

  async function onLoginSuccess(payload) {
    // Atualiza UI do usuário
    const name = payload.given_name || payload.name || payload.email;
    document.getElementById('user-name').textContent = name;

    const avatar = payload.picture || '';
    document.getElementById('user-avatar').src = avatar;
    document.getElementById('user-avatar-mobile').src = avatar;

    // Mostra o app
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-app').classList.add('active');

    // Verifica/inicializa a planilha
    try {
      await Sheets.initSpreadsheet();
    } catch (e) {
      console.warn('initSpreadsheet:', e);
    }

    // Carrega a página inicial
    loadPage('painel');

    // Auto-refresh a cada 5 minutos
    setInterval(() => {
      if (document.visibilityState === 'visible') loadPage(_currentPage);
    }, 5 * 60 * 1000);
  }

  function logout() {
    google.accounts.id.disableAutoSelect();
    _token = null;
    document.getElementById('screen-app').classList.remove('active');
    document.getElementById('screen-login').classList.add('active');
  }

  // ── Utils ─────────────────────────────────────────────
  function parseJwt(token) {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  }

  // ── Service Worker (PWA) ──────────────────────────────
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(r => {
        console.log('SW registrado:', r.scope);
      }).catch(e => console.log('SW erro:', e));
    }
  }

  // ── Init ──────────────────────────────────────────────
  function init() {
    // Bind navegação
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.page));
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', Pages.closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) Pages.closeModal();
    });

    // Refresh button
    document.getElementById('btn-refresh').addEventListener('click', () => {
      Pages.toast('Atualizando…');
      loadPage(_currentPage);
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', logout);

    // Auth
    initGoogleAuth();

    // PWA
    registerSW();
  }

  return { init, navigateTo };
})();

// Inicia quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', App.init);
