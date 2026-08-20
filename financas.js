// ══════════════════════════════════════════════════════════
//  MOTOR DE CÁLCULO FINANCEIRO
//  Centraliza toda a lógica: semáforo, comprometimento,
//  previsão de parcelas, alertas
// ══════════════════════════════════════════════════════════

const Financas = (() => {

  // ─── Constantes ───────────────────────────────────────
  const LIMITE_COMPROMETIMENTO = 0.30; // 30% da renda em dívidas = amarelo
  const LIMITE_CRITICO         = 0.50; // 50% = vermelho
  const META_POUPANCA          = 0.20; // 20% de poupança = saudável
  const MEMBROS_RENDA = ['Joelson', 'Raquel'];

  // ─── Cálculo do mês/ano ───────────────────────────────
  function mesAtual()  { return new Date().getMonth() + 1; }
  function anoAtual()  { return new Date().getFullYear(); }

  function filtrarPeriodo(items, campo, mes, ano) {
    return items.filter(i => {
      if (!i[campo]) return false;
      const [y, m] = i[campo].split('-').map(Number);
      return y === ano && m === mes;
    });
  }

  // ─── Renda mensal por pessoa ──────────────────────────
  function calcRendaMensal(receitas, mes, ano) {
    const recMes = filtrarPeriodo(receitas, 'data', mes, ano);
    const total  = recMes.reduce((s, r) => s + r.valor, 0);
    const joelson = recMes.filter(r => r.resp === 'Joelson').reduce((s, r) => s + r.valor, 0);
    const raquel  = recMes.filter(r => r.resp === 'Raquel').reduce((s, r) => s + r.valor, 0);
    return { total, joelson, raquel };
  }

  // ─── Gastos mensais por pessoa ────────────────────────
  function calcGastosMensal(despesas, mes, ano) {
    const desp = filtrarPeriodo(despesas, 'data', mes, ano);
    const total    = desp.reduce((s, d) => s + d.valor, 0);
    const joelson  = desp.filter(d => d.para === 'Joelson').reduce((s, d) => s + d.valor, 0);
    const raquel   = desp.filter(d => d.para === 'Raquel').reduce((s, d) => s + d.valor, 0);
    const davi     = desp.filter(d => d.para === 'Davi').reduce((s, d) => s + d.valor, 0);
    const luisa    = desp.filter(d => d.para === 'Luísa').reduce((s, d) => s + d.valor, 0);
    const familia  = desp.filter(d => d.para === 'Família (geral)').reduce((s, d) => s + d.valor, 0);
    return { total, joelson, raquel, davi, luisa, familia };
  }

  // ─── Parcelas ativas e comprometimento futuro ─────────
  function calcParcelasAtivas(dividas) {
    const hoje = new Date();
    const ativas = dividas.filter(d => d.nParc > 0 && d.pagas < d.nParc);

    let totalMensalParcelado = 0;
    const detalhe = ativas.map(d => {
      const restantes = d.nParc - d.pagas;
      // Calcula data de término
      const inicio = d.inicio ? new Date(d.inicio) : new Date();
      const dataFim = new Date(inicio);
      dataFim.setMonth(dataFim.getMonth() + d.nParc - 1);

      totalMensalParcelado += d.parcela;
      return {
        ...d,
        restantes,
        dataFim,
        dataFimStr: dataFim.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        mesRestantes: Math.max(0, (dataFim.getFullYear() - hoje.getFullYear()) * 12 + dataFim.getMonth() - hoje.getMonth()),
      };
    });

    return { ativas: detalhe, totalMensalParcelado };
  }

  // ─── Semáforo financeiro ─────────────────────────────
  //  Calcula um score 0–100 e retorna cor + mensagens
  function calcSemaforo(renda, gastos, parcelasAtivas, totalParcelasMensal) {
    const { total: totalRenda } = renda;
    const { total: totalGastos } = gastos;

    if (totalRenda === 0) {
      return {
        cor: 'gray', emoji: '⚫', titulo: 'Sem dados de renda',
        label: 'Cadastre as receitas do mês para ativar o semáforo',
        score: 0, msgs: []
      };
    }

    const saldo         = totalRenda - totalGastos;
    const taxaPoupanca  = saldo / totalRenda;
    const compRenda     = totalParcelasMensal / totalRenda; // comprometimento com parcelas
    const comprGastos   = totalGastos / totalRenda;        // gastos vs renda
    const msgs = [];

    // Pontuação: começa em 100, vai perdendo
    let score = 100;

    if (comprGastos > 1.0) { score -= 40; msgs.push({ tipo: 'danger', txt: 'Gastando mais do que ganha este mês' }); }
    else if (comprGastos > 0.9) { score -= 25; msgs.push({ tipo: 'warn', txt: 'Gastos chegando perto de 90% da renda' }); }
    else if (comprGastos > 0.7) { score -= 10; msgs.push({ tipo: 'warn', txt: `Gastos em ${(comprGastos*100).toFixed(0)}% da renda` }); }

    if (compRenda > LIMITE_CRITICO) { score -= 30; msgs.push({ tipo: 'danger', txt: `${(compRenda*100).toFixed(0)}% da renda comprometida com parcelas fixas` }); }
    else if (compRenda > LIMITE_COMPROMETIMENTO) { score -= 15; msgs.push({ tipo: 'warn', txt: `${(compRenda*100).toFixed(0)}% da renda comprometida com parcelas` }); }

    if (taxaPoupanca < 0) { score -= 20; msgs.push({ tipo: 'danger', txt: 'Mês no negativo: gastando mais do que entra' }); }
    else if (taxaPoupanca < 0.10) { score -= 10; msgs.push({ tipo: 'warn', txt: 'Poupança abaixo de 10% — tente aumentar' }); }
    else if (taxaPoupanca >= META_POUPANCA) { msgs.push({ tipo: 'ok', txt: `Poupando ${(taxaPoupanca*100).toFixed(0)}% da renda — ótimo!` }); }

    if (parcelasAtivas > 5) { score -= 10; msgs.push({ tipo: 'warn', txt: `${parcelasAtivas} compras parceladas ativas` }); }

    score = Math.max(0, Math.min(100, score));

    let cor, emoji, titulo, label;
    if (score >= 75) {
      cor = 'green'; emoji = '🟢'; titulo = 'Saúde financeira BOA';
      label = 'Gastando menos do que ganha e com poupança positiva.';
    } else if (score >= 50) {
      cor = 'yellow'; emoji = '🟡'; titulo = 'Atenção necessária';
      label = 'Finanças sob controle, mas há pontos de melhoria.';
    } else if (score >= 25) {
      cor = 'orange'; emoji = '🟠'; titulo = 'Situação preocupante';
      label = 'Comprometimento alto. Revise gastos urgente.';
    } else {
      cor = 'red'; emoji = '🔴'; titulo = 'Alerta: endividamento alto';
      label = 'Gastos e parcelas comprometem severamente a renda.';
    }

    return { cor, emoji, titulo, label, score, msgs, taxaPoupanca, comprGastos, compRenda };
  }

  // ─── Alerta de comprometimento individual ─────────────
  function alertaComprometimento(receitas, despesas, mes, ano) {
    const renda  = calcRendaMensal(receitas, mes, ano);
    const gastos = calcGastosMensal(despesas, mes, ano);
    const alertas = [];

    MEMBROS_RENDA.forEach(nome => {
      const r = renda[nome.toLowerCase()] || 0;
      const g = gastos[nome.toLowerCase()] || 0;
      if (r > 0) {
        const pct = g / r;
        if (pct >= 0.9)       alertas.push({ nome, pct, nivel: 'danger', msg: `gastou ${(pct*100).toFixed(0)}% do salário` });
        else if (pct >= 0.7)  alertas.push({ nome, pct, nivel: 'warn',   msg: `já gastou ${(pct*100).toFixed(0)}% do salário` });
        else if (pct >= 0.5)  alertas.push({ nome, pct, nivel: 'info',   msg: `gastou ${(pct*100).toFixed(0)}% do salário` });
      }
    });

    return alertas;
  }

  // ─── Impacto de nova parcela ─────────────────────────
  function calcImpactoNovaParcela(parcela, nParc, inicio, dividas, renda) {
    const { ativas, totalMensalParcelado } = calcParcelasAtivas(dividas);
    const novoTotal = totalMensalParcelado + parcela;
    const compAtual = renda > 0 ? (totalMensalParcelado / renda) * 100 : 0;
    const compNovo  = renda > 0 ? (novoTotal / renda) * 100 : 0;

    // Data de fim da nova parcela
    const dataInicio = inicio ? new Date(inicio) : new Date();
    const dataFim    = new Date(dataInicio);
    dataFim.setMonth(dataFim.getMonth() + nParc - 1);
    const dataFimStr = dataFim.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Parcela com data mais longa
    let maisLonga = dataFim;
    ativas.forEach(a => { if (a.dataFim > maisLonga) maisLonga = a.dataFim; });
    const maisLongaStr = maisLonga.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return {
      nAtivas: ativas.length,
      totalAtual: totalMensalParcelado,
      novoTotal,
      compAtual: compAtual.toFixed(1),
      compNovo: compNovo.toFixed(1),
      dataFimStr,
      maisLongaStr,
      aumento: compNovo - compAtual,
      critico: compNovo > 50,
      alerta:  compNovo > 30,
    };
  }

  // ─── Histórico mensal para gráfico ───────────────────
  function calcHistorico(receitas, despesas, nMeses = 6) {
    const hoje = new Date();
    const hist = [];
    for (let i = nMeses - 1; i >= 0; i--) {
      let m = hoje.getMonth() + 1 - i;
      let y = hoje.getFullYear();
      while (m <= 0) { m += 12; y--; }
      const rec  = filtrarPeriodo(receitas, 'data', m, y).reduce((s, r) => s + r.valor, 0);
      const desp = filtrarPeriodo(despesas, 'data', m, y).reduce((s, r) => s + r.valor, 0);
      const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      hist.push({ mes: MESES[m - 1], ano: y, rec, desp, saldo: rec - desp });
    }
    return hist;
  }

  return {
    calcRendaMensal, calcGastosMensal, calcParcelasAtivas,
    calcSemaforo, alertaComprometimento, calcImpactoNovaParcela,
    calcHistorico, filtrarPeriodo, mesAtual, anoAtual,
    LIMITE_COMPROMETIMENTO, LIMITE_CRITICO, META_POUPANCA,
  };
})();
