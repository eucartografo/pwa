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

  const ICON_EDIT = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;color:var(--gray-300)"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';

  // ─── Celebração ao quitar uma parcela de dívida ────────
  // Confete em CSS/JS puro (sem biblioteca) + um acorde curto via Web Audio
  // API (sem arquivo de áudio). Recompensa visual/sonora pra reforçar o
  // hábito de quitar dívidas.
  const CONFETE_CORES = ['#1E7B45', '#2E5395', '#E07B39', '#BF9000', '#C0392B', '#4CAF91'];

  function lancarConfete(quantidade = 60) {
    const container = document.createElement('div');
    container.className = 'confete-container';
    document.body.appendChild(container);
    for (let i = 0; i < quantidade; i++) {
      const pedaco = document.createElement('div');
      pedaco.className = 'confete-pedaco';
      pedaco.style.left = `${Math.random() * 100}vw`;
      pedaco.style.background = CONFETE_CORES[Math.floor(Math.random() * CONFETE_CORES.length)];
      pedaco.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
      pedaco.style.animationDelay = `${Math.random() * 0.35}s`;
      pedaco.style.setProperty('--giro', `${360 + Math.random() * 540}deg`);
      container.appendChild(pedaco);
    }
    setTimeout(() => container.remove(), 3200);
  }

  function tocarSomSucesso(grande = false) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const notas = grande ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 987.77];
      notas.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const inicio = ctx.currentTime + i * 0.09;
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, inicio);
        gain.gain.exponentialRampToValueAtTime(0.22, inicio + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(inicio);
        osc.stop(inicio + 0.45);
      });
      setTimeout(() => ctx.close(), (notas.length * 90 + 500));
    } catch(e) { /* áudio bloqueado/indisponível: segue sem som, sem quebrar o fluxo */ }
  }

  // Gap (em %) entre colunas do gráfico "Receitas × Dívidas com Despesas em
  // linha" — tem que ser exatamente o mesmo valor do `gap` de `.hd-chart` em
  // style.css, senão a linha em SVG desalinha das barras em flexbox.
  const GAP_HD_CHART_PCT = 1.5;

  // Gráfico de rosca (donut) em SVG puro, sem bibliotecas — usado no Painel
  // para mostrar a quebra de despesas por categoria ("para onde foi o dinheiro").
  function svgDonut(slices, size = 150, stroke = 24) {
    const total = slices.reduce((s, x) => s + x.valor, 0);
    if (total <= 0) return '';
    const r = (size - stroke) / 2;
    const cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    let acc = 0;
    const arcos = slices.map(s => {
      const frac = s.valor / total;
      const len = frac * circ;
      const rotate = -90 + acc * 360;
      acc += frac;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}"
        stroke-dasharray="${len.toFixed(1)} ${(circ - len).toFixed(1)}"
        transform="rotate(${rotate.toFixed(1)} ${cx} ${cy})"/>`;
    }).join('');
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${arcos}</svg>`;
  }

  // Estatística secundária em formato compacto (ícone de cor + label + valor),
  // usada no Painel para números de apoio que não precisam do destaque de um
  // kpi-card grande — mantém a hierarquia visual focada no que importa mais.
  function statChip(label, value, colorVar, sub = '') {
    return `<div class="stat-chip" style="border-left-color:var(${colorVar})">
      <div class="stat-chip-label">${label}</div>
      <div class="stat-chip-val" style="color:var(${colorVar})">${value}</div>
      ${sub ? `<div class="stat-chip-sub">${sub}</div>` : ''}
    </div>`;
  }

  // ─── Detecção de lançamento duplicado ──────────────────
  // Mesma data + mesmo valor + descrição igual (ignorando maiúsculas/espaços)
  // já existente no cache da página. excludeRow evita comparar um registro
  // em edição com ele mesmo.
  function encontrarDuplicata(cache, data, desc, valor, excludeRow = null) {
    if (!cache) return null;
    const descNorm = desc.trim().toLowerCase();
    return cache.find(i =>
      i._row !== excludeRow && i.data === data &&
      Math.abs(i.valor - valor) < 0.01 &&
      i.desc.trim().toLowerCase() === descNorm
    ) || null;
  }

  // Se houver duplicata, pede confirmação antes de rodar `salvar`; senão, roda direto.
  function confirmarSeDuplicado(duplicata, rotulo, salvar) {
    if (!duplicata) return salvar();
    openModal('Possível lançamento duplicado', `
      <p class="text-sm" style="line-height:1.5">
        Já existe ${rotulo} parecido: <strong>${duplicata.desc}</strong> em ${fmtDate(duplicata.data)}
        no valor de ${fmt(duplicata.valor)}. Deseja lançar mesmo assim?
      </p>
    `, [
      { label: 'Cancelar', cls: 'btn-ghost', action: async () => { closeModal(); } },
      { label: 'Lançar mesmo assim', cls: 'btn-primary', action: async () => { await salvar(); } },
    ]);
  }

  // ─── Confirmação antes de excluir (substitui window.confirm) ──
  function confirmModal(message, onConfirm) {
    openModal('Confirmar exclusão', `<p class="text-sm" style="line-height:1.5">${message}</p>`, [
      { label: 'Cancelar', cls: 'btn-ghost', action: async () => { closeModal(); } },
      { label: 'Excluir', cls: 'btn-danger', action: async () => { closeModal(); await onConfirm(); } },
    ]);
  }

  // ─── PAINEL ───────────────────────────────────────────
  async function renderPainel(el) {
    el.innerHTML = skeletonPainel();
    try {
      const [recRows, despRows, contRows, metRows, divRows] = await Promise.all([
        Sheets.readAll(CONFIG.SHEETS.RECEITAS),
        Sheets.readAll(CONFIG.SHEETS.DESPESAS),
        Sheets.readAll(CONFIG.SHEETS.CONTAS),
        Sheets.readAll(CONFIG.SHEETS.METAS),
        Sheets.readAll(CONFIG.SHEETS.DIVIDAS),
      ]);
      const receitas  = Sheets.parseReceitas(recRows);
      const despesas  = Sheets.parseDespesas(despRows);
      const contas    = Sheets.parseContas(contRows);
      const metas     = Sheets.parseMetas(metRows);
      const dividas   = Sheets.parseDividas(divRows);

      const recMes    = filtrarMesAtual(receitas).reduce((s,i) => s + i.valor, 0);
      const despMes   = filtrarMesAtual(despesas).reduce((s,i) => s + i.valor, 0);
      const saldoMes  = recMes - despMes;
      const saldoTotal = contas.reduce((s,c) => s + c.saldo, 0);
      const reserva   = contas.find(c => c.nome === 'Reserva de Emergência')?.saldo || 0;
      const totalDavi  = filtrarMesAtual(despesas).filter(d => d.para === 'Davi').reduce((s,i) => s + i.valor, 0);
      const totalLuisa = filtrarMesAtual(despesas).filter(d => d.para === 'Luísa').reduce((s,i) => s + i.valor, 0);

      // Saldo acumulado: soma de TODAS as receitas/despesas já lançadas, desde o início.
      // Não zera na virada do mês — é o contraponto ao "Saldo do Mês".
      const saldoAcumulado = receitas.reduce((s,i) => s + i.valor, 0) - despesas.reduce((s,i) => s + i.valor, 0);

      // Saldo do mês anterior, para comparação ao lado do saldo atual.
      const { mes: mesAnt, ano: anoAnt } = Financas.mesAnterior(Financas.mesAtual(), Financas.anoAtual());
      const recMesAnt  = Financas.filtrarPeriodo(receitas, 'data', mesAnt, anoAnt).reduce((s,i) => s + i.valor, 0);
      const despMesAnt = Financas.filtrarPeriodo(despesas, 'data', mesAnt, anoAnt).reduce((s,i) => s + i.valor, 0);
      const saldoMesAnt = recMesAnt - despMesAnt;
      const houveMesAnt = recMesAnt > 0 || despMesAnt > 0;

      // Dívidas em aberto — resumo e parcelas para marcar como pagas direto no Painel.
      const { ativas: parcelasAtivas, totalMensalParcelado } = Financas.calcParcelasAtivas(dividas);
      const totalDevedor = parcelasAtivas.reduce((s,d) => s + (d.total - d.parcela * d.pagas), 0);

      // "Para onde foi o dinheiro": despesas por categoria no mês, comparadas
      // com o mês anterior, + a maior despesa individual do mês.
      const catAtual = Financas.calcGastosPorCategoria(despesas, mesAtual(), anoAtual());
      const catAntMap = Object.fromEntries(
        Financas.calcGastosPorCategoria(despesas, mesAnt, anoAnt).map(c => [c.cat, c.valor])
      );
      const PALETA_CAT = ['#2E5395', '#1E7B45', '#E07B39', '#BF9000', '#C0392B'];
      const catSlices = catAtual.slice(0, 5).map((c, i) => ({ cat: c.cat, valor: c.valor, color: PALETA_CAT[i] }));
      const restanteCat = catAtual.slice(5).reduce((s,c) => s + c.valor, 0);
      if (restanteCat > 0) catSlices.push({ cat: 'Outras', valor: restanteCat, color: '#6B7280' });
      const totalCatAtual = catSlices.reduce((s,c) => s + c.valor, 0);
      const maiorGasto = filtrarMesAtual(despesas).reduce((max, d) => (!max || d.valor > max.valor) ? d : max, null);

      const recentes = [...filtrarMesAtual(receitas).slice(-3).map(i => ({...i, tipo:'rec'})),
                        ...filtrarMesAtual(despesas).slice(-3).map(i => ({...i, tipo:'desp'}))]
        .sort((a,b) => b.data.localeCompare(a.data)).slice(0, 6);

      el.innerHTML = `
        <p class="text-xs text-gray mb-12">${new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</p>

        <p class="section-title" style="margin-top:0">Para Onde Foi Seu Dinheiro em ${MESES_NOMES[mesAtual()-1]}</p>
        ${catSlices.length ? `
          <div class="card mb-12"><div class="card-body">
            ${catSlices[0] ? `<p class="donut-headline">Você gastou <strong>${fmt(totalCatAtual)}</strong> este mês: <strong>${fmtPct(catSlices[0].valor / totalCatAtual)}</strong> foi com <strong>${catSlices[0].cat}</strong>.</p>` : ''}
            <div class="donut-wrap">
              ${svgDonut(catSlices, 190, 30)}
              <div class="donut-center">
                <div class="donut-center-val">${fmt(totalCatAtual)}</div>
                <div class="donut-center-label">gasto no mês</div>
              </div>
            </div>
            <div class="donut-legend">
              ${catSlices.map(s => {
                const pct = totalCatAtual > 0 ? s.valor / totalCatAtual : 0;
                const ant = catAntMap[s.cat] || 0;
                const delta = ant > 0 ? ((s.valor - ant) / ant * 100) : null;
                return `<div class="donut-leg-row">
                  <span class="donut-dot" style="background:${s.color}"></span>
                  <span class="donut-leg-cat">${s.cat}</span>
                  <span class="donut-leg-val">${fmt(s.valor)}</span>
                  <span class="donut-leg-pct">${fmtPct(pct)}</span>
                  ${delta !== null
                    ? `<span class="donut-leg-delta ${delta >= 0 ? 'text-red' : 'text-green'}">${delta >= 0 ? '▲' : '▼'}${Math.abs(delta).toFixed(0)}%</span>`
                    : `<span class="donut-leg-delta text-gray">novo</span>`}
                </div>`;
              }).join('')}
            </div>
          </div></div>
          ${maiorGasto ? `
          <div class="card mb-12" style="border-left:4px solid var(--red)">
            <div class="card-body" style="display:flex;align-items:center;gap:12px">
              <div style="font-size:28px">🔥</div>
              <div style="flex:1;min-width:0">
                <div class="text-xs text-gray" style="text-transform:uppercase;font-weight:700;letter-spacing:.4px">Maior gasto do mês</div>
                <div style="font-weight:700;font-size:15px">${maiorGasto.desc}</div>
                <div class="text-sm text-gray">${fmtDate(maiorGasto.data)} · ${maiorGasto.cat} · ${maiorGasto.para}</div>
              </div>
              <div style="font-size:18px;font-weight:700;color:var(--red);flex-shrink:0">${fmt(maiorGasto.valor)}</div>
            </div>
          </div>` : ''}
        ` : '<div class="empty-state"><p>Nenhuma despesa lançada neste mês ainda</p></div>'}

        <div class="kpi-grid" style="grid-template-columns:1fr 1fr 1fr">
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
            ${houveMesAnt ? `<div class="kpi-sub">Mês anterior: ${fmt(saldoMesAnt)}</div>` : ''}
          </div>
        </div>

        <div class="stat-chip-row">
          ${statChip('Saldo em Contas', fmt(saldoTotal), '--navy')}
          ${statChip('Saldo Acumulado', fmt(saldoAcumulado), saldoAcumulado >= 0 ? '--green' : '--orange', 'desde o início')}
          ${statChip('Reserva de Emergência', fmt(reserva), '--blue')}
        </div>
        <div class="stat-chip-row">
          ${statChip('Gastos c/ Davi', fmt(totalDavi), '--gray-500')}
          ${statChip('Gastos c/ Luísa', fmt(totalLuisa), '--gray-500')}
          ${statChip('Total c/ Crianças', fmt(totalDavi + totalLuisa), '--gold')}
        </div>

        <div class="flex justify-between items-center mb-12 mt-16">
          <p class="section-title" style="margin:0">Dívidas em Aberto</p>
          <button class="btn btn-ghost btn-sm" onclick="App.navigateTo('dividas')">Ver todas →</button>
        </div>
        ${parcelasAtivas.length ? `
          <div class="stat-chip-row">
            ${statChip('Saldo Devedor Total', fmt(totalDevedor), '--red')}
            ${statChip('Parcelas/Mês', fmt(totalMensalParcelado), '--orange')}
          </div>
          <div class="card mb-12"><div class="card-body" style="padding:0">
            ${parcelasAtivas.map(d => `
              <div class="orc-row">
                <div class="orc-cat">
                  <div style="font-weight:600;font-size:13px">${d.desc}</div>
                  <div style="font-size:11px;color:var(--gray-500)">${d.resp} · ${d.pagas}/${d.nParc} pagas · ${fmt(d.parcela)}/mês</div>
                </div>
                <button class="btn btn-success btn-sm" onclick="Pages.registrarPagamentoDivida(${d._row},${d.pagas},${d.nParc},'${d.desc.replace(/'/g,"\\'")}')">✓ Marcar paga</button>
              </div>
            `).join('')}
          </div></div>
        ` : '<div class="empty-state"><p>🎉 Nenhuma dívida em aberto!</p></div>'}

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
      <p class="section-title" style="margin-top:0">Para Onde Foi Seu Dinheiro</p>
      <div class="skeleton" style="height:260px;border-radius:12px;margin-bottom:16px"></div>
      <div class="kpi-grid" style="grid-template-columns:1fr 1fr 1fr">${[1,2,3].map(() => '<div class="skeleton skel-kpi"></div>').join('')}</div>
      <div class="kpi-grid">${[1,2,3].map(() => '<div class="skeleton skel-row"></div>').join('')}</div>
      <div class="kpi-grid">${[1,2,3].map(() => '<div class="skeleton skel-row"></div>').join('')}</div>
      <p class="section-title">Dívidas em Aberto</p>
      <div class="skeleton skel-row" style="margin-bottom:16px"></div>
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
  let _recCache = null;

  async function renderReceitas(el) {
    el.innerHTML = '<div class="skeleton skel-row"></div>'.repeat(5);
    try {
      const rows = await Sheets.readAll(CONFIG.SHEETS.RECEITAS);
      _recCache = Sheets.parseReceitas(rows);
      const agora = new Date();
      if (!el.dataset.mes)    el.dataset.mes = agora.getMonth() + 1;
      if (!el.dataset.ano)    el.dataset.ano = agora.getFullYear();
      if (!el.dataset.sort)   el.dataset.sort = 'data';
      if (!el.dataset.filtro) el.dataset.filtro = 'Todos';
      if (el.dataset.busca === undefined) el.dataset.busca = '';
      _renderReceitasList(el);
    } catch(e) { el.innerHTML = erro(e); console.error(e); }
  }

  function _renderReceitasList(el) {
    const mesSel = parseInt(el.dataset.mes), anoSel = parseInt(el.dataset.ano);
    const sort   = el.dataset.sort;
    const filtro = el.dataset.filtro;
    const busca  = (el.dataset.busca || '').toLowerCase();

    const mes = Financas.filtrarPeriodo(_recCache, 'data', mesSel, anoSel);
    const total      = mes.reduce((s,i) => s + i.valor, 0);
    const totJoelson = mes.filter(i => i.resp === 'Joelson').reduce((s,i) => s + i.valor, 0);
    const totRaquel  = mes.filter(i => i.resp === 'Raquel').reduce((s,i) => s + i.valor, 0);

    let lista = mes;
    if (filtro !== 'Todos') lista = lista.filter(i => i.resp === filtro);
    if (busca) lista = lista.filter(i => i.desc.toLowerCase().includes(busca) || i.cat.toLowerCase().includes(busca));
    lista = [...lista].sort((a,b) => sort === 'alfa' ? a.desc.localeCompare(b.desc, 'pt-BR') : b.data.localeCompare(a.data));

    const nomeMesSel = MESES_NOMES[mesSel - 1];
    const mesesOpts = MESES_NOMES.map((n,i) => `<option value="${i+1}" ${i+1===mesSel?'selected':''}>${n}</option>`).join('');
    const anosOpts  = [anoSel-1, anoSel, anoSel+1].map(y => `<option value="${y}" ${y===anoSel?'selected':''}>${y}</option>`).join('');
    const filtroOpts = ['Todos', ...CONFIG.MEMBROS].map(m => `<option value="${m}" ${m===filtro?'selected':''}>${m}</option>`).join('');

    el.innerHTML = `
      <div class="rel-period-bar">
        <div class="rel-period-label">Período</div>
        <div class="rel-period-selects">
          <select class="form-control rel-select" id="rec-sel-mes" onchange="Pages._recChangePeriodo()">${mesesOpts}</select>
          <select class="form-control rel-select" id="rec-sel-ano" onchange="Pages._recChangePeriodo()">${anosOpts}</select>
        </div>
      </div>

      <div class="toolbar">
        <input class="form-control toolbar-search" type="text" id="rec-busca" placeholder="Buscar receita..." value="${busca}" oninput="Pages._recSetBusca(this)">
        <select class="form-control toolbar-filter" onchange="Pages._recSetFiltro(this)">${filtroOpts}</select>
        <button class="btn btn-ghost btn-sm btn-sort" onclick="Pages._recToggleSort()">${sort === 'alfa' ? '🔤 A-Z' : '📅 Recentes'}</button>
      </div>

      <div class="kpi-grid" style="grid-template-columns:1fr 1fr 1fr">
        <div class="kpi-card kpi-green"><div class="kpi-label">Total ${nomeMesSel}</div><div class="kpi-value">${fmt(total)}</div></div>
        <div class="kpi-card kpi-blue"><div class="kpi-label">Joelson</div><div class="kpi-value">${fmt(totJoelson)}</div></div>
        <div class="kpi-card kpi-teal"><div class="kpi-label">Raquel</div><div class="kpi-value">${fmt(totRaquel)}</div></div>
      </div>
      <div class="flex justify-between items-center" style="margin:24px 0 12px">
        <p class="section-title" style="margin:0">Lançamentos de ${nomeMesSel}</p>
        <span class="text-xs text-gray">${lista.length} · ${fmt(lista.reduce((s,i) => s + i.valor, 0))}</span>
      </div>
      ${lista.length ? `<div class="tx-list">
        ${lista.map(i => `
          <div class="tx-item">
            <div class="tx-icon income"><svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg></div>
            <div class="tx-info">
              <div class="tx-desc">${i.desc}</div>
              <div class="tx-meta">${fmtDate(i.data)} · ${i.resp} · ${i.conta}${i.lancadoPor ? ' · lançado por '+i.lancadoPor : ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="tx-amount income">+${fmt(i.valor)}</div>
              <button class="btn-icon" onclick="Pages.editarReceita(${i._row})">${ICON_EDIT}</button>
              <button class="btn-icon" onclick="Pages.deletarLancamento('${CONFIG.SHEETS.RECEITAS}',${i._row})">
                <svg viewBox="0 0 24 24" style="width:16px;height:16px;color:var(--gray-300)"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            </div>
          </div>
        `).join('')}
      </div>` : `<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg><p>Nenhuma receita encontrada</p></div>`}

      <button class="btn-fab" onclick="Pages.openNovaReceita(null, Pages._recDataSugestao())">
        <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>
    `;
  }

  function _recChangePeriodo() {
    const el = document.getElementById('page-receitas');
    el.dataset.mes = document.getElementById('rec-sel-mes').value;
    el.dataset.ano = document.getElementById('rec-sel-ano').value;
    _renderReceitasList(el);
  }
  function _recSetFiltro(sel) {
    const el = document.getElementById('page-receitas');
    el.dataset.filtro = sel.value;
    _renderReceitasList(el);
  }
  function _recSetBusca(input) {
    const el = document.getElementById('page-receitas');
    const pos = input.selectionStart;
    el.dataset.busca = input.value;
    _renderReceitasList(el);
    const novo = document.getElementById('rec-busca');
    if (novo) { novo.focus(); novo.setSelectionRange(pos, pos); }
  }
  function _recToggleSort() {
    const el = document.getElementById('page-receitas');
    el.dataset.sort = el.dataset.sort === 'alfa' ? 'data' : 'alfa';
    _renderReceitasList(el);
  }
  function _recDataSugestao() {
    const el = document.getElementById('page-receitas');
    const mesSel = parseInt(el.dataset.mes) || mesAtual(), anoSel = parseInt(el.dataset.ano) || anoAtual();
    const agora = new Date();
    if (mesSel === agora.getMonth() + 1 && anoSel === agora.getFullYear()) return todayISO();
    return `${anoSel}-${String(mesSel).padStart(2,'0')}-${String(Math.min(agora.getDate(),28)).padStart(2,'0')}`;
  }
  function editarReceita(row) {
    const item = _recCache?.find(r => r._row === row);
    if (item) openNovaReceita(item);
  }

  function openNovaReceita(preencher = null, dataSugestao = null) {
    const isEdit = !!preencher;
    const p = preencher || {};
    openModal(isEdit ? 'Editar Receita' : 'Nova Receita', `
      <div class="form-group"><label class="form-label">Data</label>
        <input class="form-control" type="date" id="rec-data" value="${p.data || dataSugestao || todayISO()}"></div>
      <div class="form-group"><label class="form-label">Descrição</label>
        <input class="form-control" type="text" id="rec-desc" placeholder="ex: Salário Joelson" value="${p.desc||''}"></div>
      <div class="form-group"><label class="form-label">Categoria</label>
        <select class="form-control" id="rec-cat">${selectOptions(CONFIG.CAT_RECEITA, p.cat)}</select></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Responsável</label>
          <select class="form-control" id="rec-resp">${selectOptions(CONFIG.MEMBROS, p.resp)}</select></div>
        <div class="form-group"><label class="form-label">Conta</label>
          <select class="form-control" id="rec-conta">${selectOptions(CONFIG.CONTAS, p.conta)}</select></div>
      </div>
      <div class="form-group"><label class="form-label">Valor (R$)</label>
        <input class="form-control" type="number" id="rec-valor" step="0.01" min="0" placeholder="0,00" value="${p.valor||''}"></div>
    `, [
      { label: isEdit ? 'Salvar Alterações' : 'Salvar', cls:'btn-success', action: async () => {
        const data  = document.getElementById('rec-data').value;
        const desc  = document.getElementById('rec-desc').value.trim();
        const cat   = document.getElementById('rec-cat').value;
        const resp  = document.getElementById('rec-resp').value;
        const conta = document.getElementById('rec-conta').value;
        const valor = parseFloat(document.getElementById('rec-valor').value) || 0;
        if (!data || !desc || !valor) return toast('Preencha todos os campos', 'error');

        const salvar = async () => {
          if (isEdit) {
            await Sheets.update(CONFIG.SHEETS.RECEITAS, `B${p._row}:G${p._row}`, [[data, desc, cat, resp, conta, valor]]);
            toast('Receita atualizada!', 'success');
          } else {
            const lancadoPor = App.getUserName();
            await Sheets.append(CONFIG.SHEETS.RECEITAS, [[genId(), data, desc, cat, resp, conta, valor, lancadoPor]]);
            toast('Receita lançada!', 'success');
          }
          closeModal();
          renderReceitas(document.getElementById('page-receitas'));
          if (document.getElementById('page-painel').classList.contains('active'))
            renderPainel(document.getElementById('page-painel'));
        };

        const duplicata = encontrarDuplicata(_recCache, data, desc, valor, isEdit ? p._row : null);
        await confirmarSeDuplicado(duplicata, 'uma receita', salvar);
      }}
    ]);
    setTimeout(() => document.getElementById('rec-desc')?.focus(), 100);
  }

  // ─── DESPESAS ─────────────────────────────────────────
  let _despCache = null;

  async function renderDespesas(el) {
    el.innerHTML = '<div class="skeleton skel-row"></div>'.repeat(5);
    try {
      const rows = await Sheets.readAll(CONFIG.SHEETS.DESPESAS);
      _despCache = Sheets.parseDespesas(rows);
      const agora = new Date();
      if (!el.dataset.mes)    el.dataset.mes = agora.getMonth() + 1;
      if (!el.dataset.ano)    el.dataset.ano = agora.getFullYear();
      if (!el.dataset.sort)   el.dataset.sort = 'data';
      if (!el.dataset.filtro) el.dataset.filtro = 'Todos';
      if (el.dataset.busca === undefined) el.dataset.busca = '';
      _renderDespesasList(el);
    } catch(e) { el.innerHTML = erro(e); console.error(e); }
  }

  function _renderDespesasList(el) {
    const mesSel = parseInt(el.dataset.mes), anoSel = parseInt(el.dataset.ano);
    const sort   = el.dataset.sort;
    const filtro = el.dataset.filtro;
    const busca  = (el.dataset.busca || '').toLowerCase();

    const mes = Financas.filtrarPeriodo(_despCache, 'data', mesSel, anoSel);
    const total      = mes.reduce((s,i) => s + i.valor, 0);
    const totDavi    = mes.filter(i => i.para === 'Davi').reduce((s,i) => s + i.valor, 0);
    const totLuisa   = mes.filter(i => i.para === 'Luísa').reduce((s,i) => s + i.valor, 0);
    const totFamilia = mes.filter(i => i.para === 'Família (geral)').reduce((s,i) => s + i.valor, 0);

    let lista = mes;
    if (filtro !== 'Todos') lista = lista.filter(i => i.para === filtro);
    if (busca) lista = lista.filter(i => i.desc.toLowerCase().includes(busca) || i.cat.toLowerCase().includes(busca));
    lista = [...lista].sort((a,b) => sort === 'alfa' ? a.desc.localeCompare(b.desc, 'pt-BR') : b.data.localeCompare(a.data));

    const nomeMesSel = MESES_NOMES[mesSel - 1];
    const mesesOpts = MESES_NOMES.map((n,i) => `<option value="${i+1}" ${i+1===mesSel?'selected':''}>${n}</option>`).join('');
    const anosOpts  = [anoSel-1, anoSel, anoSel+1].map(y => `<option value="${y}" ${y===anoSel?'selected':''}>${y}</option>`).join('');
    const filtroOpts = ['Todos', ...CONFIG.MEMBROS].map(m => `<option value="${m}" ${m===filtro?'selected':''}>${m}</option>`).join('');

    el.innerHTML = `
      <div class="rel-period-bar">
        <div class="rel-period-label">Período</div>
        <div class="rel-period-selects">
          <select class="form-control rel-select" id="desp-sel-mes" onchange="Pages._despChangePeriodo()">${mesesOpts}</select>
          <select class="form-control rel-select" id="desp-sel-ano" onchange="Pages._despChangePeriodo()">${anosOpts}</select>
        </div>
      </div>

      <div class="toolbar">
        <input class="form-control toolbar-search" type="text" id="desp-busca" placeholder="Buscar despesa..." value="${busca}" oninput="Pages._despSetBusca(this)">
        <select class="form-control toolbar-filter" onchange="Pages._despSetFiltro(this)">${filtroOpts}</select>
        <button class="btn btn-ghost btn-sm btn-sort" onclick="Pages._despToggleSort()">${sort === 'alfa' ? '🔤 A-Z' : '📅 Recentes'}</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card kpi-red"><div class="kpi-label">Total ${nomeMesSel}</div><div class="kpi-value">${fmt(total)}</div></div>
        <div class="kpi-card kpi-gray"><div class="kpi-label">Davi</div><div class="kpi-value">${fmt(totDavi)}</div></div>
        <div class="kpi-card kpi-gray"><div class="kpi-label">Luísa</div><div class="kpi-value">${fmt(totLuisa)}</div></div>
        <div class="kpi-card kpi-orange"><div class="kpi-label">Família Geral</div><div class="kpi-value">${fmt(totFamilia)}</div></div>
      </div>
      <div class="flex justify-between items-center" style="margin:24px 0 12px">
        <p class="section-title" style="margin:0">Lançamentos de ${nomeMesSel}</p>
        <span class="text-xs text-gray">${lista.length} · ${fmt(lista.reduce((s,i) => s + i.valor, 0))}</span>
      </div>
      ${lista.length ? `<div class="tx-list">
        ${lista.map(i => `
          <div class="tx-item">
            <div class="tx-icon expense"><svg viewBox="0 0 24 24"><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8z"/></svg></div>
            <div class="tx-info">
              <div class="tx-desc">${i.desc}</div>
              <div class="tx-meta">${fmtDate(i.data)} · ${i.para} · ${i.cat}${i.lancadoPor ? ' · lançado por '+i.lancadoPor : ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="tx-amount expense">-${fmt(i.valor)}</div>
              <button class="btn-icon" onclick="Pages.editarDespesa(${i._row})">${ICON_EDIT}</button>
              <button class="btn-icon" onclick="Pages.deletarLancamento('${CONFIG.SHEETS.DESPESAS}',${i._row})">
                <svg viewBox="0 0 24 24" style="width:16px;height:16px;color:var(--gray-300)"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            </div>
          </div>
        `).join('')}
      </div>` : '<div class="empty-state"><p>Nenhuma despesa encontrada</p></div>'}

      <button class="btn-fab" onclick="Pages.openNovaDespesa(null, Pages._despDataSugestao())">
        <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>
    `;
  }

  function _despChangePeriodo() {
    const el = document.getElementById('page-despesas');
    el.dataset.mes = document.getElementById('desp-sel-mes').value;
    el.dataset.ano = document.getElementById('desp-sel-ano').value;
    _renderDespesasList(el);
  }
  function _despSetFiltro(sel) {
    const el = document.getElementById('page-despesas');
    el.dataset.filtro = sel.value;
    _renderDespesasList(el);
  }
  function _despSetBusca(input) {
    const el = document.getElementById('page-despesas');
    const pos = input.selectionStart;
    el.dataset.busca = input.value;
    _renderDespesasList(el);
    const novo = document.getElementById('desp-busca');
    if (novo) { novo.focus(); novo.setSelectionRange(pos, pos); }
  }
  function _despToggleSort() {
    const el = document.getElementById('page-despesas');
    el.dataset.sort = el.dataset.sort === 'alfa' ? 'data' : 'alfa';
    _renderDespesasList(el);
  }
  function _despDataSugestao() {
    const el = document.getElementById('page-despesas');
    const mesSel = parseInt(el.dataset.mes) || mesAtual(), anoSel = parseInt(el.dataset.ano) || anoAtual();
    const agora = new Date();
    if (mesSel === agora.getMonth() + 1 && anoSel === agora.getFullYear()) return todayISO();
    return `${anoSel}-${String(mesSel).padStart(2,'0')}-${String(Math.min(agora.getDate(),28)).padStart(2,'0')}`;
  }
  function editarDespesa(row) {
    const item = _despCache?.find(d => d._row === row);
    if (item) openNovaDespesa(item);
  }

  function openNovaDespesa(preencher = null, dataSugestao = null) {
    const isEdit = !!preencher;
    const p = preencher || {};
    openModal(isEdit ? 'Editar Despesa' : 'Nova Despesa', `
      <div class="form-group"><label class="form-label">Data</label>
        <input class="form-control" type="date" id="desp-data" value="${p.data || dataSugestao || todayISO()}"></div>
      <div class="form-group"><label class="form-label">Descrição</label>
        <input class="form-control" type="text" id="desp-desc" placeholder="ex: Mensalidade escola - Davi" value="${p.desc||''}"></div>
      <div class="form-group"><label class="form-label">Categoria</label>
        <select class="form-control" id="desp-cat">${selectOptions(CONFIG.CAT_DESPESA, p.cat)}</select></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Para quem</label>
          <select class="form-control" id="desp-para">${selectOptions(CONFIG.MEMBROS, p.para || 'Família (geral)')}</select></div>
        <div class="form-group"><label class="form-label">Conta</label>
          <select class="form-control" id="desp-conta">${selectOptions(CONFIG.CONTAS, p.conta)}</select></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Forma de Pagamento</label>
          <select class="form-control" id="desp-forma" ${isEdit ? '' : 'onchange="Pages._toggleParcelado()"'}>${selectOptions(CONFIG.FORMAS_PGTO, p.forma)}</select></div>
        <div class="form-group"><label class="form-label">Valor (R$)</label>
          <input class="form-control" type="number" id="desp-valor" step="0.01" min="0" placeholder="0,00" value="${p.valor||''}"></div>
      </div>

      ${isEdit ? `<p class="text-xs text-gray">Para alterar o parcelamento desta compra, edite a parcela na aba Dívidas.</p>` : `
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
      </div>`}
    `, [
      { label: isEdit ? 'Salvar Alterações' : 'Salvar', cls: isEdit ? 'btn-primary' : 'btn-danger', action: async () => {
        const data   = document.getElementById('desp-data').value;
        const desc   = document.getElementById('desp-desc').value.trim();
        const cat    = document.getElementById('desp-cat').value;
        const para   = document.getElementById('desp-para').value;
        const conta  = document.getElementById('desp-conta').value;
        const forma  = document.getElementById('desp-forma').value;
        const valor  = parseFloat(document.getElementById('desp-valor').value) || 0;
        if (!data || !desc || !valor) return toast('Preencha todos os campos', 'error');

        const salvar = async () => {
          if (isEdit) {
            await Sheets.update(CONFIG.SHEETS.DESPESAS, `B${p._row}:H${p._row}`, [[data, desc, cat, para, conta, forma, valor]]);
            toast('Despesa atualizada!', 'success');
          } else {
            // Salva despesa normal
            const lancadoPor = App.getUserName();
            await Sheets.append(CONFIG.SHEETS.DESPESAS, [[genId(), data, desc, cat, para, conta, forma, valor, lancadoPor]]);

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
          }
          closeModal();
          renderDespesas(document.getElementById('page-despesas'));
          if (document.getElementById('page-painel').classList.contains('active'))
            renderPainel(document.getElementById('page-painel'));
        };

        const duplicata = encontrarDuplicata(_despCache, data, desc, valor, isEdit ? p._row : null);
        await confirmarSeDuplicado(duplicata, 'uma despesa', salvar);
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
        ${impacto.critico ? '<div class="impacto-alerta danger">⛔ Acima de 50%: comprometimento crítico da renda familiar!</div>'
          : impacto.alerta ? '<div class="impacto-alerta warn">⚠️ Acima de 30%: avalie se realmente precisa dessa compra.</div>'
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
            <thead><tr><th>Cartão</th><th>Titular</th><th class="text-right">Limite</th><th class="text-right">Vencimento</th><th></th></tr></thead>
            <tbody>
              ${cartoes.map(c => `<tr>
                <td><strong>${c.nome}</strong></td>
                <td>${c.titular}</td>
                <td class="td-num">${fmt(c.limite)}</td>
                <td class="td-num">Dia ${c.diaVenc}</td>
                <td class="td-actions"><button class="btn-icon" onclick="Pages.editarCartao(${c._row},'${c.nome.replace(/'/g,"\\'")}',${c.limite},${c.diaVenc})">${ICON_EDIT}</button></td>
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

  function editarCartao(row, nome, limite, diaVenc) {
    openModal(`Editar: ${nome}`, `
      <div class="form-group"><label class="form-label">Limite (R$)</label>
        <input class="form-control" type="number" id="cart-limite" step="0.01" value="${limite}" placeholder="0,00"></div>
      <div class="form-group"><label class="form-label">Dia de Vencimento</label>
        <input class="form-control" type="number" id="cart-dia" min="1" max="31" value="${diaVenc}"></div>
    `, [
      { label:'Salvar', cls:'btn-primary', action: async () => {
        const limite = parseFloat(document.getElementById('cart-limite').value) || 0;
        const dia    = parseInt(document.getElementById('cart-dia').value) || 1;
        await Sheets.update(CONFIG.SHEETS.CARTAO, `C${row}:D${row}`, [[limite, dia]]);
        toast('Cartão atualizado!', 'success'); closeModal();
        renderCartao(document.getElementById('page-cartao'));
      }}
    ]);
  }

  // ─── DÍVIDAS ──────────────────────────────────────────
  let _divCache = null;

  async function renderDividas(el) {
    el.innerHTML = '<div class="skeleton skel-row"></div>'.repeat(3);
    try {
      const rows = await Sheets.readAll(CONFIG.SHEETS.DIVIDAS);
      _divCache = Sheets.parseDividas(rows);
      if (!el.dataset.filtro) el.dataset.filtro = 'Todos';
      _renderDividasList(el);
    } catch(e) { el.innerHTML = erro(e); console.error(e); }
  }

  function _renderDividasList(el) {
    const filtro = el.dataset.filtro || 'Todos';
    const dividas = filtro === 'Todos' ? _divCache : _divCache.filter(d => d.resp === filtro);
    const totalDevedor  = dividas.reduce((s,d) => s + (d.total - d.parcela * d.pagas), 0);
    const totalParcelas = dividas.reduce((s,d) => s + d.parcela, 0);
    const filtroOpts = ['Todos','Joelson','Raquel','Família (geral)'].map(m => `<option value="${m}" ${m===filtro?'selected':''}>${m}</option>`).join('');

    el.innerHTML = `
      <div class="toolbar">
        <select class="form-control toolbar-filter" onchange="Pages._divSetFiltro(this)">${filtroOpts}</select>
      </div>
      <div class="kpi-grid" style="grid-template-columns:1fr 1fr">
        <div class="kpi-card kpi-red"><div class="kpi-label">Saldo Devedor${filtro!=='Todos' ? ' de '+filtro : ' Total'}</div><div class="kpi-value">${fmt(totalDevedor)}</div></div>
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
              <button class="btn btn-ghost btn-sm" onclick="Pages.registrarPagamentoDivida(${d._row},${d.pagas},${d.nParc},'${d.desc.replace(/'/g,"\\'")}')">Registrar parcela</button>
              <button class="btn btn-ghost btn-sm" onclick="Pages.editarDivida(${d._row})">Editar</button>
              <button class="btn btn-ghost btn-sm" onclick="Pages.deletarLancamento('${CONFIG.SHEETS.DIVIDAS}',${d._row})">Excluir</button>
            </div>
          </div>
        </div>`;
      }).join('') : '<div class="empty-state"><p>Nenhuma dívida cadastrada 🎉</p></div>'}

      <button class="btn-fab" onclick="Pages.openNovaDivida()">
        <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>
    `;
  }

  function _divSetFiltro(sel) {
    const el = document.getElementById('page-dividas');
    el.dataset.filtro = sel.value;
    _renderDividasList(el);
  }
  function editarDivida(row) {
    const item = _divCache?.find(d => d._row === row);
    if (item) openNovaDivida(item);
  }

  function openNovaDivida(preencher = null) {
    const isEdit = !!preencher;
    const p = preencher || {};
    openModal(isEdit ? 'Editar Dívida / Parcela Fixa' : 'Nova Dívida / Parcela Fixa', `
      <div class="form-group"><label class="form-label">Descrição</label>
        <input class="form-control" type="text" id="div-desc" placeholder="ex: Financiamento Veículo" value="${p.desc||''}"></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Responsável</label>
          <select class="form-control" id="div-resp">${selectOptions(['Joelson','Raquel','Família (geral)'], p.resp)}</select></div>
        <div class="form-group"><label class="form-label">Data de início</label>
          <input class="form-control" type="date" id="div-inicio" value="${p.inicio || todayISO()}"
            oninput="Pages._calcImpactoDivida()"></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Valor Total (R$)</label>
          <input class="form-control" type="number" id="div-total" step="0.01" placeholder="0,00" value="${p.total||''}"></div>
        <div class="form-group"><label class="form-label">Valor da Parcela (R$)</label>
          <input class="form-control" type="number" id="div-parcela" step="0.01" placeholder="0,00" value="${p.parcela||''}"
            oninput="Pages._calcImpactoDivida()"></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Nº de Parcelas</label>
          <input class="form-control" type="number" id="div-nparc" min="1" placeholder="12" value="${p.nParc||''}"
            oninput="Pages._calcImpactoDivida()"></div>
        <div class="form-group"><label class="form-label">Parcelas Pagas</label>
          <input class="form-control" type="number" id="div-pagas" min="0" value="${p.pagas ?? 0}"></div>
      </div>
      <div id="div-impacto-preview" class="impacto-preview" style="display:none"></div>
    `, [
      { label: isEdit ? 'Salvar Alterações' : 'Salvar', cls:'btn-primary', action: async () => {
        const desc   = document.getElementById('div-desc').value.trim();
        const resp   = document.getElementById('div-resp').value;
        const inicio = document.getElementById('div-inicio').value;
        const total  = parseFloat(document.getElementById('div-total').value) || 0;
        const parc   = parseFloat(document.getElementById('div-parcela').value) || 0;
        const nparc  = parseInt(document.getElementById('div-nparc').value) || 0;
        const pagas  = parseInt(document.getElementById('div-pagas').value) || 0;
        if (!desc || !total) return toast('Preencha os campos obrigatórios', 'error');
        if (isEdit) {
          await Sheets.update(CONFIG.SHEETS.DIVIDAS, `A${p._row}:G${p._row}`, [[desc, resp, total, parc, nparc, pagas, inicio]]);
          toast('Dívida atualizada!', 'success');
        } else {
          await Sheets.append(CONFIG.SHEETS.DIVIDAS, [[desc, resp, total, parc, nparc, pagas, inicio]]);
          toast('Dívida cadastrada!', 'success');
        }
        closeModal();
        renderDividas(document.getElementById('page-dividas'));
        if (document.getElementById('page-saude').classList.contains('active'))
          renderSaude(document.getElementById('page-saude'));
        if (document.getElementById('page-painel').classList.contains('active'))
          renderPainel(document.getElementById('page-painel'));
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
          : impacto.alerta ? '<div class="impacto-alerta warn">⚠️ Acima de 30%: pense bem antes de assumir mais parcelas.</div>'
          : '<div class="impacto-alerta ok">✅ Comprometimento dentro do limite recomendado (abaixo de 30%).</div>'}
      `;
    } catch(e) { console.error(e); }
  }

  // Pede confirmação antes de marcar a parcela como paga — evita remoção/
  // alteração por toque acidental (ex: celular no bolso), já que essa ação
  // muda o progresso da dívida direto na planilha.
  function registrarPagamentoDivida(row, pagas, nParc, desc = '') {
    if (pagas >= nParc) return toast('Dívida já quitada!', 'success');
    const proxima = pagas + 1;
    const quitaAgora = proxima >= nParc;
    openModal('Confirmar pagamento', `
      <p class="text-sm" style="line-height:1.5">
        Confirma que a parcela <strong>${proxima}/${nParc}</strong>${desc ? ` de "${desc}"` : ''} foi paga?
        ${quitaAgora ? '<br><br>Essa é a última parcela: a dívida será marcada como quitada.' : ''}
      </p>
    `, [
      { label: 'Cancelar', cls: 'btn-ghost', action: async () => { closeModal(); } },
      { label: 'Confirmar pagamento', cls: 'btn-success', action: async () => {
        await Sheets.update(CONFIG.SHEETS.DIVIDAS, `F${row}`, [[proxima]]);
        closeModal();
        lancarConfete(quitaAgora ? 100 : 55);
        tocarSomSucesso(quitaAgora);
        toast(quitaAgora ? 'Dívida quitada! 🎉' : 'Parcela registrada!', 'success');
        const active = document.querySelector('.page.active');
        if (active?.id === 'page-painel') renderPainel(active);
        else if (active?.id === 'page-dividas') renderDividas(active);
      }}
    ]);
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
            <div class="nf-sub">Cada nível só faz sentido depois que o anterior estiver concluído. Não poupamos enquanto temos dívidas, pois os juros sempre ganham.</div>
          </div>
        </div>

        <!-- ════ NÍVEL 1: QUITAR DÍVIDAS ════ -->
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

        <!-- ════ NÍVEL 2: RESERVA DE EMERGÊNCIA ════ -->
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
              <p class="nivel-desc">Você ainda não cadastrou sua Reserva de Emergência. Crie agora: o objetivo é ter 6 meses de despesas guardados.</p>
              <button class="btn btn-success btn-sm" onclick="Pages.openNovaMetaReserva()">
                + Criar Reserva de Emergência
              </button>
            `}
          </div>
        </div>

        <!-- ════ NÍVEL 3: METAS LIVRES ════ -->
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
                  ${metasLivres.map(m => `<div class="mpb-item">🔒 ${m.nome}: ${fmt(m.meta)}</div>`).join('')}
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
                <div class="empty-state"><p>Nenhuma meta ainda. Crie a primeira!</p></div>
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
  function deletarLancamento(sheet, row) {
    confirmModal('Tem certeza que deseja excluir este lançamento? Essa ação não pode ser desfeita.', async () => {
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
          else if (id === 'painel') renderPainel(active);
        }
      } catch(e) { toast('Erro ao excluir', 'error'); console.error(e); }
    });
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
      const histDiv    = Financas.calcHistoricoComDividas(receitas, despesas, dividas, 6);
      const histDivMax = Math.max(...histDiv.map(h => Math.max(h.rec, h.divida, h.desp)), 1);

      // Centro de cada coluna em % — tem que levar o `gap` do flex em conta
      // (ver GAP_HD_CHART_PCT/.hd-chart em style.css) pra linha em SVG cair
      // exatamente sobre o centro das barras, não numa divisão ingênua.
      const colPct = (100 - GAP_HD_CHART_PCT * (histDiv.length - 1)) / histDiv.length;
      const hdColX = i => i * (colPct + GAP_HD_CHART_PCT) + colPct / 2;

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
          <div class="sem-leg-item"><span class="sem-leg-dot" style="background:#27AE60"></span> Verde: saudável (score ≥ 75)</div>
          <div class="sem-leg-item"><span class="sem-leg-dot" style="background:#F1C40F"></span> Amarelo: atenção (50–74)</div>
          <div class="sem-leg-item"><span class="sem-leg-dot" style="background:#E07B39"></span> Laranja: preocupante (25–49)</div>
          <div class="sem-leg-item"><span class="sem-leg-dot" style="background:#C0392B"></span> Vermelho: crítico (0–24)</div>
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
        <p class="section-title">Renda × Gastos nos Últimos 6 Meses</p>
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

        <!-- ══ GRÁFICO RECEITAS × DÍVIDAS (barras) COM DESPESAS (linha) ══ -->
        <p class="section-title">Receitas × Dívidas com Despesas em Linha (Últimos 6 Meses)</p>
        <div class="card mb-12">
          <div class="card-body">
            <div class="rel-legend">
              <span class="rel-legend-dot" style="background:var(--green)"></span> Receitas &nbsp;
              <span class="rel-legend-dot" style="background:var(--gold)"></span> Parcelas de Dívida &nbsp;
              <span class="rel-legend-dot" style="background:var(--navy)"></span> Despesas (linha)
            </div>
            <div class="hd-chart-wrap" style="height:140px">
              <svg class="hd-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline points="${histDiv.map((h,i) => `${hdColX(i).toFixed(1)},${(100 - h.desp/histDivMax*100).toFixed(1)}`).join(' ')}"
                  fill="none" stroke="var(--navy)" stroke-width="2" vector-effect="non-scaling-stroke" />
                ${histDiv.map((h,i) => `<circle cx="${hdColX(i).toFixed(1)}" cy="${(100 - h.desp/histDivMax*100).toFixed(1)}" r="1.6" fill="var(--navy)" />`).join('')}
              </svg>
              <div class="hd-chart">
                ${histDiv.map(h => `
                  <div class="hd-col">
                    <div class="hd-bars">
                      <div class="hd-bar hd-bar-rec" style="height:${(h.rec/histDivMax*100).toFixed(1)}%" title="Receita: ${fmt(h.rec)}"></div>
                      <div class="hd-bar hd-bar-div" style="height:${(h.divida/histDivMax*100).toFixed(1)}%" title="Parcelas de dívida: ${fmt(h.divida)}"></div>
                    </div>
                    <div class="hd-col-label">${h.mes}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- ══ RENDA vs GASTOS (mês atual) ══ -->
        <p class="section-title">Composição da Renda no Mês Atual</p>
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
  let _relCache = null;

  async function renderRelatorio(el) {
    el.innerHTML = skeletonRelatorio();
    try {
      const [recRows, despRows, orcRows, divRows] = await Promise.all([
        Sheets.readAll(CONFIG.SHEETS.RECEITAS),
        Sheets.readAll(CONFIG.SHEETS.DESPESAS),
        Sheets.readAll(CONFIG.SHEETS.ORCAMENTO),
        Sheets.readAll(CONFIG.SHEETS.DIVIDAS),
      ]);
      const receitas = Sheets.parseReceitas(recRows);
      const despesas = Sheets.parseDespesas(despRows);
      const orc      = Sheets.parseOrcamento(orcRows);
      const dividas  = Sheets.parseDividas(divRows);

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

      // Histórico incluindo dívida comprometida (para o gráfico no PDF)
      const histDiv = Financas.calcHistoricoComDividas(receitas, despesas, dividas, 6);

      // Nomes dos meses para o seletor
      const nomeMesSel = MESES_NOMES[mesSel-1];
      const mesesOpts = MESES_NOMES.map((n,i) =>
        `<option value="${i+1}" ${i+1===mesSel?'selected':''}>${n}</option>`).join('');
      const anosOpts = [anoSel-1, anoSel, anoSel+1].map(y =>
        `<option value="${y}" ${y===anoSel?'selected':''}>${y}</option>`).join('');

      // Guarda os dados já calculados para a exportação (PDF/CSV) usar sem refazer fetch.
      _relCache = {
        mesSel, anoSel, nomeMesSel,
        recMes, despMes, totRec, totDesp, saldo, poupanca,
        catsSorted, membroMap, dividas, hist, histMax, histDiv, orc,
      };

      el.innerHTML = `
        <!-- SELETOR DE PERÍODO -->
        <div class="rel-period-bar">
          <div class="rel-period-label">Relatório de</div>
          <div class="rel-period-selects">
            <select class="form-control rel-select" id="rel-mes" onchange="Pages._relChangePeriod()">${mesesOpts}</select>
            <select class="form-control rel-select" id="rel-ano" onchange="Pages._relChangePeriod()">${anosOpts}</select>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="Pages.openExportarRelatorio()">
            <svg viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Exportar
          </button>
        </div>

        <!-- RESUMO EXECUTIVO -->
        <p class="section-title">Resumo de ${nomeMesSel} ${anoSel}</p>
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
        <p class="section-title">Histórico dos Últimos 6 Meses</p>
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
        <p class="section-title">Entradas de ${nomeMesSel}</p>
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
        <p class="section-title">Saídas de ${nomeMesSel}</p>
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

  // ─── EXPORTAR RELATÓRIO (PDF ou CSV, seções selecionáveis) ──
  function openExportarRelatorio() {
    const r = _relCache;
    if (!r) return toast('Carregue o relatório primeiro', 'error');
    openModal('Exportar Relatório', `
      <p class="text-sm text-gray mb-12">Relatório de ${r.nomeMesSel} ${r.anoSel}. Escolha o que incluir:</p>
      <div class="form-group">
        <label class="checkbox-row"><input type="checkbox" id="exp-receitas" checked> Receitas</label>
        <label class="checkbox-row"><input type="checkbox" id="exp-despesas" checked> Despesas</label>
        <label class="checkbox-row"><input type="checkbox" id="exp-dividas" checked> Dívidas</label>
        <label class="checkbox-row"><input type="checkbox" id="exp-graficos" checked> Gráficos <span class="text-xs text-gray">(somente no PDF)</span></label>
      </div>
      <div class="form-group">
        <label class="form-label">Formato</label>
        <div class="flex gap-12">
          <label class="checkbox-row"><input type="radio" name="exp-formato" value="pdf" checked> PDF</label>
          <label class="checkbox-row"><input type="radio" name="exp-formato" value="csv"> CSV</label>
        </div>
      </div>
    `, [
      { label: 'Exportar', cls:'btn-primary', action: async () => {
        const opts = {
          receitas: document.getElementById('exp-receitas').checked,
          despesas: document.getElementById('exp-despesas').checked,
          dividas:  document.getElementById('exp-dividas').checked,
          graficos: document.getElementById('exp-graficos').checked,
          formato:  document.querySelector('input[name="exp-formato"]:checked').value,
        };
        if (!opts.receitas && !opts.despesas && !opts.dividas) return toast('Selecione ao menos uma seção', 'error');
        closeModal();
        if (opts.formato === 'csv') gerarCSVRelatorio(opts); else gerarPDFRelatorio(opts);
      }}
    ]);
  }

  // Gera um gráfico de barras (até 2 séries) + linha opcional, como SVG puro
  // (sem bibliotecas), pronto para imprimir/exportar em PDF.
  function svgGroupedBars(data, seriesBar, seriesLine, max, width = 600, height = 200) {
    const n = data.length || 1;
    const padBottom = 24, padTop = 10;
    const chartH = height - padBottom - padTop;
    const groupW = width / n;
    const barW = groupW * 0.32;
    let bars = '';
    const pontos = [];
    data.forEach((d, i) => {
      const cx = i * groupW + groupW / 2;
      seriesBar.forEach((s, si) => {
        const val = d[s.key] || 0;
        const h = max > 0 ? (val / max * chartH) : 0;
        const x = cx - barW - 2 + si * (barW + 4);
        const y = padTop + (chartH - h);
        bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${s.color}" rx="2"/>`;
      });
      bars += `<text x="${cx.toFixed(1)}" y="${height - 6}" font-size="10" fill="#6B7280" text-anchor="middle">${d.mes}</text>`;
      if (seriesLine) {
        const val = d[seriesLine.key] || 0;
        const h = max > 0 ? (val / max * chartH) : 0;
        pontos.push([cx, padTop + (chartH - h)]);
      }
    });
    let linha = '';
    if (seriesLine && pontos.length) {
      linha = `<polyline points="${pontos.map(p => p.map(v=>v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${seriesLine.color}" stroke-width="2"/>` +
        pontos.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="${seriesLine.color}"/>`).join('');
    }
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;display:block;margin:0 auto">${bars}${linha}</svg>`;
  }

  function gerarPDFRelatorio(opts) {
    const r = _relCache;
    const titulo = `${r.nomeMesSel} ${r.anoSel}`;

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
        .legend { font-size: 11px; color: #6B7280; margin-bottom: 6px; }
        .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
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

    const temRecDesp = opts.receitas || opts.despesas;

    const kpiHTML = temRecDesp ? `<div class="kpis">
      ${opts.receitas ? `<div class="kpi" style="background:#1E7B45"><div class="kpi-label">Receitas</div><div class="kpi-value">${fmt(r.totRec)}</div></div>` : ''}
      ${opts.despesas ? `<div class="kpi" style="background:#C0392B"><div class="kpi-label">Despesas</div><div class="kpi-value">${fmt(r.totDesp)}</div></div>` : ''}
      <div class="kpi" style="background:#2E5395"><div class="kpi-label">Saldo</div><div class="kpi-value">${fmt(r.saldo)}</div></div>
      <div class="kpi" style="background:#BF9000"><div class="kpi-label">Taxa de Poupança</div><div class="kpi-value">${fmtPct(Math.max(r.poupanca,0))}</div></div>
    </div>` : '';

    let dividasKpiHTML = '';
    let tabDividasHTML = '';
    if (opts.dividas) {
      const { ativas, totalMensalParcelado } = Financas.calcParcelasAtivas(r.dividas);
      const totalDevedor = ativas.reduce((s,d) => s + (d.total - d.parcela*d.pagas), 0);
      dividasKpiHTML = `<div class="kpis" style="grid-template-columns:repeat(2,1fr)">
        <div class="kpi" style="background:#C0392B"><div class="kpi-label">Saldo Devedor Total</div><div class="kpi-value">${fmt(totalDevedor)}</div></div>
        <div class="kpi" style="background:#E07B39"><div class="kpi-label">Parcelas/Mês</div><div class="kpi-value">${fmt(totalMensalParcelado)}</div></div>
      </div>`;
      tabDividasHTML = `<div class="sec">Dívidas</div><table>
        <thead><tr><th>Descrição</th><th>Responsável</th><th>Parcelas</th><th>Status</th><th class="tr">Saldo Devedor</th></tr></thead>
        <tbody>
          ${r.dividas.map(d => {
            const devedor = d.total - d.parcela * d.pagas;
            const status = d.pagas >= d.nParc ? 'Quitado' : 'Em andamento';
            return `<tr><td>${d.desc}</td><td>${d.resp}</td><td>${d.pagas}/${d.nParc} de ${fmt(d.parcela)}</td><td>${status}</td><td class="tr red">${fmt(devedor)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>`;
    }

    let catHTML = '';
    let membrosHTML = '';
    if (opts.despesas) {
      catHTML = `<div class="sec">Despesas por Categoria</div><table><thead><tr><th>Categoria</th><th class="tr">Valor</th><th class="tr">Meta</th></tr></thead><tbody>
        ${r.catsSorted.map(([cat,val]) => {
          const meta = r.orc.find(o => o.cat === cat)?.meta || 0;
          const over = meta > 0 && val > meta;
          return `<tr><td>${cat}</td><td class="tr${over ? ' red' : ''}">${fmt(val)}</td><td class="tr">${meta > 0 ? fmt(meta) : '-'}</td></tr>`;
        }).join('')}
      </tbody></table>`;
      membrosHTML = `<div class="sec">Gastos por Membro</div><table><thead><tr><th>Membro</th><th class="tr">Valor</th></tr></thead><tbody>
        ${CONFIG.MEMBROS.map(m => `<tr><td>${m}</td><td class="tr">${fmt(r.membroMap[m]||0)}</td></tr>`).join('')}
      </tbody></table>`;
    }

    let graficoHistHTML = '';
    if (opts.graficos && temRecDesp) {
      graficoHistHTML = `<div class="sec">Histórico dos Últimos 6 Meses (Receitas × Despesas)</div>
        <div class="legend"><span class="dot" style="background:#1E7B45"></span>Receitas &nbsp; <span class="dot" style="background:#C0392B"></span>Despesas</div>
        ${svgGroupedBars(r.hist, [{key:'rec',color:'#1E7B45'},{key:'desp',color:'#C0392B'}], null, r.histMax)}`;
    }

    let graficoDividasHTML = '';
    if (opts.graficos && opts.dividas) {
      const maxDiv = Math.max(...r.histDiv.map(h => Math.max(h.rec, h.divida, h.desp)), 1);
      graficoDividasHTML = `<div class="sec">Receitas × Dívidas com Despesas em Linha</div>
        <div class="legend"><span class="dot" style="background:#1E7B45"></span>Receitas &nbsp; <span class="dot" style="background:#BF9000"></span>Parcelas de Dívida &nbsp; <span class="dot" style="background:#1F3864"></span>Despesas (linha)</div>
        ${svgGroupedBars(r.histDiv, [{key:'rec',color:'#1E7B45'},{key:'divida',color:'#BF9000'}], {key:'desp',color:'#1F3864'}, maxDiv)}`;
    }

    const tabRecHTML = opts.receitas ? `<div class="sec">Receitas Detalhadas de ${titulo}</div>
      ${r.recMes.length ? `<table><thead><tr><th>Data</th><th>Descrição</th><th>Responsável</th><th class="tr">Valor</th></tr></thead><tbody>
        ${[...r.recMes].sort((a,b)=>b.data.localeCompare(a.data)).map(x => `<tr><td>${fmtDate(x.data)}</td><td>${x.desc}</td><td>${x.resp}</td><td class="tr green">+${fmt(x.valor)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="3">Total Receitas</td><td class="tr">${fmt(r.totRec)}</td></tr></tfoot></table>` : '<p>Sem receitas neste período.</p>'}` : '';

    const tabDespHTML = opts.despesas ? `<div class="sec">Despesas Detalhadas de ${titulo}</div>
      ${r.despMes.length ? `<table><thead><tr><th>Data</th><th>Descrição</th><th>Para</th><th>Categoria</th><th class="tr">Valor</th></tr></thead><tbody>
        ${[...r.despMes].sort((a,b)=>b.data.localeCompare(a.data)).map(x => `<tr><td>${fmtDate(x.data)}</td><td>${x.desc}</td><td>${x.para}</td><td>${x.cat}</td><td class="tr red">-${fmt(x.valor)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="4">Total Despesas</td><td class="tr">${fmt(r.totDesp)}</td></tr></tfoot></table>` : '<p>Sem despesas neste período.</p>'}` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório ${titulo}</title>${style}</head><body>
      <h1>Relatório de ${titulo}</h1>
      <div class="sub">Família: Joelson, Raquel, Davi e Luísa · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
      ${kpiHTML}
      ${dividasKpiHTML}
      ${graficoHistHTML}
      ${graficoDividasHTML}
      ${catHTML}
      ${membrosHTML}
      ${tabRecHTML}
      ${tabDespHTML}
      ${tabDividasHTML}
    </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

  // ─── EXPORTAR CSV ─────────────────────────────────────
  function csvCell(v) {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }
  function csvRow(arr) { return arr.map(csvCell).join(';') + '\r\n'; }

  function gerarCSVRelatorio(opts) {
    const r = _relCache;
    let linhas = [];
    linhas.push(csvRow([`Relatório ${r.nomeMesSel} ${r.anoSel}`]));
    linhas.push(csvRow(['Gerado em', new Date().toLocaleDateString('pt-BR')]));
    linhas.push(csvRow([]));

    if (opts.receitas) {
      linhas.push(csvRow(['RECEITAS']));
      linhas.push(csvRow(['Data','Descrição','Categoria','Responsável','Conta','Valor','Lançado por']));
      r.recMes.forEach(x => linhas.push(csvRow([x.data, x.desc, x.cat, x.resp, x.conta, x.valor.toFixed(2), x.lancadoPor || ''])));
      linhas.push(csvRow(['', '', '', '', 'Total', r.totRec.toFixed(2), '']));
      linhas.push(csvRow([]));
    }
    if (opts.despesas) {
      linhas.push(csvRow(['DESPESAS']));
      linhas.push(csvRow(['Data','Descrição','Categoria','Para quem','Conta','Forma Pgto','Valor','Lançado por']));
      r.despMes.forEach(x => linhas.push(csvRow([x.data, x.desc, x.cat, x.para, x.conta, x.forma, x.valor.toFixed(2), x.lancadoPor || ''])));
      linhas.push(csvRow(['', '', '', '', '', 'Total', r.totDesp.toFixed(2), '']));
      linhas.push(csvRow([]));
    }
    if (opts.dividas) {
      linhas.push(csvRow(['DÍVIDAS']));
      linhas.push(csvRow(['Descrição','Responsável','Valor Total','Parcela','Nº Parcelas','Pagas','Início','Saldo Devedor','Status']));
      r.dividas.forEach(d => {
        const devedor = d.total - d.parcela * d.pagas;
        const status = d.pagas >= d.nParc ? 'Quitado' : 'Em andamento';
        linhas.push(csvRow([d.desc, d.resp, d.total.toFixed(2), d.parcela.toFixed(2), d.nParc, d.pagas, d.inicio, devedor.toFixed(2), status]));
      });
      linhas.push(csvRow([]));
    }

    const csvContent = '﻿' + linhas.join(''); // BOM: garante acentuação correta ao abrir no Excel/Sheets
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${r.nomeMesSel.toLowerCase()}-${r.anoSel}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('CSV exportado!', 'success');
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
    renderRelatorio, openExportarRelatorio, _relChangePeriod,
    openNovaReceita, openNovaDespesa, openNovaDivida, openNovaMeta,
    openNovaMetaReserva, openEditarContas, openEditarOrcamento, openAtualizarMeta,
    registrarPagamentoDivida, deletarLancamento, openModal, closeModal, toast,
    _toggleParcelado, _calcImpactoParc, _calcImpactoDivida, editarCartao,
    editarReceita, _recChangePeriodo, _recSetFiltro, _recSetBusca, _recToggleSort,
    editarDespesa, _despChangePeriodo, _despSetFiltro, _despSetBusca, _despToggleSort,
    editarDivida, _divSetFiltro,
  };
})();
