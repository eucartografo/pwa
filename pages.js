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
          <select class="form-control" id="desp-forma" onchange="Pages._toggleParcelado()">${selectOptions(CONFIG.FORMAS_PGTO)}</select></div>
        <div class="form-group"><label class="form-label">Valor (R$)</label>
          <input class="form-control" type="number" id="desp-valor" step="0.01" min="0" placeholder="0,00"></div>
      </div>

      <!-- Seção parcelado (aparece quando seleciona Cartão de Crédito) -->
      <div id="desp-parcelado-wrap" style="display:none">
        <div class="notice" style="margin-bottom:12px;background:var(--blue-lt);border-color:var(--blue)">
          <strong>Compra parcelada?</strong> Preencha abaixo para o app calcular o impacto e adicionar automaticamente às dívidas/parcelas.
        </div>
        <div class="form-row form-row-2">
          <div class="form-group"><label class="form-label">Nº de Parcelas</label>
            <input class="form-control" type="number" id="desp-nparc" min="1" placeholder="1" value="1"
              oninput="Pages._calcImpactoParc()"></div>
          <div class="form-group"><label class="form-label">Valor de Cada Parcela (R$)</label>
            <input class="form-control" type="number" id="desp-vparc" step="0.01" placeholder="0,00"
              oninput="Pages._calcImpactoParc()"></div>
        </div>
        <div id="desp-impacto-preview" class="impacto-preview" style="display:none"></div>
      </div>
    `, [
      { label:'Salvar', cls:'btn-danger', action: async () => {
        const data   = document.getElementById('desp-data').value;
        const desc   = document.getElementById('desp-desc').value.trim();
        const cat    = document.getElementById('desp-cat').value;
        const para   = document.getElementById('desp-para').value;
        const conta  = document.getElementById('desp-conta').value;
        const forma  = document.getElementById('desp-forma').value;
        const valor  = parseFloat(document.getElementById('desp-valor').value) || 0;
        if (!data || !desc || !valor) return toast('Preencha todos os campos', 'error');

        // Salva despesa normal
        await Sheets.append(CONFIG.SHEETS.DESPESAS, [[genId(), data, desc, cat, para, conta, forma, valor]]);

        // Se parcelado, cadastra também na aba DÍVIDAS
        const nparc = parseInt(document.getElementById('desp-nparc')?.value) || 1;
        const vparc = parseFloat(document.getElementById('desp-vparc')?.value) || 0;
        const isParc = document.getElementById('desp-parcelado-wrap')?.style.display !== 'none' && nparc > 1;
        if (isParc && vparc > 0) {
          await Sheets.append(CONFIG.SHEETS.DIVIDAS, [[desc, para, valor, vparc, nparc, 0, data]]);
          toast(`Despesa lançada e ${nparc}x registradas nas parcelas!`, 'success');
        } else {
          toast('Despesa lançada!', 'success');
        }
        closeModal();
        renderDespesas(document.getElementById('page-despesas'));
        if (document.getElementById('page-painel').classList.contains('active'))
          renderPainel(document.getElementById('page-painel'));
      }}
    ]);
    setTimeout(() => document.getElementById('desp-desc')?.focus(), 100);
  }

  // Mostra/oculta seção parcelado
  function _toggleParcelado() {
    const forma = document.getElementById('desp-forma').value;
    const wrap  = document.getElementById('desp-parcelado-wrap');
    if (wrap) wrap.style.display = forma === 'Cartão de Crédito' ? 'block' : 'none';
  }

  // Calcula e exibe impacto da nova parcela em tempo real
  async function _calcImpactoParc() {
    const nparc = parseInt(document.getElementById('desp-nparc')?.value) || 0;
    const vparc = parseFloat(document.getElementById('desp-vparc')?.value) || 0;
    const preview = document.getElementById('desp-impacto-preview');
    if (!preview || nparc < 2 || vparc <= 0) {
      if (preview) preview.style.display = 'none';
      return;
    }
    try {
      const [divRows, recRows] = await Promise.all([
        Sheets.readAll(CONFIG.SHEETS.DIVIDAS),
        Sheets.readAll(CONFIG.SHEETS.RECEITAS),
      ]);
      const dividas  = Sheets.parseDividas(divRows);
      const receitas = Sheets.parseReceitas(recRows);
      const renda    = Financas.calcRendaMensal(receitas, Financas.mesAtual(), Financas.anoAtual());
      const data     = document.getElementById('desp-data')?.value || todayISO();
      const impacto  = Financas.calcImpactoNovaParcela(vparc, nparc, data, dividas, renda.total);

      const cor = impacto.critico ? 'var(--red)' : impacto.alerta ? 'var(--orange)' : 'var(--navy)';
      const ico = impacto.critico ? '🔴' : impacto.alerta ? '⚠️' : 'ℹ️';

      preview.style.display = 'block';
      preview.innerHTML = `
        <div class="impacto-header" style="color:${cor}">${ico} Impacto dessa compra parcelada</div>
        <div class="impacto-linha">Você já tem <strong>${impacto.nAtivas} compra(s) parcelada(s)</strong> ativas</div>
        <div class="impacto-linha">Parcelas mensais atuais: <strong>${fmt(impacto.totalAtual)}</strong></div>
        <div class="impacto-linha">Com essa nova parcela: <strong style="color:${cor}">${fmt(impacto.novoTotal)}/mês</strong></div>
        <div class="impacto-linha">Comprometimento da renda familiar:
          <strong style="color:${cor}">${impacto.compNovo}%</strong>
          ${parseFloat(impacto.compAtual) > 0 ? `(era ${impacto.compAtual}%)` : ''}
        </div>
        <div class="impacto-linha">Esta parcela vai até: <strong>${impacto.dataFimStr}</strong></div>
        <div class="impacto-linha">Parcela mais longa existente: <strong>${impacto.maisLongaStr}</strong></div>
        ${impacto.critico ? '<div class="impacto-alerta danger">⛔ Acima de 50% — comprometimento crítico da renda familiar!</div>'
          : impacto.alerta ? '<div class="impacto-alerta warn">⚠️ Acima de 30% — avalie se realmente precisa dessa compra.</div>'
          : '<div class="impacto-alerta ok">✅ Comprometimento dentro do limite recomendado.</div>'}
      `;
    } catch(e) { console.error(e); }
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
    openModal('Nova Dívida / Parcela Fixa', `
      <div class="form-group"><label class="form-label">Descrição</label>
        <input class="form-control" type="text" id="div-desc" placeholder="ex: Financiamento Veículo"></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Responsável</label>
          <select class="form-control" id="div-resp">${selectOptions(['Joelson','Raquel','Família (geral)'])}</select></div>
        <div class="form-group"><label class="form-label">Data de início</label>
          <input class="form-control" type="date" id="div-inicio" value="${todayISO()}"
            oninput="Pages._calcImpactoDivida()"></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Valor Total (R$)</label>
          <input class="form-control" type="number" id="div-total" step="0.01" placeholder="0,00"></div>
        <div class="form-group"><label class="form-label">Valor da Parcela (R$)</label>
          <input class="form-control" type="number" id="div-parcela" step="0.01" placeholder="0,00"
            oninput="Pages._calcImpactoDivida()"></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Nº de Parcelas</label>
          <input class="form-control" type="number" id="div-nparc" min="1" placeholder="12"
            oninput="Pages._calcImpactoDivida()"></div>
        <div class="form-group"><label class="form-label">Parcelas Pagas</label>
          <input class="form-control" type="number" id="div-pagas" min="0" value="0"></div>
      </div>
      <div id="div-impacto-preview" class="impacto-preview" style="display:none"></div>
    `, [
      { label:'Salvar', cls:'btn-primary', action: async () => {
        const desc   = document.getElementById('div-desc').value.trim();
        const resp   = document.getElementById('div-resp').value;
        const inicio = document.getElementById('div-inicio').value;
        const total  = parseFloat(document.getElementById('div-total').value) || 0;
        const parc   = parseFloat(document.getElementById('div-parcela').value) || 0;
        const nparc  = parseInt(document.getElementById('div-nparc').value) || 0;
        const pagas  = parseInt(document.getElementById('div-pagas').value) || 0;
        if (!desc || !total) return toast('Preencha os campos obrigatórios', 'error');
        await Sheets.append(CONFIG.SHEETS.DIVIDAS, [[desc, resp, total, parc, nparc, pagas, inicio]]);
        toast('Dívida cadastrada!', 'success'); closeModal();
        renderDividas(document.getElementById('page-dividas'));
        if (document.getElementById('page-saude').classList.contains('active'))
          renderSaude(document.getElementById('page-saude'));
      }}
    ]);
  }

  async function _calcImpactoDivida() {
    const vparc = parseFloat(document.getElementById('div-parcela')?.value) || 0;
    const nparc = parseInt(document.getElementById('div-nparc')?.value) || 0;
    const data  = document.getElementById('div-inicio')?.value || todayISO();
    const preview = document.getElementById('div-impacto-preview');
    if (!preview || nparc < 1 || vparc <= 0) {
      if (preview) preview.style.display = 'none';
      return;
    }
    try {
      const [divRows, recRows] = await Promise.all([
        Sheets.readAll(CONFIG.SHEETS.DIVIDAS),
        Sheets.readAll(CONFIG.SHEETS.RECEITAS),
      ]);
      const dividas  = Sheets.parseDividas(divRows);
      const receitas = Sheets.parseReceitas(recRows);
      const renda    = Financas.calcRendaMensal(receitas, Financas.mesAtual(), Financas.anoAtual());
      const impacto  = Financas.calcImpactoNovaParcela(vparc, nparc, data, dividas, renda.total);

      const cor = impacto.critico ? 'var(--red)' : impacto.alerta ? 'var(--orange)' : 'var(--navy)';
      const ico = impacto.critico ? '🔴' : impacto.alerta ? '⚠️' : 'ℹ️';
      preview.style.display = 'block';
      preview.innerHTML = `
        <div class="impacto-header" style="color:${cor}">${ico} Impacto nos compromissos mensais</div>
        <div class="impacto-linha">Parcelas mensais atuais: <strong>${fmt(impacto.totalAtual)}</strong></div>
        <div class="impacto-linha">Com essa nova parcela: <strong style="color:${cor}">${fmt(impacto.novoTotal)}/mês</strong></div>
        <div class="impacto-linha">Comprometimento da renda: <strong style="color:${cor}">${impacto.compNovo}%</strong></div>
        <div class="impacto-linha">Esta parcela vai até: <strong>${impacto.dataFimStr}</strong></div>
        <div class="impacto-linha">Você já tem <strong>${impacto.nAtivas} compromisso(s) parcelado(s)</strong></div>
        ${impacto.critico ? '<div class="impacto-alerta danger">⛔ Atenção: comprometimento crítico acima de 50% da renda!</div>'
          : impacto.alerta ? '<div class="impacto-alerta warn">⚠️ Acima de 30% — pense bem antes de assumir mais parcelas.</div>'
          : '<div class="impacto-alerta ok">✅ Comprometimento dentro do limite recomendado (abaixo de 30%).</div>'}
      `;
    } catch(e) { console.error(e); }
  }

  async function registrarPagamentoDivida(row, pagas, nParc) {
    if (pagas >= nParc) return toast('Dívida já quitada!', 'success');
    await Sheets.update(CONFIG.SHEETS.DIVIDAS, `F${row}`, [[pagas + 1]]);
    toast('Parcela registrada!', 'success');
    renderDividas(document.getElementById('page-dividas'));
  }

  // ─── METAS ────────────────────────────────────────────
  async function renderMetas(el) {
    el.innerHTML = '<div class="skeleton skel-row"></div>'.repeat(5);
    try {
      const [metRows, divRows] = await Promise.all([
        Sheets.readAll(CONFIG.SHEETS.METAS),
        Sheets.readAll(CONFIG.SHEETS.DIVIDAS),
      ]);
      const metas   = Sheets.parseMetas(metRows);
      const dividas = Sheets.parseDividas(divRows);

      // ── Cálculo dívidas ───────────────────────────────
      const dividasAtivas = dividas.filter(d => d.nParc > 0 && d.pagas < d.nParc);
      const totalDevedor  = dividasAtivas.reduce((s, d) => s + (d.total - d.parcela * d.pagas), 0);
      const { ativas: parcelasAtivas } = Financas.calcParcelasAtivas(dividasAtivas);
      const semDividas = totalDevedor <= 0 && dividasAtivas.length === 0;

      // ── Separar metas por nível ────────────────────────
      // Nível 2: Reserva de Emergência (nome contém "reserva" ou "emergência")
      const isReserva = m => /reserva|emergência|emergencia/i.test(m.nome);
      const metaReserva = metas.find(isReserva);
      const reservaOk   = metaReserva
        ? metaReserva.guardado >= metaReserva.meta && metaReserva.meta > 0
        : false;
      // Nível 3: demais metas
      const metasLivres = metas.filter(m => !isReserva(m));

      // ── Status de cada nível ─────────────────────────
      const n1ok = semDividas;   // sem dívidas → nível 1 OK
      const n2ok = n1ok && reservaOk; // sem dívidas E reserva OK → nível 2 OK

      // ── Renderização ─────────────────────────────────
      el.innerHTML = `

        <!-- FILOSOFIA -->
        <div class="nivel-filosofia">
          <div class="nf-icon">🏆</div>
          <div>
            <div class="nf-titulo">Construção financeira em níveis</div>
            <div class="nf-sub">Cada nível só faz sentido depois que o anterior estiver concluído. Não poupamos enquanto temos dívidas — os juros sempre ganham.</div>
          </div>
        </div>

        <!-- ════ NÍVEL 1 — QUITAR DÍVIDAS ════ -->
        <div class="nivel-wrap ${n1ok ? 'nivel-ok' : 'nivel-ativo'}">
          <div class="nivel-header">
            <div class="nivel-badge ${n1ok ? 'badge-ok' : 'badge-ativo'}">
              ${n1ok ? '✅' : '🔴'} Nível 1
            </div>
            <div class="nivel-titulo">Quitar todas as dívidas</div>
            <div class="nivel-status ${n1ok ? 'text-green' : 'text-red'}">
              ${n1ok ? 'CONCLUÍDO' : 'EM ANDAMENTO'}
            </div>
          </div>
          <div class="nivel-body">
            <p class="nivel-desc">Antes de qualquer meta, elimine as dívidas. Nenhum investimento rende mais do que os juros que você paga. Cada real pago em dívida é um retorno garantido.</p>

            ${dividasAtivas.length ? `
              <div class="nivel-resumo-dividas">
                <div class="nrd-item">
                  <span class="nrd-label">Total em aberto</span>
                  <span class="nrd-val text-red">${fmt(totalDevedor)}</span>
                </div>
                <div class="nrd-item">
                  <span class="nrd-label">Dívidas ativas</span>
                  <span class="nrd-val">${dividasAtivas.length}</span>
                </div>
              </div>

              ${parcelasAtivas.map(d => {
                const saldoDevedor = d.total - d.parcela * d.pagas;
                const pct = d.nParc > 0 ? d.pagas / d.nParc : 0;
                return `<div class="divida-meta-item">
                  <div class="dmi-header">
                    <div class="dmi-nome">${d.desc}</div>
                    <div class="dmi-saldo text-red">${fmt(saldoDevedor)}</div>
                  </div>
                  <div class="dmi-sub">${d.resp} · ${d.pagas}/${d.nParc} parcelas · vence ${d.dataFimStr}</div>
                  <div class="progress-bar mt-4">
                    <div class="progress-fill" style="width:${(pct*100).toFixed(0)}%;background:var(--green)"></div>
                  </div>
                  <div class="dmi-parcela">${fmt(d.parcela)}/mês</div>
                </div>`;
              }).join('')}

              <button class="btn btn-ghost btn-sm mt-8 w-full" onclick="App.navigateTo('dividas')">
                Ver todas as dívidas →
              </button>
            ` : `
              <div class="nivel-concluido-msg">
                🎉 Parabéns! Nenhuma dívida ativa. Avance para o Nível 2.
              </div>
            `}
          </div>
        </div>

        <!-- ════ NÍVEL 2 — RESERVA DE EMERGÊNCIA ════ -->
        <div class="nivel-wrap ${!n1ok ? 'nivel-bloqueado' : n2ok ? 'nivel-ok' : 'nivel-ativo'}">
          <div class="nivel-header">
            <div class="nivel-badge ${!n1ok ? 'badge-bloqueado' : n2ok ? 'badge-ok' : 'badge-ativo'}">
              ${!n1ok ? '🔒' : n2ok ? '✅' : '🟡'} Nível 2
            </div>
            <div class="nivel-titulo">Reserva de Emergência</div>
            <div class="nivel-status ${!n1ok ? 'text-gray' : n2ok ? 'text-green' : 'text-orange'}">
              ${!n1ok ? 'BLOQUEADO' : n2ok ? 'CONCLUÍDO' : 'EM ANDAMENTO'}
            </div>
          </div>
          <div class="nivel-body">
            ${!n1ok ? `
              <div class="nivel-bloqueado-msg">
                🔒 Quite todas as dívidas primeiro (Nível 1) para desbloquear a Reserva de Emergência.
                Não faz sentido guardar dinheiro enquanto se paga juros.
              </div>
            ` : metaReserva ? `
              <p class="nivel-desc">Meta: 6 meses de despesas guardados. Essa reserva te protege de imprevistos sem precisar de empréstimos.</p>
              ${(() => {
                const pct  = metaReserva.meta > 0 ? Math.min(metaReserva.guardado / metaReserva.meta, 1) : 0;
                const rest = metaReserva.meta - metaReserva.guardado;
                const prazo = metaReserva.aporte > 0 ? Math.ceil(rest / metaReserva.aporte) : null;
                const warn = pct < .3 ? 'danger' : pct < .7 ? 'warn' : '';
                return `<div class="meta-card" style="margin:0">
                  <div class="meta-header">
                    <div class="meta-name">${metaReserva.nome}</div>
                    <div class="meta-pct ${pct >= 1 ? 'text-green' : ''}">${fmtPct(pct)}</div>
                  </div>
                  <div class="progress-bar"><div class="progress-fill ${warn}" style="width:${pct*100}%"></div></div>
                  <div class="meta-values">
                    <span>${fmt(metaReserva.guardado)} de ${fmt(metaReserva.meta)}</span>
                    <span>${prazo ? `~${prazo} meses` : ''}</span>
                  </div>
                  ${metaReserva.obs ? `<div class="text-xs text-gray mt-4">${metaReserva.obs}</div>` : ''}
                  <div class="mt-8 flex gap-8" style="justify-content:flex-end">
                    <button class="btn btn-ghost btn-sm" onclick="Pages.openAtualizarMeta(${metaReserva._row},'${metaReserva.nome}',${metaReserva.guardado})">Atualizar valor</button>
                  </div>
                </div>`;
              })()}
            ` : `
              <p class="nivel-desc">Você ainda não cadastrou sua Reserva de Emergência. Crie agora — o objetivo é ter 6 meses de despesas guardados.</p>
              <button class="btn btn-success btn-sm" onclick="Pages.openNovaMetaReserva()">
                + Criar Reserva de Emergência
              </button>
            `}
          </div>
        </div>

        <!-- ════ NÍVEL 3 — METAS LIVRES ════ -->
        <div class="nivel-wrap ${!n2ok ? 'nivel-bloqueado' : 'nivel-ativo'}">
          <div class="nivel-header">
            <div class="nivel-badge ${!n2ok ? 'badge-bloqueado' : 'badge-ativo'}">
              ${!n2ok ? '🔒' : '🟢'} Nível 3
            </div>
            <div class="nivel-titulo">Metas & Sonhos</div>
            <div class="nivel-status ${!n2ok ? 'text-gray' : 'text-green'}">
              ${!n2ok ? 'BLOQUEADO' : `${metasLivres.length} meta(s)`}
            </div>
          </div>
          <div class="nivel-body">
            ${!n2ok ? `
              <div class="nivel-bloqueado-msg">
                🔒 Complete a Reserva de Emergência (Nível 2) para desbloquear metas como viagens, troca de carro e educação dos filhos.
                Com dívidas ou sem reserva, qualquer imprevisto te joga de volta ao início.
              </div>
              ${metasLivres.length ? `
                <div class="metas-preview-bloqueado">
                  <div class="mpb-titulo">Suas metas aguardando:</div>
                  ${metasLivres.map(m => `<div class="mpb-item">🔒 ${m.nome} — ${fmt(m.meta)}</div>`).join('')}
                </div>
              ` : ''}
            ` : `
              <p class="nivel-desc">Sem dívidas e com reserva de emergência garantida, agora você pode sonhar e planejar com segurança.</p>
              <div class="flex justify-between items-center mb-12">
                <span class="text-sm text-gray">${metasLivres.length} meta(s) ativa(s)</span>
                <button class="btn btn-primary btn-sm" onclick="Pages.openNovaMeta()">+ Nova Meta</button>
              </div>
              ${metasLivres.length ? metasLivres.map(m => {
                const pct   = m.meta > 0 ? Math.min(m.guardado / m.meta, 1) : 0;
                const rest  = m.meta - m.guardado;
                const prazo = m.aporte > 0 ? Math.ceil(rest / m.aporte) : null;
                const warn  = pct < .3 ? 'danger' : pct < .7 ? 'warn' : '';
                return `<div class="meta-card">
                  <div class="meta-header">
                    <div class="meta-name">${m.nome}</div>
                    <div class="meta-pct ${pct >= 1 ? 'text-green' : ''}">${fmtPct(pct)}</div>
                  </div>
                  <div class="progress-bar"><div class="progress-fill ${warn}" style="width:${pct*100}%"></div></div>
                  <div class="meta-values">
                    <span>${fmt(m.guardado)} de ${fmt(m.meta)}</span>
                    <span>${prazo ? `~${prazo} meses` : ''}</span>
                  </div>
                  ${m.obs ? `<div class="text-xs text-gray mt-4">${m.obs}</div>` : ''}
                  <div class="mt-8 flex gap-8" style="justify-content:flex-end">
                    <button class="btn btn-ghost btn-sm" onclick="Pages.openAtualizarMeta(${m._row},'${m.nome}',${m.guardado})">Atualizar valor</button>
                    <button class="btn btn-ghost btn-sm" onclick="Pages.deletarLancamento('${CONFIG.SHEETS.METAS}',${m._row})">Excluir</button>
                  </div>
                </div>`;
              }).join('') : `
                <div class="empty-state"><p>Nenhuma meta ainda — crie a primeira!</p></div>
              `}
            `}
          </div>
        </div>
      `;
    } catch(e) { el.innerHTML = erro(e); }
  }

  // Atalho para criar meta de reserva com nome padronizado
  function openNovaMetaReserva() {
    openModal('Criar Reserva de Emergência', `
      <div class="nivel-filosofia" style="margin-bottom:16px">
        <div class="nf-icon">🛡️</div>
        <div class="nf-sub">Objetivo: 6 meses de despesas mensais guardados em conta de fácil acesso (poupança ou CDB de liquidez diária).</div>
      </div>
      <div class="form-group"><label class="form-label">Valor da Meta (R$)</label>
        <input class="form-control" type="number" id="meta-res-meta" step="0.01" placeholder="ex: 21000 (6 × R$ 3.500/mês)"></div>
      <div class="form-group"><label class="form-label">Já Guardado (R$)</label>
        <input class="form-control" type="number" id="meta-res-guard" step="0.01" value="0"></div>
      <div class="form-group"><label class="form-label">Aporte Mensal (R$)</label>
        <input class="form-control" type="number" id="meta-res-aporte" step="0.01" placeholder="quanto vai guardar por mês"></div>
    `, [
      { label:'Criar Reserva', cls:'btn-success', action: async () => {
        const meta    = parseFloat(document.getElementById('meta-res-meta').value) || 0;
        const guard   = parseFloat(document.getElementById('meta-res-guard').value) || 0;
        const aporte  = parseFloat(document.getElementById('meta-res-aporte').value) || 0;
        if (!meta) return toast('Informe o valor da meta', 'error');
        await Sheets.append(CONFIG.SHEETS.METAS, [['Reserva de Emergência (6 meses)', meta, guard, aporte, 'Manter na conta Reserva de Emergência']]);
        toast('Reserva criada!', 'success'); closeModal();
        renderMetas(document.getElementById('page-metas'));
      }}
    ]);
  }
  function openNovaMeta() {
    openModal('Nova Meta (Nível 3)', `
      <div class="nivel-filosofia" style="margin-bottom:16px">
        <div class="nf-icon">🎯</div>
        <div class="nf-sub">Lembre-se: metas só fazem sentido após quitar dívidas (Nível 1) e criar a Reserva de Emergência (Nível 2).</div>
      </div>
      <div class="form-group"><label class="form-label">Nome do Objetivo</label>
        <input class="form-control" type="text" id="meta-nome" placeholder="ex: Viagem em família, Troca do carro"></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Valor da Meta (R$)</label>
          <input class="form-control" type="number" id="meta-meta" step="0.01" placeholder="0,00"></div>
        <div class="form-group"><label class="form-label">Já Guardado (R$)</label>
          <input class="form-control" type="number" id="meta-guardado" step="0.01" placeholder="0,00" value="0"></div>
      </div>
      <div class="form-group"><label class="form-label">Aporte Mensal Planejado (R$)</label>
        <input class="form-control" type="number" id="meta-aporte" step="0.01" placeholder="0,00"></div>
      <div class="form-group"><label class="form-label">Observação (opcional)</label>
        <input class="form-control" type="text" id="meta-obs" placeholder="ex: Férias de fim de ano"></div>
    `, [
      { label:'Salvar', cls:'btn-success', action: async () => {
        const nome    = document.getElementById('meta-nome').value.trim();
        const meta    = parseFloat(document.getElementById('meta-meta').value) || 0;
        const guardado = parseFloat(document.getElementById('meta-guardado').value) || 0;
        const aporte  = parseFloat(document.getElementById('meta-aporte').value) || 0;
        const obs     = document.getElementById('meta-obs').value.trim();
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

  // ─── SAÚDE FINANCEIRA ─────────────────────────────────
  async function renderSaude(el) {
    el.innerHTML = skeletonSaude();
    try {
      const [recRows, despRows, divRows] = await Promise.all([
        Sheets.readAll(CONFIG.SHEETS.RECEITAS),
        Sheets.readAll(CONFIG.SHEETS.DESPESAS),
        Sheets.readAll(CONFIG.SHEETS.DIVIDAS),
      ]);
      const receitas = Sheets.parseReceitas(recRows);
      const despesas = Sheets.parseDespesas(despRows);
      const dividas  = Sheets.parseDividas(divRows);

      const mes = Financas.mesAtual();
      const ano = Financas.anoAtual();

      const renda  = Financas.calcRendaMensal(receitas, mes, ano);
      const gastos = Financas.calcGastosMensal(despesas, mes, ano);
      const { ativas, totalMensalParcelado } = Financas.calcParcelasAtivas(dividas);
      const semaforo = Financas.calcSemaforo(renda, gastos, ativas.length, totalMensalParcelado);
      const alertas  = Financas.alertaComprometimento(receitas, despesas, mes, ano);
      const hist     = Financas.calcHistorico(receitas, despesas, 6);
      const histMax  = Math.max(...hist.map(h => Math.max(h.rec, h.desp)), 1);

      const saldo     = renda.total - gastos.total;
      const poupPct   = renda.total > 0 ? Math.max(saldo / renda.total, 0) : 0;
      const comprPct  = renda.total > 0 ? totalMensalParcelado / renda.total : 0;

      // Cor do semáforo
      const corMap = { green:'#1E7B45', yellow:'#BF9000', orange:'#E07B39', red:'#C0392B', gray:'#6B7280' };
      const bgSem  = corMap[semaforo.cor];

      el.innerHTML = `

        <!-- ══ SEMÁFORO ══ -->
        <div class="semaforo-card" style="background:${bgSem}">
          <div class="sem-left">
            <div class="sem-luzes">
              <div class="sem-luz ${semaforo.cor === 'red'    ? 'ativa' : ''}" style="background:#C0392B"></div>
              <div class="sem-luz ${semaforo.cor === 'orange' ? 'ativa' : ''}" style="background:#E07B39"></div>
              <div class="sem-luz ${semaforo.cor === 'yellow' ? 'ativa' : ''}" style="background:#F1C40F"></div>
              <div class="sem-luz ${semaforo.cor === 'green'  ? 'ativa' : ''}" style="background:#27AE60"></div>
            </div>
          </div>
          <div class="sem-right">
            <div class="sem-emoji">${semaforo.emoji}</div>
            <div class="sem-titulo">${semaforo.titulo}</div>
            <div class="sem-label">${semaforo.label}</div>
            <div class="sem-score">Score: ${semaforo.score}/100</div>
          </div>
        </div>

        <!-- Legenda do semáforo -->
        <div class="sem-legenda">
          <div class="sem-leg-item"><span class="sem-leg-dot" style="background:#27AE60"></span> Verde — saudável (score ≥ 75)</div>
          <div class="sem-leg-item"><span class="sem-leg-dot" style="background:#F1C40F"></span> Amarelo — atenção (50–74)</div>
          <div class="sem-leg-item"><span class="sem-leg-dot" style="background:#E07B39"></span> Laranja — preocupante (25–49)</div>
          <div class="sem-leg-item"><span class="sem-leg-dot" style="background:#C0392B"></span> Vermelho — crítico (0–24)</div>
        </div>

        <!-- Alertas individuais -->
        ${alertas.length ? `
          <p class="section-title">⚠️ Alertas Pessoais</p>
          ${alertas.map(a => `
            <div class="alerta-card alerta-${a.nivel}">
              <div class="alerta-avatar">${a.nome[0]}</div>
              <div class="alerta-texto">
                <strong>${a.nome}</strong>, você ${a.msg} este mês.
                <div class="progress-bar mt-4" style="height:10px">
                  <div class="progress-fill ${a.nivel === 'danger' ? 'danger' : a.nivel === 'warn' ? 'warn' : ''}"
                       style="width:${Math.min(a.pct*100,100).toFixed(0)}%"></div>
                </div>
                <div style="font-size:11px;margin-top:3px;opacity:.8">${(a.pct*100).toFixed(0)}% do salário utilizado</div>
              </div>
            </div>
          `).join('')}
        ` : ''}

        <!-- Mensagens do semáforo -->
        ${semaforo.msgs.length ? `
          <p class="section-title">Diagnóstico</p>
          <div class="card mb-12"><div class="card-body" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
            ${semaforo.msgs.map(m => `
              <div class="diag-item diag-${m.tipo}">
                <span class="diag-icon">${m.tipo==='ok'?'✅':m.tipo==='warn'?'⚠️':'🔴'}</span>
                <span>${m.txt}</span>
              </div>
            `).join('')}
          </div></div>
        ` : ''}

        <!-- ══ GRÁFICO RENDA vs GASTOS ══ -->
        <p class="section-title">Renda × Gastos — Últimos 6 Meses</p>
        <div class="card mb-12">
          <div class="card-body">
            <div class="rel-legend">
              <span class="rel-legend-dot" style="background:var(--green)"></span> Renda &nbsp;
              <span class="rel-legend-dot" style="background:var(--red)"></span> Gastos
            </div>
            <div class="rel-chart" style="height:140px">
              ${hist.map(h => `
                <div class="rel-col">
                  <div class="rel-bars" style="height:120px">
                    <div class="rel-bar rel-bar-rec"  style="height:${(h.rec /histMax*100).toFixed(1)}%" title="Renda: ${fmt(h.rec)}"></div>
                    <div class="rel-bar rel-bar-desp" style="height:${(h.desp/histMax*100).toFixed(1)}%" title="Gastos: ${fmt(h.desp)}"></div>
                  </div>
                  <div class="rel-col-label" style="${h.saldo < 0 ? 'color:var(--red)' : ''}">${h.mes}</div>
                </div>
              `).join('')}
            </div>
            <div class="hist-totais">
              ${hist.map(h => `<div class="hist-tot-col ${h.saldo < 0 ? 'neg' : 'pos'}">${h.saldo >= 0 ? '+' : ''}${fmtK(h.saldo)}</div>`).join('')}
            </div>
          </div>
        </div>

        <!-- ══ RENDA vs GASTOS (mês atual) ══ -->
        <p class="section-title">Mês Atual — Composição da Renda</p>
        <div class="card mb-12"><div class="card-body">

          <!-- Joelson -->
          <div class="pessoa-row">
            <div class="pessoa-avatar" style="background:var(--blue)">J</div>
            <div class="pessoa-info">
              <div class="pessoa-nome">Joelson</div>
              <div class="pessoa-vals">Renda ${fmt(renda.joelson)} · Gastos ${fmt(gastos.joelson)}</div>
              <div class="progress-bar mt-4">
                <div class="progress-fill ${renda.joelson > 0 && gastos.joelson/renda.joelson > .9 ? 'danger' : renda.joelson > 0 && gastos.joelson/renda.joelson > .7 ? 'warn' : ''}"
                     style="width:${renda.joelson > 0 ? Math.min(gastos.joelson/renda.joelson*100,100).toFixed(0) : 0}%"></div>
              </div>
              <div class="pessoa-pct">${renda.joelson > 0 ? (gastos.joelson/renda.joelson*100).toFixed(0) : 0}% utilizado</div>
            </div>
          </div>

          <!-- Raquel -->
          <div class="pessoa-row" style="margin-top:16px">
            <div class="pessoa-avatar" style="background:var(--green-em)">R</div>
            <div class="pessoa-info">
              <div class="pessoa-nome">Raquel</div>
              <div class="pessoa-vals">Renda ${fmt(renda.raquel)} · Gastos ${fmt(gastos.raquel)}</div>
              <div class="progress-bar mt-4">
                <div class="progress-fill ${renda.raquel > 0 && gastos.raquel/renda.raquel > .9 ? 'danger' : renda.raquel > 0 && gastos.raquel/renda.raquel > .7 ? 'warn' : ''}"
                     style="width:${renda.raquel > 0 ? Math.min(gastos.raquel/renda.raquel*100,100).toFixed(0) : 0}%"></div>
              </div>
              <div class="pessoa-pct">${renda.raquel > 0 ? (gastos.raquel/renda.raquel*100).toFixed(0) : 0}% utilizado</div>
            </div>
          </div>

          <!-- Total família -->
          <div class="familia-total">
            <div class="ft-item">
              <span class="ft-label">Renda Total</span>
              <span class="ft-val text-green">${fmt(renda.total)}</span>
            </div>
            <div class="ft-sep">−</div>
            <div class="ft-item">
              <span class="ft-label">Gastos Totais</span>
              <span class="ft-val text-red">${fmt(gastos.total)}</span>
            </div>
            <div class="ft-sep">=</div>
            <div class="ft-item">
              <span class="ft-label">Saldo</span>
              <span class="ft-val ${saldo >= 0 ? 'text-green' : 'text-red'}">${fmt(saldo)}</span>
            </div>
          </div>
        </div></div>

        <!-- ══ PRINCÍPIO FUNDAMENTAL ══ -->
        <div class="principio-card">
          <div class="principio-icon">💡</div>
          <div class="principio-texto">
            <strong>Princípio fundamental:</strong> Gastar menos do que ganhamos.
            <div class="principio-detalhe">
              Meta de poupança: <strong>20% da renda</strong> · Comprometimento atual: <strong>${(comprPct*100).toFixed(0)}% em parcelas</strong> · Poupança atual: <strong class="${poupPct >= 0.2 ? 'text-green' : poupPct >= 0.1 ? 'text-orange' : 'text-red'}">${(poupPct*100).toFixed(0)}%</strong>
            </div>
          </div>
        </div>

        <!-- ══ PARCELAS ATIVAS ══ -->
        <p class="section-title">Parcelas em Aberto (${ativas.length})</p>
        ${ativas.length ? `
          <div class="card mb-12"><div class="card-body" style="padding:0">
            ${ativas.sort((a,b) => b.dataFim - a.dataFim).map(p => {
              const pct = p.nParc > 0 ? p.pagas / p.nParc : 0;
              return `<div class="orc-row">
                <div class="orc-cat">
                  <div style="font-weight:600;font-size:13px">${p.desc}</div>
                  <div style="font-size:11px;color:var(--gray-500)">${p.resp} · vence em ${p.dataFimStr}</div>
                </div>
                <div style="flex:0 0 100px">
                  <div class="progress-bar"><div class="progress-fill" style="width:${(pct*100).toFixed(0)}%"></div></div>
                  <div style="font-size:10px;color:var(--gray-500);margin-top:2px">${p.pagas}/${p.nParc} pagas</div>
                </div>
                <div style="text-align:right;min-width:72px;font-size:13px;font-weight:600;color:var(--red)">${fmt(p.parcela)}/mês</div>
              </div>`;
            }).join('')}
            <div class="orc-row" style="background:var(--gray-50)">
              <div class="orc-cat" style="font-weight:700;color:var(--navy)">Total mensal em parcelas</div>
              <div></div>
              <div style="text-align:right;min-width:72px;font-size:14px;font-weight:700;color:var(--red)">${fmt(totalMensalParcelado)}</div>
            </div>
          </div></div>
          <div class="comp-bar-wrap">
            <div class="comp-label">Comprometimento da renda familiar com parcelas</div>
            <div class="comp-bar">
              <div class="comp-fill" style="width:${Math.min(comprPct*100,100).toFixed(0)}%;background:${comprPct>0.5?'#C0392B':comprPct>0.3?'#E07B39':'#1E7B45'}"></div>
              <div class="comp-mark" style="left:30%"><span>30%</span></div>
              <div class="comp-mark" style="left:50%"><span>50%</span></div>
            </div>
            <div class="comp-legend">
              <span>0%</span><span style="color:${comprPct>0.5?'#C0392B':comprPct>0.3?'#E07B39':'#1E7B45'};font-weight:700">${(comprPct*100).toFixed(1)}% atual</span><span>100%</span>
            </div>
          </div>
        ` : `<div class="empty-state"><p>🎉 Nenhuma parcela em aberto!</p></div>`}
      `;
    } catch(e) { el.innerHTML = erro(e); console.error(e); }
  }

  function skeletonSaude() {
    return `
      <div class="skeleton" style="height:110px;border-radius:16px;margin-bottom:16px"></div>
      <div class="skeleton" style="height:60px;border-radius:12px;margin-bottom:20px"></div>
      <div class="skeleton" style="height:160px;border-radius:12px;margin-bottom:20px"></div>
      <div class="skeleton" style="height:120px;border-radius:12px;margin-bottom:20px"></div>
      ${[1,2,3].map(()=>'<div class="skeleton skel-row" style="margin-bottom:6px"></div>').join('')}
    `;
  }

  // Formata em K para o gráfico histórico
  function fmtK(v) {
    if (Math.abs(v) >= 1000) return (v/1000).toFixed(1) + 'k';
    return v.toFixed(0);
  }
  async function renderRelatorio(el) {
    el.innerHTML = skeletonRelatorio();
    try {
      const [recRows, despRows, orcRows] = await Promise.all([
        Sheets.readAll(CONFIG.SHEETS.RECEITAS),
        Sheets.readAll(CONFIG.SHEETS.DESPESAS),
        Sheets.readAll(CONFIG.SHEETS.ORCAMENTO),
      ]);
      const receitas = Sheets.parseReceitas(recRows);
      const despesas = Sheets.parseDespesas(despRows);
      const orc      = Sheets.parseOrcamento(orcRows);

      // Mês/ano selecionado (padrão: atual)
      const agora = new Date();
      let mesSel = parseInt(el.dataset.mes || agora.getMonth() + 1);
      let anoSel = parseInt(el.dataset.ano || agora.getFullYear());

      function filtrarPeriodo(items, campo = 'data') {
        return items.filter(i => {
          if (!i[campo]) return false;
          const [y,m] = i[campo].split('-').map(Number);
          return y === anoSel && m === mesSel;
        });
      }
      function filtrarMesAnterior(items, campo = 'data') {
        let m = mesSel - 1, y = anoSel;
        if (m === 0) { m = 12; y--; }
        return items.filter(i => {
          if (!i[campo]) return false;
          const [iy,im] = i[campo].split('-').map(Number);
          return iy === y && im === m;
        });
      }

      const recMes   = filtrarPeriodo(receitas);
      const despMes  = filtrarPeriodo(despesas);
      const recAnt   = filtrarMesAnterior(receitas);
      const despAnt  = filtrarMesAnterior(despesas);

      const totRec   = recMes.reduce((s,i) => s + i.valor, 0);
      const totDesp  = despMes.reduce((s,i) => s + i.valor, 0);
      const saldo    = totRec - totDesp;
      const poupanca = totRec > 0 ? saldo / totRec : 0;

      const totRecAnt  = recAnt.reduce((s,i) => s + i.valor, 0);
      const totDespAnt = despAnt.reduce((s,i) => s + i.valor, 0);

      // Despesas por categoria
      const catMap = {};
      despMes.forEach(d => { catMap[d.cat] = (catMap[d.cat] || 0) + d.valor; });
      const catsSorted = Object.entries(catMap).sort((a,b) => b[1] - a[1]);
      const maxCat = catsSorted[0]?.[1] || 1;

      // Despesas por membro
      const membroMap = {};
      CONFIG.MEMBROS.forEach(m => {
        membroMap[m] = despMes.filter(d => d.para === m).reduce((s,d) => s + d.valor, 0);
      });

      // Receitas por categoria
      const recCatMap = {};
      recMes.forEach(r => { recCatMap[r.cat] = (recCatMap[r.cat] || 0) + r.valor; });

      // Comparativo receita/despesa (últimos 6 meses)
      const hist = [];
      for (let i = 5; i >= 0; i--) {
        let m = agora.getMonth() + 1 - i;
        let y = agora.getFullYear();
        while (m <= 0) { m += 12; y--; }
        const r = receitas.filter(x => { if (!x.data) return false; const [iy,im] = x.data.split('-').map(Number); return iy===y&&im===m; }).reduce((s,x)=>s+x.valor,0);
        const d = despesas.filter(x => { if (!x.data) return false; const [iy,im] = x.data.split('-').map(Number); return iy===y&&im===m; }).reduce((s,x)=>s+x.valor,0);
        hist.push({ mes: MESES_ABREV[m-1], rec: r, desp: d });
      }
      const histMax = Math.max(...hist.map(h => Math.max(h.rec, h.desp)), 1);

      // Nomes dos meses para o seletor
      const nomeMesSel = MESES_NOMES[mesSel-1];
      const mesesOpts = MESES_NOMES.map((n,i) =>
        `<option value="${i+1}" ${i+1===mesSel?'selected':''}>${n}</option>`).join('');
      const anosOpts = [anoSel-1, anoSel, anoSel+1].map(y =>
        `<option value="${y}" ${y===anoSel?'selected':''}>${y}</option>`).join('');

      el.innerHTML = `
        <!-- SELETOR DE PERÍODO -->
        <div class="rel-period-bar">
          <div class="rel-period-label">Relatório de</div>
          <div class="rel-period-selects">
            <select class="form-control rel-select" id="rel-mes" onchange="Pages._relChangePeriod()">${mesesOpts}</select>
            <select class="form-control rel-select" id="rel-ano" onchange="Pages._relChangePeriod()">${anosOpts}</select>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="Pages.exportarRelatorio('${nomeMesSel} ${anoSel}')">
            <svg viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            PDF
          </button>
        </div>

        <!-- RESUMO EXECUTIVO -->
        <p class="section-title">Resumo — ${nomeMesSel} ${anoSel}</p>
        <div class="kpi-grid">
          <div class="kpi-card kpi-green">
            <div class="kpi-label">Receitas</div>
            <div class="kpi-value">${fmt(totRec)}</div>
            ${totRecAnt > 0 ? `<div class="kpi-sub">${totRec >= totRecAnt ? '▲' : '▼'} ${fmt(Math.abs(totRec - totRecAnt))} vs mês ant.</div>` : ''}
          </div>
          <div class="kpi-card kpi-red">
            <div class="kpi-label">Despesas</div>
            <div class="kpi-value">${fmt(totDesp)}</div>
            ${totDespAnt > 0 ? `<div class="kpi-sub">${totDesp >= totDespAnt ? '▲' : '▼'} ${fmt(Math.abs(totDesp - totDespAnt))} vs mês ant.</div>` : ''}
          </div>
          <div class="kpi-card ${saldo >= 0 ? 'kpi-blue' : 'kpi-orange'}">
            <div class="kpi-label">Saldo</div>
            <div class="kpi-value">${fmt(saldo)}</div>
          </div>
          <div class="kpi-card ${poupanca >= 0.2 ? 'kpi-teal' : poupanca >= 0.1 ? 'kpi-gold' : 'kpi-orange'}">
            <div class="kpi-label">Taxa de Poupança</div>
            <div class="kpi-value">${fmtPct(Math.max(poupanca, 0))}</div>
            <div class="kpi-sub">Meta recomendada: 20%</div>
          </div>
        </div>

        <!-- GRÁFICO DE BARRAS HISTÓRICO (últimos 6 meses) -->
        <p class="section-title">Histórico — Últimos 6 Meses</p>
        <div class="card mb-12">
          <div class="card-body">
            <div class="rel-legend">
              <span class="rel-legend-dot" style="background:var(--green)"></span> Receitas
              <span class="rel-legend-dot" style="background:var(--red); margin-left:12px"></span> Despesas
            </div>
            <div class="rel-chart">
              ${hist.map(h => `
                <div class="rel-col">
                  <div class="rel-bars">
                    <div class="rel-bar rel-bar-rec" style="height:${(h.rec/histMax*100).toFixed(1)}%" title="Receitas: ${fmt(h.rec)}"></div>
                    <div class="rel-bar rel-bar-desp" style="height:${(h.desp/histMax*100).toFixed(1)}%" title="Despesas: ${fmt(h.desp)}"></div>
                  </div>
                  <div class="rel-col-label">${h.mes}</div>
                </div>
              `).join('')}
            </div>
            <div class="rel-chart-scale">
              <span>${fmt(histMax)}</span>
              <span>${fmt(histMax/2)}</span>
              <span>R$ 0</span>
            </div>
          </div>
        </div>

        <!-- DESPESAS POR CATEGORIA -->
        <p class="section-title">Despesas por Categoria</p>
        ${catsSorted.length ? `<div class="card mb-12"><div class="card-body" style="padding:0">
          ${catsSorted.map(([cat, val]) => {
            const meta = orc.find(o => o.cat === cat)?.meta || 0;
            const pct  = meta > 0 ? Math.min(val / meta, 1) : val / maxCat;
            const over = meta > 0 && val > meta;
            return `<div class="orc-row">
              <div class="orc-cat">${cat}</div>
              <div style="flex:0 0 120px">
                <div class="progress-bar">
                  <div class="progress-fill ${over ? 'danger' : ''}" style="width:${(val/maxCat*100).toFixed(1)}%"></div>
                </div>
              </div>
              <div style="text-align:right;min-width:80px;font-size:13px;font-weight:600;${over?'color:var(--red)':''}">${fmt(val)}</div>
              ${meta > 0 ? `<div style="text-align:right;min-width:80px;font-size:11px;color:var(--gray-500)">/ ${fmt(meta)}</div>` : '<div style="min-width:80px"></div>'}
            </div>`;
          }).join('')}
        </div></div>` : '<div class="empty-state"><p>Sem despesas neste período</p></div>'}

        <!-- GASTOS POR MEMBRO -->
        <p class="section-title">Gastos por Membro da Família</p>
        <div class="rel-members-grid">
          ${CONFIG.MEMBROS.map(m => {
            const val = membroMap[m] || 0;
            const pct = totDesp > 0 ? val / totDesp : 0;
            const cores = { 'Joelson':'kpi-blue','Raquel':'kpi-teal','Davi':'kpi-navy','Luísa':'kpi-gold','Família (geral)':'kpi-gray' };
            return `<div class="kpi-card ${cores[m]||'kpi-gray'}">
              <div class="kpi-label">${m}</div>
              <div class="kpi-value">${fmt(val)}</div>
              <div class="kpi-sub">${fmtPct(pct)} do total</div>
            </div>`;
          }).join('')}
        </div>

        <!-- RECEITAS DETALHADAS -->
        <p class="section-title">Entradas — ${nomeMesSel}</p>
        ${recMes.length ? `<div class="table-wrap mb-12">
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Responsável</th><th class="text-right">Valor</th></tr></thead>
            <tbody>
              ${recMes.sort((a,b)=>b.data.localeCompare(a.data)).map(r => `<tr>
                <td>${fmtDate(r.data)}</td>
                <td>${r.desc}</td>
                <td><span class="badge badge-green">${r.resp}</span></td>
                <td class="td-num text-green">+${fmt(r.valor)}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot><tr><td colspan="3"><strong>Total Receitas</strong></td><td class="td-num">${fmt(totRec)}</td></tr></tfoot>
          </table>
        </div>` : '<div class="empty-state" style="padding:24px"><p>Sem receitas neste período</p></div>'}

        <!-- DESPESAS DETALHADAS -->
        <p class="section-title">Saídas — ${nomeMesSel}</p>
        ${despMes.length ? `<div class="table-wrap mb-12">
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Para</th><th>Categoria</th><th class="text-right">Valor</th></tr></thead>
            <tbody>
              ${despMes.sort((a,b)=>b.data.localeCompare(a.data)).map(d => `<tr>
                <td>${fmtDate(d.data)}</td>
                <td>${d.desc}</td>
                <td><span class="badge badge-blue">${d.para}</span></td>
                <td class="text-xs text-gray">${d.cat}</td>
                <td class="td-num text-red">-${fmt(d.valor)}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot><tr><td colspan="4"><strong>Total Despesas</strong></td><td class="td-num">${fmt(totDesp)}</td></tr></tfoot>
          </table>
        </div>` : '<div class="empty-state" style="padding:24px"><p>Sem despesas neste período</p></div>'}
      `;

      // salva período no elemento para o seletor de mês
      el.dataset.mes = mesSel;
      el.dataset.ano = anoSel;

    } catch(e) { el.innerHTML = erro(e); console.error(e); }
  }

  const MESES_NOMES  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MESES_ABREV  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Callback do seletor de período
  function _relChangePeriod() {
    const el = document.getElementById('page-relatorio');
    el.dataset.mes = document.getElementById('rel-mes').value;
    el.dataset.ano = document.getElementById('rel-ano').value;
    renderRelatorio(el);
  }

  // ─── EXPORTAR PDF ─────────────────────────────────────
  function exportarRelatorio(titulo) {
    // Abre janela de impressão do browser com CSS específico para print
    const style = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: Inter, sans-serif; }
        body { padding: 32px; color: #111; font-size: 13px; }
        h1 { font-size: 22px; color: #1F3864; margin-bottom: 4px; }
        .sub { color: #6B7280; font-size: 12px; margin-bottom: 24px; }
        .kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
        .kpi { padding: 12px; border-radius: 8px; color: white; }
        .kpi-label { font-size: 10px; font-weight: 600; text-transform: uppercase; opacity:.85; }
        .kpi-value { font-size: 18px; font-weight: 700; margin-top: 4px; }
        .sec { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #6B7280; margin: 16px 0 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
        th { background: #1F3864; color: white; padding: 7px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
        td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; }
        .tr { text-align: right; }
        .green { color: #1E7B45; } .red { color: #C0392B; }
        tfoot td { font-weight: 700; background: #f9fafb; }
        .bar-wrap { height: 6px; background: #eee; border-radius: 99px; overflow: hidden; display: inline-block; width: 80px; vertical-align: middle; }
        .bar-fill { height: 100%; background: #4CAF91; border-radius: 99px; }
        .bar-fill.danger { background: #C0392B; }
        @media print { body { padding: 20px; } }
      </style>
    `;

    const el   = document.getElementById('page-relatorio');
    const kpis = el.querySelectorAll('.kpi-card');
    const cats = el.querySelectorAll('.orc-row');
    const tabRec  = el.querySelectorAll('table')[0]?.innerHTML || '';
    const tabDesp = el.querySelectorAll('table')[1]?.innerHTML || '';

    let kpiHTML = '<div class="kpis">';
    kpis.forEach(k => {
      const label = k.querySelector('.kpi-label')?.textContent || '';
      const value = k.querySelector('.kpi-value')?.textContent || '';
      const bg = k.classList.contains('kpi-green') ? '#1E7B45'
               : k.classList.contains('kpi-red')   ? '#C0392B'
               : k.classList.contains('kpi-blue')  ? '#2E5395'
               : k.classList.contains('kpi-teal')  ? '#1E8A7D'
               : k.classList.contains('kpi-gold')  ? '#BF9000'
               : k.classList.contains('kpi-orange')? '#E07B39'
               : '#374151';
      kpiHTML += `<div class="kpi" style="background:${bg}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`;
    });
    kpiHTML += '</div>';

    let catHTML = '<table><thead><tr><th>Categoria</th><th>Realizado</th><th>Meta</th></tr></thead><tbody>';
    cats.forEach(row => {
      const cells = row.querySelectorAll('.orc-cat, [style*="font-weight:600"], [style*="font-size:11px"]');
      const cat = cells[0]?.textContent || '';
      const val = cells[1]?.textContent || '';
      const meta = cells[2]?.textContent || '—';
      if (cat) catHTML += `<tr><td>${cat}</td><td class="tr">${val}</td><td class="tr">${meta}</td></tr>`;
    });
    catHTML += '</tbody></table>';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório ${titulo}</title>${style}</head><body>
      <h1>Relatório Mensal — ${titulo}</h1>
      <div class="sub">Família: Joelson, Raquel, Davi e Luísa · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
      ${kpiHTML}
      <div class="sec">Despesas por Categoria</div>${catHTML}
      ${tabRec ? `<div class="sec">Receitas Detalhadas</div><table>${tabRec}</table>` : ''}
      ${tabDesp ? `<div class="sec">Despesas Detalhadas</div><table>${tabDesp}</table>` : ''}
    </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

  function skeletonRelatorio() {
    return `
      <div class="skeleton" style="height:40px;border-radius:8px;margin-bottom:20px"></div>
      <div class="kpi-grid">${[1,2,3,4].map(()=>'<div class="skeleton skel-kpi"></div>').join('')}</div>
      <div class="skeleton" style="height:160px;border-radius:12px;margin:20px 0"></div>
      ${[1,2,3,4,5].map(()=>'<div class="skeleton skel-row" style="margin-bottom:6px"></div>').join('')}
    `;
  }

  return {
    renderPainel, renderSaude, renderContas, renderReceitas, renderDespesas,
    renderOrcamento, renderCartao, renderDividas, renderMetas,
    renderRelatorio, exportarRelatorio, _relChangePeriod,
    openNovaReceita, openNovaDespesa, openNovaDivida, openNovaMeta,
    openNovaMetaReserva, openEditarContas, openEditarOrcamento, openAtualizarMeta,
    registrarPagamentoDivida, deletarLancamento, openModal, closeModal, toast,
    _toggleParcelado, _calcImpactoParc, _calcImpactoDivida,
  };
})();
