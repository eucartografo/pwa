# Orçamento Familiar — Documentação do Projeto PWA

> Documento de referência para uso no Claude Code (VS Code).
> Contém toda a arquitetura, decisões de design, estrutura de arquivos e instruções de manutenção.

---

## 1. Visão Geral

Aplicativo web progressivo (PWA) de controle financeiro pessoal para a família **Joelson, Raquel, Davi e Luísa**.

| Item | Valor |
|---|---|
| **URL em produção** | https://eucartografo.github.io/pwa/ |
| **Repositório GitHub** | https://github.com/eucartografo/pwa |
| **Hospedagem** | GitHub Pages (gratuito, branch `main`, pasta raiz `/`) |
| **Backend / banco de dados** | Google Sheets (via Google Sheets API v4) |
| **Autenticação** | Google Identity Services (OAuth 2.0) |
| **Tecnologia** | HTML + CSS + JavaScript puro (sem framework) |
| **Tipo** | PWA instalável (funciona como app nativo no Android/iOS) |

---

## 2. Filosofia e Premissas do App

O app foi construído em torno de princípios financeiros claros:

1. **Gastar menos do que se ganha** — princípio fundamental, exibido explicitamente na tela de Saúde Financeira.
2. **Hierarquia de prioridades financeiras** (sistema de níveis na aba Metas):
   - 🔴 **Nível 1** — Quitar todas as dívidas (bloqueante)
   - 🟡 **Nível 2** — Reserva de Emergência (6 meses de despesas)
   - 🟢 **Nível 3** — Metas livres (viagem, troca de carro, educação dos filhos)
3. **Transparência** — semáforo financeiro com score 0–100, alertas de comprometimento de renda por pessoa, e aviso ao cadastrar novas parcelas.

---

## 3. Estrutura de Arquivos

```
pwa/
├── index.html        # Shell do app — estrutura HTML, login, navegação
├── style.css         # Todo o CSS (design tokens, componentes, responsivo)
├── app.js            # Lógica principal: auth, navegação, back button Android
├── config.js         # ⚙️ CONFIGURAÇÃO DO USUÁRIO (CLIENT_ID, SPREADSHEET_ID, emails)
├── financas.js       # Motor de cálculo financeiro (semáforo, comprometimento, etc.)
├── sheets.js         # Camada de acesso ao Google Sheets API v4
├── pages.js          # Renderização de cada página do app
├── manifest.json     # Configuração PWA (ícones, cores, start_url)
├── sw.js             # Service Worker (cache offline, instalação PWA)
├── icons/
│   ├── icon-192.png  # Ícone PWA 192×192
│   └── icon-512.png  # Ícone PWA 512×512
└── PROJETO.md        # Este arquivo
```

---

## 4. Configuração (`config.js`)

**Este é o único arquivo que o usuário precisa editar para configurar o app.**

```javascript
const CONFIG = {
  CLIENT_ID: 'SEU_CLIENT_ID.apps.googleusercontent.com', // Google Cloud OAuth 2.0
  SPREADSHEET_ID: 'ID_DA_PLANILHA_GOOGLE_SHEETS',        // ID da planilha de dados
  ALLOWED_EMAILS: [
    'joelson@gmail.com',   // E-mail real do Joelson
    'raquel@gmail.com',    // E-mail real da Raquel
  ],
  MEMBROS: ['Joelson', 'Raquel', 'Davi', 'Luísa', 'Família (geral)'],
  CONTAS: ['Conta Corrente', 'Conta Joelson', 'Conta Raquel', ...],
  // ... categorias de receita e despesa
};
```

---

## 5. Arquitetura de Dados — Google Sheets

O Google Sheets funciona como banco de dados. O app cria automaticamente as abas na primeira execução.

### Abas da Planilha

