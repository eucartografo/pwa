// ══════════════════════════════════════════════════════════
//  PÁGINAS — renderização de cada seção
// ══════════════════════════════════════════════════════════

const Pages = (() => {

  // ─── Utilidades ───────────────────────────────────────
  const fmt = v => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v || 0);
  const fmtPct = v => (v * 100).toFixed(1) + '%';
  const todayISO = () => new Date().toISOString().split('T')[0];
  const mesAtual = () => new Date().getMonth() + 1;
  const anoAtual = () => new Date().getFullYear();

  function fmtDate(iso) {
    if (!iso) return '';
    const [y,m,d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  }

  function filtrarMesAtual(items, campo = 'data') {
    const m = mesAtual(), a = anoAtual();
    return items.filter(i => {
      if (!i[campo]) return false;
      const [y,mo] = i[campo].split('-').map(Number);
      return y === a && mo === m;
    });
  }

  // ─── SELECT helpers ───────────────────────────────────
  function selectOptions(arr, selected = '') {
    return arr.map(o => `<option value="${o}" ${o === selected ? 'selected' : ''}>${o}</option>`).join('');
  }

  // ─── PAINEL ───────────────────────────────────────────
  async function renderPainel(el) {
    el.innerHTML = skeletonPainel();
    try {
      const [recRows, despRows, contRows, metRows] = await Promise.all([
        Sheets.readAll(CONFIG.SHEETS.RECEITAS),
        Sheets.readAll(CONFIG.SHEETS.DESPESAS),
        Sheets.readAll(CONFIG.SHEETS.CONTAS),
        Sheets.readAll(CONFIG.SHEETS.METAS),
      ]);
      const receitas  = Sheets.parseReceitas(recRows);
      const despesas  = Sheets.parseDespesas(despRows);
      const contas    = Sheets.parseContas(contRows);
      const metas     = Sheets.parseMetas(metRows);

      const recMes    = filtrarMesAtual(receitas).reduce((s,i) => s + i.valor, 0);
      const despMes   = filtrarMesAtual(despesas).reduce((s,i) => s + i.valor, 0);
      const saldoMes  = recMes - despMes;
      const saldoTotal = contas.reduce((s,c) => s + c.saldo, 0);
      const reserva   = contas.find(c => c.nome === 'Reserva de Emergência')?.saldo || 0;
      const totalDavi  = filtrarMesAtual(despesas).filter(d => d.para === 'Davi').reduce((s,i) => s + i.valor, 0);
      const totalLuisa = filtrarMesAtual(despesas).filter(d => d.para === 'Luísa').reduce((s,i) => s + i.valor, 0);

      const recentes = [...filtrarMesAtual(receitas).slice(-3).map(i => ({...i, tipo:'rec'})),
                        ...filtrarMesAtual(despesas).slice(-3).map(i => ({...i, tipo:'desp'}))]
        .sort((a,b) => b.data.localeCompare(a.data)).slice(0, 6);

      el.innerHTML = `
        <p class="text-xs text-gray mb-12">${new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</p>

        <div class="kpi-grid">
          <div class="kpi-card kpi-green">
            <div class="kpi-label">Receitas do Mês</div>
            <div class="kpi-value">${fmt(recMes)}</div>
          </div>
          <div class="kpi-card kpi-red">
            <div class="kpi-label">Despesas do Mês</div>
            <div class="kpi-value">${fmt(despMes)}</div>
          </div>
          <div class="kpi-card ${saldoMes >= 0 ? 'kpi-blue' : 'kpi-orange'}">
            <div class="kpi-label">Saldo do Mês</div>
            <div class="kpi-value">${fmt(saldoMes)}</div>
          </div>
          <div class="kpi-card kpi-navy">
            <div class="kpi-label">Saldo em Contas</div>
            <div class="kpi-value">${fmt(saldoTotal)}</div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card kpi-teal">
            <div class="kpi-label">Reserva de Emergência</div>
            <div class="kpi-value">${fmt(reserva)}</div>
          </div>
          <div class="kpi-card kpi-gray">
            <div class="kpi-label">Gastos c/ Davi</div>
            <div class="kpi-value">${fmt(totalDavi)}</div>
          </div>
          <div class="kpi-card kpi-gray">
            <div class="kpi-label">Gastos c/ Luísa</div>
            <div class="kpi-value">${fmt(totalLuisa)}</div>
          </div>
          <div class="kpi-card kpi-gold">
            <div class="kpi-label">Total c/ Crianças</div>
            <div class="kpi-value">${fmt(totalDavi + totalLuisa)}</div>
          </div>
        </div>

        <p class="section-title">Lançamentos Recentes</p>
        ${recentes.length ? `<div class="tx-list">
          ${recentes.map(i => `
            <div class="tx-item">
              <div class="tx-icon ${i.tipo === 'rec' ? 'income' : 'expense'}">
                <svg viewBox="0 0 24 24">${i.tipo === 'rec'
                  ? '<path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>'
                  : '<path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8z"/>'}</svg>
              </div>
              <div class="tx-info">
                <div class="tx-desc">${i.desc || i.cat}</div>
                <div class="tx-meta">${fmtDate(i.data)} · ${i.cat}</div>
              </div>
              <div class="tx-amount ${i.tipo === 'rec' ? 'income' : 'expense'}">${i.tipo === 'rec' ? '+' : '-'}${fmt(i.valor)}</div>
            </div>
          `).join('')}
        </div>` : '<div class="empty-state"><p>Nenhum lançamento neste mês</p></div>'}

        ${metas.length ? `
          <p class="section-title">Progresso das Metas</p>
          ${metas.slice(0,3).map(m => {
            const pct = m.meta > 0 ? Math.min(m.guardado / m.meta, 1) : 0;
            const warn = pct < .3 ? 'danger' : pct < .7 ? 'warn' : '';
            return `<div class="meta-card">
              <div class="meta-header">
                <div class="meta-name">${m.nome}</div>
                <div class="meta-pct">${fmtPct(pct)}</div>
              </div>
              <div class="progress-bar"><div class="progress-fill ${warn}" style="width:${pct*100}%"></div></div>
              <div class="meta-values"><span>${fmt(m.guardado)} guardado</span><span>Meta: ${fmt(m.meta)}</span></div>
            </div>`;
          }).join('')}
        ` : ''}
      `;
    } catch(e) {
      el.innerHTML = `<div class="notice"><strong>Erro ao carregar dados.</strong> Verifique a conexão e as configurações.</div>`;
      console.error(e);
    }
  }

  function skeletonPainel() {
    return `
      <div class="kpi-grid">${[1,2,3,4].map(() => '<div class="skeleton skel-kpi"></div>').join('')}</div>
      <div class="kpi-grid">${[1,2,3,4].map(() => '<div class="skeleton skel-kpi"></div>').join('')}</div>
      <p class="section-title">Lançamentos Recentes</p>
      ${[1,2,3].map(() => '<div class="skeleton skel-row"></div>').join('')}
    `;
  }

  // ─── CONTAS ───────────────────────────────────────────
  async function renderContas(el) {
    el.innerHTML = '<div class="skeleton skel-row"></div>'.repeat(4);
    try {
      const rows  = await Sheets.readAll(CONFIG.SHEETS.CONTAS);
      const contas = Sheets.parseContas(rows);
      const total  = contas.reduce((s,c) => s + c.saldo, 0);

      el.innerHTML = `
        <div class="flex justify-between items-center mb-12">
          <p class="section-title" style="margin:0">Suas Contas</p>
          <button class="btn btn-primary btn-sm" onclick="Pages.openEditarContas()">Atualizar Saldos</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Conta</th><th>Responsável</th><th class="text-right">Saldo</th></tr></thead>
            <tbody>
              ${contas.map(c => `
                <tr>
                  <td><strong>${c.nome}</strong></td>
                  <td><span class="badge badge-blue">${c.resp}</span></td>
                  <td class="td-num ${c.saldo < 0 ? 'text-red' : 'text-green'}">${fmt(c.saldo)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot><tr>
              <td colspan="2"><strong>SALDO TOTAL</strong></td>
              <td class="td-num ${total < 0 ? 'text-red' : ''}">${fmt(total)}</td>
            </tr></tfoot>
          </table>
        </div>
      `;
    } catch(e) { el.innerHTML = erro(e); }
  }

  window._contasRows = null;
  async function openEditarContas() {
    const rows  = await Sheets.readAll(CONFIG.SHEETS.CONTAS);
    const contas = Sheets.parseContas(rows);
    window._contasRows = contas;

    openModal('Atualizar Saldos', `
      <p class="text-sm text-gray mb-12">Insira o saldo atual de cada conta:</p>
      ${contas.map((c, i) => `
        <div class="form-group">
          <label class="form-label">${c.nome} <span class="text-gray">(${c.resp})</span></label>
          <input class="form-control" type="number" step="0.01" id="saldo_${i}" value="${c.saldo}" placeholder="0,00">
        </div>
      `).join('')}
    `, [
      { label:'Salvar', cls:'btn-primary', action: async () => {
        for (let i = 0; i < contas.length; i++) {
          const v = parseFloat(document.getElementById(`saldo_${i}`).value) || 0;
          await Sheets.update(CONFIG.SHEETS.CONTAS, `C${contas[i]._row}`, [[v]]);
        }
        toast('Saldos atualizados!', 'success');
        closeModal();
        renderContas(document.getElementById('page-contas'));
      }}
    ]);
  }

  // ─── RECEITAS ─────────────────────────────────────────
  async function renderReceitas(el) {
    el.innerHTML = '<div class="skeleton skel-row"></div>'.repeat(5);
    try {
      const rows = await Sheets.readAll(CONFIG.SHEETS.RECEITAS);
      const items = Sheets.parseReceitas(rows);
      const mesFiltro = mesAtual(), anoFiltro = anoAtual();
      const mes = items.filter(i => {
        if (!i.data) return false;
        const [y,m] = i.data.split('-').map(Number);
        return y === anoFiltro && m === mesFiltro;
      });
      const total = mes.reduce((s,i) => s + i.valor, 0);
      const totJoelson = mes.filter(i => i.resp === 'Joelson').reduce((s,i) => s + i.valor, 0);
      const totRaquel  = mes.filter(i => i.resp === 'Raquel').reduce((s,i) => s + i.valor, 0);

      el.innerHTML = `
        <div class="kpi-grid" style="grid-template-columns:1fr 1fr 1fr">
          <div class="kpi-card kpi-green"><div class="kpi-label">Total Mês</div><div class="kpi-value">${fmt(total)}</div></div>
          <div class="kpi-card kpi-blue"><div class="kpi-label">Joelson</div><div class="kpi-value">${fmt(totJoelson)}</div></div>
          <div class="kpi-card kpi-teal"><div class="kpi-label">Raquel</div><div class="kpi-value">${fmt(totRaquel)}</div></div>
        </div>
        <p class="section-title">Lançamentos do Mês</p>
        ${mes.length ? `<div class="tx-list">
          ${mes.sort((a,b) => b.data.localeCompare(a.data)).map(i => `
            <div class="tx-item">
              <div class="tx-icon income"><svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg></div>
              <div class="tx-info">
                <div class="tx-desc">${i.desc}</div>
                <div class="tx-meta">${fmtDate(i.data)} · ${i.resp} · ${i.conta}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <div class="tx-amount income">+${fmt(i.valor)}</div>
                <button class="btn-icon" onclick="Pages.deletarLancamento('${CONFIG.SHEETS.RECEITAS}',${i._row})">
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px;color:var(--gray-300)"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>` : '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg><p>Nenhuma receita lançada neste mês</p></div>'}

        <button class="btn-fab" onclick="Pages.openNovaReceita()">
          <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
      `;
    } catch(e) { el.innerHTML = erro(e); }
  }

  function openNovaReceita(preencher = {}) {
    openModal('Nova Receita', `
      <div class="form-group"><label class="form-label">Data</label>
        <input class="form-control" type="date" id="rec-data" value="${preencher.data || todayISO()}"></div>
      <div class="form-group"><label class="form-label">Descrição</label>
        <input class="form-control" type="text" id="rec-desc" placeholder="ex: Salário Joelson" value="${preencher.desc||''}"></div>
      <div class="form-group"><label class="form-label">Categoria</label>
        <select class="form-control" id="rec-cat">${selectOptions(CONFIG.CAT_RECEITA, preencher.cat)}</select></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Responsável</label>
          <select class="form-control" id="rec-resp">${selectOptions(CONFIG.MEMBROS, preencher.resp)}</select></div>
        <div class="form-group"><label class="form-label">Conta</label>
          <select class="form-control" id="rec-conta">${selectOptions(CONFIG.CONTAS, preencher.conta)}</select></div>
      </div>
      <div class="form-group"><label class="form-label">Valor (R$)</label>
        <input class="form-control" type="number" id="rec-valor" step="0.01" min="0" placeholder="0,00" value="${preencher.valor||''}"></div>
    `, [
      { label:'Salvar', cls:'btn-success', action: async () => {
        const data  = document.getElementById('rec-data').value;
        const desc  = document.getElementById('rec-desc').value.trim();
        const cat   = document.getElementById('rec-cat').value;
        const resp  = document.getElementById('rec-resp').value;
        const conta = document.getElementById('rec-conta').value;
        const valor = parseFloat(document.getElementById('rec-valor').value) || 0;
        if (!data || !desc || !valor) return toast('Preencha todos os campos', 'error');
        await Sheets.append(CONFIG.SHEETS.RECEITAS, [[genId(), data, desc, cat, resp, conta, valor]]);
        toast('Receita lançada!', 'success'); closeModal();
        renderReceitas(document.getElementById('page-receitas'));
        if (document.getElementById('page-painel').classList.contains('active'))
          renderPainel(document.getElementById('page-painel'));
      }}
    ]);
    setTimeout(() => document.getElementById('rec-desc')?.focus(), 100);
  }

  // ─── DESPESAS ─────────────────────────────────────────
  async function renderDespesas(el) {
    el.innerHTML = '<div class="skeleton skel-row"></div>'.repeat(5);
    try {
      const rows = await Sheets.readAll(CONFIG.SHEETS.DESPESAS);
      const items = Sheets.parseDespesas(rows);
      const mes = filtrarMesAtual(items);
      const total = mes.reduce((s,i) => s + i.valor, 0);
      const porPessoa = CONFIG.MEMBROS.map(m => ({
        nome: m, val: mes.filter(i => i.para === m).reduce((s,i) => s + i.valor, 0)
      })).filter(p => p.val > 0);

      el.innerHTML = `
        <div class="kpi-grid">
          <div class="kpi-card kpi-red"><div class="kpi-label">Total Mês</div><div class="kpi-value">${fmt(total)}</div></div>
          <div class="kpi-card kpi-gray"><div class="kpi-label">Davi</div><div class="kpi-value">${fmt(mes.filter(i=>i.para==='Davi').reduce((s,i)=>s+i.valor,0))}</div></div>
          <div class="kpi-card kpi-gray"><div class="kpi-label">Luísa</div><div class="kpi-value">${fmt(mes.filter(i=>i.para==='Luísa').reduce((s,i)=>s+i.valor,0))}</div></div>
          <div class="kpi-card kpi-orange"><div class="kpi-label">Família Geral</div><div class="kpi-value">${fmt(mes.filter(i=>i.para==='Família (geral)').reduce((s,i)=>s+i.valor,0))}</div></div>
        </div>
        <p class="section-title">Lançamentos do Mês</p>
        ${mes.length ? `<div class="tx-list">
          ${mes.sort((a,b) => b.data.localeCompare(a.data)).map(i => `
            <div class="tx-item">
              <div class="tx-icon expense"><svg viewBox="0 0 24 24"><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8z"/></svg></div>
              <div class="tx-info">
                <div class="tx-desc">${i.desc}</div>
                <div class="tx-meta">${fmtDate(i.data)} · ${i.para} · ${i.cat}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <div class="tx-amount expense">-${fmt(i.valor)}</div>
                <button class="btn-icon" onclick="Pages.deletarLancamento('${CONFIG.SHEETS.DESPESAS}',${i._row})">
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px;color:var(--gray-300)"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>` : '<div class="empty-state"><p>Nenhuma despesa lançada neste mês</p></div>'}

        <button class="btn-fab" onclick="Pages.openNovaDespesa()">
          <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
      `;
    } catch(e) { el.innerHTML = erro(e); }
  }

  function openNovaDespesa() {
    openModal('Nova Despesa', `
      <div class="form-group"><label class="form-label">Data</label>
        <input class="form-control" type="date" id="desp-data" value="${todayISO()}"></div>
      <div class="form-group"><label class="form-label">Descrição</label>
        <input class="form-control" type="text" id="desp-desc" placeholder="ex: Mensalidade escola - Davi"></div>
      <div class="form-group"><label class="form-label">Categoria</label>
        <select class="form-control" id="desp-cat">${selectOptions(CONFIG.CAT_DESPESA)}</select></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Para quem</label>
          <select class="form-control" id="desp-para">${selectOptions(CONFIG.MEMBROS, 'Família (geral)')}</select></div>
        <div class="form-group"><label class="form-label">Conta</label>
          <select class="form-control" id="desp-conta">${selectOptions(CONFIG.CONTAS)}</select></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Forma de Pagamento</label>
          <select class="form-control" id="desp-forma">${selectOptions(CONFIG.FORMAS_PGTO)}</select></div>
        <div class="form-group"><label class="form-label">Valor (R$)</label>
          <input class="form-control" type="number" id="desp-valor" step="0.01" min="0" placeholder="0,00"></div>
      </div>
    `, [
      { label:'Salvar', cls:'btn-danger', action: async () => {
        const data  = document.getElementById('desp-data').value;
        const desc  = document.getElementById('desp-desc').value.trim();
        const cat   = document.getElementById('desp-cat').value;
        const para  = document.getElementById('desp-para').value;
        const conta = document.getElementById('desp-conta').value;
        const forma = document.getElementById('desp-forma').value;
        const valor = parseFloat(document.getElementById('desp-valor').value) || 0;
        if (!data || !desc || !valor) return toast('Preencha todos os campos', 'error');
        await Sheets.append(CONFIG.SHEETS.DESPESAS, [[genId(), data, desc, cat, para, conta, forma, valor]]);
        toast('Despesa lançada!', 'success'); closeModal();
        renderDespesas(document.getElementById('page-despesas'));
        renderPainel(document.getElementById('page-painel'));
      }}
    ]);
    setTimeout(() => document.getElementById('desp-desc')?.focus(), 100);
  }

  // ─── ORÇAMENTO ────────────────────────────────────────
  async function renderOrcamento(el) {
    el.innerHTML = '<div class="skeleton skel-row"></div>'.repeat(6);
    try {
      const [orcRows, despRows] = await Promise.all([
        Sheets.readAll(CONFIG.SHEETS.ORCAMENTO),
        Sheets.readAll(CONFIG.SHEETS.DESPESAS),
      ]);
      const orc  = Sheets.parseOrcamento(orcRows);
      const desp = Sheets.parseDespesas(despRows);
      const mesDep = filtrarMesAtual(desp);

      const totalMeta = orc.reduce((s,o) => s + o.meta, 0);
      const totalReal = mesDep.reduce((s,d) => s + d.valor, 0);

      el.innerHTML = `
        <div class="kpi-grid" style="grid-template-columns:1fr 1fr">
          <div class="kpi-card kpi-blue"><div class="kpi-label">Orçado (mês)</div><div class="kpi-value">${fmt(totalMeta)}</div></div>
          <div class="kpi-card ${totalReal > totalMeta ? 'kpi-red' : 'kpi-green'}"><div class="kpi-label">Realizado</div><div class="kpi-value">${fmt(totalReal)}</div></div>
        </div>
        <div class="flex justify-between items-center mb-12 mt-16">
          <p class="section-title" style="margin:0">Por Categoria</p>
          <button class="btn btn-ghost btn-sm" onclick="Pages.openEditarOrcamento()">Editar Metas</button>
        </div>
        <div class="card"><div class="card-body" style="padding:0">
          ${orc.map(o => {
            const real = mesDep.filter(d => d.cat === o.cat).reduce((s,d) => s + d.valor, 0);
            const pct  = o.meta > 0 ? Math.min(real / o.meta, 1) : (real > 0 ? 1 : 0);
            const warn = pct > 1 ? 'danger' : pct > .8 ? 'warn' : '';
            return `<div class="orc-row">
              <div class="orc-cat">${o.cat}</div>
              <div class="orc-bar-wrap"><div class="progress-bar"><div class="progress-fill ${warn}" style="width:${pct*100}%"></div></div></div>
              <div class="orc-vals">
                <span class="orc-meta">${fmt(o.meta)}</span>
                <span class="orc-real ${warn === 'danger' ? 'text-red' : ''}">${fmt(real)}</span>
              </div>
            </div>`;
          }).join('')}
        </div></div>
      `;
    } catch(e) { el.innerHTML = erro(e); }
  }

  async function openEditarOrcamento() {
    const rows = await Sheets.readAll(CONFIG.SHEETS.ORCAMENTO);
    const orc  = Sheets.parseOrcamento(rows);
    openModal('Editar Metas Mensais', `
      <p class="text-sm text-gray mb-12">Defina quanto planeja gastar em cada categoria por mês:</p>
      ${orc.map((o,i) => `
        <div class="form-group">
          <label class="form-label">${o.cat}</label>
          <input class="form-control" type="number" step="0.01" id="orc_${i}" value="${o.meta}" placeholder="0,00">
        </div>
      `).join('')}
    `, [
      { label:'Salvar', cls:'btn-primary', action: async () => {
        for (let i = 0; i < orc.length; i++) {
          const v = parseFloat(document.getElementById(`orc_${i}`).value) || 0;
          await Sheets.update(CONFIG.SHEETS.ORCAMENTO, `B${orc[i]._row}`, [[v]]);
        }
        toast('Metas atualizadas!', 'success'); closeModal();
        renderOrcamento(document.getElementById('page-orcamento'));
      }}
    ]);
  }

  // ─── CARTÃO ───────────────────────────────────────────
  async function renderCartao(el) {
    el.innerHTML = '<div class="skeleton skel-row"></div>'.repeat(3);
    try {
      const [cartRows, despRows] = await Promise.all([
        Sheets.readAll(CONFIG.SHEETS.CARTAO),
        Sheets.readAll(CONFIG.SHEETS.DESPESAS),
      ]);
      const cartoes = Sheets.parseCartoes(cartRows);
      const desp = Sheets.parseDespesas(despRows);
      const mesDep = filtrarMesAtual(desp).filter(d => d.forma === 'Cartão de Crédito');
      const totalFatura = mesDep.reduce((s,d) => s + d.valor, 0);

      el.innerHTML = `
        <div class="kpi-grid" style="grid-template-columns:1fr">
          <div class="kpi-card kpi-gold"><div class="kpi-label">Fatura Total (mês atual)</div><div class="kpi-value">${fmt(totalFatura)}</div></div>
        </div>
        <p class="section-title">Cartões</p>
        <div class="table-wrap mb-12">
          <table>
            <thead><tr><th>Cartão</th><th>Titular</th><th class="text-right">Limite</th><th class="text-right">Vencimento</th></tr></thead>
            <tbody>
              ${cartoes.map(c => `<tr>
                <td><strong>${c.nome}</strong></td>
                <td>${c.titular}</td>
                <td class="td-num">${fmt(c.limite)}</td>
                <td class="td-num">Dia ${c.diaVenc}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="section-title">Gastos no Cartão (mês atual)</p>
        ${mesDep.length ? `<div class="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Para</th><th class="text-right">Valor</th></tr></thead>
            <tbody>
              ${mesDep.sort((a,b)=>b.data.localeCompare(a.data)).map(d => `<tr>
                <td>${fmtDate(d.data)}</td>
                <td>${d.desc}</td>
                <td>${d.para}</td>
                <td class="td-num text-red">${fmt(d.valor)}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot><tr><td colspan="3">Total</td><td class="td-num">${fmt(totalFatura)}</td></tr></tfoot>
          </table>
        </div>` : '<div class="empty-state"><p>Nenhum gasto no cartão este mês</p></div>'}
      `;
    } catch(e) { el.innerHTML = erro(e); }
  }

  // ─── DÍVIDAS ──────────────────────────────────────────
  async function renderDividas(el) {
    el.innerHTML = '<div class="skeleton skel-row"></div>'.repeat(3);
    try {
      const rows = await Sheets.readAll(CONFIG.SHEETS.DIVIDAS);
      const dividas = Sheets.parseDividas(rows);
      const totalDevedor = dividas.reduce((s,d) => s + (d.total - d.parcela * d.pagas), 0);
      const totalParcelas = dividas.reduce((s,d) => s + d.parcela, 0);

      el.innerHTML = `
        <div class="kpi-grid" style="grid-template-columns:1fr 1fr">
          <div class="kpi-card kpi-red"><div class="kpi-label">Saldo Devedor Total</div><div class="kpi-value">${fmt(totalDevedor)}</div></div>
          <div class="kpi-card kpi-orange"><div class="kpi-label">Parcelas/Mês</div><div class="kpi-value">${fmt(totalParcelas)}</div></div>
        </div>
        <div class="flex justify-between items-center mb-12 mt-16">
          <p class="section-title" style="margin:0">Dívidas em Andamento</p>
          <button class="btn btn-primary btn-sm" onclick="Pages.openNovaDivida()">+ Nova</button>
        </div>
        ${dividas.length ? dividas.map(d => {
          const devedor = d.total - d.parcela * d.pagas;
          const pct = d.nParc > 0 ? d.pagas / d.nParc : 0;
          const status = d.pagas >= d.nParc ? 'Quitado' : 'Em andamento';
          return `<div class="card mb-12">
            <div class="card-body">
              <div class="flex justify-between items-center">
                <strong>${d.desc}</strong>
                <span class="badge ${status === 'Quitado' ? 'badge-green' : 'badge-orange'}">${status}</span>
              </div>
              <div class="text-sm text-gray mt-4">${d.resp} · ${d.pagas}/${d.nParc} parcelas de ${fmt(d.parcela)}</div>
              <div class="mt-8 progress-bar"><div class="progress-fill" style="width:${pct*100}%"></div></div>
              <div class="meta-values"><span>${fmt(d.pagas * d.parcela)} pago</span><span>Restante: ${fmt(devedor)}</span></div>
              <div class="mt-8 flex gap-8" style="justify-content:flex-end">
                <button class="btn btn-ghost btn-sm" onclick="Pages.registrarPagamentoDivida(${d._row},${d.pagas},${d.nParc})">Registrar parcela</button>
                <button class="btn btn-ghost btn-sm" onclick="Pages.deletarLancamento('${CONFIG.SHEETS.DIVIDAS}',${d._row})">Excluir</button>
              </div>
            </div>
          </div>`;
        }).join('') : '<div class="empty-state"><p>Nenhuma dívida cadastrada 🎉</p></div>'}
      `;
    } catch(e) { el.innerHTML = erro(e); }
  }

  function openNovaDivida() {
    openModal('Nova Dívida / Financiamento', `
      <div class="form-group"><label class="form-label">Descrição</label>
        <input class="form-control" type="text" id="div-desc" placeholder="ex: Financiamento Veículo"></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Responsável</label>
          <select class="form-control" id="div-resp">${selectOptions(['Joelson','Raquel','Família (geral)'])}</select></div>
        <div class="form-group"><label class="form-label">Data de início</label>
          <input class="form-control" type="date" id="div-inicio" value="${todayISO()}"></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Valor Total (R$)</label>
          <input class="form-control" type="number" id="div-total" step="0.01" placeholder="0,00"></div>
        <div class="form-group"><label class="form-label">Valor da Parcela (R$)</label>
          <input class="form-control" type="number" id="div-parcela" step="0.01" placeholder="0,00"></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Nº de Parcelas</label>
          <input class="form-control" type="number" id="div-nparc" min="1" placeholder="12"></div>
        <div class="form-group"><label class="form-label">Parcelas Pagas</label>
          <input class="form-control" type="number" id="div-pagas" min="0" value="0"></div>
      </div>
    `, [
      { label:'Salvar', cls:'btn-primary', action: async () => {
        const desc  = document.getElementById('div-desc').value.trim();
        const resp  = document.getElementById('div-resp').value;
        const inicio = document.getElementById('div-inicio').value;
        const total  = parseFloat(document.getElementById('div-total').value) || 0;
        const parc   = parseFloat(document.getElementById('div-parcela').value) || 0;
        const nparc  = parseInt(document.getElementById('div-nparc').value) || 0;
        const pagas  = parseInt(document.getElementById('div-pagas').value) || 0;
        if (!desc || !total) return toast('Preencha os campos obrigatórios', 'error');
        await Sheets.append(CONFIG.SHEETS.DIVIDAS, [[desc, resp, total, parc, nparc, pagas, inicio]]);
        toast('Dívida cadastrada!', 'success'); closeModal();
        renderDividas(document.getElementById('page-dividas'));
      }}
    ]);
  }

  async function registrarPagamentoDivida(row, pagas, nParc) {
    if (pagas >= nParc) return toast('Dívida já quitada!', 'success');
    await Sheets.update(CONFIG.SHEETS.DIVIDAS, `F${row}`, [[pagas + 1]]);
    toast('Parcela registrada!', 'success');
    renderDividas(document.getElementById('page-dividas'));
  }

  // ─── METAS ────────────────────────────────────────────
  async function renderMetas(el) {
    el.innerHTML = '<div class="skeleton skel-row"></div>'.repeat(4);
    try {
      const rows = await Sheets.readAll(CONFIG.SHEETS.METAS);
      const metas = Sheets.parseMetas(rows);
      const totalMeta = metas.reduce((s,m) => s + m.meta, 0);
      const totalGuardado = metas.reduce((s,m) => s + m.guardado, 0);

      el.innerHTML = `
        <div class="kpi-grid" style="grid-template-columns:1fr 1fr">
          <div class="kpi-card kpi-teal"><div class="kpi-label">Total Metas</div><div class="kpi-value">${fmt(totalMeta)}</div></div>
          <div class="kpi-card kpi-green"><div class="kpi-label">Total Guardado</div><div class="kpi-value">${fmt(totalGuardado)}</div></div>
        </div>
        <div class="flex justify-between items-center mb-12 mt-16">
          <p class="section-title" style="margin:0">Objetivos Financeiros</p>
          <button class="btn btn-primary btn-sm" onclick="Pages.openNovaMeta()">+ Nova</button>
        </div>
        ${metas.map(m => {
          const pct  = m.meta > 0 ? Math.min(m.guardado / m.meta, 1) : 0;
          const rest = m.meta - m.guardado;
          const prazo = m.aporte > 0 ? Math.ceil(rest / m.aporte) : '—';
          const warn = pct < .3 ? 'danger' : pct < .7 ? 'warn' : '';
          return `<div class="meta-card">
            <div class="meta-header">
              <div class="meta-name">${m.nome}</div>
              <div class="meta-pct ${pct >= 1 ? 'text-green' : ''}">${fmtPct(pct)}</div>
            </div>
            <div class="progress-bar"><div class="progress-fill ${warn}" style="width:${pct*100}%"></div></div>
            <div class="meta-values">
              <span>${fmt(m.guardado)} de ${fmt(m.meta)}</span>
              <span>${typeof prazo === 'number' ? `~${prazo} meses` : ''}</span>
            </div>
            ${m.obs ? `<div class="text-xs text-gray mt-4">${m.obs}</div>` : ''}
            <div class="mt-8 flex gap-8" style="justify-content:flex-end">
              <button class="btn btn-ghost btn-sm" onclick="Pages.openAtualizarMeta(${m._row},'${m.nome}',${m.guardado})">Atualizar valor</button>
              <button class="btn btn-ghost btn-sm" onclick="Pages.deletarLancamento('${CONFIG.SHEETS.METAS}',${m._row})">Excluir</button>
            </div>
          </div>`;
        }).join('')}
        ${!metas.length ? '<div class="empty-state"><p>Nenhuma meta cadastrada ainda</p></div>' : ''}
      `;
    } catch(e) { el.innerHTML = erro(e); }
  }

  function openNovaMeta() {
    openModal('Nova Meta', `
      <div class="form-group"><label class="form-label">Nome do Objetivo</label>
        <input class="form-control" type="text" id="meta-nome" placeholder="ex: Poupança Educação - Davi"></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Valor da Meta (R$)</label>
          <input class="form-control" type="number" id="meta-meta" step="0.01" placeholder="0,00"></div>
        <div class="form-group"><label class="form-label">Já Guardado (R$)</label>
          <input class="form-control" type="number" id="meta-guardado" step="0.01" placeholder="0,00" value="0"></div>
      </div>
      <div class="form-group"><label class="form-label">Aporte Mensal Planejado (R$)</label>
        <input class="form-control" type="number" id="meta-aporte" step="0.01" placeholder="0,00"></div>
      <div class="form-group"><label class="form-label">Observação (opcional)</label>
        <input class="form-control" type="text" id="meta-obs" placeholder="ex: Faculdade do Davi"></div>
    `, [
      { label:'Salvar', cls:'btn-success', action: async () => {
        const nome = document.getElementById('meta-nome').value.trim();
        const meta = parseFloat(document.getElementById('meta-meta').value) || 0;
        const guardado = parseFloat(document.getElementById('meta-guardado').value) || 0;
        const aporte = parseFloat(document.getElementById('meta-aporte').value) || 0;
        const obs = document.getElementById('meta-obs').value.trim();
        if (!nome || !meta) return toast('Preencha nome e valor da meta', 'error');
        await Sheets.append(CONFIG.SHEETS.METAS, [[nome, meta, guardado, aporte, obs]]);
        toast('Meta criada!', 'success'); closeModal();
        renderMetas(document.getElementById('page-metas'));
      }}
    ]);
  }

  function openAtualizarMeta(row, nome, guardadoAtual) {
    openModal(`Atualizar: ${nome}`, `
      <div class="form-group"><label class="form-label">Valor Guardado Atual (R$)</label>
        <input class="form-control" type="number" id="meta-upd-guardado" step="0.01" value="${guardadoAtual}" placeholder="0,00"></div>
    `, [
      { label:'Salvar', cls:'btn-success', action: async () => {
        const v = parseFloat(document.getElementById('meta-upd-guardado').value) || 0;
        await Sheets.update(CONFIG.SHEETS.METAS, `C${row}`, [[v]]);
        toast('Meta atualizada!', 'success'); closeModal();
        renderMetas(document.getElementById('page-metas'));
      }}
    ]);
  }

  // ─── DELETE genérico ──────────────────────────────────
  async function deletarLancamento(sheet, row) {
    if (!confirm('Excluir este lançamento?')) return;
    try {
      await Sheets.deleteRow(sheet, row - 1); // API é 0-based
      toast('Excluído!', 'success');
      // Recarrega a página atual
      const active = document.querySelector('.page.active');
      if (active) {
        const id = active.id.replace('page-','');
        if (id === 'receitas') renderReceitas(active);
        else if (id === 'despesas') renderDespesas(active);
        else if (id === 'dividas') renderDividas(active);
        else if (id === 'metas') renderMetas(active);
      }
    } catch(e) { toast('Erro ao excluir', 'error'); console.error(e); }
  }

  // ─── Modal & Toast helpers ────────────────────────────
  function openModal(title, bodyHTML, actions = []) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    const footer = document.getElementById('modal-footer');
    footer.innerHTML = '';
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = `btn ${a.cls}`;
      btn.textContent = a.label;
      btn.onclick = async () => {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span>`;
        try { await a.action(); } finally { btn.disabled = false; btn.textContent = a.label; }
      };
      footer.appendChild(btn);
    });
    document.getElementById('modal-overlay').classList.add('open');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
  }

  let _toastTimer;
  function toast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show ${type}`;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.className = 'toast', 3000);
  }

  function erro(e) {
    return `<div class="notice"><strong>Erro ao carregar.</strong> ${e.message}</div>`;
  }

  return {
    renderPainel, renderContas, renderReceitas, renderDespesas,
    renderOrcamento, renderCartao, renderDividas, renderMetas,
    openNovaReceita, openNovaDespesa, openNovaDivida, openNovaMeta,
    openEditarContas, openEditarOrcamento, openAtualizarMeta,
    registrarPagamentoDivida, deletarLancamento, openModal, closeModal, toast,
  };
})();
