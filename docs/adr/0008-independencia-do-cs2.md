# ADR 0008 — Independência do CS2 e ausência de risco de ban

**Status:** aceito (F2.0)

## Requisito do usuário

> "o programa tem que ser 100% independente da instalação do cs2, tem que
> funcionar sem o cs2 instalado e jamais pode ter algum risco de ban"

## Por que não há risco de ban

O VAC age sobre programas que **interagem com o processo do jogo** (lêem ou
escrevem memória, injetam código, abrem handles para o `cs2.exe`) ou que
**alteram arquivos do jogo**. O app não faz nenhuma das duas coisas:

- lê um arquivo `.dem`, que é um arquivo de dados comum, igual a um vídeo;
- nunca abre, procura ou enumera o processo do jogo;
- nunca lê nem escreve na instalação do CS2 ou da Steam;
- não se comunica com o jogo de nenhuma forma — nem por Game State Integration,
  nem por console, nem por rede. O app não abre socket (ADR 0004).

O texto `setpos/setang` previsto na F2.6 é só texto copiado para a área de
transferência. Quem cola no console é o usuário, num servidor privado.

## Por que funciona sem o CS2 instalado

| Precisa de | Vem de | Toca no CS2? |
|---|---|---|
| Ler a demo | `@laihoe/demoparser2` (Rust, embutido) | Não |
| Radares | `vendor/boltobserv-maps` (arte redesenhada, GPL-3) | Não |
| Voz | `csgove.exe` + `opus.dll` (MIT/BSD). As DLLs da Valve que ele exige são **arquivos vazios** | Não |
| Ícones (F2.2) | `Juknum/counter-strike-icons` — decisão do usuário; nunca extraídos do jogo | Não |
| Tempos de round/C4 (F2.1) | A própria demo ou medidos na partida | Não |

## A cópia da demo (decisão do usuário, F2.0)

Na importação, o `.dem` é copiado para `data/demos/<sha256>.dem`
(`packages/ingest/src/demo-store.ts`). Todos os passes e o extrator de voz leem
**a cópia**. A pasta de origem é lida uma vez, para o hash e a cópia, e nunca
mais. Reprocessar funciona com o CS2 desinstalado ou com a demo original
apagada.

- Cópia por nome temporário `.part` e renomeação: fechar o app no meio da
  cópia nunca deixa um `.dem` truncado com cara de válido.
- Nome pelo hash: a mesma demo arrastada de duas pastas vira uma cópia só.
- A cópia sai junto com o replay, pela política de retenção. A varredura
  preserva a demo de importações **na fila ou em andamento**, que ainda não
  têm partida no banco.
- `matches.file_path` guarda de onde a demo veio (informativo);
  `matches.stored_demo_path`, o que o app lê (migração 005).
- Custo: ~200 MB por partida. Aparece nas configurações ("Espaço em disco").

## Travas automáticas

`apps/desktop/test/independence.test.ts`, em três camadas:

1. **Código-fonte** — proíbe caminhos da Steam e do jogo, nome do processo,
   protocolo `steam://`, registro da Valve, `.vpk`, `libraryfolders.vdf`,
   `gameinfo.gi` e APIs de acesso a outro processo (`OpenProcess`,
   `ReadProcessMemory`, `WriteProcessMemory`, `CreateRemoteThread`,
   `VirtualAllocEx`).
2. **Dependências** — nenhuma biblioteca de VPK, Steam, VDF ou acesso à memória
   de processos em nenhum `package.json`.
3. **Bundles e binários distribuídos** — só o que aponta para o jogo.
   `OpenProcess` aparece legitimamente em runtimes: o DuckDB o usa para dizer
   qual processo segura a trava do banco, e o runtime do Go o importa em todo
   executável. Sem o nome do processo, não há como mirar o jogo. Verificado:
   nenhum binário contém `cs2.exe`, `csgo.exe`, `steamapps` ou o registro da
   Valve.

Mais uma verificação: as DLLs da Valve exigidas pelo extrator de voz têm 0
byte.

A trava foi testada plantando uma violação: um arquivo com `steamapps` e
`OpenProcess` fez o teste falhar e apontar as duas.

O portão do `.exe` confirma que a partida importada lê a cópia em
`data/demos/`, e a demo de teste vem de `fixtures/demos/`, fora de qualquer
pasta da Steam.

## Encontrado no caminho

**O teste de fumaça usava a pasta de dados do app instalado.** Até a F1.12,
cada execução do portão importava a demo de teste na biblioteca real do usuário
(`%APPDATA%\CS2 Demo Analyser`). Com o app instalado e aberto, esbarrava na
trava de instância única e saía sem testar nada. Agora `--smoke-test` usa uma
pasta de dados temporária própria, apagada no fim pelo próprio `.exe` e pelo
script do portão. A trava de instância é por pasta de dados, então o portão
roda com o app do usuário aberto.