| Aba | Colunas | Descrição |
|---|---|---|
| `CONTAS` | CONTA, RESPONSÁVEL, SALDO | Saldos das contas bancárias |
| `RECEITAS` | ID, DATA, DESCRIÇÃO, CATEGORIA, RESPONSÁVEL, CONTA, VALOR, LANÇADO_POR | Entradas de dinheiro |
| `DESPESAS` | ID, DATA, DESCRIÇÃO, CATEGORIA, PARA_QUEM, CONTA, FORMA_PGTO, VALOR, LANÇADO_POR | Saídas de dinheiro |
| `ORÇAMENTO` | CATEGORIA, META_MENSAL | Meta de gasto por categoria |
| `CARTÃO` | CARTÃO, TITULAR, LIMITE, DIA_VENC | Cartões de crédito cadastrados |
| `DÍVIDAS` | DESCRIÇÃO, RESPONSÁVEL, VALOR_TOTAL, PARCELA, N_PARCELAS, PAGAS, DATA_INICIO | Dívidas e parcelamentos |
| `METAS` | OBJETIVO, META, GUARDADO, APORTE_MENSAL, OBSERVAÇÃO | Objetivos financeiros |

> `RESPONSÁVEL`/`PARA_QUEM` indicam de quem é o dinheiro/gasto. `LANÇADO_POR` é diferente: é o nome de quem estava logado no app no momento em que o lançamento foi criado (Joelson ou Raquel) — útil para saber quem registrou cada item. É preenchido automaticamente a partir da sessão Google logada; não é editável no formulário. Planilhas criadas antes dessa coluna existir recebem o cabeçalho automaticamente na primeira vez que o app carrega (`Sheets.migrarColunaLancadoPor`); lançamentos antigos ficam com esse campo em branco.

### Acesso à API

- **Leitura**: `GET /v4/spreadsheets/{id}/values/{range}`
- **Escrita (append)**: `POST /v4/spreadsheets/{id}/values/{range}:append`
- **Escrita (update)**: `PUT /v4/spreadsheets/{id}/values/{range}`
- **Deletar linha**: `POST /v4/spreadsheets/{id}:batchUpdate` com `deleteDimension`
- **Autenticação**: Bearer token OAuth 2.0 (scope: `spreadsheets`)

---

## 6. Módulos JavaScript

### `app.js` — Núcleo do App

Responsável por:
- **Autenticação** com Google Identity Services (One Tap + OAuth2 Token Client)
- **Sessão persistente** via `localStorage` (chave `familia_user`) — o usuário não precisa fazer login toda vez
- **Renovação automática de token** a cada 50 minutos (tokens OAuth duram 1 hora)
- **Roteamento** entre páginas com histórico (`history.pushState`)
- **Botão voltar Android** — intercepta `popstate` e navega entre páginas em vez de fechar o app
- **Modal de confirmação de saída** quando o usuário está na tela inicial e pressiona voltar
- **Menu de perfil mobile** — clique no avatar abre menu com Sair e atalhos para páginas

Funções exportadas: `init`, `navigateTo`, `togglePerfilMenu`, `cancelExit`, `confirmExit`, `getUserName` (nome do usuário logado, usado para registrar quem lançou cada receita/despesa)

### `financas.js` — Motor de Cálculo

Motor central de análise financeira. Funções principais:

| Função | O que faz |
|---|---|
| `calcRendaMensal(receitas, mes, ano)` | Renda total, do Joelson e da Raquel no mês |
| `calcGastosMensal(despesas, mes, ano)` | Gastos por pessoa (Joelson, Raquel, Davi, Luísa) |
| `calcParcelasAtivas(dividas)` | Parcelas em aberto, total mensal comprometido, data de fim de cada uma |
| `calcSemaforo(renda, gastos, ativas, totalParcelas)` | Score 0–100, cor (green/yellow/orange/red), diagnóstico |
| `alertaComprometimento(receitas, despesas, mes, ano)` | Alerta individual: "Raquel, você já gastou 70% do salário" |
| `calcImpactoNovaParcela(parcela, nParc, inicio, dividas, renda)` | Impacto de uma nova compra parcelada na renda familiar |
| `calcHistorico(receitas, despesas, nMeses)` | Histórico mensal para o gráfico dos últimos N meses |
| `calcGastosPorCategoria(despesas, mes, ano)` | Despesas do mês agrupadas por categoria, ordenadas da maior para a menor — base do gráfico "Para Onde Foi Seu Dinheiro" no Painel |
| `calcHistoricoComDividas(receitas, despesas, dividas, nMeses)` | Igual ao anterior, mas também soma quanto estava comprometido em parcelas de dívida em cada mês — usado no gráfico "Receitas × Dívidas com Despesas em linha" da Saúde Financeira |
| `mesAnterior(mes, ano)` | Retorna `{ mes, ano }` do mês anterior ao informado (trata virada de ano) |

