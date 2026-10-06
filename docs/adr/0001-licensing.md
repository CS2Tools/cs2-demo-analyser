# ADR 0001 — Licenciamento: GPL-3.0-or-later

- **Data:** 2026-09-19
- **Status:** Aceito

## Contexto

O visualizador 2D precisa de imagens de radar e dos parametros de conversao de
coordenadas de cada mapa. O usuario proibiu explicitamente qualquer acesso a
instalacao local do CS2 (nada de ler `pak01_dir.vpk`, nada de tocar em
`steamapps/`), o que elimina a rota de extrair os assets da Valve em tempo de
setup.

A fonte escolhida e o repositorio **boltobserv**
(https://github.com/boltgolt/boltobserv). Suas imagens de radar nao sao assets
da Valve: sao arte redesenhada, produzida em cooperacao com o SimpleRadar. O
repositorio inteiro esta sob **GPL-3.0**, sem excecao declarada para os assets.

## Decisao

O projeto adota **GPL-3.0-or-later** desde o primeiro commit.

1. `LICENSE` na raiz contem o texto integral da GPL-3.
2. `NOTICE` credita boltgolt/boltobserv e o SimpleRadar/readtldr.gg, e descreve
   as modificacoes feitas.
3. Os assets ficam confinados em `vendor/boltobserv-maps/` e sao consumidos
   exclusivamente por `packages/radar`.

## Consequencias

- **Uso privado: nenhuma obrigacao.** A GPL so impoe deveres quando a obra e
  distribuida. Enquanto o app rodar so na maquina do autor, nada muda.
- **Distribuir (publicar o repositorio, mandar o .exe para alguem) implica GPL-3
  para a obra inteira**, incluindo todo o codigo proprio. Isso e consequencia do
  copyleft, nao uma escolha reversivel depois.
- A unica rota para um release nao-GPL seria substituir os assets de
  `vendor/boltobserv-maps/` por arte de outra licenca. Como o unico consumidor e
  `packages/radar`, essa troca e cirurgica.
- Todas as demais dependencias (demoparser2, DuckDB, shadcn/ui, Recharts) sao
  MIT e portanto compativeis.

## Ressalva conhecida

O boltobserv credita o SimpleRadar/readtldr.gg como co-criadores das imagens,
mas o repositorio nao documenta cessao formal de direitos. A concessao GPL-3
sobre as imagens repousa na afirmacao do boltgolt. Se o projeto for alem de uso
pessoal, vale obter confirmacao explicita do autor de que os PNGs sao GPL-3 e
redistribuiveis.

## Adendo (F2.2) — ícones de CS2

Por decisão do usuário, os ícones de armas, killfeed, mapas e radar vêm de
`Juknum/counter-strike-icons` (commit fixado em
`vendor/counter-strike-icons/manifest.json`). Diferente do boltobserv, **esses
ícones são propriedade da Valve Corporation** e não são licenciados para uso
comercial sem permissão da Valve. As ferramentas do repositório são MIT.

Consequências:

- Os ícones **não fazem parte da obra GPL**. Ficam em pasta própria, com o
  LICENSE original e uma seção no NOTICE.
- Não são versionados no git: `scripts/fetch-cs-icons.mjs` os reconstitui e
  confere cada arquivo pelo hash do manifesto.
- **Uso pessoal/comunitário não comercial: ok. Distribuição comercial: exige
  remover ou substituir os ícones.** A troca é localizada: a UI resolve todo
  ícone por um único mapa (`apps/web/src/lib/icons.ts`) e cai para o nome da
  arma quando um ícone falta.
- Continuam valendo as regras da ADR 0008: nada é extraído da instalação do
  jogo, e os arquivos vêm do GitHub em tempo de build.
