# Segmentação de rounds: aquecimento, round faca e restarts

> Especificação de domínio. Implementada no Pass A da ingestão
> (`packages/ingest`), consumida por tudo que depende de `rounds`.

## O problema

Uma demo de Gamers Club ou FACEIT **não começa na partida**. A sequência típica é:

```
aquecimento  →  ROUND FACA  →  mp_restartgame  →  (às vezes outro restart)  →  partida real
```

O contador interno do jogo (`total_rounds_played`) **volta a zero** a cada
restart, e os eventos `round_start` / `round_end` do round faca e do aquecimento
são indistinguíveis dos da partida real se olharmos só para eles.

Tratar isso errado não gera um erro visível — gera **números silenciosamente
errados**:

- O placar final não fecha (rounds a mais).
- O "round 1" vira o round faca, então a economia de pistol round sai
  completamente distorcida (no round faca todo mundo tem $0 gasto e só faca).
- Heatmaps de morte e posição misturam aquecimento com jogo real.
- Estatísticas de entry/trade contam kills de aquecimento, onde as pessoas se
  matam sem sentido tático.
- O replay 2D mostra um "round 1" que não é o round 1.

## Sinais disponíveis na demo

Em ordem de confiabilidade:

1. **`round_announce_match_start`** — o evento que o servidor emite quando a
   partida de verdade começa. É o sinal mais direto. Pode aparecer **mais de uma
   vez** se houver múltiplos restarts.
2. **Reset de `total_rounds_played`** — a prop volta de N para 0. Cada reset é
   uma fronteira de restart.
3. **`is_warmup_period` / `game_phase`** — marca o aquecimento explicitamente.
4. **Inventário só de faca** — num round faca, nenhum jogador tem arma primária
   nem secundária, e `cash_spent_this_round` é 0 para todos os 10. Isso
   identifica o round faca mesmo quando os sinais acima falham.
5. **`round_end` com `win_reason`** — o round faca termina por eliminação, igual
   a qualquer outro; **não serve** para distingui-lo.

## Regra de segmentação

```
matchStartTick = tick do ÚLTIMO round_announce_match_start
                 (se ausente: tick do ÚLTIMO reset de total_rounds_played para 0)
                 (se ambos ausentes: tick do primeiro round_freeze_end da demo)
```

Todo round cujo `start_tick < matchStartTick` recebe `phase != 'live'`:

| `rounds.phase` | Critério | Entra nas estatísticas? |
|---|---|---|
| `warmup` | Antes do `matchStartTick` e com `is_warmup_period` ativo | **Não** |
| `knife` | Antes do `matchStartTick`, 10 jogadores só com faca, gasto zero | **Não** (mas é exibido) |
| `restart_discarded` | Antes do `matchStartTick`, sem se encaixar acima | **Não** |
| `live` | A partir do `matchStartTick` | **Sim** |

**A numeração `round_num` é reatribuída a partir de 1 sobre os rounds `live`,
em ordem de tick.** O número interno do jogo nunca é usado como chave, porque
ele repete após o restart.

## Consequências no schema

- `matches.match_start_tick BIGINT` — a fronteira, gravada na ingestão.
- `matches.restart_count INT` — quantos restarts foram detectados. Exibido na
  UI da partida; um valor alto é sinal de que a segmentação merece conferência.
- `matches.knife_round_tick BIGINT NULL` — se houve round faca, e qual.
- `rounds.phase VARCHAR` — os quatro valores da tabela acima.
- `rounds.game_round_num INT` — o número original do jogo, guardado só para
  depuração. **Nunca** usado em join nem em agregação.

## Regra de consulta

**Toda consulta analítica filtra `rounds.phase = 'live'`.** As únicas exceções
são a lista de rounds do replay (que pode mostrar o round faca, claramente
rotulado, porque assistir ao round faca é legítimo) e a tela de diagnóstico da
ingestão.

## Validação pós-ingestão

Estas asserções entram em `matches.validation_json` e viram banner de aviso se
falharem:

- `count(rounds WHERE phase = 'live')` é igual a `score_a + score_b`.
- O primeiro round `live` de cada metade tem economia de pistol round
  (equipamento de todos os 10 abaixo de $1.500).
- Nenhum round `live` tem os 10 jogadores apenas com faca.
- `match_start_tick` é menor que o `start_tick` do primeiro round `live`.

## Fontes de demo afetadas

| Origem | Round faca | Restarts |
|---|---|---|
| Gamers Club | Sim | Sim, às vezes múltiplos |
| FACEIT | Sim | Sim |
| Matchmaking da Valve | Não | Raro |
| HLTV / pro | Sim | Sim, frequentemente vários |

Ou seja: a segmentação **não é um caso de borda**, é o caminho normal para três
das quatro origens que o app aceita.