**Limites financeiros configurados:**
- `LIMITE_COMPROMETIMENTO = 0.30` — 30% da renda em parcelas = amarelo
- `LIMITE_CRITICO = 0.50` — 50% = vermelho
- `META_POUPANCA = 0.20` — 20% de poupança = saudável

### `sheets.js` — Camada de Dados

Abstração do Google Sheets API. Funções:

- `read(sheet, range)` / `readAll(sheet)` — leitura
- `append(sheet, values)` — inserir nova linha
- `update(sheet, range, values)` — atualizar células
- `deleteRow(sheet, rowIndex)` — deletar linha (0-based)
- `initSpreadsheet()` — cria as abas e cabeçalhos no primeiro acesso
- `parseReceitas/Despesas/Contas/Orcamento/Dividas/Metas/Cartoes(rows)` — parsers de cada aba

### `pages.js` — Renderização

Contém um renderer para cada página. Todas as funções recebem o elemento `el` da página e fazem fetch dos dados + render do HTML internamente.

| Função | Página |
|---|---|
| `renderPainel(el)` | Dashboard: **"Para Onde Foi Seu Dinheiro"** (gráfico de rosca por categoria + frase-resumo + maior gasto do mês) é o primeiro bloco da tela; KPIs grandes só para Receitas/Despesas/Saldo do Mês; demais números (saldo em contas, acumulado, reserva, por pessoa, dívidas) em `stat-chip`s compactos; lançamentos recentes; progresso de metas |
| `renderSaude(el)` | Semáforo, alertas pessoais, gráfico renda×gastos, gráfico receitas×dívidas com despesas em linha, parcelas ativas |
| `renderContas(el)` | Saldos das contas com botão de atualização |
| `renderReceitas(el)` | Seletor de mês/ano, busca, filtro por pessoa, ordenação Data/A-Z, edição e exclusão com confirmação, mostra quem lançou |
| `renderDespesas(el)` | Seletor de mês/ano, busca, filtro por pessoa, ordenação Data/A-Z, edição e exclusão com confirmação, mostra quem lançou |
| `renderOrcamento(el)` | Meta vs realizado por categoria com barras de progresso |
| `renderCartao(el)` | Fatura atual calculada automaticamente das despesas, edição de limite/vencimento |
| `renderDividas(el)` | Filtro por responsável, cards de dívidas com progresso, edição, registro de parcelas com confirmação e confete, botão flutuante de nova dívida |
| `renderMetas(el)` | **Sistema de 3 níveis** — Dívidas → Reserva → Metas livres |
| `renderRelatorio(el)` | Relatório mensal com seletor de período e exportação (PDF ou CSV, seções selecionáveis) |

