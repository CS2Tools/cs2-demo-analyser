# CS2 Demo Analyser

Analisador de demos de Counter-Strike 2 que roda inteiro na sua máquina.
Você aponta para um arquivo `.dem`, o programa lê, guarda num banco local e
mostra o que aconteceu — round por round, jogador por jogador, com o número
sempre acompanhado de onde ele saiu.

## As três garantias

Estas não são intenções; são requisitos de projeto, e há decisão registrada e
verificação automática para cada uma.

**1. Funciona sem internet.** O aplicativo instalado não abre socket. Nenhuma
API, nenhuma telemetria, nenhum serviço de terceiro. Mapas de radar, ícones,
fontes e o extrator de voz são empacotados no instalador. Só a *construção* do
instalador baixa coisas da internet, uma vez (`fetch:icons`, `fetch:voice`),
e cada arquivo é conferido por SHA-256.

**2. Não depende do CS2.** Você não precisa ter o jogo instalado. O programa
nunca lê, escreve ou enumera nada dentro da pasta do CS2 ou da Steam. Uma demo
é um arquivo de dados comum, e é tratada como tal.

**3. Não há risco de ban.** O programa não toca no processo do jogo: não lê
memória, não injeta código, não abre handle para o `cs2.exe`, não usa Game
State Integration nem console. O texto `setpos/setang` que algumas telas
oferecem é apenas texto copiado para a área de transferência — quem cola no
console é você, num servidor privado. Ver
[ADR 0008](docs/adr/0008-independencia-do-cs2.md).

## O que ele mostra

- **Biblioteca** — as partidas importadas, com mapa, placar, fonte (Gamers
  Club, FACEIT, matchmaking, HLTV) e data.
- **Partida** — placar, rounds como sequência, economia, bomba e sites, chat,
  e o replay 2D com radar, killfeed e painel de jogadores (com o K/D/A de cada
  um no instante que está na tela, como o placar do jogo).
- **Análise** — quinze cards: precisão, mira, duelos de entrada, clutches,
  multikills, KAST, cadeia da troca, economia, economia a fundo, bomba,
  utilitário, flashes, vantagem numérica, mapa de calor e rating.
- **Jogador** — evolução ao longo da biblioteca e o histórico por métrica.
- **Time / Adversário** — leitura de scout: os dois times lado a lado nesta
  partida, e o elenco recorrente ao longo da biblioteca.
- **Explorador** — consulta montada na tela (agrupar, medir, filtrar) sem
  escrever SQL; e um console de SQL para quem quiser escrever.
- **Utilitárias** — mapa de arremessos, filtrável por tipo, lado, jogador e
  pelo que de fato funcionou.
- **Veredictos** — dezesseis regras que comparam você com o seu próprio
  histórico (ou, quando ele é curto, com os outros da partida), e que se
  **calam** quando a amostra não dá para afirmar nada.
- **Troca de elenco** — o *complete* da Gamers Club: quando alguém sai e o time
  pede um substituto, a partida passa a ter seis ou mais por time. O app mede a
  janela de rounds de cada um, declara os rounds jogados desfalcados, e **não
  afirma o motivo** da saída — a demo não registra isso.

Todo card que mostra uma tabela exporta nos três formatos — PNG, CSV e JSON
— com rodapé de procedência. A imagem reproduz o card da tela, com os rótulos
traduzidos e as cores do tema, desenhada num canvas: não há rasterizador de DOM
no projeto. O CSV e o JSON continuam sendo o formato de **máquina**, com nomes
estáveis e sem acento — eles não mudam de idioma.

## O que ele não faz

O programa só afirma o que a demo mede. Onde a demo não diz, a tela declara
isso em vez de inventar:

- **Rating 2.0 é aproximação declarada.** A HLTV nunca publicou a fórmula; os
  coeficientes vêm de regressão publicada por terceiros, e a tela diz isso.
  O Rating 3.0 não é imitado. Ver [ADR 0013](docs/adr/0013-rating-aproximacao-e-impacto-de-round.md).
- **O chat não tem escopo.** O evento da demo não diz se a mensagem foi para o
  time ou para todos, então o painel não rotula.
- **A demo não carrega data.** Ela vem do padrão do nome do arquivo ou da data
  de modificação, e a tela mostra qual das duas foi.
