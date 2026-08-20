// ══════════════════════════════════════════════════════════
//  APP PRINCIPAL — autenticação, navegação, ciclo de vida
// ══════════════════════════════════════════════════════════

const App = (() => {

  let _currentPage = 'painel';
  let _token = null;
  let _tokenClient = null;
  let _tokenExpiry = 0;       // timestamp de expiração do access token
  let _userPayload = null;    // dados do usuário logado

  const STORAGE_KEY = 'familia_user'; // chave no localStorage

  const PAGE_TITLES = {
    painel: 'Painel', saude: 'Saúde Financeira', contas: 'Contas',
    receitas: 'Receitas', despesas: 'Despesas', orcamento: 'Orçamento',
    cartao: 'Cartão', dividas: 'Dívidas', metas: 'Metas', relatorio: 'Relatório Mensal',
  };

  const PAGE_RENDERERS = {
    painel:    Pages.renderPainel,
    saude:     Pages.renderSaude,
    contas:    Pages.renderContas,
    receitas:  Pages.renderReceitas,
    despesas:  Pages.renderDespesas,
    orcamento: Pages.renderOrcamento,
    cartao:    Pages.renderCartao,
    dividas:   Pages.renderDividas,
    metas:     Pages.renderMetas,
    relatorio: Pages.renderRelatorio,
  };

  // ── Navegação ─────────────────────────────────────────
  function navigateTo(page) {
    if (page === _currentPage) return;

    document.querySelectorAll('.nav-item, .bn-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;

    _currentPage = page;
    loadPage(page);
  }

  async function loadPage(page) {
    // Renova token se estiver perto de expirar (menos de 5 min)
    if (_token && Date.now() > _tokenExpiry - 5 * 60 * 1000) {
      await refreshTokenSilent();
    }
    const el = document.getElementById(`page-${page}`);
    const renderer = PAGE_RENDERERS[page];
    if (renderer) renderer(el);
  }

  // ── Token: renovação silenciosa ──────────────────────
  function refreshTokenSilent() {
    return new Promise((resolve) => {
      if (!_tokenClient) { resolve(); return; }
      // prompt: '' = silencioso, sem popup de confirmação
      _tokenClient.requestAccessToken({ prompt: '' });
      // resolve imediatamente; o callback do tokenClient vai atualizar _token
      setTimeout(resolve, 1000);
    });
  }

  // ── Autenticação Google ───────────────────────────────
  function initGoogleAuth() {
    const tryInit = () => {
      if (typeof google === 'undefined') { setTimeout(tryInit, 200); return; }

      // Inicializa o cliente de ID (para o botão "Entrar com Google")
      google.accounts.id.initialize({
        client_id: CONFIG.CLIENT_ID,
        callback: handleCredential,
        auto_select: true,          // tenta login automático se já logou antes
        cancel_on_tap_outside: false,
      });

      google.accounts.id.renderButton(
        document.getElementById('google-btn-container'),
        { theme: 'outline', size: 'large', width: 280, text: 'signin_with', shape: 'pill' }
      );

      // Tenta login automático (One Tap)
      google.accounts.id.prompt((notification) => {
        // Se o One Tap não funcionar (usuário dispensou antes),
        // tenta restaurar sessão salva do localStorage
        if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
          tryRestoreSession();
        }
      });
    };
    tryInit();
  }

  // ── Restaurar sessão salva ────────────────────────────
  function tryRestoreSession() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved);
      // Verifica se o e-mail ainda é autorizado
      if (!CONFIG.ALLOWED_EMAILS.includes(data.email)) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      // Sessão salva válida — renova o token silenciosamente
      _userPayload = data;
      setupTokenClient(data, /* silent= */ true);
    } catch(e) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // ── Recebe credencial do botão Google ─────────────────
  function handleCredential(response) {
    const payload = parseJwt(response.credential);

    if (!CONFIG.ALLOWED_EMAILS.includes(payload.email)) {
      alert(`Acesso negado.\n\nEste app é exclusivo da família.\nConta usada: ${payload.email}`);
      return;
    }

    // Salva dados do usuário no localStorage para restaurar sessão
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      email: payload.email,
      name:  payload.given_name || payload.name || payload.email,
      picture: payload.picture || '',
    }));

    _userPayload = payload;
    setupTokenClient(payload, /* silent= */ false);
  }

  // ── Configura o cliente OAuth2 para o Sheets ──────────
  function setupTokenClient(userInfo, silent) {
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      hint: userInfo.email,       // pré-seleciona a conta correta
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          // Token falhou — mostra tela de login
          showLogin();
          return;
        }
        _token = tokenResponse.access_token;
        // Tokens do Google duram 1 hora (3600s)
        _tokenExpiry = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
        Sheets.setToken(_token);

        // Se já temos os dados do usuário, entra direto
        if (_userPayload || userInfo) {
          onLoginSuccess(userInfo);
        }
      },
    });

    // silent = restaurando sessão (sem popup)
    // !silent = primeiro login (pode mostrar popup de conta)
    _tokenClient.requestAccessToken({ prompt: silent ? 'none' : '' });
  }

  // ── Após login bem-sucedido ────────────────────────────
  async function onLoginSuccess(userInfo) {
    const name    = userInfo.given_name || userInfo.name || userInfo.email;
    const picture = userInfo.picture || '';

    document.getElementById('user-name').textContent = name;
    document.getElementById('user-avatar').src = picture;
    document.getElementById('user-avatar-mobile').src = picture;

    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-app').classList.add('active');

    try { await Sheets.initSpreadsheet(); } catch(e) { console.warn(e); }

    loadPage('painel');

    // Renova token automaticamente a cada 50 minutos (antes de expirar)
    setInterval(refreshTokenSilent, 50 * 60 * 1000);

    // Auto-refresh dos dados a cada 5 minutos
    setInterval(() => {
      if (document.visibilityState === 'visible') loadPage(_currentPage);
    }, 5 * 60 * 1000);
  }

  function showLogin() {
    document.getElementById('screen-app').classList.remove('active');
    document.getElementById('screen-login').classList.add('active');
  }

  // ── Logout ────────────────────────────────────────────
  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    _token = null;
    _userPayload = null;
    _tokenExpiry = 0;
    google.accounts.id.disableAutoSelect();
    showLogin();
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
      navigator.serviceWorker.register('sw.js')
        .then(r => console.log('SW:', r.scope))
        .catch(e => console.log('SW erro:', e));
    }
  }

  // ── Init ──────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.page));
    });

    document.getElementById('modal-close').addEventListener('click', Pages.closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) Pages.closeModal();
    });

    document.getElementById('btn-refresh').addEventListener('click', () => {
      Pages.toast('Atualizando…');
      loadPage(_currentPage);
    });

    document.getElementById('btn-logout').addEventListener('click', logout);

    initGoogleAuth();
    registerSW();
  }

  return { init, navigateTo };
})();

document.addEventListener('DOMContentLoaded', App.init);