**Funções de formulário (modais):**
- `openNovaDespesa(preencher?, dataSugestao?)` — cria ou edita (quando `preencher` tem `_row`); detecta cartão de crédito e exibe impacto de parcelamento ao criar
- `openNovaReceita(preencher?, dataSugestao?)` — cria ou edita uma receita
- `openNovaDivida(preencher?)` — cria ou edita uma dívida; calcula impacto na renda em tempo real ao digitar
- `encontrarDuplicata(cache, data, desc, valor, excludeRow?)` / `confirmarSeDuplicado(...)` — antes de salvar uma nova despesa/receita, avisa se já existe um lançamento com a mesma data, valor e descrição, e pede confirmação para continuar
- `openNovaMetaReserva()` — formulário simplificado para Reserva de Emergência
- `editarCartao(row, nome, limite, diaVenc)` — edita limite/vencimento de um cartão
- `confirmModal(mensagem, onConfirm)` — modal de confirmação usada antes de qualquer exclusão
- `_calcImpactoParc()` / `_calcImpactoDivida()` — cálculo em tempo real do impacto de novas parcelas
- `openExportarRelatorio()` — modal com checkboxes (Receitas/Despesas/Dívidas/Gráficos) e escolha de formato (PDF ou CSV); chama `gerarPDFRelatorio(opts)` ou `gerarCSVRelatorio(opts)` conforme a escolha. O PDF desenha os gráficos como SVG puro (`svgGroupedBars`, sem bibliotecas externas) para imprimir corretamente; o CSV sai com BOM UTF-8 e colunas separadas por `;` (compatível com Excel/Sheets em pt-BR)

---

## 7. Páginas do App

### Navegação Desktop (sidebar)
Painel → Saúde Financeira → Contas → Receitas → Despesas → Orçamento → Cartão → Dívidas → Metas → Relatório

### Navegação Mobile (bottom nav)
Painel | Saúde | Receitas | Despesas | Relatório
+ Menu de perfil (avatar no canto superior direito) com acesso a: Contas, Metas, Dívidas, Orçamento, Cartão, Sair

---

## 8. PWA — Instalação no Celular

### manifest.json
```json
{
  "start_url": "/pwa/",
  "scope": "/pwa/",
  "display": "standalone",
  "theme_color": "#1F3864",
  "background_color": "#1F3864"
}
```
> ⚠️ O `start_url` e `scope` devem incluir `/pwa/` porque o app está em subdiretório no GitHub Pages.

### Service Worker (`sw.js`)
- Cache: `familia-v2` (incrementar versão ao mudar arquivos estáticos)
- Estratégia: **network-first** para APIs Google; **cache-first** para assets estáticos
- Todos os caminhos no ASSETS devem começar com `/pwa/`

### Como instalar no Android
1. Acessar https://eucartografo.github.io/pwa/ no Chrome
2. Clicar nos 3 pontos → "Adicionar à tela inicial" (ou banner automático)
3. Confirmar instalação
4. O app abre em modo standalone (sem barra do navegador)

---

## 9. Autenticação — Fluxo Completo

```
1. Usuário acessa o app
2. App verifica localStorage por sessão salva (chave: "familia_user")
   ├── Sessão encontrada → setupTokenClient(userInfo, silent=true)
   │   └── requestAccessToken({ prompt: '' }) → token renovado sem popup
   └── Sem sessão → google.accounts.id.prompt() (One Tap)
       ├── One Tap aceito → handleCredential() → salva no localStorage
       └── One Tap dispensado → mostra botão "Entrar com Google"

3. Com token válido → onLoginSuccess() → carrega Painel
4. Token renovado automaticamente a cada 50 minutos (setInterval)
5. Logout limpa localStorage + desativa auto-select do Google
```

> ⚠️ O `CLIENT_ID` deve ter `https://eucartografo.github.io` em **Authorized JavaScript origins** no Google Cloud Console.

---

## 10. Semáforo Financeiro — Lógica de Score

| Condição | Penalidade |
|---|---|
| Gastos > 100% da renda | −40 pts |
| Gastos > 90% da renda | −25 pts |
| Gastos > 70% da renda | −10 pts |
| Parcelas > 50% da renda | −30 pts |
| Parcelas > 30% da renda | −15 pts |
| Saldo negativo no mês | −20 pts |
| Poupança < 10% | −10 pts |
| Mais de 5 parcelamentos ativos | −10 pts |

| Score | Cor | Status |
|---|---|---|
| 75–100 | 🟢 Verde | Saúde financeira boa |
| 50–74 | 🟡 Amarelo | Atenção necessária |
| 25–49 | 🟠 Laranja | Situação preocupante |
| 0–24 | 🔴 Vermelho | Alerta: endividamento alto |

