// ══════════════════════════════════════════════════════════
//  CONFIGURAÇÃO — preencha após criar o projeto no Google Cloud
// ══════════════════════════════════════════════════════════

const CONFIG = {
  // 1. Client ID do Google Cloud (OAuth 2.0)
  //    Acesse: console.cloud.google.com → APIs & Services → Credentials
    CLIENT_ID: '830166894181-592vrfkgpn24sk6vju40t45iv2o6alkm.apps.googleusercontent.com',

  // 2. ID da Planilha Google Sheets
  //    É o trecho longo da URL: docs.google.com/spreadsheets/d/ESTE_TRECHO/edit
    SPREADSHEET_ID: '1tg2ZpnqXGh-ztA49zVjEw-ILPuSjoqjgqjgGMn5wrgc',

  // 3. E-mails autorizados (só esses conseguem fazer login)
  ALLOWED_EMAILS: [
        'eucartografo@gmail.com',  // Joelson
        'rql.nobre@gmail.com',  // Raquel
  ],

  // 4. Membros e categorias (já configurados, altere se quiser)
  MEMBROS: ['Joelson', 'Raquel', 'Davi', 'Luísa', 'Família (geral)'],
  CONTAS: ['Conta Corrente', 'Conta Joelson', 'Conta Raquel', 'Carteira (Dinheiro)', 'Poupança', 'Reserva de Emergência'],
  FORMAS_PGTO: ['PIX', 'Débito', 'Cartão de Crédito', 'Boleto', 'Transferência', 'Dinheiro'],

  CAT_RECEITA: [
    'Salário Joelson', 'Salário Raquel', '13º Salário', 'Férias',
    'Bônus/PLR', 'Freelance/Renda Extra', 'Benefícios (Vale Alim./Transp.)',
    'Rendimentos de Investimentos', 'Restituição IR', 'Outras Receitas'
  ],

  CAT_DESPESA: [
    'Moradia (Aluguel/Financiamento)', 'Condomínio', 'Energia Elétrica',
    'Água/Esgoto', 'Gás', 'Internet/Telefone', 'Mercado/Alimentação',
    'Açougue/Feira', 'Transporte/Combustível', 'Transporte Público/App',
    'Manutenção Veículo', 'Seguro Veículo', 'Saúde (Plano/Consultas)',
    'Farmácia/Medicamentos', 'Educação Adultos', 'Escola/Creche Crianças',
    'Material Escolar', 'Atividades Extracurriculares Crianças',
    'Fralda/Higiene Infantil', 'Roupas e Calçados Crianças',
    'Roupas e Calçados Adultos', 'Brinquedos/Lazer Infantil',
    'Lazer/Entretenimento Família', 'Streaming/Assinaturas',
    'Cuidados Pessoais', 'Cartão de Crédito (Fatura)',
    'Empréstimos/Financiamentos', 'Seguros (Vida/Residencial)',
    'Impostos/Taxas', 'Presentes', 'Viagens', 'Imprevistos', 'Outras Despesas'
  ],

  // Abas do Google Sheets (não altere a menos que mude os nomes nas planilhas)
  SHEETS: {
    CONTAS:    'CONTAS',
    RECEITAS:  'RECEITAS',
    DESPESAS:  'DESPESAS',
    ORCAMENTO: 'ORÇAMENTO',
    CARTAO:    'CARTÃO',
    DIVIDAS:   'DÍVIDAS',
    METAS:     'METAS',
  }
};
