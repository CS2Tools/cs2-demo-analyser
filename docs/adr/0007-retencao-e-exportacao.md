# ADR 0007 — Retenção e exportação

**Status:** aceito (F1.11)

## Retenção

- **O que envelhece são só os Parquet de `data/bulk/<partida>/`** (replay 2D e
  ticks de análise fina, alguns MB por partida). O banco guarda tudo para
  sempre: scoreboard, análises, veredictos, heatmap, histórico de métricas.
  Podar é um `rm` de pasta mais `bulk_state = 'pruned'`.
- **Ordem de importação, não data da partida.** Importar hoje uma demo antiga
  é sinal de que ela interessa agora; ela não pode nascer já podada.
- **Fixadas não ocupam vaga**: fixar uma partida não empurra outra para fora.
- **Quando roda:** no boot, depois de cada importação, ao salvar as
  configurações e ao desafixar. A tela de configurações mostra ANTES de salvar
  quantas partidas perderão o replay — a poda só se desfaz reimportando a demo.
- **Ordem de operação:** apaga o disco, depois marca o banco. Se o `rm` falhar
  (arquivo aberto no Windows), a marca continua dizendo que o replay existe, o
  que é verdade.

## Exportação

Um mecanismo por tamanho, não um por tela:

| O quê | Onde é montado | Como sai |
|---|---|---|
| Um componente (tabela, radar, heatmap, veredictos, resultado SQL) | Na UI, com o que já está na tela | `Transport.saveFile`: download no navegador, diálogo nativo no Electron |
| A partida | No backend (`export.match`) | `.zip` com CSV por tabela, `match/analysis/findings.json`, Parquet e manifesto |
| A biblioteca | No backend (`export.library`) | Pasta com cópia do banco via `COPY FROM DATABASE` (consistente, não cópia de arquivo aberto), `bulk/` e manifesto |

Regras:

- **A procedência sai junto.** JSON leva `meta.references` (janela de trade,
  limiar de flash, modelo de mira...); veredictos levam `baseline`; o PNG leva
  legenda e crédito do radar num rodapé, porque imagem compartilhada não tem
  tooltip.
- **CSV em formato de máquina**: vírgula, ponto decimal, BOM UTF-8. É o que
  planilha, pandas e DuckDB leem sem configuração. Consequência conhecida: o
  Excel em pt-BR, que espera `;`, pode abrir tudo numa coluna — use
  *Dados → De Texto/CSV*.
- **Tabelas não exportam PNG** nesta versão: só o que já é canvas (heatmap,
  radar). O gráfico de evolução da tela Jogador (F3.3) é SVG desenhado à mão e
  por isso não entra no PNG: a exportação dele sai como tabela, que é o dado
  que o gráfico desenha (F5.3).
- **`app.reveal` só abre o que o app exportou** — a rota recusa caminhos fora
  da pasta de exportação.
- Destino: `data/exports/` no host de dev, `Documentos/CS2 Demo
  Analyser/exportacoes` no app instalado.