---

## 11. Deploy e Atualização

### Estrutura do repositório GitHub
```
eucartografo/pwa/          ← raiz do repositório
├── index.html
├── style.css
├── app.js
├── config.js              ← ⚠️ contém credenciais reais (não commitar em público)
├── financas.js
├── sheets.js
├── pages.js
├── manifest.json
├── sw.js
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

### Comandos de atualização
```bash
# Clonar (primeira vez)
git clone https://github.com/eucartografo/pwa.git
cd pwa

# Atualizar arquivos e subir
git add .
git commit -m "descrição da mudança"
git push

# Apenas arquivos específicos
git add app.js index.html style.css
git commit -m "navegação Android e menu perfil mobile"
git push
```

### Quais arquivos mudar para cada tipo de mudança

| O que mudar | Arquivos afetados |
|---|---|
| Credenciais Google / e-mails / categorias | `config.js` |
| Nova página ou rota | `index.html` + `app.js` + `pages.js` |
| Lógica financeira (semáforo, cálculos) | `financas.js` |
| Layout / cores / responsivo | `style.css` |
| Acesso ao Google Sheets | `sheets.js` |
| Cache offline / versão PWA | `sw.js` (incrementar `CACHE = 'familia-v3'`) |
| Ícones ou nome do app | `manifest.json` + `icons/` |

> ⚠️ Ao mudar `sw.js`, incremente o nome do cache (`familia-v2` → `familia-v3`) para forçar atualização nos dispositivos.

---

## 12. Paleta de Cores (CSS Tokens)

```css
--navy:       #1F3864   /* azul marinho principal */
--blue:       #2E5395   /* azul secundário */
--blue-lt:    #EEF3FB   /* azul claro (fundos) */
--green:      #1E7B45   /* verde (receitas, positivo) */
--green-em:   #4CAF91   /* verde esmeralda (destaques) */
--green-lt:   #E8F5EE   /* verde claro (fundos) */
--red:        #C0392B   /* vermelho (despesas, negativo) */
--orange:     #E07B39   /* laranja (atenção) */
--gold:       #BF9000   /* dourado (cartão, alertas) */
--gray-900:   #111827   /* texto principal */
--gray-500:   #6B7280   /* texto secundário */
--gray-100:   #F3F4F6   /* fundos claros */
```

---

## 13. Histórico de Funcionalidades

| Versão | O que foi adicionado |
|---|---|
| v1 | Estrutura base: Painel, Contas, Receitas, Despesas, Orçamento, Cartão, Dívidas, Metas |
| v2 | Página de Relatório Mensal com seletor de período e exportação PDF |
| v3 | Saúde Financeira: semáforo, alertas individuais, gráfico renda×gastos, motor `financas.js` |
| v4 | Alerta de impacto ao cadastrar compras parceladas (nova despesa e nova dívida) |
| v5 | Sistema de 3 níveis na aba Metas (Dívidas → Reserva → Metas) |
| v6 | Fix: `manifest.json` com `start_url: /pwa/` e `sw.js` com paths `/pwa/` |
| v7 | Login persistente via `localStorage` + renovação silenciosa de token OAuth |
| v8 | Navegação com histórico, botão voltar Android, modal de saída, menu perfil mobile |
| v9 | Busca e filtro por pessoa em Receitas/Despesas/Dívidas, ordenação A-Z, edição de despesas/receitas/dívidas/limite do cartão, confirmação antes de excluir, seletor de mês em Receitas/Despesas, saldo acumulado e saldo do mês anterior no Painel, resumo de dívidas com "marcar parcela paga" no Painel |
| v10 | Coluna LANÇADO_POR (identifica quem registrou cada receita/despesa), aviso de possível lançamento duplicado, gráfico "Receitas × Dívidas com Despesas em linha" (histórico de 6 meses) na Saúde Financeira, script de backup semanal automático da planilha (`backup-planilha.gs`) |
| v11 | Exportação do Relatório com seções selecionáveis (Receitas/Despesas/Dívidas/Gráficos) em PDF (com gráficos SVG) ou CSV (com BOM UTF-8, para Excel/Sheets) |
| v12 | Painel responde "Para onde foi meu dinheiro": gráfico de rosca por categoria com comparação ao mês anterior, e destaque do maior gasto do mês |
| v13 | Auditoria de código (5 bugs corrigidos) + revisão visual do Painel: bloco "Para Onde Foi Seu Dinheiro" movido para o topo da tela com frase-resumo e donut maior; KPIs secundários (saldo em contas, acumulado, reserva, por pessoa, dívidas) convertidos em `stat-chip`s compactos para reduzir a "parede de cards coloridos" e focar a atenção na resposta da pergunta |
| v14 | Fix: SVG do donut renderizando 20×20px (regra global `svg{}` sobrescrevia o tamanho); fix: cards de KPI sem `min-width:0` causavam overflow horizontal da página inteira ao deslizar; confete + som (Web Audio API) ao marcar parcela de dívida como paga; revisão de pontuação em todo o texto do app (travessões `—` substituídos por vírgula, dois-pontos ou nova frase, conforme o contexto) |
| v15 | Fix: valor do KPI quebrando no meio do número em telas estreitas (trocado `overflow-wrap: break-word` por `clamp()` de fonte); confirmação obrigatória antes de marcar parcela de dívida como paga (evita toque acidental); botão flutuante (FAB) de "Nova Dívida" na aba Dívidas, igual Receitas/Despesas |
| v16 | Fix crítico: botão "+" de Receitas/Despesas não fazia nada — `_despDataSugestao`/`_recDataSugestao` eram chamadas no HTML (`onclick="Pages._despDataSugestao()"`) mas nunca tinham sido adicionadas à lista de exports do módulo `Pages`, então a chamada lançava um erro silencioso (`TypeError: ... is not a function`) antes mesmo de abrir o formulário |

---

## 14. Próximas Melhorias Sugeridas

- [ ] Notificações push (ex: "Joelson, você gastou 80% do salário este mês")
- [ ] Gráfico de pizza de despesas por categoria no Painel
- [ ] Filtro por mês nas abas de Receitas e Despesas
- [ ] Modo escuro
- [ ] Exportar planilha completa como XLSX direto do app
- [ ] Widget de resumo para tela inicial do Android

---

## 15. Contato / Manutenção

- **Desenvolvido com** Claude (Anthropic) — modelo próprio, livre para uso e edição
- **Repositório:** https://github.com/eucartografo/pwa
- **App em produção:** https://eucartografo.github.io/pwa/

---

## 16. Backup Semanal de Segurança

O Google Sheets já guarda histórico de versões (File → Histórico de versões, dentro do próprio Sheets), mas isso não protege contra, por exemplo, apagar a planilha inteira por engano. Por isso existe um backup automático adicional:

- **Arquivo:** [`backup-planilha.gs`](./backup-planilha.gs) — script do Google Apps Script.
- **O que faz:** toda semana, cria uma cópia completa da planilha "Orçamento Familiar" numa pasta `Backups - Orçamento Familiar` no Google Drive do usuário. Backups com mais de 180 dias são apagados automaticamente para não acumular lixo.
- **Por que Apps Script e não algo no app:** o app é 100% estático (GitHub Pages), sem servidor — não existe como agendar uma tarefa que rode "mesmo que ninguém abra o app". O Apps Script roda dentro da infraestrutura do Google, vinculado à própria planilha, então o backup acontece de verdade todo domingo independente de alguém abrir o app ou o celular naquele dia.
- **Configuração:** é manual e feita uma única vez (não pode ser feita por este repositório, pois exige autorizar o script com a conta Google do usuário). Passo a passo completo nos comentários do topo do arquivo `backup-planilha.gs`.
- **Para restaurar:** abra a pasta de backups no Drive, escolha a cópia da data desejada, e copie os dados de volta para a planilha principal (ou passe a usar aquela cópia, atualizando `SPREADSHEET_ID` em `config.js`).
