# ADR 0010 — Utilitário a fundo: o que a demo mede e o que não mede

**Status:** aceito (F2.5)

## Contexto

O plano da F2.5 pedia, para flash: **pop flash** (arremesso→detonação abaixo de
0,9 s), flash assist e cegueira de quem estava de costas. Também pedia, para
molotov, "tempo de área negada", e, para smoke, se ela bloqueou visão.

Antes de colocar qualquer um desses números na tela, medimos na demo de
referência (Gamers Club, 64 tick, de_overpass, 17 rounds live).

## O que a medição mostrou

| Métrica pedida | O que a demo dá | Decisão |
|---|---|---|
| Pop flash (tempo de voo) | `detonate_tick − throw_tick` é **sempre 104 ticks** (1,6 s) nas 57 flashes: mínimo = mediana = máximo | **Não é calculável.** É o pavio, não o voo |
| HE: tempo até detonar | também fixo em 104 ticks | idem — não vira métrica |
| Molotov e smoke: tempo até detonar | variável (molotov 13–98, smoke 79–136 ticks), porque detonam ao tocar o chão | serve como dado, não como "pop" |
| Cegueira pelas costas | não existe na demo; dá para derivar do yaw da vítima contra a posição do estouro | **Derivado no Pass F**, a 8 Hz, marcado como aproximação |
| Distância da flash até a vítima | derivável das mesmas duas posições | **Entra no lugar da pop flash** |
| Área negada por molotov | a demo não traz o volume do fogo | fica de fora; o raio da detonação já existe marcado como `is_approximation` |
| Smoke bloqueou visão | exigiria linha de visão contra a geometria do mapa | fica de fora, declarado na tela |

Um "pop flash" medido por tempo de voo daria **zero para todo mundo, sempre** —
um número que parece informação e não é. Por isso a função `isPopFlash` da F1.9
continua no código, mas sem uso e com o porquê escrito em cima dela.

## O que entrou no lugar

**Distância mediana do estouro** (`blinds.flash_distance`, migração 008): a
distância entre o inimigo cegado e o ponto onde a flash abriu. Na demo de
referência: 117 cegueiras, mediana 769 unidades, mínimo 26, máximo 2186 — e a
diferença entre jogadores é grande (273 a 1196), então o número separa quem
joga a flash em cima de quem joga longe.

**Cegueira pelas costas** (`blinds.facing_away`, migração 007): 37 das 117.
Nunca somada à eficácia — aparece ao lado dela, porque é aproximação.

**Utilitário na morte** (`player_round_stats.unused_utility_value`, migração
007): o valor das granadas no inventário no último tick amostrado antes da
morte. Não é erro por si só, e a tela diz isso.

## Consequências

- As duas colunas derivadas dos ticks só existem em partidas importadas a
  partir da F2.5. `hasDeepData` avisa a tela, que oferece **Reprocessar**.
- A amostragem de 8 Hz limita as duas: quem gira o corpo ou compra dentro dos
  125 ms anteriores é classificado pelo instante anterior.
- Nada disso lê a demo de novo fora da ingestão: os dois campos são
  materializados no Pass F e **sobrevivem à poda**.
