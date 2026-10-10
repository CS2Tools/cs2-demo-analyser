export const ptBR = {
  common: {
    appName: 'CS2 Demo Analyser',
    offline: '100% local',
    loading: 'Carregando...',
    cancel: 'Cancelar',
    close: 'Fechar',
    save: 'Salvar',
    export: 'Exportar',
    search: 'Buscar',
    empty: 'Nada por aqui ainda',
    language: 'Idioma',
    version: 'Versao',
  },
  nav: {
    library: 'Biblioteca',
    match: 'Partida',
    player: 'Jogador',
    team: 'Time / Adversario',
    utility: 'Utilitarios',
    explore: 'Explorador',
    sql: 'Console SQL',
    settings: 'Configuracoes',
  },
  library: {
    title: 'Biblioteca de partidas',
    subtitle: 'Arraste um arquivo .dem aqui para analisar',
    dropHere: 'Solte a demo para comecar',
    noMatches: 'Nenhuma partida importada ainda',
    noMatchesHint: 'Arraste um arquivo .dem de GOTV para esta janela.',
  },
  settings: {
    title: 'Configuracoes',
    steamId: 'Seu SteamID64',
    steamIdHint:
      'Digitado a mão. É o que faz o resumo de cada partida falar de você.',
    steamIdInvalid: 'Um SteamID64 tem exatamente 17 digitos.',
    playersOfInterest: 'Jogadores de interesse',
    playersOfInterestHint:
      'Colegas de time e adversarios que voce estuda. Sao destacados em qualquer demo.',
    retention: 'Partidas com dados de replay',
    retentionHint:
      'Partidas mais antigas perdem o replay e a cópia da demo, mas mantêm todas as análises, gráficos e veredictos. 0 guarda tudo.',
    replayLabels: 'Nomes no radar do replay',
    replayLabelsNumber: 'Número no ponto (legenda no painel)',
    replayLabelsAlways: 'Nome sempre visível',
    replayLabelsHover: 'Só ao passar o mouse',
    replayLabelsHint:
      'Como identificar quem é quem no radar sem precisar caçar com o mouse enquanto o round corre.',
    voice: 'Audio de voz',
    voiceHint:
      'Demos de Gamers Club e FACEIT costumam conter voz. As do matchmaking da Valve nao.',
    diagnostics: 'Diagnostico',
    transport: 'Transporte',
    offlineNote:
      'Tudo aqui fica no seu computador. O app nunca consulta a Steam nem qualquer serviço externo.',
    retentionWarnTitle_one: 'Salvar vai remover o replay de {{count}} partida',
    retentionWarnTitle_other: 'Salvar vai remover o replay de {{count}} partidas',
    retentionWarn:
      'Scoreboard, análises, veredictos e heatmap continuam completos. Só o replay 2D some — e só volta reimportando a demo. Fixe uma partida para protegê-la.',
    appliesToLibrary: 'As mudanças valem também para as partidas já importadas.',
    network: 'Rede',
    noNetwork: 'nenhuma conexão',
    poiEmpty: 'Nenhum jogador cadastrado.',
    poiRemove: 'Remover {{name}}',
    poiSteamId: 'SteamID64 do jogador',
    poiName: 'Nome para exibir',
    poiNote: 'Nota (opcional): função, time, o que observar',
    poiAdd: 'Adicionar',
    poiDuplicate: 'Este SteamID já está na lista.',
    poiIsUser: 'Este é o seu próprio SteamID.',
    poiWhereToFind:
      'O SteamID64 de qualquer jogador aparece ao passar o mouse sobre o nome no scoreboard de uma partida.',
    storage: 'Espaço em disco',
    storageHint:
      'Ao importar, o app guarda uma cópia da demo e nunca mais lê a pasta de origem — nem a do CS2. As cópias saem junto com o replay, pela retenção acima.',
    storageDemos_one: 'Cópias das demos ({{count}})',
    storageDemos_other: 'Cópias das demos ({{count}})',
    storageReplays: 'Dados de replay',
    storageVoice: 'Áudio de voz',
    storageDatabase: 'Banco de análises',
    storageDatabaseHint: 'Nunca é podado: análises e veredictos ficam para sempre.',
    storageTotal: 'Total',
  },

  tabs: {
    summary: 'Resumo',
    aim: 'Mira',
    duels: 'Duelos',
    rounds: 'Rounds',
    economy: 'Economia',
    utility: 'Utilitário',
    map: 'Mapa',
    replay: 'Replay 2D',
  },

  table: {
    player: 'Jogador',
    team: 'Time',
    rounds: 'Rounds',
    kills: 'K',
    deaths: 'D',
    assists: 'A',
    plusMinus: '+/-',
    hsPct: 'HS%',
    hsPctDesc: 'Porcentagem das kills que foram na cabeça',
    util: 'Util',
    flash: 'Flash',
    converted: 'Convertidos',
    side: 'Lado',
    map: 'Mapa',
    matches: 'Partidas',
  },
  matchScreen: {
    openError: 'Nao foi possivel abrir a partida',

    liveRoundCount_one: '{{count}} round live',
    liveRoundCount_other: '{{count}} rounds live',
    plusDiscarded_one: ', {{count}} fora da partida',
    plusDiscarded_other: ', {{count}} fora da partida',
    roundWindow: 'rounds {{first}}-{{last}}',
    roundWindowTip:
      'Este jogador nao esteve em campo a partida inteira. Jogou {{rounds}} round(s), e as medias dele saem sobre esses rounds — nao sobre o total da partida.',
    rosterChanges: 'Troca de elenco',
    rosterChangesDesc:
      'A Gamers Club permite pedir um substituto quando um jogador sai da partida. O app mede a JANELA DE ROUNDS de cada um; o pareamento abaixo e inferencia por adjacencia, e o motivo da saida a demo nao registra.',
    rosterHandoff: '{{out}} saiu no round {{outRound}}; {{in}} entrou no round {{inRound}}',
    rosterHandoffOutOnly: '{{out}} saiu no round {{outRound}}, e ninguem entrou no lugar',
    rosterHandoffInOnly: '{{in}} entrou no round {{inRound}}, sem saida pareada',
    rosterGapClean: 'troca entre rounds: nenhum round foi jogado desfalcado',
    rosterGapRounds: '{{n}} round(s) jogado(s) desfalcado(s) no intervalo',
    rosterOverlap:
      'as janelas se sobrepoem em {{n}} round(s): os dois estiveram em campo, entao isto NAO e uma substituicao',
    understaffedRounds: 'Rounds com elenco desigual',
    understaffedRound: 'round {{round}}: {{ct}} CT contra {{t}} T',
    noVoice: 'sem voz',
    noVoiceDesc:
      'Esta demo nao tem voz gravada. Nao e falha do app: gravar a voz na demo e uma configuracao do SERVIDOR da partida. Servidor oficial da Valve nunca grava; plataformas como a Gamers Club gravam quando estao configuradas para isso.',
    noRadar: 'sem radar',
    noRadarDesc:
      'Este mapa nao tem radar vendorizado, entao o visualizador 2D fica indisponivel. Todas as analises, graficos e tabelas funcionam normalmente.',
    pinned: 'fixada',
    checksFailed: 'Checagens pos-ingestao falharam',
    you: 'voce',
    followed: 'acompanhado',
  },
  libraryScreen: {
    pathPlaceholder: 'C:\caminho\para\a-demo.dem',
    pathLabel: 'Caminho da demo',
    importError: 'Nao deu para importar',
    deleteTitle: 'Apagar esta partida?',
    delete: 'Apagar',
    actions: 'Acoes da partida',
    imported: 'importada',
    import: 'Importar',
    deleteDesc:
      'Some da biblioteca com todas as analises. O arquivo .dem original nao e tocado, entao da para importar de novo depois.',
  },

  analysis: {
    error: 'Nao foi possivel calcular as analises',
    noData: 'sem dados',
    clutches: 'Clutches',
    clutchesEmpty: 'Ninguem ficou sozinho contra inimigo vivo nesta partida.',
    clutchesDesc:
      'Quem ficou por ultimo, contra quantos, e o que aconteceu. Dois ou tres por partida: e pouco para tirar conclusao de um jogador, e por isso isto e tabela e nao veredicto.',
    advantage: 'Vantagem numerica',
    advantageDesc:
      'O PRIMEIRO desequilibrio de cada round e o que cada TIME fez com ele. Um 5v4 aberto e perdido e um problema diferente de um round que nunca desequilibrou. Por lado sozinho a conta misturaria os dois times, porque o lado vira na metade da partida.',
    advantageEmpty: 'Sem dado suficiente.',

    advantageByAbsence: 'Rounds que comecaram desfalcados',
    advantageByAbsenceDesc:
      'Nestes rounds o adversario entrou com menos gente em campo: alguem saiu e o substituto do complete ainda nao tinha entrado. A vantagem nao foi conquistada, entao ela NAO entra na conversao acima — converter o que se recebe de graca mede outra coisa.',
    advantageByAbsenceRow: '{{label}} em {{rounds}} round(s), {{won}} vencido(s)',
    livesTip: 'O placar de vivos no instante do primeiro desequilibrio do round.',
    livesHeader: 'Placar de vivos',
    roundsTip: 'Rounds que passaram por esse placar de vivos.',
    convertedTip: 'Rounds em que o lado em vantagem acabou vencendo.',
    unnamedTeam: 'Time nao identificado',
    openerLine: 'Quem fez a primeira kill levou o round',
    openerTimes: 'vezes.',
    multikills: 'Multikills',
    multikillsDesc: 'Rounds em que o jogador matou duas ou mais pessoas.',
    multikillsEmpty: 'Nenhum multikill nesta partida.',
    kastDesc:
      'Fracao dos rounds em que o jogador matou, deu assistencia, sobreviveu ou foi trocado. Mede contribuicao que nao aparece no K/D.',
    accuracy: 'Precisao',
    accuracyDesc:
      'Quantos disparos viraram acerto. O acerto e atribuido pelo tick do tiro, e um disparo acerta ou nao acerta — pelota de escopeta nao conta como acerto a mais. Granada e faca ficam fora.',
    shots: 'Tiros',
    hitRate: 'Acerto',
    firstShot: '1o tiro',
    spray: 'Spray',
    standing: 'Parado',
    standingWord: 'parado',
    whereBullet: 'Onde a bala pegou',
    byWeapon: 'Por arma',
    preAimAndAccuracy: 'e precisao',
    preAimDesc:
      'Pre-aim e onde a mira estava 250 ms ANTES do tiro — isso e crosshair placement. Precisao e onde ela estava no momento do tiro. Sao coisas diferentes e nunca se misturam aqui.',
    duels: 'Duelos',
    vertical: 'Vertical',
    below: 'abaixo',
    tradeChain: 'Cadeia da troca',
    tradeChainMirror:
      'Suas mortes: quantas tinham companheiro vivo para vingar, em quantas alguem acertou o seu assassino, e em quantas ele caiu.',
    chance: 'chance',
    wentAfter: 'foi atras',
    avenged: 'vingou',
    chanceHeader: 'Chance',
    wentAfterHeader: 'Foi atras',
    tradedDeath: 'morte trocada',
    tradedDeathDesc:
      'A taxa de morte trocada e metrica de TIME, nao individual: ela mede se seus companheiros estavam perto o suficiente para vingar voce.',
    entries: 'Entradas',
    success: 'Sucesso',
    trades: 'Trocas',
    avengedHeader: 'Vingado',
    entryFootnote: 'Entrada = primeira kill do lado, no comeco do round e com os times cheios.',
    flashEfficacy: 'Eficacia de flash',
    flashEfficacyDesc:
      'O que importa nao e quantas voce jogou: e quanto tempo de cegueira util elas geraram, descontado o que cegou o proprio time.',
    blinded: 'Cegou',
    effective: 'Efetivas',
    allies: 'Aliados',
    net: 'Liquido',
    effectiveWord: 'efetiva',
    economyPerRound: 'Economia por round',
    economyPerRoundDesc:
      'Valor do equipamento no fim do freezetime — o unico instante em que "com o que o time entrou no round" e bem definido.',
    deathMap: 'Mapa de mortes',
    noRadarTitle: 'Mapa sem radar',
    noRadarDesc: 'O heatmap precisa do radar, que nao esta disponivel para',
    noRadarRest: '. As outras quatro analises continuam completas.',
    whereDeaths: 'Onde as pessoas morrem',
    whereKills: 'Onde as pessoas matam',
    everyone: 'todo mundo',
    bombTitle: 'Bomba e sites',
    bombEmpty: 'Nenhuma bomba foi plantada nesta partida.',
    bombDesc:
      'Onde a bomba sobe, quanto tempo leva e o que acontece depois. So rounds com plantio entram: round sem bomba nao diz nada sobre pos-plant.',
    plants: 'Plantios',
    untilPlant: 'Ate plantar',
    tWon: 'T levou',
    ctRetake: 'Retake do CT',
    whereBombWent: 'Onde a bomba subiu',
    chainLead: 'Companheiro morreu com voce vivo',
    chainMid: 'voce acertou o assassino',
    chainMid2: 'voce matou',
    chainWindow: '— dentro da janela de {{seconds}} s.',
  },

  chain: {
    deaths: 'Mortes',
    chances: 'Chances',
    withChance: 'Com chance',
    wentAfter: 'Foi atras',
    someoneWent: 'Alguem foi',
    avenged: 'Vingou',
    avengedMirror: 'Vingadas',
    converted: 'Converteu',
    chanceNote:
      '<b>Chance</b> e todo companheiro que morreu com voce vivo, sem contar distancia: a demo so guarda posicao de quem matou ou morreu, entao nao da para saber quem estava perto. Por isso o numero de chances e alto.',
    wentAfterNote:
      '<b>Foi atras</b> e ter acertado o assassino dentro da janela. O disparo que errou nao aparece — a demo registra o tiro, mas nao para onde ele foi. Matar conta como ter ido atras.',
    flashNote:
      'Uma cegueira conta como <b>efetiva</b> a partir de {{seconds}}s — abaixo disso o jogador ainda consegue lutar. O valor liquido desconta <b>{{penalty}}x</b> o tempo cegando aliado, porque cegar o proprio time e pior do que nao cegar ninguem.',
  },

  utilityCard: {
    title: 'Utilitario a fundo',
    desc:
      'HE, molotov, smoke e flash por jogador. <b>Efetivas</b> sao cegueiras acima de {{seconds}} s — uma flash pode cegar tres inimigos, entao esse numero nao se compara com o de flashes arremessadas. <b>Dist.</b> e a mediana de quao perto do inimigo a flash estourou. <b>De costas</b> conta quem estava olhando para o outro lado na hora do estouro, e fica <i>ao lado</i> da eficacia, nunca somado a ela.',
    missingTitle: 'Faltam dois numeros nesta partida',
    he: 'HE',
    heTip:
      'Granadas de alto explosivo ARREMESSADAS. E o denominador: granada que nao pegou ninguem conta aqui.',
    heDamage: 'Dano HE',
    heDamageTip: 'Dano causado em inimigos com HE. Dano no proprio time nao entra.',
    bestHe: 'Melhor HE',
    bestHeTip: 'Mais inimigos atingidos por UMA unica HE na partida.',
    molotov: 'Molotov',
    molotovTip: 'Molotovs e incendiarias arremessadas.',
    fireDamage: 'Dano fogo',
    fireDamageTip: 'Dano causado em inimigos com fogo.',
    smokes: 'Smokes',
    smokesTip:
      'Smokes arremessadas. O app nao afirma se a smoke bloqueou visao: isso exigiria a geometria do mapa (ADR 0010).',
    flashes: 'Flash',
    flashesTip: 'Flashes arremessadas.',
    effective: 'Efetivas',
    effectiveTip:
      'Cegueiras acima de 1,1 s causadas em inimigos. Uma flash pode cegar tres pessoas, entao este numero NAO se compara com o de flashes arremessadas.',
    distance: 'Dist.',
    distanceTip:
      'Mediana da distancia entre o inimigo cegado e o ponto onde a flash estourou, em unidades do jogo. Perto = flash jogada em cima; longe = flash de apoio.',
    assist: 'Assist',
    assistTip: 'Kills de companheiros contra alguem que a sua flash cegou.',
    facingAway: 'De costas',
    facingAwayTip:
      'Vitimas que estavam olhando para o outro lado no estouro. E APROXIMACAO, medida a 8 Hz, e por isso fica ao lado da eficacia e nunca somada a ela.',
    teamFlash: 'Team',
    teamFlashTip:
      'Cegueiras causadas no proprio time. Contam em dobro contra voce no valor liquido da flash.',
    inHand: 'Na mao',
    inHandTip:
      'Valor medio, em dolares, do utilitario que o jogador ainda carregava quando morreu.',
    distanceChip: 'Mediana da distancia entre o inimigo cegado e o ponto do estouro',
    popFlashChip: 'Pop flash nao aparece aqui',
    smokeChip: 'Smoke que bloqueou visao nao e calculada',
    whereItLanded: 'Onde o utilitario caiu',
    onlyEffective: 'so as que funcionaram',
    onlyEffectiveTip:
      'Dano em inimigo ou inimigo cegado. Smoke e decoy saem: o app nao mede bloqueio de visao.',
    minDamage: 'dano HE/molotov',
    minDamageTip: 'Dano minimo em inimigos. Vale para HE e molotov; nao toca nas flashes.',
    minBlind: 'cegueira',
    minBlindTip: 'Cegueira minima num UNICO inimigo, em segundos. Vale so para flash.',
    minEnemies: 'inimigos',
    minEnemiesTip:
      'Inimigos atingidos ou cegados pela mesma granada. Vale para HE, molotov e flash.',
    side: 'Lado',
    all: 'Todos',
    any: 'qualquer',
    clear: 'limpar',
    less: 'menos {{what}}',
    more: 'mais {{what}}',
  },

  utilityNote: {
    text:
      '<b>Melhor HE</b> e quantos inimigos a melhor granada pegou de uma vez. <b>Team</b> e quantas vezes cegou o proprio time. <b>Pop flash nao aparece aqui</b>: o tempo entre arremessar e estourar e o pavio da granada, sempre 1,6 s, entao medir "estourou rapido" nao diz nada. O que diz e a distancia do estouro. <b>Na mao</b> e o valor das granadas que o jogador ainda carregava quando morreu — nao e erro por si so, quem morre na entrada nao teve tempo. <b>Smoke que bloqueou visao nao e calculada</b>: exigiria linha de visao contra a geometria do mapa, e seria chute com cara de numero.',
  },

  teamScreen: {
    error: 'Nao foi possivel montar os times',
    empty: 'Nenhum time ainda. Importe uma partida e os elencos aparecem aqui.',
    unnamed: 'Sem nome',
    noName: 'Time sem nome',
    tabMatch: 'Nesta partida',
    tabLibrary: 'Ao longo da biblioteca',
    matchLabel: 'Partida',
    openInMatch: 'abrir na tela Partida',
    byTeamNote:
      'Tudo aqui e por TIME, e nao por lado: o lado vira na metade da partida, e somar por lado juntaria os dois adversarios na mesma linha. O time de cada lado em cada round sai da maioria do elenco daquele lado.',
    reading: 'Leitura',
    thisTeam: 'Deste time',
    opponent: 'Do adversario',
    roundsOf: 'Rounds de',
    opened: 'Abriu o round',
    openedTip:
      'Rounds em que este time fez a PRIMEIRA kill, e quantos deles virou vitoria.',
    turned: 'Virou o round',
    turnedTip:
      'Rounds que este time venceu DEPOIS de o adversario fazer a primeira kill. E a leitura oposta da de cima.',
    utilPerRound: 'Utilitario por round',
    utilPerRoundTip: 'Granadas arremessadas pelo time, e a media por round jogado.',
    utilDamage: 'Dano de utilitario',
    utilDamageTip: 'Dano causado com HE e molotov em inimigos.',
    bomb: 'Bomba',
    bombTip: 'Plantios do time, e quantas bombas ele desarmou do adversario.',
    plantsShort: '{{plants}} plantio(s), {{defuses}} defusa(s)',
    wherePlants: 'Onde planta',
    unknownSite: 'site nao identificado',
    defusedCount: '{{n}} desarmado(s)',
    buy: 'Compra',
    exportTitle: 'Time {{name}}',
    summary: '{{matches}} partida(s), {{wins}} vitoria(s). Rounds {{won}}–{{lost}}.',
    won: 'Ganhos',
    roster: 'Elenco',
    coreHint: 'Nucleo: esteve em todas as partidas do grupo',
    playedHint: 'Jogou {{n}} de {{total}}',
    heuristic:
      'A demo nao tem id de time. Duas partidas sao do mesmo time quando compartilham <b>tres jogadores com alguma partida</b> do grupo — por isso um reserva nao quebra o historico, e por isso dois grupos parecidos podem colar. As partidas que entraram estao ao lado.',

    rosterSize: '({{n}} jogadores)',
    byMap: 'Por mapa',
    byMapDesc:
      'Onde este time ganha e onde perde. Com poucas partidas por mapa, e tendencia, nao conclusao.',
    balance: 'Saldo',
    groupMatches: 'Partidas do grupo',
  },

  explorerScreen: {

    rows_one: '{{count}} linha em {{ms}} ms',
    rows_other: '{{count}} linhas em {{ms}} ms',
    truncatedAtLimit: ' — cortado no limite',
    chartTitle: '{{measure}} por {{group}}',
    title: 'Explorador',
    saved: 'Salvas',
    error: 'Nao deu para responder',
    savePlaceholder: 'Salvar esta pergunta como…',
    deleteQuestion: 'Apagar esta pergunta',
    show: 'Mostrar',
    groupingBy: 'agrupando por',
    measuring: 'medindo',
    removeMeasure: 'Tirar esta medida',
    fieldPlaceholder: 'campo…',
    addMeasure: 'Adicionar medida',
    shortcuts: 'Atalhos',
    onlyWhen: 'So quando',
    noFilter: '(sem filtro)',
    addFilter: '+ filtro',
    valuePlaceholder: 'valor…',
    not: 'nao',
    openInReplay: 'Abrir no replay',
    min: 'minimo',
    value: 'valor',
  },

  ratingCard: {
    title: 'Rating e impacto de round',
    desc:
      '<b>Rating (aprox.)</b> reproduz o HLTV Rating 2.0 por uma combinacao linear publicada — a HLTV nunca abriu a formula, entao o numero e aproximacao e leva esse nome. <b>Impacto/round</b> e a ideia do Rating 3.0 — quanto as kills mexeram na chance de ganhar o round — medida na SUA biblioteca. O <b>Rating 3.0 nao e imitado</b>: a HLTV o trata como formula fechada, e chutar pesos secretos seria inventar um numero com cara de oficial.',
    rating: 'Rating (aprox.)',
    ratingTip:
      'Aproximacao do HLTV Rating 2.0 por combinacao linear publicada. Nao e o numero oficial: a HLTV nunca abriu a formula.',
    swing: 'Impacto/round',
    swingTip:
      'Quanto as kills dele mexeram na chance de o proprio lado ganhar o round, somado e dividido pelos rounds jogados. Travessao = os estados das kills dele nao tinham amostra na biblioteca.',
    kastTip: 'Rounds em que ele matou, assistiu, sobreviveu ou teve a morte trocada.',
    kprTip: 'Kills por round.',
    dprTip: 'Mortes por round. E o termo de maior peso negativo da formula.',
    adrTip: 'Dano medio por round.',
    ratingChip: 'rating: aproximacao declarada',
    ratingChipDesc:
      '0,0073·KAST + 0,3591·KPR − 0,5329·DPR + 0,2372·Impacto + 0,0032·ADR + 0,1587, com Impacto = 2,13·KPR + 0,42·APR − 0,41. Os coeficientes vem de regressao publicada por terceiros contra os valores da HLTV — nao da HLTV. Ver ADR 0013.',
    impactChip: 'impacto: base propria',
    impactChipDesc:
      'A chance de ganhar o round vem da frequencia observada de cada estado (vivos CT × vivos T × bomba) na sua biblioteca: {{observations}} estados observados, {{states}} deles com pelo menos {{min}} rounds. Estado com amostra menor nao vira probabilidade — cai para o degrau sem a bomba, e se nem esse tiver amostra, a kill fica de fora.',
    noLibrary:
      'Ainda nao ha biblioteca suficiente para o impacto de round: nenhum estado chegou a {{min}} rounds. Ele aparece sozinho conforme voce importa partidas.',
    skipped:
      '{{n}} kill(s) ficaram de fora do impacto: o estado em que aconteceram ainda nao tem {{min}} rounds na biblioteca.',
  },
  deepEconomy: {
    title: 'Economia a fundo',
    desc:
      'Dinheiro do time no comeco de cada round, o premio de derrota em vigor e os rounds em que a compra quebrou. O premio de derrota <b>nao vem da demo</b>: e reconstruido pela regra do CS2.',
    moneyAtStart: 'Dinheiro no comeco do round',
    peak: '{{value}} no pico',
    breakPoint: 'break point',
    ctBroke: 'CT quebrou depois deste round',
    tBroke: 'T quebrou depois deste round',
    lossBonusLine: 'perde o round e ganha',
    fixedRef: 'referencia fixa',
    lossBonusDesc:
      'Premio de derrota do CS2: {{steps}}. Perder sobe um degrau, vencer desce um, e o contador recomeca a cada metade. Nao e media de partidas: e regra do jogo.',
    conversion: 'Conversao de eco, semi-eco e force',
    forceCost: 'O que custou cada force perdido',
    noFullBuy: 'sem full buy ate o fim da metade',
    untilFullBuy: '{{n}} round(s) ate o full buy',
    byPlayer: 'Por jogador — o que destruiu, o que salvou e o que deixou na mesa',
    spent: 'Gastou',
    spentTip: 'Dinheiro que o jogador gastou na partida inteira.',
    destroyed: 'Destruiu',
    destroyedTip:
      'Valor do equipamento INIMIGO que ele destruiu: o que o adversario perdeu ao morrer para ele.',
    saved: 'Salvou',
    savedTip: 'Valor do proprio equipamento que ele levou vivo para o round seguinte.',
    onTable: 'Na mesa',
    onTableTip:
      'Dinheiro que sobrou no fim do freezetime em rounds de FULL BUY do time. Em eco, guardar e estrategia; em full buy, e compra que nao aconteceu.',
    footnote:
      '<b>Destruiu</b> e o valor com que a vitima entrou no round — quem comprou no meio do round entra subestimado. <b>Na mesa</b> so conta em round de full buy do proprio time: em eco, guardar dinheiro e a estrategia.',
  },

  analysisTail: {
    reprocessNote:
      'Esta partida foi importada antes de o app gravar a velocidade no tiro e o ponto do corpo atingido: <b>parado</b> e a quebra por parte do corpo so aparecem depois de reprocessar.',
    pitchNote:
      'Negativo significa mirar <b>abaixo</b> da cabeca; positivo, acima. Um valor consistentemente negativo e o sinal classico de crosshair baixo.',
    everyone: 'todo mundo',
    defused: 'Desarmadas',
    defusedOf: '{{defused}} de {{plants}}',
    defusedHint: '{{withKit}} com kit, {{withoutKit}} sem',
    exploded: 'Explodiram',
    explodedHint: '{{n}} acabaram antes (time eliminado)',
    leftOnDefuse: 'Sobrava no desarme',
    preAimAndAccuracy: 'Pre-aim e precisao',
    entryAndTrade: 'Entradas e trocas',
  },

  playerScreen: {
    error: 'Nao foi possivel montar o perfil',
    search: 'Buscar por nome ou SteamID',
    noMatches: 'Este jogador nao tem partidas na biblioteca',
    matches: 'Partidas',
    period: 'Periodo',
    noMetrics:
      'Ainda nao ha metricas para este jogador. Elas aparecem assim que uma partida dele e importada.',
    evolution: 'Evolucao ao longo das partidas',
    closerToZero: 'o ideal e zero — os dois sentidos sao ruins',
    higherBetter: 'quanto maior, melhor',
    lowerBetter: 'quanto menor, melhor',
    medianNote:
      'A linha tracejada e a mediana das suas partidas ANTERIORES — a mesma base que o veredicto da partida usa. Pontos apagados tiveram menos de {{min}} de amostra: aparecem, mas nao sustentam conclusao.',
    whatToTrain: 'O que treinar',
    byMap: 'Por mapa',
    winLoss: 'V–D',
    entry: 'Entrada',
    byWeapon: 'Por arma',
    kills: 'Kills',
    distance: 'Distancia',
    pick: 'Escolha um jogador acima. Comece por você ou por um jogador de interesse.',
    distanceNote: 'Distancia em metros, mediana.',
  },

  playerWeapons: {
    noteWithMissing:
      'Distancia em metros, mediana. O dano em branco e explicado ao passar o mouse.',
  },

  misc: {
    mapLoadError: 'Nao foi possivel carregar o mapa',
    radarX: 'Radar X',
    radarY: 'Radar Y',
    level: 'Nivel',
    mainLevel: 'principal',
    twoFloors: 'Mapa de dois andares',
    roundUtility: 'Utilitárias do round',
    emptyCollection: 'Acervo vazio',
    rename: 'Renomear',
    notePlaceholder: 'Nota (de onde sai, para que serve…)',
    crouched: 'agachado',
    deleteFromCollection: 'Apagar do acervo',
    diagnosticsUnavailable: 'Diagnostico indisponivel',
    cs2Builds: 'Builds do CS2 na biblioteca',
    voiceMissing: 'Extrator de voz ausente',
    noVendoredRadar: 'Sem radar vendorizado',
    viewerUnavailable: 'Visualizador 2D indisponivel neste mapa',
    replayUnavailable: 'Replay indisponivel',
    prevEvent: 'Evento anterior ( [ )',
    prevFrame: 'Quadro anterior ( , )',
    playPause: 'Reproduzir / pausar (espaco)',
    nextFrame: 'Proximo quadro ( . )',
    nextEvent: 'Proximo evento ( ] )',
    utilityNotExtracted: 'Utilitárias não extraídas nesta partida',
    noUtilityThisRound: 'Ninguém jogou utilitária neste round.',
    seeThrowInReplay: 'Ver o arremesso no replay',
    saveToCollection: 'Salvar esta utilitária no acervo',
    toggleSidebar: 'Abrir/fechar o menu',
  },

  misc2: {
    duplicate: 'Esta demo ja esta na biblioteca',
    chatTitle: 'Chat da partida',
    teamOnly: 'Dita so para o time',
    radarNumber: 'Numero deste jogador no radar',
    scoreboard: 'Scoreboard',
    queryRefused: 'Consulta recusada',
    lineupMap: 'Mapa de lineups',
  },

  chatScope: {
    unknown:
      'A demo registrou a fala sem dizer se foi para o time ou para todos. Acontece nas demos a partir da atualizacao de setembro do CS2, que trazem outro evento de chat.',
  },

  radar: {
    approxNote:
      '<m>≈</m> Fumaca e incendiaria: a posicao e a duracao sao reais; a <b>area e aproximada</b>, porque o demo nao contem o volume. Roda o scroll para dar zoom, arrasta para mover, clique duplo para reiniciar.',
    toggleSidebar: 'Abrir ou fechar o menu',
  },

  sidebar: {
    title: 'Menu',
    desc: 'Mostra o menu lateral no celular.',
  },

  libraryFilter: {
    history: 'Historico',
    all: 'Todas',
    mine: 'So as minhas',
    mineWhy: 'Configure seu SteamID em Configuracoes para usar este filtro.',
    poi: 'Jogadores de interesse',
    poiWhy: 'Cadastre jogadores de interesse em Configuracoes para usar este filtro.',
    knifeRound: 'round faca',
  },

  labels: {

    roundNum: 'round {{n}}:',

    timesOf: '{{times}} de {{of}}',
    source: {
      gamers_club: 'Gamers Club',
      faceit: 'FACEIT',
      valve_mm: 'Matchmaking',
      hltv: 'HLTV',
      unknown: 'Desconhecida',
    },
    winReason: {
      t_killed: 'T eliminados',
      ct_killed: 'CT eliminados',
      bomb_exploded: 'Bomba explodiu',
      bomb_defused: 'Bomba desarmada',
      target_bombed: 'Bomba explodiu',
      target_saved: 'Tempo esgotado',
      hostages_rescued: 'Refens resgatados',
      hostages_not_rescued: 'Refens nao resgatados',
    },
  },

  segmentation: {
    title_one: '{{count}} round fora da partida',
    title_other: '{{count}} rounds fora da partida',
    restarts_one: 'Esta demo tem {{count}} restart.',
    restarts_other: 'Esta demo tem {{count}} restarts.',
    knife: 'O round faca foi identificado e excluido das estatisticas.',
    warmup: '{{count}} round(s) de aquecimento descartado(s).',
    other: '{{count}} round(s) descartado(s) por restart.',
    why: 'Sem isso, o round faca viraria o "round 1" e a economia do pistol round sairia errada.',
    mapLabel: 'Mapa',
  },

  agg: {
    count: 'Quantidade',
    sum: 'Soma',
    avg: 'Média',
    median: 'Mediana',
    max: 'Máximo',
    min: 'Mínimo',
    share: 'Porcentagem',
    nothing: 'nada',
    onlyMe: 'só eu',
    onlyMeWhy: 'Configure seu SteamID em Configurações para usar este atalho.',
    onlyMine: 'só meus jogadores',
    onlyMineWhy: 'Cadastre jogadores de interesse em Configurações para usar este atalho.',
  },

  ui: {
    save: 'Salvar',
    saved: 'salva',
    delete: 'Apagar',
    deleteQ: 'Apagar?',
    deleteMatch: 'Apagar partida',
    yes: 'sim',
    no: 'não',
    all: 'Todos',
    maps: 'Mapas',
    map: 'Mapa',
    weapon: 'Arma',
    damage: 'Dano',
    site: 'Site',
    voice: 'Voz',
    warnings: 'avisos',
    noRadarBadge: 'sem radar',
    seeInReplay: 'Ver no replay',
    fixedReference: 'referência fixa',
    close: 'Fechar',
    loading: 'Carregando',
    chooseDemos: 'Escolher demos',
    dragHint: 'ou arraste os arquivos .dem para esta janela — pode ser mais de um',
    noImports: 'Nenhuma importacao registrada ainda.',
    pickMatch: 'Escolha uma partida na biblioteca.',
    offlineNote:
      'Este app nunca abre uma conexao de rede. Todos os dados ficam nesta maquina.',
    reprocess: 'Reprocessar',
    reprocessWarning:
      'Reprocessar apaga a analise atual desta partida e refaz tudo do zero. Util depois de uma atualizacao do app.',
    openExisting: 'Abrir a existente',
    advancedSql: 'Avançado: console SQL',
    advancedRadar: 'Avancado: conferir radar',
    sqlNoRows: 'A consulta rodou, mas nao retornou linhas.',
    noRowsFilter: 'Nenhuma linha. Tente tirar um filtro.',
    nobodyFound: 'Ninguem encontrado. Importe uma demo ou ajuste a busca.',
    matchGone: 'Pode ter sido apagada, ou a demo ainda nao foi importada.',
    clickRadar: 'Clique no radar para ler a coordenada',
    toSeeJump: 'para ver o salto.',
    outOfMatch: 'Fora da partida',
    liveOnly:
      'Apenas rounds live. O round faca e o aquecimento nao entram em nenhum numero.',
    winsByBuy: 'Vitorias por tipo de compra',
    noHitgroup: 'Sem dado de parte do corpo nesta partida.',
    otherFourOk: '. As outras quatro analises continuam completas.',
    of: 'de',
    recoilModel: 'O modelo de recuo (',
    killsOnly:
      'So duelos que terminaram em morte. Duelos sem morte exigem estimar o inimigo visivel, e isso a demo nao da.',
    tradeWindow:
      'da morte do companheiro, contra quem o matou. Essa janela e convencao da comunidade, nao do jogo.',
    diagnosticsHint:
      'O que olhar quando algo parece errado — principalmente depois de uma atualizacao do CS2.',
    buildHint:
      'Build "nao detectada" e partida importada antes de o app passar a ler esse campo. Reprocessar preenche.',
    radarHint:
      'Digite uma coordenada do jogo e veja onde ela cai no radar; clique no radar para o caminho inverso.',
    trainHint:
      'critico ou atencao — quanto mais se repete, mais em cima. Nas ultimas',
    trainEmpty:
      'Nada a corrigir nesta janela: nenhuma metrica saiu como critico ou atencao.',
    weaponDamageGap:
      'O evento de dano da demo nao separa esta arma da variante de outro lado, entao o dano fica em branco.',
    collectionHint:
      'As utilitárias que você salvou, por mapa. Para guardar uma nova, abra o replay 2D de uma partida.',
    collectionEmpty:
      'Nada salvo ainda. No replay 2D, cada round mostra as granadas jogadas; salve as que você quiser guardar.',
    noReplaySaved:
      'Sem replay: a partida de origem saiu da biblioteca. A utilitaria continua salva.',
    clickRowThrow: 'Clique numa linha para ver o arremesso acontecer.',
    pasteOnServer: 'Cole num servidor privado com',
    pasteOnServerEnd: '. O app não fala com o jogo: isto é só texto.',
    utilityOldMatch:
      'Utilitario na morte e cegueira pelas costas so existem em partidas importadas da F2.5 em diante.',
    utilityNotExtractedHint:
      'Ela foi importada antes desta versão. Reprocesse a partida para poder salvar utilitárias.',
    noBlindData:
      'Esta partida nao tem nenhuma cegueira registrada na demo, entao nenhuma flash conta como efetiva aqui. HE e molotov continuam valendo.',
    theMap: 'O mapa',
    noVendoredRadarRest:
      'nao tem radar vendorizado. Todas as analises, graficos e tabelas desta partida continuam funcionando.',
  },

  collection: {
    hint:
      'As utilitárias que você salvou, por mapa. Para guardar uma nova, abra o replay 2D de uma partida e use a lista <b>{{list}}</b>.',
    empty:
      'Nada salvo ainda. No replay 2D, cada round mostra as granadas que foram jogadas — o botão de salvar guarda a que você quiser aqui, com a posição, o ângulo e o comando para treinar.',
  },

  train: {
    matchesOption: '{{n}} partidas',
    windowNote: '(a biblioteca tem {{n}} deste jogador para esta janela)',
    empty:
      'Nada a corrigir nesta janela: nenhuma metrica saiu como critico ou atencao nas partidas consideradas.',
  },

  weaponGap: {
    text:
      'O evento de dano da demo nao separa esta arma da variante dela (M4A4 e M4A1-S chegam com o mesmo nome). Em vez de somar o dano na arma errada, fica em branco.',
  },

  analysisNotes: {
    killsOnly:
      'So duelos que terminaram em morte. Duelos sem morte exigem estimar o inicio do confronto e ficam para depois.',
    tradeWindow:
      'Uma kill conta como troca quando acontece em ate <b>{{seconds}} segundos</b> da morte do companheiro, contra quem o matou. Essa janela e convencao da comunidade, nao media de rank — mudar o valor muda o numero.',
    noRadarHeatmap:
      'O heatmap precisa do radar, que nao esta disponivel para <m>{{map}}</m>. As outras quatro analises continuam completas.',
  },

  panel: {
    saveHint: 'salve as que você quiser guardar — só elas entram em Utilitários',
    savedAs: 'Salva como "{{name}}"',
    noRadarReplay:
      'O mapa <m>{{map}}</m> nao tem radar vendorizado. Todas as analises, graficos e tabelas desta partida continuam completos — so o replay fica de fora.',
  },

  ui2: {
    utilityOldMatch:
      'Utilitario na morte e cegueira pelas costas so existem em partidas importadas a partir desta versao. O resto da tela esta completo.',
    duplicateHint:
      'Reprocessar apaga a analise atual desta partida e refaz tudo do zero. Use se a ingestao anterior deu errado ou se o app ganhou analises novas desde entao.',
    twoFloors:
      'Os dois niveis estao na MESMA imagem, empilhados. O andar e escolhido pelo Z, e o ponto e deslocado em pontos percentuais. Varie o Z entre <a>{{from}}</a> e <b>{{to}}</b> para ver o salto.',
    chatUnknownScope:
      '<b>{{n}}</b> mensagem(ns) sem escopo: a demo registrou a fala mas nao disse se foi para o time ou para todos — e o app nao chuta.',
  },

  sqlConsole: {
    run: 'Executar',
    shortcut: 'Ctrl+Enter',

    rows_one: '{{count}} linha em {{ms}} ms',
    rows_other: '{{count}} linhas em {{ms}} ms',
    truncated: ' (truncado)',
  },

  chatPanel: {
    noChat:
      'Esta demo nao gravou nenhuma mensagem de chat. Na Gamers Club o chat aberto aos times e desligado no servidor, e a partir da atualizacao de setembro do CS2 as demos passaram a trazer so o evento de chat publico — algumas partidas ficam sem nada aqui.',
    needsReprocess:
      'Esta partida foi importada antes de o app ler chat. Reprocesse para ver o que foi digitado — o que esta na demo continua la.',
  },

  frag: {
    openerLine: 'Quem fez a primeira kill levou o round <b>{{won}} de {{total}}</b> vezes.',
    counterStrafe:
      'Fracao dos tiros disparados abaixo de {{pct}}% da velocidade maxima da arma — o limite em que o CS2 deixa o tiro sair preciso. E o que o counter-strafe busca. {{slow}} de {{judged}} tiros julgados.',
    weaponDamage: '{{damage}} dano',
    preAimTitle: '{{preAim}} e precisao',
    calibration: '{{deg}}°. Ver ADR 0005.',
    economyTooltip: 'Round {{round}} — venceu {{side}}',
    heatmapDesc:
      'Cada celula agrega {{what}} numa grade de {{grid}}x{{grid}} sobre o radar. {{whose}}',
    heatmapDeaths: 'as mortes',
    heatmapKills: 'as kills',
    heatmapWhoDied: 'A posicao e a de quem morreu.',
    heatmapWhoKilled: 'A posicao e a de quem matou, nao a da vitima.',
    postPlantDeaths: 'Depois do plantio morreram',
    ofSide: 'do',
    nicknames: 'A identidade e o SteamID. Tambem ja apareceu como:',
    chartOrder: 'da mais antiga para a mais recente',
    chartMin: 'menor:',
    chartMax: 'maior:',
    halves: 'Primeira metade da janela contra a segunda:',
    localOnly: 'Tudo lido desta maquina.',
    extractorInstalled: 'Extrator instalado.',
    extractorMissing: 'Sem ele, nenhuma partida importa audio. Esperado em',
    inUse: 'em uso pela sua biblioteca.',
    prunedRest:
      '. Todas as analises destas partidas continuam completas — so o replay 2D e a voz saem.',
    demoBuild: 'Versao do CS2 que gravou esta demo',
    demoBuildEnd: '. Serve para saber o que mudou quando o jogo atualiza.',
    build: 'build',
    blinded: '· cegou',
    damageShort: 'dano',
    sqlBehind: 'o SQL que esta pergunta virou',
    deleteNamed: 'Apagar "',
    savedCount: '{{n}} utilitária(s) salva(s)',
    savedShort: 'salva(s)',
    roundShort: 'Round',
    chatDesc:
      'O que foi digitado, na ordem, com o round em que foi dito. Clique para abrir o replay no instante da fala.',
    colorNeedsReprocess:
      'A cor de cada jogador no HUD do time chega ao reprocessar esta partida.',

    slotsNeedReprocess:
      'Esta partida foi importada com o replay limitado a dez jogadores. Se ela teve complete, um jogador pode estar faltando no radar e no painel. Reprocessar resolve.',
    playersWithoutTeam: 'Sem time identificado',
    unattributedDamage:
      '{{n}} de dano ficou de fora: a demo registrou o dano mas nao a granada que o causou, entao ela nao esta no mapa (e continua contada na tabela por jogador).',
    zoomReset: 'x · reiniciar',
    split: 'andar',
  },

  chart: {
    aliases: 'A identidade e o SteamID. Tambem ja apareceu como: {{list}}.',
    aliasCount_one: '+{{count}} apelido',
    aliasCount_other: '+{{count}} apelidos',
    points_one: '{{count}} partida com esta metrica · da mais antiga para a mais recente',
    points_other: '{{count}} partidas com esta metrica · da mais antiga para a mais recente',
    min: 'menor: {{value}}',
    max: 'maior: {{value}}',
    halves: 'Primeira metade da janela contra a segunda: {{trend}}.',
  },

  frag2: {
    voiceInstalled: 'Extrator instalado. {{with}} de {{total}} partida(s) com audio.',
    voiceServerNote:
      ' Demo sem voz costuma ser do SERVIDOR: se ele nao grava voz, nao ha o que extrair.',
    voiceMissingWhere: 'Sem ele, nenhuma partida importa audio. Esperado em',
    notConfigured: 'nao configurado',
    radarsInUse: '{{n}} em uso pela sua biblioteca.',
    noRadarMaps: '{{maps}}. Todas as analises destas partidas continuam completas — so o replay 2D fica de fora.',
    demoBuildBadge: 'build {{build}}',
    demoBuildTip:
      'Versao do CS2 que gravou esta demo{{format}}. Serve para saber o que mudou quando o jogo atualiza.',
    demoFormat: ' (formato {{format}})',
    blindedCount: ' · cegou {{n}}',
    damageCount: ' · {{n}} dano',
    sqlBehind: 'o SQL que esta pergunta virou',
    deleteNamed: 'Apagar "{{name}}"?',
    savedCount_one: '{{count}} utilitária salva',
    savedCount_other: '{{count}} utilitárias salvas',
    savedShort_one: '{{count}} salva',
    savedShort_other: '{{count}} salvas',
    roundTooltip: 'Round {{round}}',
  },

  frag3: {
    showSql: 'Ver o SQL que esta pergunta virou',
    hideSql: 'Esconder o SQL que esta pergunta virou',
  },

  frag4: {
    zoomReset: '{{zoom}}x · reiniciar',
    splitBadge: 'andar {{n}}',
  },

  frag5: {
    prunedMatches:
      'Estas partidas perderam os ticks para a poda. As metricas continuam aqui; o que nao da mais para abrir e o replay 2D.',
    prunedBadge_one: '{{count}} sem replay',
    prunedBadge_other: '{{count}} sem replay',
    radarCheck:
      'Digite uma coordenada do jogo e veja onde ela cai no radar; clique no radar e veja a coordenada. Em Nuke e Vertigo, variar o Z faz o ponto saltar de andar. Serve para conferir a transformacao, nao para analisar partida.',
    pickOnMap:
      'Clique num ponto do mapa ou na lista abaixo. O ponto é onde a granada parou; o quadrado, de onde ela saiu.',
  },

  throwMap: {

    shownOfTotal:
      '{{shown}} de {{total}} granadas. O ponto e onde ela detonou; a linha, de onde saiu — reta, porque a trajetoria real faz arco.',
    thresholdRule:
      'Cada limiar so filtra o tipo que ele mede: dano nao apaga flash, cegueira nao apaga HE. Smoke e decoy nao tem efeito medido, e nenhum limiar as toca.',
    unattributedBlind:
      '{{seconds}} s de cegueira tambem ficaram sem granada correspondente.',
  },
  baseline: {
    ownHistory_one: 'histórico próprio ({{count}} partida)',
    ownHistory_other: 'histórico próprio ({{count}} partidas)',
    ownHistoryTip:
      'Comparado com as {{count}} partidas ANTERIORES deste jogador na biblioteca. Mediana {{p50}}; faixa típica de {{p25}} a {{p75}}.',
    matchRelative: '{{rank}}º de {{of}} nesta partida',
    matchRelativeTip:
      'Comparado com os {{of}} jogadores desta partida que tinham amostra suficiente. Média da partida: {{mean}}. Não é média de rank — é quem estava no servidor.',
    fixedReference: 'referência fixa',
    fixedReferenceValue: 'referência fixa · {{value}}',
    insufficient: 'sem base ainda — precisa de {{required}}, há {{have}}',
    insufficientHistoryTip:
      'Este veredicto usaria o histórico do jogador, que precisa de {{required}} partidas anteriores na biblioteca. Há {{have}}. O app prefere dizer isso a inventar uma média.',
    insufficientMatchTip:
      'Poucos jogadores desta partida têm amostra suficiente para comparar ({{have}} de {{required}}). O app prefere dizer isso a inventar uma média.',
  },
  export: {
    nothing: 'Nada para exportar ainda.',
    failed: 'A exportação falhou',
    done: 'Exportado ({{size}})',
    reveal: 'Mostrar na pasta',
    revealUnavailable: 'Abra o caminho acima manualmente.',
    match: 'Exportar partida',
    matchHint:
      'Um .zip com as tabelas em CSV, as análises e os veredictos em JSON (com as bases) e os dados de replay.',
    library: 'Exportar biblioteca',
    libraryHint:
      'Uma cópia do banco e dos dados de replay, para backup ou para levar a outra máquina.',
  },
  retention: {
    pin: 'Fixar',
    unpin: 'Desafixar',
    pinned: 'fixada',
    pinHint: 'Partida fixada nunca perde o replay para a política de retenção.',
    prunedBadge: 'sem replay',
    prunedTitle: 'Replay indisponível',
    prunedExplain:
      'Os dados de tick foram removidos pela política de retenção. Análises, gráficos e veredictos permanecem completos. Para ter o replay de volta, reimporte a demo.',
  },
  voice: {
    turnOn: 'Ligar a voz ( M )',
    turnOff: 'Desligar a voz ( M )',
    volume: 'Volume da voz',
    noneThisRound: 'ninguém falou neste round',
    loading: 'carregando voz…',
    error: 'voz indisponível',
    silencedBySpeed: 'voz muda fora de 1×–2×',
    badge: 'voz',
    badgeHint:
      'A demo traz o áudio de voz dos jogadores. Ele toca no replay, alinhado aos ticks.',
    mixer: 'Mixer de voz',
    muteTeam: 'Silenciar o time inteiro',
    unmuteTeam: 'Ativar o time',
    teamVolume: 'Volume de {{team}}',
    playerVolume: 'Volume de {{name}}',
    solo: 'Ouvir só este jogador',
    clearSolo: 'Ouvir todos',
    yourTeam: 'Seu time',
    opponent: 'Adversário',
    mutePlayer: 'Silenciar este jogador',
    unmutePlayer: 'Ativar a voz deste jogador',
  },
  reprocess: {
    button: 'Reprocessar',
    hint: 'Reimporta a partida com a versão atual do app, usando a cópia da demo guardada na biblioteca. Traz dados que importações antigas não gravavam.',
    missingTitle: 'A demo desta partida não foi encontrada',
    missing:
      'Ela foi importada antes de o app guardar cópias, e o arquivo original não está mais no lugar. Arraste a demo de novo na biblioteca para reprocessar.',
    failed: 'O reprocessamento falhou',
    needed: 'Reprocesse esta partida para ver dinheiro, inventário e a C4.',
  },
  hud: {
    freeze: 'freezetime',
    planted: 'C4 plantada no {{site}}',
    defused: 'C4 desarmada',
    exploded: 'C4 explodiu',
    roundOver: 'round decidido',
    replayCutShort:
      'Esta partida foi importada antes de o replay passar a ir até o fim do round: ele termina na última kill. Reprocessar traz o pós-round.',
    defusingKit: '{{name}} desarmando (kit, 5 s)',
    defusingNoKit: '{{name}} desarmando (sem kit, 10 s)',
    c4Reference: 'timer de referência',
    c4ReferenceHint:
      'Esta partida não teve nenhuma explosão para medir o timer da C4; o valor é a referência de 41 s medida em outras demos (40 s do mp_c4timer + ~1 s até a explosão).',
    world: 'mundo',
    killfeedSeek: 'Ir para este momento',
    blind: 'atacante cego',
    flashAssist: 'assistência de flash',
    noscope: 'sem mira (noscope)',
    thruSmoke: 'através da smoke',
    wallbang: 'através da parede (wallbang)',
    headshot: 'headshot',
    blindShort: 'cego',
    kdaTitle: 'kills / mortes / assistências na partida, até este instante',
    armor: 'colete ({{n}})',
    armorHelmet: 'colete e capacete ({{n}})',
    kit: 'kit de desarme',
    c4Carrier: 'com a C4',
    c4Dropped: 'C4 no chão (posição aproximada)',
  },
  verdict: {
    summaryTitle: 'O que esta partida diz',
    focusUser: 'Sobre você',
    focusPoi: 'Sobre os jogadores de interesse',
    focusMatch: 'Sobre a partida inteira',
    focusMatchHint: 'Configure seu SteamID em Configurações para que o resumo fale de você.',
    historyPending:
      '{{name}}: {{have}} de {{required}} partidas anteriores na biblioteca. Até lá, a base é a própria partida.',

    presencePending:
      '{{name}}: jogou {{played}} de {{total}} rounds. Amostra insuficiente para o app opinar — e insuficiente para servir de comparação aos outros.',
    noFindings:
      'Nenhum desvio forte nesta partida: todas as métricas ficaram dentro do esperado para as bases disponíveis.',
    allFindings: 'Todos os achados',
    allFindingsHint:
      'Cada linha mostra a base usada. Os neutros ficam aqui e nunca sobem para o resumo.',
    gridHint:
      'Cada celula e um jogador num assunto: a cor e o achado mais grave dali. Clique para abrir os achados inteiros.',
    gridView: 'Grade',
    listView: 'Lista',
    gridNoFinding: 'sem achado',
    family: {
      aim: 'Mira',
      duels: 'Duelos',
      utility: 'Utilitário',
      economy: 'Economia',
      combat: 'Combate',
    },
    vsBaseline: 'vs. base',
    evidence: 'Ver no replay',
    player: 'Jogador',
    sample: 'amostra: {{n}}',
    severity: {
      critical: 'Crítico',
      warning: 'Atenção',
      positive: 'Ponto forte',
      neutral: 'Dentro do esperado',
    },
    confidence: {
      high: 'amostra sólida',
      medium: 'amostra média',
      low: 'amostra pequena',
    },
    ruleName: {
      aim: {
        preaim: 'Crosshair placement',
        pitch_bias: 'Viés vertical da mira',
        firstshot: 'Precisão no tiro',
        accuracy: 'Acerto',
        counter_strafe: 'Counter-strafe',
      },
      duels: {
        entry_success: 'Duelos de abertura',
        traded_death_rate: 'Mortes trocadas',
        kast: 'KAST',
        trade_attempt_rate: 'Ir atrás da troca',
      },
      utility: {
        flash_net: 'Valor líquido das flashes',
        unused_on_death: 'Utilitário que morreu na mão',
        nade_damage: 'Dano por granada',
      },
      economy: {
        dmg_per_1000: 'Dano por $1000',
        left_on_table: 'Dinheiro parado no full buy',
        force_damage: 'Dano nos rounds de force',
      },
      combat: { adr: 'ADR' },
    },
    ref: {
      pitchBias: {
        label: 'ruído da medição',
        rationale:
          'Em headshots confirmados, o método erra cerca de 1,1° de mediana (calibração, ADR 0005). Um viés acima de {{value}} não é explicado pela medição: é a mira.',
      },
      coinFlip: {
        label: 'duelo parelho',
        rationale:
          'Um duelo de abertura parelho é cara ou coroa. Abaixo de {{value}}, as entradas deixam o time em desvantagem numérica mais vezes do que em vantagem.',
      },
      flashZero: {
        label: 'zero líquido',
        rationale:
          'Abaixo de {{value}}, as flashes cegaram mais o próprio time (com peso dobrado) do que o adversário. É uma fronteira por definição, não uma média.',
      },
    },
    ev: {
      aimError: 'Round {{round}} · erro de {{deg}}°',
      pitch: 'Round {{round}} · {{deg}}° na vertical',
      entryDeath: 'Round {{round}} · morreu na entrada',
      untraded: 'Round {{round}} · morte sem troca',
      teamFlash: 'Round {{round}} · cegou aliado por {{seconds}} s',
    },
    rules: {
      aim: {
        preaim: {
          bad: {
            title: 'Crosshair placement abaixo do esperado',
            body: '{{name}} teve pré-aim mediano de {{value}} em {{n}} duelos: a mira estava longe de onde o inimigo apareceu. É o erro que perde o duelo antes do tiro.',
          },
          good: {
            title: 'Crosshair placement afiado',
            body: '{{name}} teve pré-aim mediano de {{value}} em {{n}} duelos: a mira já estava onde o inimigo apareceu.',
          },
          neutral: {
            title: 'Crosshair placement dentro do esperado',
            body: 'Pré-aim mediano de {{value}} em {{n}} duelos.',
          },
        },
        pitch_bias: {
          low: {
            title: 'Mira sistematicamente baixa',
            body: 'Antes do tiro, a mira de {{name}} ficou em {{value}} em relação à cabeça, na mediana de {{n}} duelos. Viés constante não é azar, é hábito — e é o erro mais treinável que existe: suba a mira para a altura da cabeça.',
          },
          high: {
            title: 'Mira sistematicamente alta',
            body: 'Antes do tiro, a mira de {{name}} ficou em {{value}} em relação à cabeça, na mediana de {{n}} duelos. Viés constante não é azar, é hábito: desça a mira para a altura da cabeça.',
          },
          good: {
            title: 'Mira na altura da cabeça',
            body: 'Viés vertical de {{value}} em {{n}} duelos: dentro do ruído da medição.',
          },
          neutral: {
            title: 'Viés vertical pequeno',
            body: 'Viés vertical de {{value}} em {{n}} duelos.',
          },
        },
        firstshot: {
          bad: {
            title: 'Precisão no tiro abaixo do esperado',
            body: 'No instante do disparo, o erro mediano de {{name}} foi {{value}} em {{n}} duelos. Diferente do pré-aim: aqui a mira já teve tempo de corrigir.',
          },
          good: {
            title: 'Precisão no tiro acima do esperado',
            body: 'No instante do disparo, o erro mediano de {{name}} foi {{value}} em {{n}} duelos.',
          },
          neutral: {
            title: 'Precisão no tiro dentro do esperado',
            body: 'Erro mediano de {{value}} no disparo, em {{n}} duelos.',
          },
        },
        accuracy: {
          bad: {
            title: 'Acerto abaixo do esperado',
            body: '{{name}} acertou {{value}} dos {{n}} disparos. É diferente de crosshair placement: aqui a mira já estava no lugar e a bala não chegou — spray sem controle, tiro em movimento ou distância errada para a arma.',
          },
          good: {
            title: 'Acerto alto',
            body: '{{name}} acertou {{value}} dos {{n}} disparos.',
          },
          neutral: {
            title: 'Acerto dentro do esperado',
            body: '{{value}} de acerto em {{n}} disparos.',
          },
        },
        counter_strafe: {
          bad: {
            title: 'Atirando em movimento',
            body: 'Só {{value}} dos {{n}} tiros de {{name}} saíram com o jogador lento o bastante para a bala ir onde a mira aponta. Em CS2 o tiro só é preciso abaixo de 34% da velocidade máxima da arma — é isso que o counter-strafe (tocar a tecla contrária) alcança em um ou dois quadros.',
          },
          good: {
            title: 'Counter-strafe consistente',
            body: '{{value}} dos {{n}} tiros saíram já parado, dentro do limite de precisão da arma.',
          },
          neutral: {
            title: 'Counter-strafe dentro do esperado',
            body: '{{value}} dos {{n}} tiros saíram dentro do limite de precisão da arma.',
          },
        },
      },
      duels: {
        kast: {
          bad: {
            title: 'KAST baixo',
            body: '{{name}} contribuiu em {{value}} dos {{n}} rounds (matou, deu assistência, sobreviveu ou foi trocado). KAST baixo com K/D bom costuma ser jogo solto do time.',
          },
          good: {
            title: 'KAST alto',
            body: '{{name}} contribuiu em {{value}} dos {{n}} rounds.',
          },
          neutral: {
            title: 'KAST dentro do esperado',
            body: 'Contribuiu em {{value}} dos {{n}} rounds.',
          },
        },
        trade_attempt_rate: {
          bad: {
            title: 'Longe da troca',
            body: 'Das {{n}} vezes em que um companheiro morreu com {{name}} vivo, ele acertou o assassino em {{value}}. Isso é posicionamento, não mira: quem joga longe do time nunca chega a tempo.',
          },
          good: {
            title: 'Perto da troca',
            body: 'Das {{n}} vezes em que um companheiro morreu, {{name}} foi atrás do assassino em {{value}}.',
          },
          neutral: {
            title: 'Troca dentro do esperado',
            body: 'Foi atrás do assassino em {{value}} das {{n}} chances.',
          },
        },
        entry_success: {
          bad: {
            title: 'Perdendo os duelos de abertura',
            body: '{{name}} venceu {{value}} de {{n}} tentativas de entrada. Cada entrada perdida deixa o time em 4 contra 5.',
          },
          good: {
            title: 'Abrindo rounds com vantagem',
            body: '{{name}} venceu {{value}} de {{n}} duelos de abertura: o time começa mais rounds em 5 contra 4.',
          },
          neutral: {
            title: 'Duelos de abertura equilibrados',
            body: '{{value}} de vitórias em {{n}} tentativas de entrada.',
          },
        },
        traded_death_rate: {
          bad: {
            title: 'Mortes sem troca',
            body: 'Só {{value}} das {{n}} mortes de {{name}} foram vingadas. É métrica de TIME: ou {{name}} joga longe dos companheiros, ou o time não está em posição de trocar.',
          },
          good: {
            title: 'Mortes sendo trocadas',
            body: '{{value}} das {{n}} mortes de {{name}} foram vingadas: o time joga perto e pune quem abre.',
          },
          neutral: {
            title: 'Trocas dentro do esperado',
            body: '{{value}} das {{n}} mortes foram vingadas.',
          },
        },
      },
      utility: {
        flash_net: {
          bad: {
            title: 'Flashes atrapalhando o próprio time',
            body: 'Valor líquido de {{value}} em {{n}} flashes de {{name}}: o tempo cegando aliados, com peso dobrado, superou o tempo cegando inimigos.',
          },
          good: {
            title: 'Flashes rendendo',
            body: 'Valor líquido de {{value}} em {{n}} flashes de {{name}}: muito mais cegueira no adversário do que no próprio time.',
          },
          neutral: {
            title: 'Flashes neutras',
            body: 'Valor líquido de {{value}} em {{n}} flashes.',
          },
        },
        unused_on_death: {
          bad: {
            title: 'Morrendo com utilitário na mão',
            body: '{{name}} morreu carregando {{value}} de utilitário em média, em {{n}} mortes. É dinheiro que virou nada — nem sempre dá tempo de usar, mas quando vira hábito é granada que nunca sai da mão.',
          },
          good: {
            title: 'Gasta o utilitário antes de morrer',
            body: '{{name}} morreu com apenas {{value}} de utilitário na mão, em média, em {{n}} mortes.',
          },
          neutral: {
            title: 'Utilitário que morreu na mão',
            body: '{{name}} morreu carregando {{value}} de utilitário em média, em {{n}} mortes.',
          },
        },
        nade_damage: {
          bad: {
            title: 'HE e molotov rendendo pouco',
            body: '{{name}} tirou {{value}} por granada em {{n}} HE e molotovs: a granada saiu, mas não pegou ninguém.',
          },
          good: {
            title: 'HE e molotov bem jogadas',
            body: '{{name}} tirou {{value}} por granada em {{n}} HE e molotovs.',
          },
          neutral: {
            title: 'Dano por granada dentro do esperado',
            body: '{{name}} tirou {{value}} por granada em {{n}} HE e molotovs.',
          },
        },
      },
      economy: {
        dmg_per_1000: {
          bad: {
            title: 'Pouco dano pelo dinheiro gasto',
            body: '{{name}} causou {{value}} de dano a cada $1000 gastos, ao longo de {{n}} rounds.',
          },
          good: {
            title: 'Dinheiro bem convertido em dano',
            body: '{{name}} causou {{value}} de dano a cada $1000 gastos, ao longo de {{n}} rounds.',
          },
          neutral: {
            title: 'Dano por dinheiro dentro do esperado',
            body: '{{value}} de dano a cada $1000, em {{n}} rounds.',
          },
        },
        left_on_table: {
          bad: {
            title: 'Dinheiro parado em round de full buy',
            body: '{{name}} entrou com {{value}} sobrando, em média, nos {{n}} rounds de full buy do time. Em eco, guardar é estratégia; em full buy, é compra que não aconteceu.',
          },
          good: {
            title: 'Gasta o que tem quando o time compra',
            body: '{{name}} deixou só {{value}} parados, em média, nos {{n}} rounds de full buy do time.',
          },
          neutral: {
            title: 'Dinheiro parado no full buy',
            body: '{{name}} deixou {{value}} parados, em média, nos {{n}} rounds de full buy do time.',
          },
        },
        force_damage: {
          bad: {
            title: 'Force rendendo pouco',
            body: '{{name}} causou {{value}} de dano por round nos {{n}} rounds em que o time forçou. Forçar é decisão do time; o dano é o que dá para cobrar de cada um.',
          },
          good: {
            title: 'Converte os rounds de force',
            body: '{{name}} causou {{value}} de dano por round nos {{n}} rounds em que o time forçou.',
          },
          neutral: {
            title: 'Dano no force dentro do esperado',
            body: '{{name}} causou {{value}} de dano por round nos {{n}} rounds em que o time forçou.',
          },
        },
      },
      combat: {
        adr: {
          bad: {
            title: 'ADR baixo',
            body: '{{name}} causou {{value}} de dano por round em {{n}} rounds.',
          },
          good: {
            title: 'ADR alto',
            body: '{{name}} causou {{value}} de dano por round em {{n}} rounds.',
          },
          neutral: {
            title: 'ADR dentro do esperado',
            body: '{{value}} de dano por round em {{n}} rounds.',
          },
        },
      },
    },
  },
  glossary: {
    entryKill: 'Entry Kill',
    entryKill_desc:
      'A primeira morte do round para o seu lado, geralmente abrindo o bombsite.',
    trade: 'Trade',
    trade_desc:
      'Matar quem acabou de matar seu colega, dentro da janela de tempo configurada.',
    clutch: 'Clutch',
    clutch_desc: 'Ganhar o round sozinho contra um ou mais inimigos vivos.',
    eco: 'Eco',
    eco_desc: 'Round em que o time economiza, comprando pouco ou nada.',
    forceBuy: 'Force Buy',
    forceBuy_desc:
      'Round em que o time gasta quase tudo sem conseguir um buy completo.',
    fullBuy: 'Full Buy',
    fullBuy_desc: 'Round com armamento e utilitario completos.',
    popFlash: 'Pop Flash',
    popFlash_desc:
      'Flash que detona quase imediatamente apos o arremesso, sem dar tempo de reacao.',
    preAim: 'Pre-aim',
    preAim_desc:
      'Onde a mira estava ANTES do duelo comecar. E isso que se chama de crosshair placement.',
    spray: 'Spray',
    spray_desc: 'Rajada continua, onde o controle de recuo determina o acerto.',
    kast: 'KAST',
    kast_desc:
      'Percentual de rounds em que o jogador matou, foi trocado, sobreviveu ou deu assistencia.',
    adr: 'ADR',
    adr_desc: 'Dano medio por round.',
    knifeRound: 'Round Faca',
    knifeRound_desc:
      'Round inicial de Gamers Club e FACEIT que decide o lado. Nao conta nas estatisticas.',
  },
  errors: {
    generic: 'Algo deu errado',
    povDemo: 'Este parece ser um demo POV (gravado por um jogador).',
    povDemoHint:
      'O analisador precisa de um demo GOTV, gravado pelo servidor, porque um POV so registra o que aquele jogador via.',
    duplicateDemo: 'Esta demo ja foi importada.',
    unsupportedMap: 'Mapa sem radar vendorizado.',
    transport: 'Nao foi possivel falar com o processo local.',
  },
} as const;

type WidenStrings<T> = {
  [K in keyof T]: T[K] extends string ? string : WidenStrings<T[K]>;
};

export type Catalog = WidenStrings<typeof ptBR>;
