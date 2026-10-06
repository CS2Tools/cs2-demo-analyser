# ADR 0004 — Empacotamento Electron: o portão F1.4b

- **Data:** 2026-09-19
- **Status:** Aceito
- **Portão:** o `.exe` empacotado ingere uma demo

## Resultado

**PASSOU — 10 de 10 verificações, ingestão em 9,2 s.**

```
[ ok ] DuckDB carrega e o schema esta aplicado        23 tabelas
[ ok ] rota app.health responde por IPC               transporte=ipc
[ ok ] radares empacotados                            10 mapas
[ ok ] worker empacotado ingere a demo                9.2s — 17 rounds, 1 descartado
[ ok ] partida aparece na biblioteca                  de_overpass 4x13
[ ok ] scoreboard com 10 jogadores                    10 jogadores
[ ok ] placar fecha com os rounds live                4+13 = 17 rounds
[ ok ] round faca separado da partida                 1 descartado
[ ok ] checagens pos-ingestao passaram                todas
[ ok ] console SQL consulta o banco                   141 kills
```

Reproduzível com:

```bash
npm run gate:electron
```

## Por que este teste existe na quarta etapa e não na última

O risco nº 2 do plano é o módulo nativo do DuckDB dentro do Electron
empacotado. Adiar a verificação significaria descobrir o problema depois de dez
telas escritas em cima de uma arquitetura que não empacota.

A verificação é **headless e scriptável** (`--smoke-test <demo>`), não um
clique manual, para continuar valendo a cada mudança.

## A costura provou-se

O processo principal monta **exatamente os mesmos handlers** de `@cs2/api` que o
host de desenvolvimento monta atrás de HTTP — aqui atrás de `ipcMain.handle`.
Nenhuma linha da UI mudou. A escolha acontece em uma linha:

```ts
const transport = window.__cs2Bridge ? new IpcTransport() : new HttpTransport();
```

O `app.health` respondendo `transporte=ipc` no empacotado e `transporte=http`
em desenvolvimento é a prova de que os dois caminhos existem e a UI não
distingue.

## Cinco obstáculos reais, e como cada um foi resolvido

### 1. `import.meta.url` vira string vazia no bundle CJS — e derruba o app

O esbuild avisa `"import.meta" is not available with the "cjs" output format
and will be empty`. O que o aviso não diz é a consequência:
`fileURLToPath('')` **lança**, e lança no carregamento do módulo — antes de
qualquer código poder corrigir. O primeiro `.exe` morreu com um diálogo
`ERR_INVALID_ARG_TYPE` sem nem abrir janela.

Havia duas ocorrências, ambas em código que entra no bundle:

- `packages/db/src/migrate.ts` — resolução da pasta de `.sql`. Agora é
  tolerante (`try/catch` devolvendo `null`) e o app empacotado declara o
  caminho com `setSchemaDir()`.
- `packages/ingest/src/runner.ts` — caminho do worker. Estava no **topo do
  módulo**; foi movido para dentro de `devWorkerLauncher()`, que nunca é
  chamada no empacotado, e lança uma mensagem clara se for.

**Regra:** nenhum módulo que entre num bundle pode usar `import.meta.url` no
escopo de topo.

### 2. Não existe Node dentro do pacote

O worker de ingestão é um processo filho. Em desenvolvimento é o Node do
sistema rodando `worker.ts` via `tsx`; no pacote, é o **próprio binário do
Electron em modo Node** (`ELECTRON_RUN_AS_NODE=1`) rodando o `worker.js`
compilado.

Isso virou o `WorkerLauncher` em `IngestDeps` — um parâmetro, não um detalhe
embutido. O contrato do processo filho (arquivo de job na argv, mensagens por
`process.send`) é idêntico nos dois casos.

### 3. O electron-builder ignora `node_modules` dentro de `files`

Ele gerencia dependências de produção por conta própria, então
`dist/node_modules` foi silenciosamente descartado: o asar saiu com 1 MB e
**zero** binários nativos.

