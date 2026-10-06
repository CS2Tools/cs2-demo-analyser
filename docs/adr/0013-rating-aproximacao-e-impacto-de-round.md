# ADR 0013 — Rating: aproximação declarada e impacto de round

**Status:** aceito (F5.7)

## Contexto

O app media dezenas de coisas e não respondia a pergunta mais óbvia de quem
abre um analisador de CS2: **quem jogou melhor?** Todo mundo no ecossistema
usa o HLTV Rating para isso.

O problema é que o Rating da HLTV não é público:

- o **Rating 1.0** tem fórmula publicada e é obsoleto (não usa KAST nem ADR);
- o **Rating 2.0** nunca teve a fórmula divulgada;
- o **Rating 3.0** é tratado pela própria HLTV como *exclusive feature*. O que
  se sabe é que parte do 2.1, acrescenta ajuste de economia e um componente
  chamado **Round Swing**.

Copiar um número fechado com pesos chutados produziria algo com cara de
oficial e sem nada por trás — exatamente o que este projeto não faz.

## Decisão

Duas métricas, nenhuma se passando por número de terceiro.

### 1. `Rating 2.0 (aproximação)`

Uma combinação linear obtida por **regressão feita por terceiros** contra os
valores publicados pela HLTV, que reproduz o rating com erro da ordem de
centésimos:

```
Rating ≈ 0,0073·KAST + 0,3591·KPR − 0,5329·DPR + 0,2372·Impacto + 0,0032·ADR + 0,1587
Impacto ≈ 2,13·KPR + 0,42·APR − 0,41
```

KAST entra em **porcentagem** (72,4 — não 0,724).

- Os coeficientes ficam em `RATING2_COEFFICIENTS`, à vista, e nunca são
  reajustados contra a biblioteca do usuário: são **referência fixa**.
- Na tela, a coluna se chama **"Rating (aprox.)"** e carrega um chip de
  procedência que diz em uma frase que a HLTV nunca publicou a fórmula.
- Todas as entradas já existiam em `player_match` desde a F1.0 — KAST chegou
  na F4.5. **Nenhuma demo precisa ser reprocessada.**
- Sem KAST não há rating: o campo fica nulo em vez de assumir zero, porque o
  coeficiente do KAST é o maior peso isolado da soma e um zero ali produziria
  um rating baixo com cara de medido.

### 2. `Impacto de round`

A ideia central do 3.0 — quanto cada morte mexeu na chance de ganhar o round —
mas calculada **contra a biblioteca do próprio usuário**, e não com pesos
secretos:

1. cada round passa por uma sequência de **estados**: vivos CT × vivos T ×
   bomba plantada (`round_states`, migração 016);
2. a chance de o CT ganhar a partir de um estado é a **frequência observada**
   daquele estado na biblioteca inteira;
3. o impacto de uma kill é a variação dessa chance, do ponto de vista de quem
   matou;
4. o número na tela é a soma por round jogado.

É o mesmo princípio de base própria que o app usa desde a F2.2.

**Amostra mínima: 20 rounds por estado.** Abaixo disso o estado cai para o
degrau mais grosso (o mesmo placar de vivos, ignorando a bomba); se nem esse
tiver amostra, a kill **fica de fora** e a tela conta quantas ficaram. Com 20
observações, uma proporção de 0,5 tem erro padrão de ~0,11: grosso, mas honesto
para dizer "está perto de 50/50".

Zero e nulo dizem coisas diferentes, e a tela não os confunde: **zero** é
"matou e não mexeu no round"; **travessão** é "as kills dele caíram em estados
sem amostra".

### 3. O Rating 3.0 não é imitado

E a tela diz isso, na descrição do card.

## Uma decisão que merece registro: a partida entra na própria base

A tabela de probabilidade inclui a partida que está sendo analisada.

Isso contraria a regra das bases de veredicto (F2.2), que são **estritamente
anteriores**. A diferença é o que está sendo medido: "dado um 3v2, quantas
vezes o CT leva?" é uma quantidade **estrutural do jogo**, não uma afirmação
sobre o jogador julgado. Excluir a partida faria o mesmo round valer coisas
diferentes conforme a tela aberta, e cortaria amostra justamente de quem tem
biblioteca pequena. Em compensação, a tela **declara de quantas observações a
base saiu**.

## Consequências

- `round_states` cresce ~1 linha por morte por round (uma partida de 24 rounds
  com 9 mortes por round dá ~240 linhas). É desprezível perto de `damages`.
- O backfill é versionado (`ROUND_STATS_VERSION = 2`) e roda uma vez por
  partida: **a biblioteca inteira ganha o impacto sem reimportar nada**.
- Quanto mais partidas, melhor a base — e mais estados saem do silêncio.
- Se a HLTV publicar o 3.0 algum dia, entra como métrica nova, com fonte, e
  não como reinterpretação desta.

## Fontes

- HLTV, "Introducing Rating 3.0" (hltv.org/news/42485) — confirma que o 3.0
  parte do 2.1, tem ajuste de economia e Round Swing, e que a fórmula não é
  publicada.
- Regressões públicas do Rating 2.0 (flashed.gg; Medium/FerahgoTheGreat), de
  onde vêm os coeficientes acima.