- **A demo não diz por que alguém saiu da partida.** Medido nas vinte e quatro
  demos de teste: o código de desconexão não distingue um complete do fim
  normal da partida. Então o pareamento "entrou no lugar de" é declarado como
  inferência, e o motivo não é afirmado em lugar nenhum.

## Requisitos

**Para usar:** Windows 10 ou 11 (64 bits). Mais nada — o instalador leva tudo.

**Para desenvolver:** Node.js 22 ou mais novo, e Windows (o empacotamento e o
extrator de voz são `win32-x64`).

## Como importar uma demo

1. Abra o aplicativo na **Biblioteca**.
2. Arraste o `.dem` para a janela, ou clique em importar e escolha os arquivos
   no diálogo nativo (dá para selecionar vários; a fila importa um por um).
3. A primeira leitura é a mais demorada: são oito passagens pelo arquivo. O
   progresso aparece por partida.

As demos ficam onde você as deixou — o programa não as move. O banco e os
dados em massa vão para `%APPDATA%\CS2 Demo Analyser\data`; as exportações,
para `Documentos\CS2 Demo Analyser\exportacoes`. Nada é gravado em disco sem
você escolher o destino num diálogo nativo.

Em **Configurações** há a retenção: acima de um número de partidas, as mais
antigas perdem os dados em massa (ticks) e mantêm as estatísticas. Partida
fixada nunca é podada, e a tela diz quantas seriam afetadas antes de você
confirmar.

## Como rodar do código

```bash
npm install
npm run dev        # host em :5174, interface em :5173
```

Para o aplicativo de verdade:

```bash
npm run dist:desktop   # instalador NSIS em apps/desktop/release
```

`dist:desktop` chama `fetch:icons` e `fetch:voice` — é o único momento em que
algo é baixado, e é por isso que a primeira construção precisa de internet.

### Verificação

```bash
npm run typecheck      # tsc -b e a interface
npm test               # 803 testes
npm run gate:electron  # empacota e roda as asserções dentro do .exe
npm run check:demos    # importa uma pasta de demos de verdade, do começo ao fim
npm run check:voice    # confere o extrator de voz contra demos reais
```

O portão (`gate:electron`) não testa o código-fonte: ele empacota o
aplicativo, roda o `.exe` com `--smoke-test` e verifica o que só quebra no
empacotado — caminho de recurso, binário nativo, migração de banco.

## Como é feito

Monorepo com workspaces do npm.

| Pacote | Papel |
|---|---|
| `packages/ingest` | oito passagens pela demo (A–F, U, V) sobre o `demoparser2` |
| `packages/db` | DuckDB, 20 migrações numeradas com verificação por checksum |
| `packages/core` | cálculo: rounds, mira, bomba, utilitário, veredictos |
| `packages/api` | consultas e exportação; um só ponto de entrada por rota |
| `packages/contract` | os tipos que atravessam o fio, com `zod` |
| `packages/radar` | conversão de coordenada do mundo para o radar |
| `packages/i18n` | catálogo pt-BR (fonte) espelhado em en, com teste de paridade |
| `apps/web` | interface em React 19 + Vite + Tailwind + Base UI |
| `apps/host` | servidor Fastify, só para desenvolvimento |
| `apps/desktop` | Electron: janela, diálogos nativos e o portão |

Os dados em massa (ticks) não vão para o banco: viram Parquet ao lado dele.
Mudança de cálculo não obriga a reler a demo — cada família de número tem a
sua versão (`metrics_version`, `round_stats_version`, `replay_data_version`,
`rules_version`), e o preenchimento acontece ao abrir a biblioteca.

As decisões que custaram discussão estão em [`docs/adr/`](docs/adr) — treze
registros, do licenciamento à aproximação do rating.

## Licença

GPL-3.0-or-later. Ver [LICENSE](LICENSE).

Componentes de terceiros, com o que **não** está sob a GPL deste programa (os
ícones do Counter-Strike, que são propriedade da Valve, e a fonte Geist, que
tem a sua própria licença), estão listados em [NOTICE](NOTICE).

Counter-Strike é marca registrada da Valve Corporation. Este projeto não é
afiliado à Valve, à Gamers Club, à FACEIT nem à HLTV.
