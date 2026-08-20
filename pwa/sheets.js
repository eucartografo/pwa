// ══════════════════════════════════════════════════════════
//  GOOGLE SHEETS API v4  —  leitura e escrita
// ══════════════════════════════════════════════════════════

const Sheets = (() => {
  const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
  let _token = null;

  function setToken(token) { _token = token; }

  function headers() {
    return { 'Authorization': `Bearer ${_token}`, 'Content-Type': 'application/json' };
  }

  // ── Leitura ───────────────────────────────────────────
  async function read(sheet, range) {
    const url = `${BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(sheet + '!' + range)}`;
    const r = await fetch(url, { headers: headers() });
    if (!r.ok) throw new Error(`Sheets read error: ${r.status}`);
    const d = await r.json();
    return d.values || [];
  }

  async function readAll(sheet) {
    return read(sheet, 'A:Z');
  }

  // ── Escrita ───────────────────────────────────────────
  async function append(sheet, values) {
    const range = `${sheet}!A:A`;
    const url = `${BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const r = await fetch(url, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ values })
    });
    if (!r.ok) throw new Error(`Sheets append error: ${r.status}`);
    return r.json();
  }

  async function update(sheet, range, values) {
    const url = `${BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(sheet + '!' + range)}?valueInputOption=USER_ENTERED`;
    const r = await fetch(url, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ values })
    });
    if (!r.ok) throw new Error(`Sheets update error: ${r.status}`);
    return r.json();
  }

  async function deleteRow(sheet, rowIndex) {
    // rowIndex é 0-based na API
    const url = `${BASE}/${CONFIG.SPREADSHEET_ID}:batchUpdate`;
    const sheetId = await getSheetId(sheet);
    const r = await fetch(url, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 }
          }
        }]
      })
    });
    if (!r.ok) throw new Error(`Sheets deleteRow error: ${r.status}`);
    return r.json();
  }

  // cache de sheetIds
  let _sheetMeta = null;
  async function getSheetId(sheetName) {
    if (!_sheetMeta) {
      const url = `${BASE}/${CONFIG.SPREADSHEET_ID}?fields=sheets.properties`;
      const r = await fetch(url, { headers: headers() });
      _sheetMeta = (await r.json()).sheets;
    }
    const s = _sheetMeta.find(s => s.properties.title === sheetName);
    if (!s) throw new Error(`Sheet "${sheetName}" não encontrada`);
    return s.properties.sheetId;
  }

  // ── Inicializar planilha (cria abas e cabeçalhos se não existirem) ───
  async function initSpreadsheet() {
    try {
      // Tenta ler a aba CONTAS para ver se já existe
      await read(CONFIG.SHEETS.CONTAS, 'A1');
    } catch {
      // Cria todas as abas via batchUpdate
      await createAllSheets();
    }
  }

  async function createAllSheets() {
    const sheetDefs = [
      { name: CONFIG.SHEETS.CONTAS,    headers: ['CONTA','RESPONSÁVEL','SALDO'] },
      { name: CONFIG.SHEETS.RECEITAS,  headers: ['ID','DATA','DESCRIÇÃO','CATEGORIA','RESPONSÁVEL','CONTA','VALOR'] },
      { name: CONFIG.SHEETS.DESPESAS,  headers: ['ID','DATA','DESCRIÇÃO','CATEGORIA','PARA_QUEM','CONTA','FORMA_PGTO','VALOR'] },
      { name: CONFIG.SHEETS.ORCAMENTO, headers: ['CATEGORIA','META_MENSAL'] },
      { name: CONFIG.SHEETS.CARTAO,    headers: ['CARTÃO','TITULAR','LIMITE','DIA_VENC'] },
      { name: CONFIG.SHEETS.DIVIDAS,   headers: ['DESCRIÇÃO','RESPONSÁVEL','VALOR_TOTAL','PARCELA','N_PARCELAS','PAGAS','DATA_INICIO'] },
      { name: CONFIG.SHEETS.METAS,     headers: ['OBJETIVO','META','GUARDADO','APORTE_MENSAL','OBSERVAÇÃO'] },
    ];

    // Adiciona as abas
    const requests = sheetDefs.map(s => ({
      addSheet: { properties: { title: s.name } }
    }));
    const url = `${BASE}/${CONFIG.SPREADSHEET_ID}:batchUpdate`;
    await fetch(url, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ requests })
    });

    // Popula cabeçalhos e dados iniciais em cada aba
    for (const s of sheetDefs) {
      await update(s.name, 'A1', [s.headers]);
    }

    // Dados iniciais: CONTAS
    const contasData = CONFIG.CONTAS.map(c => {
      const resp = c.includes('Joelson') ? 'Joelson' : c.includes('Raquel') ? 'Raquel' : 'Família (geral)';
      return [c, resp, 0];
    });
    await append(CONFIG.SHEETS.CONTAS, contasData);

    // Dados iniciais: ORÇAMENTO
    const orcData = CONFIG.CAT_DESPESA.map(c => [c, 0]);
    await append(CONFIG.SHEETS.ORCAMENTO, orcData);

    // Dados iniciais: CARTÃO
    await append(CONFIG.SHEETS.CARTAO, [
      ['Cartão Joelson', 'Joelson', 3000, 10],
      ['Cartão Raquel',  'Raquel',  2000, 5],
    ]);

    // Dados iniciais: METAS
    await append(CONFIG.SHEETS.METAS, [
      ['Reserva de Emergência (6 meses)',  21000, 0, 350, 'Manter na conta Reserva de Emergência'],
      ['Poupança Educação - Davi',         15000, 0, 100, 'Faculdade/curso futuro'],
      ['Poupança Educação - Luísa',        15000, 0, 100, 'Faculdade/curso futuro'],
      ['Viagem em Família',                 6000, 0, 200, 'Férias de fim de ano'],
      ['Troca do Carro',                   20000, 0, 300, 'Entrada para troca'],
    ]);
  }

  // ── Helpers: parse de linhas ──────────────────────────
  function parseReceitas(rows) {
    if (!rows.length) return [];
    return rows.slice(1).filter(r => r[0]).map((r, i) => ({
      _row: i + 2, // linha real na planilha (1-based, +1 pelo cabeçalho)
      id: r[0] || '', data: r[1] || '', desc: r[2] || '',
      cat: r[3] || '', resp: r[4] || '', conta: r[5] || '',
      valor: parseFloat((r[6]||'0').toString().replace(',','.')) || 0
    }));
  }

  function parseDespesas(rows) {
    if (!rows.length) return [];
    return rows.slice(1).filter(r => r[0]).map((r, i) => ({
      _row: i + 2,
      id: r[0] || '', data: r[1] || '', desc: r[2] || '',
      cat: r[3] || '', para: r[4] || '', conta: r[5] || '',
      forma: r[6] || '', valor: parseFloat((r[7]||'0').toString().replace(',','.')) || 0
    }));
  }

  function parseContas(rows) {
    if (!rows.length) return [];
    return rows.slice(1).filter(r => r[0]).map((r, i) => ({
      _row: i + 2,
      nome: r[0] || '', resp: r[1] || '',
      saldo: parseFloat((r[2]||'0').toString().replace(',','.')) || 0
    }));
  }

  function parseOrcamento(rows) {
    if (!rows.length) return [];
    return rows.slice(1).filter(r => r[0]).map((r, i) => ({
      _row: i + 2,
      cat: r[0] || '',
      meta: parseFloat((r[1]||'0').toString().replace(',','.')) || 0
    }));
  }

  function parseDividas(rows) {
    if (!rows.length) return [];
    return rows.slice(1).filter(r => r[0]).map((r, i) => ({
      _row: i + 2,
      desc: r[0] || '', resp: r[1] || '',
      total: parseFloat((r[2]||'0').toString().replace(',','.')) || 0,
      parcela: parseFloat((r[3]||'0').toString().replace(',','.')) || 0,
      nParc: parseInt(r[4]) || 0,
      pagas: parseInt(r[5]) || 0,
      inicio: r[6] || ''
    }));
  }

  function parseMetas(rows) {
    if (!rows.length) return [];
    return rows.slice(1).filter(r => r[0]).map((r, i) => ({
      _row: i + 2,
      nome: r[0] || '',
      meta: parseFloat((r[1]||'0').toString().replace(',','.')) || 0,
      guardado: parseFloat((r[2]||'0').toString().replace(',','.')) || 0,
      aporte: parseFloat((r[3]||'0').toString().replace(',','.')) || 0,
      obs: r[4] || ''
    }));
  }

  function parseCartoes(rows) {
    if (!rows.length) return [];
    return rows.slice(1).filter(r => r[0]).map((r, i) => ({
      _row: i + 2,
      nome: r[0] || '', titular: r[1] || '',
      limite: parseFloat((r[2]||'0').toString().replace(',','.')) || 0,
      diaVenc: parseInt(r[3]) || 0
    }));
  }

  return {
    setToken, read, readAll, append, update, deleteRow,
    initSpreadsheet,
    parseReceitas, parseDespesas, parseContas, parseOrcamento,
    parseDividas, parseMetas, parseCartoes
  };
})();
