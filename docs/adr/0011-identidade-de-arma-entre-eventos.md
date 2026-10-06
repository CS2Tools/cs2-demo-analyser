# ADR 0011 — A mesma arma tem dois nomes na demo

**Status:** aceito (F3.3)

## Contexto

A tela Jogador (F3.3) promete uma tabela "por arma": kills, headshot, distância
mediana e **dano**. As três primeiras saem de `kills`. O dano precisa sair de
`damages`, porque só ela conta o tiro que acertou e não matou — que é a
diferença entre "fecha duelo" e "acerta".

O caminho óbvio é juntar as duas tabelas pela coluna `weapon`. Antes de fazer
isso, medimos.

## O que a medição mostrou

Juntando os dois eventos pelo MESMO lance (mesma partida, mesmo tick, mesmo
atirador, mesma vítima) na biblioteca de referência:

| `kills.weapon` | `damages.weapon` | lances |
|---|---|---|
| `m4a1_silencer` | `m4a1` | 112 |
| `usp_silencer` | `hkp2000` | 46 |
| `knife_butterfly` | `knife` | 1 |
| `revolver` | `deagle` | 1 |

O evento de morte nomeia a arma EXATA; o evento de dano usa o nome da família.
Não é ruído: é sistemático e vale para todos os lances daquele par.

A consequência é que o nome do dano é **ambíguo por construção**. Quem usou
M4A4 e M4A1-S na mesma biblioteca tem os dois somados sob `m4a1`, e não há como
separá-los olhando só a tabela de dano.

## Decisão

1. **O pareamento é lido do dado, não chutado.** Para cada jogador, a consulta
   descobre como cada arma de kill aparece no evento de dano pelos ticks em que
   os dois registram o mesmo lance, e usa a correspondência mais frequente. Uma
   tabela de apelidos escrita à mão envelheceria a cada atualização do CS2 —
   esta se recalibra sozinha, com os dados de quem está olhando.

2. **Ambiguidade vira nulo, não palpite.** Quando duas armas de kill caem no
   mesmo nome de dano, a coluna fica em branco para as duas, com a explicação
   ao passar o mouse. Somar o dano da M4A4 na M4A1-S seria um número plausível
   e errado — exatamente o tipo de coisa que este projeto não coloca na tela.

3. **O resto da tabela não é afetado.** Kills, headshot e distância continuam
   vindo de `kills`, que nomeia a arma exata. Perder o dano de uma arma não
   custa as outras três colunas.

## Consequências

- Quem só usa uma M4 vê o dano dela normalmente; quem alterna vê dois brancos.
  O branco é informativo: diz que a fonte não sabe separar.
- A distância do evento vem em **metros**, não em unidades do jogo (mediana de
  ~17 m na biblioteca de referência, máximo ~59 m). A tela rotula a unidade.
- `lib/icons.ts` já seguia a convenção da Valve (`m4a1` interno é a **M4A4**;
  a M4A1-S é `m4a1_silencer`), então os ícones continuam corretos.
- Se um dia o parser passar a nomear o dano com a arma exata, o pareamento
  lido do dado continua funcionando: cada arma passará a apontar para si mesma
  e os brancos somem sozinhos.
