# ADR 0002 — Spike do parser: resultados medidos

- **Data:** 2026-09-19
- **Status:** Aceito
- **Portão:** F1.2 — pico de RSS < 700 MB numa demo de 200 MB
- **Demo de referência:** Gamers Club, `de_overpass`, 200,5 MB, 64 tick, 31:11

## Resultado

**PASSOU: 442 MB de pico, 17,0 s no total (12 MB/s).**

| Passe | Tempo | Linhas | RSS acumulado |
|---|---|---|---|
| header | 1 ms | 1 | 80 MB |
| playerInfo | 173 ms | 10 | 86 MB |
| A: eventos | 445 ms | 5.029 | 90 MB |
| B: granadas (só projéteis) | 1.673 ms | 160.788 | 154 MB |
| C: replay 8 Hz (stride 8) | 2.075 ms | 147.128 | 228 MB |
| D: janelas a taxa cheia | 11.267 ms | 377.246 | 442 MB |
| E: economia | 1.385 ms | 180 | 442 MB |

O janelamento do Pass D reduziu **68,2%** dos ticks: 38.032 de interesse contra
119.746 na demo inteira. É o que torna a análise de mira viável.

## Cinco descobertas que mudam o código

### 1. `listGameEvents` mente por omissão — nunca use como filtro

`listGameEvents` declara 51 eventos e **não inclui `round_start` nem
`round_end`**. Mas `parseEvents` devolve os dois normalmente (22 e 19 nesta
demo).

A primeira versão do spike filtrava a lista desejada por `listGameEvents` e
reportou, em silêncio, **zero rounds**. Nenhum erro, nenhum aviso — só uma
partida vazia.

**Regra:** pedir todos os eventos desejados direto. Evento ausente simplesmente
não volta.

### 2. `parseGrenades` devolve 85% de lixo por padrão

| chamada | linhas | tempo |
|---|---|---|
| `parseGrenades(path)` | 1.080.241 | 8.238 ms |
| `parseGrenades(path, null, false)` | **160.788** | **1.541 ms** |

O padrão inclui as granadas **na mão** dos jogadores — entidades como
`CSmokeGrenade` e `CHEGrenade`, emitidas a cada tick com `x`, `y`, `z`
**nulos**. Só os tipos `*Projectile` são projéteis de verdade.

O terceiro parâmetro (`grenades = false`) desliga as não-projéteis. Sozinho, ele
derrubou o pico de RSS de 690 MB para 442 MB. Nenhuma trajetória é perdida.

### 3. O cabeçalho do CS2 não traz tick rate nem duração

Ao contrário do CS:GO, `parseHeader` devolve apenas: `map_name`, `server_name`,
`client_name`, `game_directory`, `patch_version`, `demo_version_name`, GUIDs e
flags de addon. **Não há `playback_ticks` nem `playback_time`.**

O tick rate sai da razão entre ticks e `game_time` (relógio do servidor em
segundos), medida em dois pontos distantes, e depois ancorada em 64 ou 128:

```ts
const probe = parseTicks(path, ['game_time'], [a, b]);
const raw = (b - a) / (gt(b) - gt(a));
const tickRate = Math.abs(raw - 128) < Math.abs(raw - 64) ? 128 : 64;
```

**Esta demo da Gamers Club é 64 tick, não 128.** A suposição de que GC e FACEIT
são sempre 128 está errada — mais um motivo para o `TickClock` e a guarda
anti-hardcode.

### 4. A assinatura de `parseTicks` não é a documentada no README

```
parseTicks(path, wantedProps, wantedTicks?, wantedPlayers?, structOfArrays?, orderBySteamid?, propStates?)
```

Os ticks são o **terceiro** argumento, não o quarto. E `structOfArrays = true`
devolve colunas em vez de um objeto por linha — é a forma que o worker deve
usar, porque um objeto JS por linha custa muito mais memória.

### 5. `parseVoice` NÃO EXISTE no binário do Windows

O `index.d.ts` declara `parseVoice`, e `index.js` faz
`module.exports.parseVoice = parseVoice` — mas o `.node` de `win32-x64` não
exporta a função. Resultado: a chave existe no módulo valendo `undefined`.

```
Object.keys(m) inclui "parseVoice"
typeof m.parseVoice === "undefined"
```

Verificado nas versões **0.42.0, 0.41.3 e 0.41.0**. É limitação da build do
Windows, não da versão.

**Consequência:** a reprodução de áudio de voz (escolhida pelo usuário na
pergunta Q22) **não é implementável pelo caminho planejado**. Ver ADR 0003.

## Decisões tomadas

1. Pass B usa `parseGrenades(path, null, false)`.
2. Nenhum passe filtra eventos por `listGameEvents`.
3. Tick rate sempre inferido de `game_time`; nunca lido do cabeçalho, nunca
   assumido pela origem da demo.
4. Todo `parseTicks` volumoso usa `structOfArrays = true`.
5. Tamanhos de bloco mantidos: 4.000 ticks amostrados no Pass C, 3.000 no
   Pass D. Com 442 MB de pico não há motivo para mexer.
6. O worker roda em **child process**, então a memória volta ao SO no fim de
   cada demo. Medimos que o addon nativo não devolve tudo ao `gc()` — depois de
   liberar as granadas e forçar duas coletas, o RSS ficou em 417 MB. Num worker
   que morre, isso é irrelevante; numa worker thread, seria permanente.

## Detecção de origem e de POV (validada)

| sinal | valor nesta demo | uso |
|---|---|---|
| `server_name` | `Registre-se e jogue @ gamersclub.com.br` | origem → `gamers_club` |
| `client_name` | `SourceTV Demo` | GOTV (POV traz o nome do jogador) |
| jogadores humanos | 10 | segundo sinal de GOTV |

## Segmentação de rounds (validada)

A demo confirma o que está em `docs/rounds-and-restarts.md`:

- **Dois** `round_announce_match_start`: ticks 7.751 e 12.754.
- `matchStartTick` = 12.754 (o último).
- 19 `round_end`, dos quais um é espúrio (tick 1, `winner` nulo).
- 18 rounds reais → **1 descartado (o round faca)** → **17 live**.
- Vitórias por lado nos rounds live: CT 9 × 8 T.

Sem essa segmentação, o round faca viraria o "round 1" e a economia do pistol
round sairia completamente distorcida.