Colocar os nativos em `dependencies` também não funciona: o npm workspaces os
iça para a raiz e o electron-builder recusa com
`must be under apps/desktop`.

**Solução:** os nativos vão como `extraResources` para `resources/node_modules`,
que está no caminho de resolução do Node a partir de
`resources/app.asar/dist/main.js`. Ficam fora do asar por construção, sem
precisar de `asarUnpack`.

Todas as dependências de `apps/desktop` são `devDependencies`: o esbuild embute
os pacotes `@cs2/*` no bundle e os nativos são copiados à mão.

### 4. `files.from` apontando para fora da pasta do app quebra o `asarUnpack`

Apontar a UI com `{"from": "../web/dist"}` falha com
`must be under apps/desktop`. A UI passou a ser **copiada** para `dist/web` pelo
script de build.

Efeito colateral bom: tudo que o app carrega passou a ser resolvível por
`__dirname` — `dist/web`, `dist/worker.js`, `dist/schema`,
`dist/parser-version.json` — e `__dirname` é a mesma raiz em desenvolvimento e
no empacotado, porque o `main` é `dist/main.js` nos dois casos. Sumiu a classe
inteira de bug "caminho condicional errado".

### 5. `electronVersion` precisa ser fixado

O npm workspaces iça o `electron` para a raiz e o electron-builder não o acha a
partir de `apps/desktop`:
`Cannot compute electron version from installed node modules`. Fixado em
`build.electronVersion`.

## Invariantes agora garantidas por mecanismo

| Invariante | Mecanismo |
|---|---|
| Nenhum socket | Não existe servidor HTTP no processo principal. A UI é servida pelo protocolo `app://`, registrado como *standard* e *secure*. |
| Nenhuma requisição externa | `session.webRequest.onBeforeRequest` cancela tudo que não seja `app:` ou `devtools:` e registra a tentativa no stderr. |
| Renderer sem Node | `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`. O preload expõe **quatro** funções (a quarta, na F1.11, salva um arquivo pelo diálogo nativo). DuckDB e o parser vivem só no processo principal. |
| Sem path traversal nos assets | `safeJoin` recusa qualquer caminho que escape da pasta permitida. |

## Pendências conhecidas

- **`winCodeSign` falha ao extrair** (7-Zip sai com status 2, problema conhecido
  com symlinks no Windows sem modo desenvolvedor). Resolvido na F1.11 com
  `win.signAndEditExecutable: false`, que dispensa o pacote inteiro. Custo: o
  `.exe` interno não recebe ícone nem metadados de versão via rcedit. O
  instalador, os atalhos e a janela têm o ícone (o da janela vem de
  `dist/icon.png`, em tempo de execução). Assinatura de código fica para quando
  houver distribuição pública.

## F1.11 — instalador

- **NSIS**, `npm run dist:desktop` → `apps/desktop/release/CS2 Demo Analyser-Setup-<versão>.exe`
  (~94 MB). Instalação por usuário (sem admin), pasta escolhível, atalhos na
  área de trabalho e no menu Iniciar, licença GPL na primeira tela, instalador
  em pt-BR.
- **Desinstalar NÃO apaga a biblioteca** (`deleteAppDataOnUninstall: false`):
  banco, replays e configurações ficam em `%APPDATA%`. Reinstalar não pode
  custar meses de partidas.
- **Ícone** gerado por `scripts/make-icon.mjs` (rasterização em Node puro,
  sem dependência) — reproduzível e versionado.
- O NSIS é baixado pelo electron-builder **em tempo de build**. O app instalado
  continua sem nenhum acesso à rede.
- **Portão ampliado para 12 verificações**: além da ingestão, prova no `.exe`
  empacotado os veredictos (F1.10) e a exportação em zip (F1.11), que depende do
  `fflate` dentro do bundle e do `COPY` do DuckDB com caminho real.
