# Notas de versão

Datas no formato ISO. "Exige reprocessar" significa reimportar a demo: dado
bruto que nasce na ingestão e que nenhum backfill alcança. Partida **podada**
perdeu a cópia da demo, e a tela declara isso.

---

## 1.2.0 — 2026-10-10

O Replay 2D, corrigido onde ele mentia.

Sete defeitos relatados em uso real, mais um que apareceu ao medir os outros.
As causas foram medidas contra a biblioteca real antes de virar código; os
números abaixo são medição, não estimativa.

**Nada aqui exige reprocessar.** A migração 021 alcança a biblioteca que já
está importada.

### Corrigido

- **Fumaça sumia do replay do nada.** A área durava dois quadros (0,25 s)
  sempre que a demo não trazia o evento de expiração. Medido: em HE, flash e
  decoy esse evento não existe — o efeito é instantâneo e dois quadros bastam;
  em fumaça ele existe e só falta quando **o round acabou antes**. Eram 25 das
  520 fumaças, todas detonadas de 346 a 768 ticks do fim do round, dentro da
  vida de 1412 ticks que as outras 495 mediram sem exceção. Nenhuma das 377
  incendiárias ficou sem o evento. A área agora fica até o fim do round, que é
  medido — não até uma duração fixa, que seria inventada.
- **Decoy não era desenhada ao detonar**, apesar de ter cor e trajetória. Agora
  aparece como ponto, sem área: o raio dela é zero, então área seria invenção.
- **Jogador aparecia na cor do time adversário.** Duas causas somadas: o lado
  do jogador vinha do *primeiro* quadro do round, e quem reconecta passa alguns
  quadros sem time atribuído; e a cor caía em "amarelo" por falta de um terceiro
  ramo. Pior: quem **saiu** da partida continuava desenhado — a demo guarda uma
  linha por quadro para ele, com vida 0, posição (0,0) e um estado que o radar
  lia como vivo, o que virava um ponto amarelo parado na origem do mapa em todos
  os rounds seguintes. Agora o lado vem do primeiro quadro válido, e quem não
  jogou o round não aparece: nem no radar, nem no painel, nem na numeração, nem
  no killfeed, nem no placar.
- **A roda do mouse rolava a página junto com o zoom.** O zoom agora é exclusivo
  do radar; fora dele a roda volta a rolar a página como em qualquer outra tela.
- **No killfeed, o nome de quem deu assistência saía sempre em branco.** Agora
  vai na cor do lado, como o do autor e o da vítima.
- **Quem saiu da partida ganhava uma linha por round até o fim dela**, com tudo
  zerado e marcado como **sobrevivente** — ele não estava lá para sobreviver.
  Medido na partida com *complete*: 16 linhas para quem jogou 5 rounds. Isso
  contaminava a taxa de sobrevivência (0,69 em vez de 0, tendo ele morrido nos
  cinco rounds que jogou), o tamanho de amostra do histórico de métricas (16 em
  vez de 5) e a contagem de rounds da tela Jogador.

### Novo

- **K/D/A ao vivo no painel do replay**, acumulado da partida até o instante
  mostrado, como o Tab do jogo: sobe no mesmo quadro em que a kill aparece no
  killfeed.
- **Placar e relógio do replay redesenhados** — faixa na cor do lado de cada
  time, quem está na frente com mais peso, relógio maior e moldura do próprio
  tema.
- **O PNG exportado passou a reproduzir o card da tela**: rótulos traduzidos,
  estrutura e colunas do card, cores e fontes lidas dos tokens do tema. O CSV e
  o JSON continuam sendo o formato de **máquina**, com nomes estáveis e sem
  acento — eles não mudam de idioma, e há teste provando que a mudança não
  vazou para eles. Continua sem rasterizador de DOM: a imagem é desenhada.

### Versões de dados

```
SCHEMA_VERSION   20 -> 21   migração 021: apaga as linhas de round de quem
                            não estava no round, e marca para recálculo só
                            as partidas afetadas
```

`REPLAY_DATA_VERSION` (6), `RULES_VERSION` (4), `ROSTER_VERSION` (1) e
`ROUND_STATS_VERSION` (2) **não mudaram**: nenhuma regra de veredicto mudou
aqui, e o formato do replay é o mesmo. O que mudou foi a *entrada* de uma
regra, então só as partidas afetadas são recalculadas.

### Verificação

- typecheck limpo; 839 testes em 74 arquivos;
- portão no `.exe` empacotado, rodado com a demo que tem *complete*;
- `check:demos` sobre as demos disponíveis, com dois invariantes novos: ninguém
  tem linha de round sem ter jogado o round, e ninguém jogou um round sem
  aparecer no replay dele;
- conferido na tela com a partida de 20/08 (onze jogadores): o scoreboard
  mostra os onze com o selo de janela nos dois parciais, e o replay mostra dez
  no round 3, **nove** no round 6 (o round desfalcado) e dez do 7 em diante,
  com a pessoa certa em cada um.

---

## 1.1.0 — 2026-10-06

O *complete* da Gamers Club.

Quando alguém sai ou é expulso, o time pode pedir um substituto de nível
parecido, e a partida passa a ter seis ou mais por time — sem limite, e várias
vezes na mesma partida. O app foi escrito supondo cinco por time e dez por
partida, e errava em sete das vinte e quatro demos de teste.

- O time de cada jogador deixou de nascer do primeiro round: quem entrava depois
  ia calado para o time B.
- O replay passou a ter slots contíguos e sem teto de dez — o sexto de um time
  ocupava o slot do primeiro do outro, e o décimo-primeiro era descartado.
- A tela ganhou o selo de janela de rounds, o painel de trocas e a declaração
  dos rounds jogados desfalcados.
- O app **não afirma o motivo** da saída: medido nas vinte e quatro demos, o
  código de desconexão não distingue um complete do fim normal da partida.
  O pareamento "entrou no lugar de" é declarado como inferência.

```
SCHEMA_VERSION        19 -> 20   migração 020, team_slot e as tabelas de elenco
REPLAY_DATA_VERSION    5 -> 6    slots contíguos — EXIGE reprocessar
RULES_VERSION          3 -> 4    elegibilidade de par por presença
ROSTER_VERSION        nova = 1   backfill, não exige reprocessar
```

---

## 1.0.0 — 2026-10-06

Primeira versão. Análise completa de demo de CS2, 100% local: sem internet, sem
depender do CS2 instalado, sem interação nenhuma com o jogo.
