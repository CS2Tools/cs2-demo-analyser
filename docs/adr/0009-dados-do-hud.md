# ADR 0009 — Dados do HUD do replay

**Status:** aceito (F2.1)

## Contexto

O HUD do replay (F2.2) precisa de dinheiro, inventário, capacete e kit de cada
jogador, dos tempos do round e da C4, e de onde e como a C4 anda. O plano
mandava confirmar tudo na demo real **antes** de escrever código, sem supor
nomes de campo.

## O teste de meio dia (demo de referência, Gamers Club, 64 tick)

`listUpdatedFields` lista os 968 campos que mudam na demo. Os relevantes, e o
que cada um mostrou:

| Precisa | Como sai da demo | Resultado |
|---|---|---|
| Dinheiro | prop `balance` (= `InGameMoneyServices.m_iAccount`) | ✔ |
| Inventário | prop `inventory`: lista pronta, com os **nomes de exibição** ("C4 Explosive", "Smoke Grenade") | ✔ |
| Capacete / kit | `has_helmet` / `has_defuser` | ✔ |
| Tempo do round | `CCSGameRules.m_iRoundTime` = **115 s** | ✔ na demo |
| Freezetime | `CCSGameRules.m_iFreezeTime` = **15 s**; bate com os ticks (960 ÷ 64) | ✔ na demo |
| Timer da C4 | **não está na demo** | medido: ver abaixo |
| Site do plantio | o evento traz um **índice de entidade** em `site`; a letra sai de `last_place_name` ("BombsiteA") | ✔ |
| Kit no desarme | `haskit` no evento `bomb_begindefuse` | ✔ |
| Flash assist | `assistedflash` no evento de morte | ✔ |
| Força do arremesso (F2.6) | `Grenade.m_flThrowStrength` (1,0 = clique esquerdo cheio) | ✔ |
| No chão / no ar (F2.6) | `CCSPlayerPawn.m_fFlags`, bit 0 = no chão; também `is_airborne` | ✔ — confirmado pelo freezetime (todos no chão) e por um jump throw real (Z sobe 45 unidades) |

## Timer da C4: medido na partida

A demo não grava o `mp_c4timer`. As 4 explosões da demo de referência
aconteceram **exatamente 2624 ticks (41,0 s)** depois do plantio: os 40 s do
padrão mais ~1 s até o evento de explosão. O app mede isso em cada partida
(mediana plantio→explosão, `measureC4Timer`) e registra a origem em
`matches.c4_timer_source`: `measured` ou, sem nenhuma explosão para medir,
`reference`, que usa os mesmos 41 s declarados em código.

## Plantio pós-round

O round 9 tinha **dois** plantios: um T plantou 301 ticks **depois do fim do
round 8** (o round já estava decidido), e a janela de eventos — "(fim do
anterior, fim deste]" — o atribuiu ao round 9. Para o HUD, vale só o plantio
**dentro** de [início, fim] do round (`plantForRound`). Isso corrige também o
`plant_site` do round e os marcadores de bomba na timeline do replay.

## Payload

Para não inflar o replay, só a arma na mão vai quadro a quadro (índice num
dicionário). Dinheiro, colete, capacete, kit e inventário vão só como
**mudanças**. Resultado na demo de referência: **+4,4%** por round (meta do
plano: menos de 30%).

## Conferências cruzadas

- O dinheiro do HUD no fim do freezetime é igual a `início − gasto` da tabela
  de economia (Pass E, calculada por outro caminho): **10 de 10** jogadores no
  round 4.
- Quem plantou é quem carregava a C4 logo antes, nos rounds 4 e 15.

## Partidas antigas

`matches.replay_data_version`: 1 antes da F2.1, 2 depois. O replay pede as
colunas novas só quando existem, e a UI oferece **Reprocessar**. Reprocessar lê
a cópia da biblioteca (F2.0), mas leva o **nome original** do arquivo: é dele
que saem os nomes dos times. Sem isso, a partida voltava como "Time CT vs Time
T". O bug foi encontrado no teste da interface e ganhou um teste de regressão.
