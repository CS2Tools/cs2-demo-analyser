# ADR 0005 — Calibração da mira: o recuo soma

- **Data:** 2026-09-20
- **Status:** Aceito
- **Portão:** F1.8 — mediana do erro angular em headshots < 1,5°, p90 < 4°

## Resultado

**PASSOU.** Sobre 40 headshots limpos da demo de referência:

| parâmetro | valor medido |
|---|---|
| modelo de recuo | **`add`** — visão **+** tranco |
| tick do disparo | evento de morte **− 2 ticks** (a 64 tick) |
| altura da cabeça | **nível do olho**, sem deslocamento |
| mediana do erro | **1,070°** (limite 1,5°) |
| p90 | **3,10°** (limite 4°) |
| viés vertical | **−0,095°** — sem erro sistemático |
| erros abaixo de 1° | 48% |

Reproduzível com:

```bash
npm run calibrate:aim -- "C:\caminho\demo.dem"
```

## Por que isto é um experimento e não uma leitura de documentação

A afirmação mais profunda que este app faz é *"sua mira estava X graus abaixo
da cabeça dele"*. Se essa conta estiver errada, todo o coaching de mira vira
ruído com aparência de precisão — e o usuário treina exatamente o contrário do
que precisa, porque **errar o sinal do recuo inverte o diagnóstico**: a mesma
rajada aparece como "mira alta" em vez de "mira baixa".

A relação entre `m_vecCsViewPunchAngle` (o tranco da câmera) e
`m_angEyeAngles` (o ângulo de visão) não está documentada de forma confiável.
Em vez de escolher por intuição, medimos.

**O método:** num headshot **confirmado**, a bala passou pela cabeça. Então o
erro angular calculado tem que colapsar para perto de zero. Qualquer modelo que
não faça isso está errado, e o dado diz qual.

## O que a varredura revelou

Três incógnitas foram varridas **juntas**, porque elas se confundem: um erro na
altura da cabeça pode mascarar um erro no modelo de recuo.

1. **modelo de recuo** — `none`, `add`, `subtract`, `usercmd`
2. **tick do disparo** — 0, −1, −2
3. **altura do alvo** — de −6u a +4u a partir do olho

O achado mais sólido: **todas as 14 combinações aprovadas usam `add`**. Não é
um resultado no fio da navalha; o recuo soma, e nenhum ajuste dos outros dois
parâmetros salva os modelos concorrentes.

## Duas armadilhas que o experimento expôs

### 1. `distance` no `player_death` vem em METROS

Uma morte à queima-roupa aparece como `4.07`, não como `213`. O primeiro filtro
usou 300 assumindo unidades do Hammer e **eliminou 100% da amostra** — sem
erro, só um zero silencioso.

### 2. Ordenar pela mediana engana; ordenar pela cauda também

Na primeira rodada, "recuo já incluso" ganhou na mediana (0,93°) e **reprovou na
cauda** (p90 de 5,09°), com viés vertical de −1,56° denunciando parâmetro
errado. Depois, ordenar só pelo p90 descartou um candidato que passava nos
**dois** limites em favor de outro com a cauda marginalmente melhor.

O critério final: primeiro os que passam nos dois portões, e entre eles o de
menor mediana.

## Props: os nomes amigáveis não existem

O ADR 0002 registrou, da pesquisa, que `aim_punch_angle` e `velocity_X` estavam
disponíveis. **Não estão** — `parseTicks` os ignora em silêncio. O que existe
são os netprops crus, que o parser aceita por caminho completo:

| o que se quer | caminho real |
|---|---|
| ângulo de visão | `CCSPlayerPawn.m_angEyeAngles` |
| tranco do recuo | `CCSPlayerPawn.CCSPlayer_CameraServices.m_vecCsViewPunchAngle` |
| tiros na rajada | `CCSPlayerPawn.m_iShotsFired` |
| imprecisão da arma | `Weapon.m_fAccuracyPenalty` |
| velocidade máxima | `CCSPlayerPawn.CCSPlayer_MovementServices.m_flMaxspeed` |

`m_angEyeAngles` e `m_vecCsViewPunchAngle` voltam como vetor `[pitch, yaw, roll]`.

Não há vetor de velocidade do jogador: velocidade precisa ser derivada da
diferença de posição entre ticks consecutivos.

**Bônus:** `m_fAccuracyPenalty` é a imprecisão que o **próprio jogo** calcula.
É um dado melhor do que qualquer estimativa nossa de spray, e entra na F1.9.

## Consequências

- `CALIBRATED_PUNCH_MODEL`, `SHOT_TICK_OFFSET_AT_64` e `HEAD_OFFSET_FROM_EYE`
  ficam fixados em `packages/core/src/aim.ts`, com teste de regressão.
- Qualquer mudança futura na matemática da mira **tem que** rodar o portão de
  novo. Os limites (1,5° e 4°) são a definição de "está certo".
- `preaim` (250 ms antes do tiro) e `firstshot` (no momento do tiro) continuam
  sendo métricas **separadas**, com nomes separados. A primeira é crosshair
  placement; a segunda é precisão. Misturá-las exageraria a afirmação de
  coaching.

## Ressalva honesta

A calibração foi feita numa única demo (Gamers Club, 64 tick, de_overpass, 40
amostras). Os parâmetros são plausíveis e o viés é praticamente zero, mas uma
segunda demo — especialmente de 128 tick — confirmaria ou refinaria o
`SHOT_TICK_OFFSET`, que é o parâmetro mais dependente do tick rate.
