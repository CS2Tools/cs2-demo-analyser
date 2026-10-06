# ADR 0012 — Precisão: o que a demo mede do tiro

**Status:** aceito (F4.3)

## Contexto

Até a Fase 3 o app media **onde a mira estava** — crosshair placement, viés
vertical, erro no primeiro tiro — e não media **se a bala acertou**. É a
lacuna mais visível contra qualquer ferramenta de CS2, e a matéria-prima
estava no banco desde a F1.8 sem nenhuma leitura: `weapon_fires` (um registro
por disparo, com posição, ângulo e recuo) e `damages` (um registro por acerto).

Antes de prometer "% de acerto" na tela, medimos — o mesmo passo que produziu
a ADR 0010 (a pop flash que não era calculável) e a ADR 0011 (a arma com dois
nomes). Medição feita na biblioteca de referência (5 partidas: Gamers Club e
HLTV) e, para o que exige o parser, em três demos direto do arquivo.

## O que a medição mostrou

### 1. O dano e o disparo se encontram pelo TICK

| | linhas |
|---|---|
| dano de arma (`NOT is_utility`) | 2.250 |
| com disparo do mesmo atirador **no mesmo tick** | 2.156 (**95,8%**) |
| com disparo a ±1 tick | 2.156 (nada a mais) |

O encontro é **exato ou nenhum** — não há deslocamento de um tick a
compensar. E os 4,2% que não encontram têm explicação:

| arma do dano sem disparo | linhas |
|---|---|
| `knife` | 46 |
| *(vazio)* — queda, mundo | 26 |
| `planted_c4` | 17 |
| `smokegrenade` | 5 |

Faca não emite `weapon_fire` nestas demos, e explosão da C4 e dano de queda
não são disparo de ninguém. **Para arma de fogo, o encontro é praticamente
100%.**

### 2. O disparo nomeia a arma EXATA; o dano, não

No mesmo tick:

| `weapon_fires.weapon` | `damages.weapon` | lances |
|---|---|---|
| `weapon_ak47` | `ak47` | 685 |
| `weapon_m4a1_silencer` | `m4a1` | 422 |
| `weapon_m4a1` | `m4a1` | 188 |
| `weapon_usp_silencer` | `hkp2000` | 113 |

Duas coisas: o disparo usa o prefixo `weapon_`, e — o que importa — ele
**distingue M4A4 de M4A1-S**, que o evento de dano funde (ADR 0011).

**Consequência boa:** como a atribuição do acerto é feita pelo TICK e não pelo
nome, a precisão por arma sai exata mesmo nas armas que a ADR 0011 declarou
ambíguas. O caminho do tick é mais forte que o caminho do nome.

### 3. Um disparo pode gerar mais de uma linha de dano

| arma | disparos | máx. linhas de dano | máx. vítimas |
|---|---|---|---|
| `weapon_xm1014` | 19 | **4** | 1 |
| `weapon_ak47` | 4.263 | 2 | 2 |
| `weapon_m4a1_silencer` | 2.006 | 2 | 2 |

São dois fenômenos diferentes: escopeta espalha pelotas (4 linhas, **uma**
vítima) e rifle atravessa (2 linhas, **duas** vítimas). Contar linhas de dano
como "acertos" daria precisão acima de 100% na escopeta.

**Decisão:** um disparo acerta ou não acerta — o acerto é contado **por
disparo**, não por linha de dano. O dano continua sendo somado por linha.

### 4. `hitgroup` existia, estava vazio, e é TEXTO

A coluna `damages.hitgroup` está **NULL em 100% das linhas** de qualquer banco
existente: a ingestão nunca pediu o campo. Sondando o parser direto, ele
entrega — e entrega **texto**, não código:

```
chest, generic, stomach, head, right_arm, left_arm, right_leg, left_leg, neck
```

Os nove valores, e só eles, nas três demos conferidas (duas de Gamers Club,
uma de HLTV). A coluna nasceu `INTEGER` e por isso a ingestão gravava `NULL`.

**Decisão:** migração 014 muda o tipo para `VARCHAR` (a coluna está toda nula,
então nada se perde) e a ingestão passa a gravar o texto do parser. Guardar o
texto, e não um código traduzido, é a mesma decisão da ADR 0011: uma tabela de
tradução envelheceria a cada atualização do CS2.

### 5. A velocidade no tiro não existia — e se deriva

`weapon_fires.speed` nasceu nula na F1.8 e continuou assim
(`engagements.player_was_moving` idem, com o comentário
`// player_was_moving: exige velocidade derivada`). A demo não entrega
velocidade sob nome amigável (ADR 0002).

Mas o Pass U já deriva velocidade para o arremesso de granada, pelo
deslocamento entre o tick anterior e o do evento. O Pass D passa a fazer o
mesmo para o disparo, em SQL, sobre a janela de ticks que ele já materializa.

**Limite declarado:** só vale entre ticks vizinhos (≤ 2 ticks, 31 ms a 64 Hz).
A janela de interesse é contínua em volta de cada tiro, mas entre duas janelas
há buracos, e medir deslocamento por cima de um buraco daria velocidade
inventada. Buraco = fica nulo, e a métrica se cala.

## O que isso custa

`hitgroup` e `speed` são os **únicos** dois itens desta fase que exigem
reprocessar: nascem na ingestão. Todo o resto da precisão (acerto, spray,
tempo até o tiro) sai de dado que já está no banco e **vale retroativamente
para a biblioteca inteira**, inclusive para partida podada.

Partida podada perdeu a cópia da demo e **nunca** terá os dois. A tela diz
isso, no mesmo padrão do `hasDeepData` da F2.5 — em vez de mostrar zero como
se fosse medição.

### 6. "Tempo até o primeiro tiro" NÃO existe

`engagements.ttfs_ms` estava na lista de coisas prontas para mostrar: a coluna
existe desde a F1.8 e nunca apareceu em tela. Medindo: **nula em 619 de 619
duelos**.

E não é só de preencher. `tick_start`, que parecia o começo do duelo, é o
ponto de amostragem do pré-aim — exatamente 250 ms antes do tiro. Calcular
`ttfs` a partir dele daria **250 ms para todo mundo, sempre**: o mesmo tipo de
número que parece informação e não é, que a ADR 0010 encontrou na pop flash.

O início de verdade de um duelo exige o cone de FOV, aproximação que o próprio
Pass F declara não fazer (`pass-f.ts:163`: *"Detectar o início de um duelo que
ninguém venceu exigiria o cone de FOV... fica para quando houver tela que a
explique"*).

**Decisão:** fica de fora. A métrica não entra no contrato nem na tela.

## O que fica de fora

- **Precisão "com inimigo à vista"**, como o Leetify calcula: exigiria saber
  quem estava visível a cada tiro, o que depende de geometria do mapa. Fica
  fora, como a smoke que bloqueia visão (ADR 0010).
- **`shots_fired` e `accuracy_penalty`**, que existem em `ticks_window`: são
  a inexatidão interna do jogo, e desaparecem com a poda. Se um dia virarem
  métrica, têm que ser materializados no Pass D antes, como `facing_away`.
