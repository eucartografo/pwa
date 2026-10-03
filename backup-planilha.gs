// ══════════════════════════════════════════════════════════
//  BACKUP SEMANAL DA PLANILHA — Google Apps Script
//  Roda dentro do Google (servidor), não depende do app nem
//  do celular estarem abertos. Faz uma cópia completa da
//  planilha "Orçamento Familiar" toda semana numa pasta do
//  Google Drive, para o caso de algo apagar ou corromper dados.
// ══════════════════════════════════════════════════════════
//
// COMO CONFIGURAR (uma única vez):
//
//  1. Abra a planilha "Orçamento Familiar" no Google Sheets.
//  2. Menu Extensões → Apps Script.
//  3. Apague o conteúdo padrão do arquivo "Code.gs" e cole todo
//     este arquivo no lugar.
//  4. No topo do editor, escolha a função "backupSemanal" e clique
//     em "Executar" (▶) uma vez. O Google vai pedir autorização —
//     aceite (é a sua própria conta, acessando a sua própria planilha).
//  5. No menu lateral esquerdo, clique no ícone de relógio
//     ("Acionadores" / "Triggers") → "+ Adicionar acionador".
//       - Função a executar: backupSemanal
//       - Origem do evento: Baseado em tempo
//       - Tipo: Timer semanal
//       - Dia e horário: escolha o que preferir (ex: Domingo, 03h-04h)
//     Salve.
//  6. Pronto. A partir de agora, todo domingo o Google cria
//     automaticamente uma cópia da planilha numa pasta chamada
//     "Backups - Orçamento Familiar" no seu Google Drive — mesmo
//     que ninguém abra o app ou a planilha naquele dia.
//
// Para restaurar um backup: abra a pasta "Backups - Orçamento
// Familiar" no Drive, abra a cópia da data desejada, e copie os
// dados de volta para a planilha principal (ou simplesmente passe
// a usar aquela cópia, ajustando o SPREADSHEET_ID em config.js).

var PASTA_BACKUP = 'Backups - Orçamento Familiar';
var MANTER_DIAS  = 180; // backups mais antigos que isso são apagados automaticamente

function backupSemanal() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var arquivoOriginal = DriveApp.getFileById(planilha.getId());
  var pasta = obterOuCriarPasta(PASTA_BACKUP);

  var agora = new Date();
  var dataStr = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
  var nomeBackup = planilha.getName() + ' — backup ' + dataStr;

  arquivoOriginal.makeCopy(nomeBackup, pasta);

  limparBackupsAntigos(pasta);
}

function obterOuCriarPasta(nome) {
  var pastas = DriveApp.getFoldersByName(nome);
  if (pastas.hasNext()) return pastas.next();
  return DriveApp.createFolder(nome);
}

function limparBackupsAntigos(pasta) {
  var limite = new Date();
  limite.setDate(limite.getDate() - MANTER_DIAS);
  var arquivos = pasta.getFiles();
  while (arquivos.hasNext()) {
    var arquivo = arquivos.next();
    if (arquivo.getDateCreated() < limite) {
      arquivo.setTrashed(true);
    }
  }
}
