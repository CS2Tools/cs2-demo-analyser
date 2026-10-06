# ADR 0006 — Veredictos: procedência obrigatória

**Status:** aceito (F1.10)

## Contexto

O app opina ("sua mira está baixa"). Opinião sem base de comparação é
autoridade inventada, e ferramentas de demo costumam preencher esse vazio com
"médias de rank" que ninguém sabe de onde vieram.

## Decisão

1. **A base é obrigatória no tipo.** `Verdict.baseline` é uma union discriminada
   com exatamente quatro formas — `own_history`, `match_relative`,
   `fixed_reference`, `insufficient_data` — em `packages/core/src/verdict/types.ts`
   e espelhada no schema zod do contrato. O handler valida a saída: um achado sem
   base não chega à tela.
2. **Não existe média de rank** em lugar nenhum do código.
3. **As regras são declarativas** (`rules.ts`): métrica, sentido, amostra mínima,
   ordem de preferência das bases. O motor (`engine.ts`) é o mesmo para todas —
   nenhuma regra escolhe a própria base.
4. **Histórico estritamente anterior.** A base "histórico próprio" usa só partidas
   com data (ou importação) ANTERIOR à analisada, e exige 5. Incluir a própria
   partida puxaria a base para o resultado.
5. **Sem base, o veredicto confessa** (`insufficient_data`) em vez de sumir ou
   de cair silenciosamente numa base pior.
6. **Referências fixas declaram a justificativa** como chave i18n exibida no
   tooltip. As três atuais:
   - viés vertical > 1,5° — o limite do portão de calibração (ADR 0005); abaixo
     disso, a medição sozinha explicaria o erro;
   - entrada 50% — duelo parelho é cara ou coroa;
   - flash líquida 0 s — fronteira por definição.
7. **Recalculado a cada leitura**, não congelado na ingestão: importar uma demo
   antiga muda o histórico das posteriores. `player_metric_history` é
   preenchida sob demanda; `match_findings` guarda o último cálculo (chaves +
   parâmetros, nunca prosa) para o console SQL e a exportação.
8. **Resumo:** `severidade × |desvio| × confiança × importância`, no máximo 5,
   no máximo 2 por família, 1 por jogador quando o foco é a partida inteira, e o
   último lugar reservado a um ponto forte se houver.

## Consequências encontradas na implementação

- **Transações concorrentes.** Duas leituras simultâneas do resumo abriam
  `BEGIN` duas vezes na conexão única ("cannot start a transaction within a
  transaction"). `Db.transaction` agora roda numa conexão própria, serializada
  por fila, e o callback recebe o `tx`. O bug era latente desde a F1.3: um merge
  de ingestão simultâneo a um "apagar partida" teria o mesmo destino.
- **Kill de utilitário não é duelo de mira.** Uma morte por molotov entrou em
  `engagements` com "erro de 145°". O Pass F passou a aceitar só armas de fogo
  (`isAimDuelWeapon`, lista de permissão) e a ignorar kill de time; a migração
  003 limpou o que já estava gravado.

## Pendente

- Teste de UI (Playwright) que abre uma partida e conta os chips. Hoje a
  garantia está no teste de API (`packages/api/test/findings.test.ts`), que
  valida o schema e a base de todo achado.
