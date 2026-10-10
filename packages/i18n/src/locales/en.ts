import type { Catalog } from './pt-BR.js';

export const en: Catalog = {
  common: {
    appName: 'CS2 Demo Analyser',
    offline: '100% local',
    loading: 'Loading...',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    export: 'Export',
    search: 'Search',
    empty: 'Nothing here yet',
    language: 'Language',
    version: 'Version',
  },
  nav: {
    library: 'Library',
    match: 'Match',
    player: 'Player',
    team: 'Team / Opponent',
    utility: 'Utility',
    explore: 'Explorer',
    sql: 'SQL console',
    settings: 'Settings',
  },
  library: {
    title: 'Match library',
    subtitle: 'Drag a .dem file here to analyse it',
    dropHere: 'Drop the demo to start',
    noMatches: 'No matches imported yet',
    noMatchesHint: 'Drag a GOTV .dem file into this window.',
  },
  settings: {
    title: 'Settings',
    steamId: 'Your SteamID64',
    steamIdHint: 'Typed by hand. It is what makes each match summary talk about you.',
    steamIdInvalid: 'A SteamID64 has exactly 17 digits.',
    playersOfInterest: 'Players of interest',
    playersOfInterestHint:
      'Teammates and opponents you study. They are highlighted in any demo.',
    retention: 'Matches keeping replay data',
    retentionHint:
      'Older matches lose the replay and the demo copy, but keep every analysis, chart and verdict. 0 keeps everything.',
    replayLabels: 'Names on the replay radar',
    replayLabelsNumber: 'Number inside the dot (legend in the panel)',
    replayLabelsAlways: 'Name always visible',
    replayLabelsHover: 'Only on hover',
    replayLabelsHint:
      'How to tell who is who on the radar without hunting with the mouse while the round runs.',
    voice: 'Voice audio',
    voiceHint:
      'Gamers Club and FACEIT demos usually carry voice. Valve matchmaking demos do not.',
    diagnostics: 'Diagnostics',
    transport: 'Transport',
    offlineNote:
      'Everything here stays on your computer. The app never queries Steam or any external service.',
    retentionWarnTitle_one: 'Saving will remove the replay of {{count}} match',
    retentionWarnTitle_other: 'Saving will remove the replay of {{count}} matches',
    retentionWarn:
      'Scoreboard, analyses, verdicts and heatmap stay complete. Only the 2D replay goes — and it only comes back by re-importing the demo. Pin a match to protect it.',
    appliesToLibrary: 'Changes also apply to matches already imported.',
    network: 'Network',
    noNetwork: 'no connection',
    poiEmpty: 'No players added.',
    poiRemove: 'Remove {{name}}',
    poiSteamId: "Player's SteamID64",
    poiName: 'Display name',
    poiNote: 'Note (optional): role, team, what to watch',
    poiAdd: 'Add',
    poiDuplicate: 'This SteamID is already on the list.',
    poiIsUser: 'This is your own SteamID.',
    poiWhereToFind:
      "Any player's SteamID64 shows up when hovering their name on a match scoreboard.",
    storage: 'Disk usage',
    storageHint:
      'On import the app keeps a copy of the demo and never reads the source folder again — not even the CS2 one. Copies go away together with the replay, via the retention above.',
    storageDemos_one: 'Demo copies ({{count}})',
    storageDemos_other: 'Demo copies ({{count}})',
    storageReplays: 'Replay data',
    storageVoice: 'Voice audio',
    storageDatabase: 'Analysis database',
    storageDatabaseHint: 'Never pruned: analyses and verdicts stay forever.',
    storageTotal: 'Total',
  },

  tabs: {
    summary: 'Summary',
    aim: 'Aim',
    duels: 'Duels',
    rounds: 'Rounds',
    economy: 'Economy',
    utility: 'Utility',
    map: 'Map',
    replay: '2D replay',
  },

  table: {
    player: 'Player',
    team: 'Team',
    rounds: 'Rounds',
    kills: 'K',
    deaths: 'D',
    assists: 'A',
    plusMinus: '+/-',
    hsPct: 'HS%',
    hsPctDesc: 'Share of kills that were headshots',
    util: 'Util',
    flash: 'Flash',
    converted: 'Converted',
    side: 'Side',
    map: 'Map',
    matches: 'Matches',
  },
  matchScreen: {
    liveRoundCount_one: '{{count}} live round',
    liveRoundCount_other: '{{count}} live rounds',
    plusDiscarded_one: ', {{count}} outside the match',
    plusDiscarded_other: ', {{count}} outside the match',
    roundWindow: 'rounds {{first}}-{{last}}',
    roundWindowTip:
      'This player was not on the server for the whole match. They played {{rounds}} round(s), and their averages are over those rounds — not over the match total.',
    rosterChanges: 'Roster change',
    rosterChangesDesc:
      'Gamers Club lets a team call in a substitute when a player leaves the match. The app measures each player ROUND WINDOW; the pairing below is inferred from adjacency, and the demo does not record why anyone left.',
    rosterHandoff: '{{out}} left on round {{outRound}}; {{in}} came in on round {{inRound}}',
    rosterHandoffOutOnly: '{{out}} left on round {{outRound}}, and nobody replaced them',
    rosterHandoffInOnly: '{{in}} came in on round {{inRound}}, with no departure paired',
    rosterGapClean: 'swapped between rounds: no round was played short-handed',
    rosterGapRounds: '{{n}} round(s) played short-handed in between',
    rosterOverlap:
      'the windows overlap by {{n}} round(s): both were on the server, so this is NOT a substitution',
    understaffedRounds: 'Rounds with uneven rosters',
    understaffedRound: 'round {{round}}: {{ct}} CT against {{t}} T',
    openError: 'Could not open this match',
    noVoice: 'no voice',
    noVoiceDesc:
      'This demo has no recorded voice. That is not an app failure: recording voice into the demo is a SERVER setting. Valve official servers never record it; platforms such as Gamers Club record it when configured to.',
    noRadar: 'no radar',
    noRadarDesc:
      'This map has no vendored radar, so the 2D viewer is unavailable. Every analysis, chart and table still works.',
    pinned: 'pinned',
    checksFailed: 'Post-ingestion checks failed',
    you: 'you',
    followed: 'followed',
  },
  libraryScreen: {
    pathPlaceholder: 'C:\path\to\a-demo.dem',
    pathLabel: 'Demo path',
    importError: 'Could not import',
    deleteTitle: 'Delete this match?',
    delete: 'Delete',
    actions: 'Match actions',
    imported: 'imported',
    import: 'Import',
    deleteDesc:
      'It disappears from the library with every analysis. The original .dem file is not touched, so you can import it again later.',
  },

  analysis: {
    error: 'Could not compute the analyses',
    noData: 'no data',
    clutches: 'Clutches',
    clutchesEmpty: 'Nobody was left alone against a living enemy in this match.',
    clutchesDesc:
      'Who was last alive, against how many, and what happened. Two or three per match: too few to conclude anything about a player, which is why this is a table and not a verdict.',
    advantage: 'Man advantage',
    advantageDesc:
      'The FIRST numeric imbalance of each round and what each TEAM did with it. A 5v4 opened and lost is a different problem from a round that never tipped. Counting by side alone would mix both teams, because sides switch at halftime.',
    advantageEmpty: 'Not enough data.',
    advantageByAbsence: 'Rounds that started short-handed',
    advantageByAbsenceDesc:
      'In these rounds the opponent fielded fewer players: someone left and the complete substitute had not come in yet. The advantage was not earned, so it does NOT count toward the conversion above — converting what you were handed measures something else.',
    advantageByAbsenceRow: '{{label}} in {{rounds}} round(s), {{won}} won',
    livesTip: 'The alive count at the moment of the round first tipping.',
    livesHeader: 'Alive count',
    roundsTip: 'Rounds that went through this alive count.',
    convertedTip: 'Rounds the advantaged side ended up winning.',
    unnamedTeam: 'Unidentified team',
    openerLine: 'Whoever got the first kill took the round',
    openerTimes: 'times.',
    multikills: 'Multikills',
    multikillsDesc: 'Rounds in which the player killed two or more people.',
    multikillsEmpty: 'No multikill in this match.',
    kastDesc:
      'Share of rounds in which the player killed, assisted, survived or was traded. It measures the contribution K/D does not show.',
    accuracy: 'Accuracy',
    accuracyDesc:
      'How many shots became hits. A hit is matched by the tick of the shot, and a shot either hits or does not — shotgun pellets do not count as extra hits. Grenades and knives are out.',
    shots: 'Shots',
    hitRate: 'Hit rate',
    firstShot: '1st shot',
    spray: 'Spray',
    standing: 'Still',
    standingWord: 'still',
    whereBullet: 'Where the bullet landed',
    byWeapon: 'By weapon',
    preAimAndAccuracy: 'and accuracy',
    preAimDesc:
      'Pre-aim is where the crosshair was 250 ms BEFORE the shot — that is crosshair placement. Accuracy is where it was at the moment of the shot. They are different things and are never mixed here.',
    duels: 'Duels',
    vertical: 'Vertical',
    below: 'below',
    tradeChain: 'Trade chain',
    tradeChainMirror:
      'Your deaths: how many had a teammate alive to avenge them, in how many someone hit your killer, and in how many he went down.',
    chance: 'chance',
    wentAfter: 'went after',
    avenged: 'avenged',
    chanceHeader: 'Chance',
    wentAfterHeader: 'Went after',
    tradedDeath: 'traded death',
    tradedDeathDesc:
      'The traded death rate is a TEAM metric, not an individual one: it measures whether your teammates were close enough to avenge you.',
    entries: 'Entries',
    success: 'Success',
    trades: 'Trades',
    avengedHeader: 'Avenged',
    entryFootnote: 'Entry = first kill of the side, early in the round and with full teams.',
    flashEfficacy: 'Flash efficacy',
    flashEfficacyDesc:
      'What matters is not how many you threw: it is how much useful blind time they produced, minus what blinded your own team.',
    blinded: 'Blinded',
    effective: 'Effective',
    allies: 'Allies',
    net: 'Net',
    effectiveWord: 'effective',
    economyPerRound: 'Economy per round',
    economyPerRoundDesc:
      'Equipment value at the end of freezetime — the only moment where "what the team entered the round with" is well defined.',
    deathMap: 'Death map',
    noRadarTitle: 'Map without radar',
    noRadarDesc: 'The heatmap needs the radar, which is not available for',
    noRadarRest: '. The other four analyses are still complete.',
    whereDeaths: 'Where people die',
    whereKills: 'Where people kill',
    everyone: 'everyone',
    bombTitle: 'Bomb and sites',
    bombEmpty: 'No bomb was planted in this match.',
    bombDesc:
      'Where the bomb goes up, how long it takes and what happens next. Only rounds with a plant count: a round without a bomb says nothing about post-plant.',
    plants: 'Plants',
    untilPlant: 'Until plant',
    tWon: 'T won',
    ctRetake: 'CT retake',
    whereBombWent: 'Where the bomb went up',
    chainLead: 'A teammate died while you were alive',
    chainMid: 'you hit the killer',
    chainMid2: 'you killed him',
    chainWindow: '— within the {{seconds}} s window.',
  },

  chain: {
    deaths: 'Deaths',
    chances: 'Chances',
    withChance: 'With a chance',
    wentAfter: 'Went after',
    someoneWent: 'Someone went',
    avenged: 'Avenged',
    avengedMirror: 'Avenged',
    converted: 'Converted',
    chanceNote:
      '<b>Chance</b> is every teammate who died while you were alive, regardless of distance: the demo only stores the position of whoever killed or died, so there is no way to know who was close. That is why the chance count is high.',
    wentAfterNote:
      '<b>Went after</b> means hitting the killer within the window. A shot that missed does not show up — the demo records the shot, but not where it went. Killing counts as having gone after.',
    flashNote:
      'A blind counts as <b>effective</b> from {{seconds}}s on — below that the player can still fight. The net value subtracts <b>{{penalty}}x</b> the time spent blinding a teammate, because blinding your own team is worse than blinding nobody.',
  },

  utilityCard: {
    title: 'Utility in depth',
    desc:
      'HE, molotov, smoke and flash per player. <b>Effective</b> means blinds longer than {{seconds}} s — one flash can blind three enemies, so that number is not comparable to the number of flashes thrown. <b>Dist.</b> is the median of how close to the enemy the flash popped. <b>Facing away</b> counts who was looking the other way when it popped, and sits <i>beside</i> efficacy, never added to it.',
    missingTitle: 'Two numbers are missing in this match',
    he: 'HE',
    heTip:
      'High-explosive grenades THROWN. It is the denominator: a grenade that hit nobody counts here.',
    heDamage: 'HE damage',
    heDamageTip: 'Damage dealt to enemies with HE. Team damage does not count.',
    bestHe: 'Best HE',
    bestHeTip: 'Most enemies hit by a SINGLE HE in the match.',
    molotov: 'Molotov',
    molotovTip: 'Molotovs and incendiaries thrown.',
    fireDamage: 'Fire damage',
    fireDamageTip: 'Damage dealt to enemies with fire.',
    smokes: 'Smokes',
    smokesTip:
      'Smokes thrown. The app does not claim whether a smoke blocked vision: that would require the map geometry (ADR 0010).',
    flashes: 'Flash',
    flashesTip: 'Flashes thrown.',
    effective: 'Effective',
    effectiveTip:
      'Blinds above 1.1 s caused on enemies. One flash can blind three people, so this number is NOT comparable to the number of flashes thrown.',
    distance: 'Dist.',
    distanceTip:
      'Median distance between the blinded enemy and the point where the flash popped, in game units. Close = flash thrown in their face; far = support flash.',
    assist: 'Assist',
    assistTip: 'Teammate kills against someone your flash blinded.',
    facingAway: 'Facing away',
    facingAwayTip:
      'Victims who were looking the other way when it popped. It is an APPROXIMATION, measured at 8 Hz, which is why it sits beside efficacy and is never added to it.',
    teamFlash: 'Team',
    teamFlashTip:
      'Blinds caused on your own team. They count double against you in the net flash value.',
    inHand: 'In hand',
    inHandTip: 'Average value, in dollars, of the utility the player was still carrying when they died.',
    distanceChip: 'Median distance between the blinded enemy and the pop point',
    popFlashChip: 'Pop flash does not show up here',
    smokeChip: 'Smoke blocking vision is not computed',
    whereItLanded: 'Where the utility landed',
    onlyEffective: 'only the ones that worked',
    onlyEffectiveTip:
      'Damage on an enemy or an enemy blinded. Smoke and decoy drop out: the app does not measure vision blocking.',
    minDamage: 'HE/molotov damage',
    minDamageTip: 'Minimum damage on enemies. Applies to HE and molotov; it does not touch flashes.',
    minBlind: 'blind',
    minBlindTip: 'Minimum blind on a SINGLE enemy, in seconds. Applies to flashes only.',
    minEnemies: 'enemies',
    minEnemiesTip: 'Enemies hit or blinded by the same grenade. Applies to HE, molotov and flash.',
    side: 'Side',
    all: 'All',
    any: 'any',
    clear: 'clear',
    less: 'less {{what}}',
    more: 'more {{what}}',
  },

  utilityNote: {
    text:
      '<b>Best HE</b> is how many enemies the best grenade caught at once. <b>Team</b> is how many times it blinded your own side. <b>Pop flash does not show up here</b>: the time between throwing and popping is the grenade fuse, always 1.6 s, so measuring "it popped fast" says nothing. What says something is the distance of the pop. <b>In hand</b> is the value of the grenades the player was still carrying when they died — not a mistake by itself, whoever dies on the entry had no time. <b>Smoke blocking vision is not computed</b>: it would require line of sight against the map geometry, and would be a guess with the face of a number.',
  },

  teamScreen: {
    error: 'Could not assemble the teams',
    empty: 'No team yet. Import a match and the lineups show up here.',
    unnamed: 'Unnamed',
    noName: 'Unnamed team',
    tabMatch: 'In this match',
    tabLibrary: 'Across the library',
    matchLabel: 'Match',
    openInMatch: 'open in the Match screen',
    byTeamNote:
      'Everything here is per TEAM, not per side: sides switch at halftime, and counting by side would put both opponents on the same line. The team on each side in each round comes from the majority of that side roster.',
    reading: 'Reading',
    thisTeam: 'This team',
    opponent: 'Opponent',
    roundsOf: 'Rounds as',
    opened: 'Opened the round',
    openedTip: 'Rounds in which this team got the FIRST kill, and how many of those it won.',
    turned: 'Turned the round',
    turnedTip:
      'Rounds this team won AFTER the opponent got the first kill. It is the opposite reading of the one above.',
    utilPerRound: 'Utility per round',
    utilPerRoundTip: 'Grenades thrown by the team, and the average per round played.',
    utilDamage: 'Utility damage',
    utilDamageTip: 'Damage dealt to enemies with HE and molotov.',
    bomb: 'Bomb',
    bombTip: 'Plants by the team, and how many enemy bombs it defused.',
    plantsShort: '{{plants}} plant(s), {{defuses}} defuse(s)',
    wherePlants: 'Where it plants',
    unknownSite: 'unidentified site',
    defusedCount: '{{n}} defused',
    buy: 'Buy',
    exportTitle: 'Team {{name}}',
    summary: '{{matches}} match(es), {{wins}} win(s). Rounds {{won}}–{{lost}}.',
    won: 'Won',
    roster: 'Roster',
    coreHint: 'Core: present in every match of the group',
    playedHint: 'Played {{n}} of {{total}}',
    heuristic:
      'The demo has no team id. Two matches belong to the same team when they share <b>three players with any match</b> of the group — that is why a substitute does not break the history, and why two similar groups can merge. The matches that went in are listed beside it.',
    rosterSize: '({{n}} players)',
    byMap: 'By map',
    byMapDesc:
      'Where this team wins and where it loses. With few matches per map, it is a tendency, not a conclusion.',
    balance: 'Balance',
    groupMatches: 'Matches of the group',
  },

  explorerScreen: {
    rows_one: '{{count}} row in {{ms}} ms',
    rows_other: '{{count}} rows in {{ms}} ms',
    truncatedAtLimit: ' — cut at the limit',
    chartTitle: '{{measure}} by {{group}}',
    title: 'Explorer',
    saved: 'Saved',
    error: 'Could not answer that',
    savePlaceholder: 'Save this question as…',
    deleteQuestion: 'Delete this question',
    show: 'Show',
    groupingBy: 'grouped by',
    measuring: 'measuring',
    removeMeasure: 'Remove this measure',
    fieldPlaceholder: 'field…',
    addMeasure: 'Add measure',
    shortcuts: 'Shortcuts',
    onlyWhen: 'Only when',
    noFilter: '(no filter)',
    addFilter: '+ filter',
    valuePlaceholder: 'value…',
    not: 'not',
    openInReplay: 'Open in the replay',
    min: 'minimum',
    value: 'value',
  },

  ratingCard: {
    title: 'Rating and round impact',
    desc:
      '<b>Rating (approx.)</b> reproduces HLTV Rating 2.0 through a published linear combination — HLTV never opened the formula, so the number is an approximation and carries that name. <b>Impact/round</b> is the Rating 3.0 idea — how much the kills moved the chance of winning the round — measured on YOUR library. <b>Rating 3.0 is not imitated</b>: HLTV treats it as a closed formula, and guessing secret weights would be inventing a number with an official face.',
    rating: 'Rating (approx.)',
    ratingTip:
      'Approximation of HLTV Rating 2.0 through a published linear combination. It is not the official number: HLTV never opened the formula.',
    swing: 'Impact/round',
    swingTip:
      'How much their kills moved the chance of their own side winning the round, summed and divided by rounds played. A dash means the states of their kills had no sample in the library.',
    kastTip: 'Rounds in which they killed, assisted, survived or had their death traded.',
    kprTip: 'Kills per round.',
    dprTip: 'Deaths per round. It is the heaviest negative term of the formula.',
    adrTip: 'Average damage per round.',
    ratingChip: 'rating: declared approximation',
    ratingChipDesc:
      '0.0073·KAST + 0.3591·KPR − 0.5329·DPR + 0.2372·Impact + 0.0032·ADR + 0.1587, with Impact = 2.13·KPR + 0.42·APR − 0.41. The coefficients come from a regression published by third parties against HLTV values — not from HLTV. See ADR 0013.',
    impactChip: 'impact: own baseline',
    impactChipDesc:
      'The chance of winning the round comes from the observed frequency of each state (CT alive × T alive × bomb) in your library: {{observations}} states observed, {{states}} of them with at least {{min}} rounds. A state with a smaller sample does not become a probability — it falls back to the step without the bomb, and if even that has no sample, the kill is left out.',
    noLibrary:
      'There is not enough library yet for round impact: no state reached {{min}} rounds. It shows up on its own as you import matches.',
    skipped:
      '{{n}} kill(s) were left out of the impact: the state they happened in does not have {{min}} rounds in the library yet.',
  },
  deepEconomy: {
    title: 'Economy in depth',
    desc:
      'Team money at the start of each round, the loss bonus in effect and the rounds where the buy broke. The loss bonus <b>does not come from the demo</b>: it is reconstructed from the CS2 rule.',
    moneyAtStart: 'Money at the start of the round',
    peak: '{{value}} at the peak',
    breakPoint: 'break point',
    ctBroke: 'CT broke after this round',
    tBroke: 'T broke after this round',
    lossBonusLine: 'loses the round and gets',
    fixedRef: 'fixed reference',
    lossBonusDesc:
      'CS2 loss bonus: {{steps}}. Losing climbs one step, winning drops one, and the counter restarts each half. It is not an average of matches: it is a game rule.',
    conversion: 'Eco, semi-eco and force conversion',
    forceCost: 'What each lost force cost',
    noFullBuy: 'no full buy until the end of the half',
    untilFullBuy: '{{n}} round(s) until the full buy',
    byPlayer: 'Per player — what they destroyed, saved and left on the table',
    spent: 'Spent',
    spentTip: 'Money the player spent across the whole match.',
    destroyed: 'Destroyed',
    destroyedTip:
      'Value of the ENEMY equipment they destroyed: what the opponent lost by dying to them.',
    saved: 'Saved',
    savedTip: 'Value of their own equipment they carried alive into the next round.',
    onTable: 'On the table',
    onTableTip:
      'Money left at the end of freezetime in FULL BUY rounds of the team. In eco, saving is strategy; in a full buy, it is a buy that did not happen.',
    footnote:
      '<b>Destroyed</b> is the value the victim entered the round with — whoever bought mid-round is underestimated. <b>On the table</b> only counts in a full buy round of their own team: in eco, saving money is the strategy.',
  },

  analysisTail: {
    reprocessNote:
      'This match was imported before the app recorded shot speed and the body part hit: <b>still</b> and the breakdown by body part only show up after reprocessing.',
    pitchNote:
      'Negative means aiming <b>below</b> the head; positive, above. A consistently negative value is the classic sign of a low crosshair.',
    everyone: 'everyone',
    defused: 'Defused',
    defusedOf: '{{defused}} of {{plants}}',
    defusedHint: '{{withKit}} with kit, {{withoutKit}} without',
    exploded: 'Exploded',
    explodedHint: '{{n}} ended earlier (team wiped)',
    leftOnDefuse: 'Left on defuse',
    preAimAndAccuracy: 'Pre-aim and accuracy',
    entryAndTrade: 'Entries and trades',
  },

  playerScreen: {
    error: 'Could not assemble the profile',
    search: 'Search by name or SteamID',
    noMatches: 'This player has no matches in the library',
    matches: 'Matches',
    period: 'Period',
    noMetrics:
      'There are no metrics for this player yet. They show up as soon as one of their matches is imported.',
    evolution: 'Evolution across matches',
    closerToZero: 'zero is ideal — both directions are bad',
    higherBetter: 'higher is better',
    lowerBetter: 'lower is better',
    medianNote:
      'The dashed line is the median of your PREVIOUS matches — the same baseline the match verdict uses. Faded points had less than {{min}} of sample: they show up, but they do not support a conclusion.',
    whatToTrain: 'What to train',
    byMap: 'By map',
    winLoss: 'W–L',
    entry: 'Entry',
    byWeapon: 'By weapon',
    kills: 'Kills',
    distance: 'Distance',
    pick: 'Pick a player above. Start with yourself or with a player of interest.',
    distanceNote: 'Distance in metres, median.',
  },

  playerWeapons: {
    noteWithMissing: 'Distance in metres, median. Blank damage is explained on hover.',
  },

  misc: {
    mapLoadError: 'Could not load the map',
    radarX: 'Radar X',
    radarY: 'Radar Y',
    level: 'Level',
    mainLevel: 'main',
    twoFloors: 'Two-floor map',
    roundUtility: 'Round utility',
    emptyCollection: 'Empty collection',
    rename: 'Rename',
    notePlaceholder: 'Note (where it is thrown from, what it is for…)',
    crouched: 'crouched',
    deleteFromCollection: 'Delete from the collection',
    diagnosticsUnavailable: 'Diagnostics unavailable',
    cs2Builds: 'CS2 builds in the library',
    voiceMissing: 'Voice extractor missing',
    noVendoredRadar: 'No vendored radar',
    viewerUnavailable: '2D viewer unavailable on this map',
    replayUnavailable: 'Replay unavailable',
    prevEvent: 'Previous event ( [ )',
    prevFrame: 'Previous frame ( , )',
    playPause: 'Play / pause (space)',
    nextFrame: 'Next frame ( . )',
    nextEvent: 'Next event ( ] )',
    utilityNotExtracted: 'Utility not extracted in this match',
    noUtilityThisRound: 'Nobody threw utility in this round.',
    seeThrowInReplay: 'See the throw in the replay',
    saveToCollection: 'Save this utility to the collection',
    toggleSidebar: 'Toggle the menu',
  },

  misc2: {
    duplicate: 'This demo is already in the library',
    chatTitle: 'Match chat',
    teamOnly: 'Said to the team only',
    radarNumber: 'This player number on the radar',
    scoreboard: 'Scoreboard',
    queryRefused: 'Query refused',
    lineupMap: 'Lineup map',
  },

  chatScope: {
    unknown:
      'The demo recorded the message without saying whether it went to the team or to everyone. It happens in demos from the September CS2 update on, which carry a different chat event.',
  },

  radar: {
    approxNote:
      '<m>≈</m> Smoke and incendiary: the position and duration are real; the <b>area is approximate</b>, because the demo does not contain the volume. Scroll to zoom, drag to pan, double-click to reset.',
    toggleSidebar: 'Open or close the menu',
  },

  sidebar: {
    title: 'Sidebar',
    desc: 'Displays the mobile sidebar.',
  },

  libraryFilter: {
    history: 'History',
    all: 'All',
    mine: 'Only mine',
    mineWhy: 'Set your SteamID in Settings to use this filter.',
    poi: 'Players of interest',
    poiWhy: 'Add players of interest in Settings to use this filter.',
    knifeRound: 'knife round',
  },

  labels: {
    roundNum: 'round {{n}}:',
    timesOf: '{{times}} of {{of}}',
    source: {
      gamers_club: 'Gamers Club',
      faceit: 'FACEIT',
      valve_mm: 'Matchmaking',
      hltv: 'HLTV',
      unknown: 'Unknown',
    },
    winReason: {
      t_killed: 'T eliminated',
      ct_killed: 'CT eliminated',
      bomb_exploded: 'Bomb exploded',
      bomb_defused: 'Bomb defused',
      target_bombed: 'Bomb exploded',
      target_saved: 'Time ran out',
      hostages_rescued: 'Hostages rescued',
      hostages_not_rescued: 'Hostages not rescued',
    },
  },

  segmentation: {
    title_one: '{{count}} round outside the match',
    title_other: '{{count}} rounds outside the match',
    restarts_one: 'This demo has {{count}} restart.',
    restarts_other: 'This demo has {{count}} restarts.',
    knife: 'The knife round was identified and excluded from the stats.',
    warmup: '{{count}} warmup round(s) discarded.',
    other: '{{count}} round(s) discarded due to a restart.',
    why: 'Without that, the knife round would become "round 1" and the pistol round economy would come out wrong.',
    mapLabel: 'Map',
  },

  agg: {
    count: 'Count',
    sum: 'Sum',
    avg: 'Average',
    median: 'Median',
    max: 'Max',
    min: 'Min',
    share: 'Share',
    nothing: 'nothing',
    onlyMe: 'only me',
    onlyMeWhy: 'Set your SteamID in Settings to use this shortcut.',
    onlyMine: 'only my players',
    onlyMineWhy: 'Add players of interest in Settings to use this shortcut.',
  },

  ui: {
    save: 'Save',
    saved: 'saved',
    delete: 'Delete',
    deleteQ: 'Delete?',
    deleteMatch: 'Delete match',
    yes: 'yes',
    no: 'no',
    all: 'All',
    maps: 'Maps',
    map: 'Map',
    weapon: 'Weapon',
    damage: 'Damage',
    site: 'Site',
    voice: 'Voice',
    warnings: 'warnings',
    noRadarBadge: 'no radar',
    seeInReplay: 'See in the replay',
    fixedReference: 'fixed reference',
    close: 'Close',
    loading: 'Loading',
    chooseDemos: 'Choose demos',
    dragHint: 'or drag the .dem files onto this window — more than one is fine',
    noImports: 'No import recorded yet.',
    pickMatch: 'Pick a match in the library.',
    offlineNote: 'This app never opens a network connection. All data stays on this machine.',
    reprocess: 'Reprocess',
    reprocessWarning:
      'Reprocessing deletes the current analysis of this match and redoes everything from scratch. Useful after an app update.',
    openExisting: 'Open the existing one',
    advancedSql: 'Advanced: SQL console',
    advancedRadar: 'Advanced: check the radar',
    sqlNoRows: 'The query ran, but returned no rows.',
    noRowsFilter: 'No rows. Try removing a filter.',
    nobodyFound: 'Nobody found. Import a demo or adjust the search.',
    matchGone: 'It may have been deleted, or the demo was never imported.',
    clickRadar: 'Click the radar to read the coordinate',
    toSeeJump: 'to see the jump.',
    outOfMatch: 'Outside the match',
    liveOnly: 'Live rounds only. The knife round and the warmup do not enter any number.',
    winsByBuy: 'Wins by buy type',
    noHitgroup: 'No body-part data in this match.',
    otherFourOk: '. The other four analyses are still complete.',
    of: 'of',
    recoilModel: 'The recoil model (',
    killsOnly:
      'Only duels that ended in a death. Duels without a death would require estimating the visible enemy, and the demo does not give that.',
    tradeWindow:
      'of the teammate death, against whoever killed them. That window is a community convention, not a game rule.',
    diagnosticsHint: 'What to look at when something seems wrong — especially after a CS2 update.',
    buildHint:
      'Build "not detected" means the match was imported before the app started reading that field. Reprocessing fills it in.',
    radarHint:
      'Type a game coordinate and see where it lands on the radar; click the radar for the reverse.',
    trainHint: 'critical or warning — the more it repeats, the higher it sits. In the last',
    trainEmpty: 'Nothing to fix in this window: no metric came out as critical or warning.',
    weaponDamageGap:
      'The demo damage event does not separate this weapon from the other side variant, so the damage is left blank.',
    collectionHint:
      'The utility you saved, by map. To keep a new one, open the 2D replay of a match.',
    collectionEmpty:
      'Nothing saved yet. In the 2D replay, each round shows the grenades thrown; save the ones you want to keep.',
    noReplaySaved:
      'No replay: the source match left the library. The utility is still saved.',
    clickRowThrow: 'Click a row to watch the throw happen.',
    pasteOnServer: 'Paste it on a private server with',
    pasteOnServerEnd: '. The app does not talk to the game: this is only text.',
    utilityOldMatch:
      'Utility on death and blinds from behind only exist in matches imported from F2.5 on.',
    utilityNotExtractedHint:
      'It was imported before this version. Reprocess the match to be able to save utility.',
    noBlindData:
      'This match has no blind recorded in the demo, so no flash counts as effective here. HE and molotov still count.',
    theMap: 'The map',
    noVendoredRadarRest:
      'has no vendored radar. Every analysis, chart and table of this match still works.',
  },

  collection: {
    hint:
      'The utility you saved, by map. To keep a new one, open the 2D replay of a match and use the <b>{{list}}</b> list.',
    empty:
      'Nothing saved yet. In the 2D replay, each round shows the grenades that were thrown — the save button keeps the one you want here, with the position, the angle and the practice command.',
  },

  train: {
    matchesOption: '{{n}} matches',
    windowNote: '(the library has {{n}} of this player for this window)',
    empty:
      'Nothing to fix in this window: no metric came out as critical or warning in the matches considered.',
  },

  weaponGap: {
    text:
      'The demo damage event does not separate this weapon from its variant (M4A4 and M4A1-S arrive under the same name). Instead of adding the damage to the wrong weapon, it is left blank.',
  },

  analysisNotes: {
    killsOnly:
      'Only duels that ended in a death. Duels without a death would require estimating the start of the fight, and that is left for later.',
    tradeWindow:
      'A kill counts as a trade when it happens within <b>{{seconds}} seconds</b> of the teammate death, against whoever killed them. That window is a community convention, not a rank average — changing the value changes the number.',
    noRadarHeatmap:
      'The heatmap needs the radar, which is not available for <m>{{map}}</m>. The other four analyses are still complete.',
  },

  panel: {
    saveHint: 'save the ones you want to keep — only those go into Utility',
    savedAs: 'Saved as "{{name}}"',
    noRadarReplay:
      'The map <m>{{map}}</m> has no vendored radar. Every analysis, chart and table of this match is still complete — only the replay is out.',
  },

  ui2: {
    utilityOldMatch:
      'Utility on death and blinds from behind only exist in matches imported from this version on. The rest of the screen is complete.',
    duplicateHint:
      'Reprocessing deletes the current analysis of this match and redoes everything from scratch. Use it if the previous ingestion went wrong or if the app gained new analyses since then.',
    twoFloors:
      'Both levels are in the SAME image, stacked. The floor is picked by Z, and the point is shifted by percentage points. Vary Z between <a>{{from}}</a> and <b>{{to}}</b> to see the jump.',
    chatUnknownScope:
      '<b>{{n}}</b> message(s) without scope: the demo recorded the words but did not say whether they went to the team or to everyone — and the app does not guess.',
  },

  sqlConsole: {
    run: 'Run',
    shortcut: 'Ctrl+Enter',
    rows_one: '{{count}} row in {{ms}} ms',
    rows_other: '{{count}} rows in {{ms}} ms',
    truncated: ' (truncated)',
  },

  chatPanel: {
    noChat:
      'This demo recorded no chat message. On Gamers Club the all-chat is turned off on the server, and from the September CS2 update on the demos started carrying only the public chat event — some matches end up with nothing here.',
    needsReprocess:
      'This match was imported before the app read chat. Reprocess it to see what was typed — whatever is in the demo is still there.',
  },

  frag: {
    openerLine: 'Whoever got the first kill took the round <b>{{won}} of {{total}}</b> times.',
    counterStrafe:
      'Share of shots fired below {{pct}}% of the weapon top speed — the limit at which CS2 lets the shot come out accurate. That is what counter-strafing aims for. {{slow}} of {{judged}} shots judged.',
    weaponDamage: '{{damage}} damage',
    preAimTitle: '{{preAim}} and accuracy',
    calibration: '{{deg}}°. See ADR 0005.',
    economyTooltip: 'Round {{round}} — {{side}} won',
    heatmapDesc: 'Each cell aggregates {{what}} on a {{grid}}x{{grid}} grid over the radar. {{whose}}',
    heatmapDeaths: 'the deaths',
    heatmapKills: 'the kills',
    heatmapWhoDied: 'The position is the one of whoever died.',
    heatmapWhoKilled: 'The position is the one of whoever killed, not of the victim.',
    postPlantDeaths: 'After the plant,',
    ofSide: 'of the',
    nicknames: 'The identity is the SteamID. It has also appeared as:',
    chartOrder: 'from oldest to most recent',
    chartMin: 'min:',
    chartMax: 'max:',
    halves: 'First half of the window against the second:',
    localOnly: 'Everything read from this machine.',
    extractorInstalled: 'Extractor installed.',
    extractorMissing: 'Without it, no match imports audio. Expected at',
    inUse: 'in use by your library.',
    prunedRest:
      '. Every analysis of these matches is still complete — only the 2D replay and the voice are out.',
    demoBuild: 'CS2 version that recorded this demo',
    demoBuildEnd: '. It tells you what changed when the game updates.',
    build: 'build',
    blinded: '· blinded',
    damageShort: 'damage',
    sqlBehind: 'the SQL this question became',
    deleteNamed: 'Delete "',
    savedCount: '{{n}} utility saved',
    savedShort: 'saved',
    roundShort: 'Round',
    chatDesc:
      'What was typed, in order, with the round it was said in. Click to open the replay at the moment of the message.',
    colorNeedsReprocess: 'Each player colour in the team HUD arrives when you reprocess this match.',
    slotsNeedReprocess:
      'This match was imported with the replay capped at ten players. If it had a complete, one player may be missing from the radar and the panel. Reprocessing fixes it.',
    playersWithoutTeam: 'No team identified',
    unattributedDamage:
      '{{n}} of damage was left out: the demo recorded the damage but not the grenade that caused it, so it is not on the map (and it is still counted in the per-player table).',
    zoomReset: 'x · reset',
    split: 'floor',
  },

  chart: {
    aliases: 'The identity is the SteamID. It has also appeared as: {{list}}.',
    aliasCount_one: '+{{count}} alias',
    aliasCount_other: '+{{count}} aliases',
    points_one: '{{count}} match with this metric · from oldest to most recent',
    points_other: '{{count}} matches with this metric · from oldest to most recent',
    min: 'min: {{value}}',
    max: 'max: {{value}}',
    halves: 'First half of the window against the second: {{trend}}.',
  },

  frag2: {
    voiceInstalled: 'Extractor installed. {{with}} of {{total}} match(es) with audio.',
    voiceServerNote:
      ' A demo without voice usually comes from the SERVER: if it does not record voice, there is nothing to extract.',
    voiceMissingWhere: 'Without it, no match imports audio. Expected at',
    notConfigured: 'not configured',
    radarsInUse: '{{n}} in use by your library.',
    noRadarMaps: '{{maps}}. Every analysis of these matches is still complete — only the 2D replay is out.',
    demoBuildBadge: 'build {{build}}',
    demoBuildTip:
      'CS2 version that recorded this demo{{format}}. It tells you what changed when the game updates.',
    demoFormat: ' (format {{format}})',
    blindedCount: ' · blinded {{n}}',
    damageCount: ' · {{n}} damage',
    sqlBehind: 'the SQL this question became',
    deleteNamed: 'Delete "{{name}}"?',
    savedCount_one: '{{count}} utility saved',
    savedCount_other: '{{count}} utilities saved',
    savedShort_one: '{{count}} saved',
    savedShort_other: '{{count}} saved',
    roundTooltip: 'Round {{round}}',
  },

  frag3: {
    showSql: 'Show the SQL this question became',
    hideSql: 'Hide the SQL this question became',
  },

  frag4: {
    zoomReset: '{{zoom}}x · reset',
    splitBadge: 'floor {{n}}',
  },

  frag5: {
    prunedMatches:
      'These matches lost their ticks to pruning. The metrics are still here; what can no longer be opened is the 2D replay.',
    prunedBadge_one: '{{count}} without replay',
    prunedBadge_other: '{{count}} without replay',
    radarCheck:
      'Type a game coordinate and see where it lands on the radar; click the radar and see the coordinate. On Nuke and Vertigo, varying Z makes the point jump floors. It is for checking the transform, not for analysing a match.',
    pickOnMap:
      'Click a point on the map or in the list below. The dot is where the grenade stopped; the square, where it came from.',
  },

  throwMap: {
    shownOfTotal:
      '{{shown}} of {{total}} grenades. The dot is where it went off; the line is where it came from — straight, because the real path arcs.',
    thresholdRule:
      'Each threshold only filters the type it can measure: damage does not hide flashes, blind time does not hide HEs. Smoke and decoy have no measured effect, and no threshold touches them.',
    unattributedBlind: '{{seconds}} s of blind time also had no matching grenade.',
  },
  baseline: {
    ownHistory_one: 'own history ({{count}} match)',
    ownHistory_other: 'own history ({{count}} matches)',
    ownHistoryTip:
      "Compared with this player's {{count}} PREVIOUS matches in the library. Median {{p50}}; typical range {{p25}} to {{p75}}.",
    matchRelative: '{{rank}} of {{of}} in this match',
    matchRelativeTip:
      'Compared with the {{of}} players in this match who had enough sample. Match average: {{mean}}. Not a rank average — just who was on the server.',
    fixedReference: 'fixed reference',
    fixedReferenceValue: 'fixed reference · {{value}}',
    insufficient: 'no baseline yet — needs {{required}}, has {{have}}',
    insufficientHistoryTip:
      "This verdict would use the player's history, which needs {{required}} previous matches in the library. There are {{have}}. The app would rather say so than invent an average.",
    insufficientMatchTip:
      'Too few players in this match have enough sample to compare ({{have}} of {{required}}). The app would rather say so than invent an average.',
  },
  export: {
    nothing: 'Nothing to export yet.',
    failed: 'Export failed',
    done: 'Exported ({{size}})',
    reveal: 'Show in folder',
    revealUnavailable: 'Open the path above manually.',
    match: 'Export match',
    matchHint:
      'A .zip with the tables as CSV, analyses and verdicts as JSON (with baselines) and the replay data.',
    library: 'Export library',
    libraryHint: 'A copy of the database and replay data, for backup or moving to another machine.',
  },
  retention: {
    pin: 'Pin',
    unpin: 'Unpin',
    pinned: 'pinned',
    pinHint: 'A pinned match never loses its replay to the retention policy.',
    prunedBadge: 'no replay',
    prunedTitle: 'Replay unavailable',
    prunedExplain:
      'Tick data was removed by the retention policy. Analyses, charts and verdicts remain complete. To get the replay back, re-import the demo.',
  },
  voice: {
    turnOn: 'Turn voice on ( M )',
    turnOff: 'Turn voice off ( M )',
    volume: 'Voice volume',
    noneThisRound: 'nobody spoke this round',
    loading: 'loading voice…',
    error: 'voice unavailable',
    silencedBySpeed: 'voice muted outside 1×–2×',
    badge: 'voice',
    badgeHint:
      "The demo carries the players' voice audio. It plays in the replay, aligned to ticks.",
    mixer: 'Voice mixer',
    muteTeam: 'Mute the whole team',
    unmuteTeam: 'Unmute the team',
    teamVolume: '{{team}} volume',
    playerVolume: '{{name}} volume',
    solo: 'Listen only to this player',
    clearSolo: 'Listen to everyone',
    yourTeam: 'Your team',
    opponent: 'Opponent',
    mutePlayer: 'Mute this player',
    unmutePlayer: 'Unmute this player',
  },
  reprocess: {
    button: 'Reprocess',
    hint: "Re-imports the match with the current app version, using the demo copy kept in the library. Brings data older imports didn't record.",
    missingTitle: "This match's demo was not found",
    missing:
      'It was imported before the app kept copies, and the original file is no longer there. Drag the demo into the library again to reprocess.',
    failed: 'Reprocessing failed',
    needed: 'Reprocess this match to see money, inventory and the C4.',
  },
  hud: {
    freeze: 'freezetime',
    planted: 'C4 planted on {{site}}',
    defused: 'C4 defused',
    exploded: 'C4 exploded',
    roundOver: 'round decided',
    replayCutShort:
      'This match was imported before the replay ran to the end of the round: it stops at the last kill. Reprocessing brings the post-round back.',
    defusingKit: '{{name}} defusing (kit, 5 s)',
    defusingNoKit: '{{name}} defusing (no kit, 10 s)',
    c4Reference: 'reference timer',
    c4ReferenceHint:
      'This match had no explosion to measure the C4 timer; the value is the 41 s reference measured on other demos (40 s mp_c4timer + ~1 s until the explosion).',
    world: 'world',
    killfeedSeek: 'Jump to this moment',
    blind: 'blind attacker',
    flashAssist: 'flash assist',
    noscope: 'noscope',
    thruSmoke: 'through smoke',
    wallbang: 'wallbang',
    headshot: 'headshot',
    blindShort: 'blind',
    kdaTitle: 'kills / deaths / assists in the match, up to this moment',
    armor: 'kevlar ({{n}})',
    armorHelmet: 'kevlar and helmet ({{n}})',
    kit: 'defuse kit',
    c4Carrier: 'carrying the C4',
    c4Dropped: 'C4 on the ground (approximate position)',
  },
  verdict: {
    summaryTitle: 'What this match says',
    focusUser: 'About you',
    focusPoi: 'About your players of interest',
    focusMatch: 'About the whole match',
    focusMatchHint: 'Set your SteamID in Settings so the summary talks about you.',
    historyPending:
      '{{name}}: {{have}} of {{required}} previous matches in the library. Until then, the baseline is the match itself.',
    presencePending:
      '{{name}}: played {{played}} of {{total}} rounds. Too small a sample for the app to weigh in — and too small to serve as a yardstick for the others.',
    noFindings:
      'No strong deviation in this match: every metric stayed within what the available baselines expect.',
    allFindings: 'All findings',
    allFindingsHint:
      'Each row shows the baseline used. Neutral findings live here and never reach the summary.',
    gridHint:
      'Each cell is one player in one subject: the colour is the worst finding there. Click to open the full findings.',
    gridView: 'Grid',
    listView: 'List',
    gridNoFinding: 'no finding',
    family: {
      aim: 'Aim',
      duels: 'Duels',
      utility: 'Utility',
      economy: 'Economy',
      combat: 'Combat',
    },
    vsBaseline: 'vs. baseline',
    evidence: 'Show in replay',
    player: 'Player',
    sample: 'sample: {{n}}',
    severity: {
      critical: 'Critical',
      warning: 'Warning',
      positive: 'Strength',
      neutral: 'As expected',
    },
    confidence: {
      high: 'solid sample',
      medium: 'medium sample',
      low: 'small sample',
    },
    ruleName: {
      aim: {
        preaim: 'Crosshair placement',
        pitch_bias: 'Vertical aim bias',
        firstshot: 'First-shot accuracy',
        accuracy: 'Accuracy',
        counter_strafe: 'Counter-strafing',
      },
      duels: {
        entry_success: 'Opening duels',
        kast: 'KAST',
        trade_attempt_rate: 'Going for the trade',
        traded_death_rate: 'Traded deaths',
      },
      utility: {
        flash_net: 'Net flash value',
        unused_on_death: 'Utility unused on death',
        nade_damage: 'Damage per grenade',
      },
      economy: {
        dmg_per_1000: 'Damage per $1000',
        left_on_table: 'Money left on full buys',
        force_damage: 'Damage on force rounds',
      },
      combat: { adr: 'ADR' },
    },
    ref: {
      pitchBias: {
        label: 'measurement noise',
        rationale:
          'On confirmed headshots the method is off by about 1.1° median (calibration, ADR 0005). A bias above {{value}} is not explained by the measurement: it is the aim.',
      },
      coinFlip: {
        label: 'even duel',
        rationale:
          'An even opening duel is a coin flip. Below {{value}}, entries leave the team a player down more often than a player up.',
      },
      flashZero: {
        label: 'net zero',
        rationale:
          'Below {{value}}, the flashes blinded the own team (double-weighted) more than the enemy. It is a boundary by definition, not an average.',
      },
    },
    ev: {
      aimError: 'Round {{round}} · {{deg}}° off',
      pitch: 'Round {{round}} · {{deg}}° vertically',
      entryDeath: 'Round {{round}} · died on entry',
      untraded: 'Round {{round}} · death not traded',
      teamFlash: 'Round {{round}} · blinded a teammate for {{seconds}} s',
    },
    rules: {
      aim: {
        preaim: {
          bad: {
            title: 'Crosshair placement below expectation',
            body: '{{name}} had a median pre-aim of {{value}} over {{n}} duels: the crosshair was far from where the enemy appeared. It loses the duel before the shot.',
          },
          good: {
            title: 'Sharp crosshair placement',
            body: '{{name}} had a median pre-aim of {{value}} over {{n}} duels: the crosshair was already where the enemy appeared.',
          },
          neutral: {
            title: 'Crosshair placement as expected',
            body: 'Median pre-aim of {{value}} over {{n}} duels.',
          },
        },
        pitch_bias: {
          low: {
            title: 'Crosshair consistently low',
            body: "Before the shot, {{name}}'s crosshair sat at {{value}} relative to the head, median over {{n}} duels. A constant bias is not bad luck, it is a habit — and the most trainable error there is: raise the crosshair to head height.",
          },
          high: {
            title: 'Crosshair consistently high',
            body: "Before the shot, {{name}}'s crosshair sat at {{value}} relative to the head, median over {{n}} duels. A constant bias is not bad luck, it is a habit: lower the crosshair to head height.",
          },
          good: {
            title: 'Crosshair at head height',
            body: 'Vertical bias of {{value}} over {{n}} duels: within measurement noise.',
          },
          neutral: {
            title: 'Small vertical bias',
            body: 'Vertical bias of {{value}} over {{n}} duels.',
          },
        },
        firstshot: {
          bad: {
            title: 'First-shot accuracy below expectation',
            body: "At the moment of the shot, {{name}}'s median error was {{value}} over {{n}} duels. Unlike pre-aim, the crosshair already had time to correct here.",
          },
          good: {
            title: 'First-shot accuracy above expectation',
            body: "At the moment of the shot, {{name}}'s median error was {{value}} over {{n}} duels.",
          },
          neutral: {
            title: 'First-shot accuracy as expected',
            body: 'Median error of {{value}} at the shot, over {{n}} duels.',
          },
        },
        accuracy: {
          bad: {
            title: 'Accuracy below par',
            body: '{{name}} landed {{value}} of {{n}} shots. This is not crosshair placement: the aim was already there and the bullet did not arrive — uncontrolled spray, shooting on the move, or the wrong range for the weapon.',
          },
          good: {
            title: 'High accuracy',
            body: '{{name}} landed {{value}} of {{n}} shots.',
          },
          neutral: {
            title: 'Accuracy as expected',
            body: '{{value}} of {{n}} shots landed.',
          },
        },
        counter_strafe: {
          bad: {
            title: 'Shooting while moving',
            body: 'Only {{value}} of {{name}}\'s {{n}} shots were fired slow enough for the bullet to go where the crosshair points. In CS2 a shot is only accurate below 34% of the weapon\'s top speed — that is what counter-strafing reaches in one or two frames.',
          },
          good: {
            title: 'Consistent counter-strafing',
            body: '{{value}} of {{n}} shots were fired within the weapon\'s accuracy threshold.',
          },
          neutral: {
            title: 'Counter-strafing as expected',
            body: '{{value}} of {{n}} shots were fired within the weapon\'s accuracy threshold.',
          },
        },
      },
      duels: {
        kast: {
          bad: {
            title: 'Low KAST',
            body: '{{name}} contributed in {{value}} of {{n}} rounds (kill, assist, survived or traded). Low KAST with a good K/D usually means playing apart from the team.',
          },
          good: {
            title: 'High KAST',
            body: '{{name}} contributed in {{value}} of {{n}} rounds.',
          },
          neutral: {
            title: 'KAST as expected',
            body: 'Contributed in {{value}} of {{n}} rounds.',
          },
        },
        trade_attempt_rate: {
          bad: {
            title: 'Far from the trade',
            body: 'Of the {{n}} times a teammate died while {{name}} was alive, they hit the killer in {{value}}. That is positioning, not aim: playing away from the team means never getting there in time.',
          },
          good: {
            title: 'Close to the trade',
            body: 'Of the {{n}} times a teammate died, {{name}} went after the killer in {{value}}.',
          },
          neutral: {
            title: 'Trading as expected',
            body: 'Went after the killer in {{value}} of {{n}} chances.',
          },
        },
        entry_success: {
          bad: {
            title: 'Losing opening duels',
            body: '{{name}} won {{value}} of {{n}} entry attempts. Every lost entry leaves the team 4 against 5.',
          },
          good: {
            title: 'Opening rounds with an advantage',
            body: '{{name}} won {{value}} of {{n}} opening duels: the team starts more rounds 5 against 4.',
          },
          neutral: {
            title: 'Balanced opening duels',
            body: '{{value}} won over {{n}} entry attempts.',
          },
        },
        traded_death_rate: {
          bad: {
            title: 'Deaths without a trade',
            body: "Only {{value}} of {{name}}'s {{n}} deaths were traded. It is a TEAM metric: either {{name}} plays far from teammates, or the team is not positioned to trade.",
          },
          good: {
            title: 'Deaths getting traded',
            body: "{{value}} of {{name}}'s {{n}} deaths were traded: the team plays close and punishes whoever opens.",
          },
          neutral: {
            title: 'Trades as expected',
            body: '{{value}} of {{n}} deaths were traded.',
          },
        },
      },
      utility: {
        flash_net: {
          bad: {
            title: 'Flashes hurting the own team',
            body: 'Net value of {{value}} over {{n}} flashes by {{name}}: time blinding teammates, double-weighted, exceeded time blinding enemies.',
          },
          good: {
            title: 'Flashes paying off',
            body: 'Net value of {{value}} over {{n}} flashes by {{name}}: far more blindness on the enemy than on the own team.',
          },
          neutral: {
            title: 'Neutral flashes',
            body: 'Net value of {{value}} over {{n}} flashes.',
          },
        },
        unused_on_death: {
          bad: {
            title: 'Dying with utility in hand',
            body: '{{name}} died carrying {{value}} of utility on average, over {{n}} deaths. That is money turned into nothing — there is not always time, but as a habit it is a grenade that never leaves the hand.',
          },
          good: {
            title: 'Uses utility before dying',
            body: '{{name}} died with only {{value}} of utility in hand on average, over {{n}} deaths.',
          },
          neutral: {
            title: 'Utility unused on death',
            body: '{{name}} died carrying {{value}} of utility on average, over {{n}} deaths.',
          },
        },
        nade_damage: {
          bad: {
            title: 'HE and molotovs paying little',
            body: '{{name}} dealt {{value}} per grenade over {{n}} HE and molotovs: the grenade was thrown but hit no one.',
          },
          good: {
            title: 'HE and molotovs well thrown',
            body: '{{name}} dealt {{value}} per grenade over {{n}} HE and molotovs.',
          },
          neutral: {
            title: 'Damage per grenade as expected',
            body: '{{name}} dealt {{value}} per grenade over {{n}} HE and molotovs.',
          },
        },
      },
      economy: {
        dmg_per_1000: {
          bad: {
            title: 'Little damage for the money spent',
            body: '{{name}} dealt {{value}} damage per $1000 spent, over {{n}} rounds.',
          },
          good: {
            title: 'Money well converted into damage',
            body: '{{name}} dealt {{value}} damage per $1000 spent, over {{n}} rounds.',
          },
          neutral: {
            title: 'Damage per money as expected',
            body: '{{value}} damage per $1000, over {{n}} rounds.',
          },
        },
        left_on_table: {
          bad: {
            title: 'Money sitting idle on full buys',
            body: '{{name}} entered with {{value}} unspent on average, over {{n}} team full-buy rounds. On eco, saving is the plan; on a full buy, it is a purchase that never happened.',
          },
          good: {
            title: 'Spends when the team buys',
            body: '{{name}} left only {{value}} unspent on average, over {{n}} team full-buy rounds.',
          },
          neutral: {
            title: 'Money left on full buys',
            body: '{{name}} left {{value}} unspent on average, over {{n}} team full-buy rounds.',
          },
        },
        force_damage: {
          bad: {
            title: 'Force rounds paying little',
            body: '{{name}} dealt {{value}} damage per round over {{n}} team force rounds. Forcing is a team call; the damage is what each player can be asked for.',
          },
          good: {
            title: 'Converts force rounds',
            body: '{{name}} dealt {{value}} damage per round over {{n}} team force rounds.',
          },
          neutral: {
            title: 'Force damage as expected',
            body: '{{name}} dealt {{value}} damage per round over {{n}} team force rounds.',
          },
        },
      },
      combat: {
        adr: {
          bad: {
            title: 'Low ADR',
            body: '{{name}} dealt {{value}} damage per round over {{n}} rounds.',
          },
          good: {
            title: 'High ADR',
            body: '{{name}} dealt {{value}} damage per round over {{n}} rounds.',
          },
          neutral: {
            title: 'ADR as expected',
            body: '{{value}} damage per round over {{n}} rounds.',
          },
        },
      },
    },
  },
  glossary: {

    entryKill: 'Entry Kill',
    entryKill_desc: 'The first kill of the round for your side, usually opening the site.',
    trade: 'Trade',
    trade_desc:
      'Killing whoever just killed your teammate, within the configured time window.',
    clutch: 'Clutch',
    clutch_desc: 'Winning the round alone against one or more living enemies.',
    eco: 'Eco',
    eco_desc: 'A round where the team saves, buying little or nothing.',
    forceBuy: 'Force Buy',
    forceBuy_desc: 'A round where the team spends nearly everything without a full buy.',
    fullBuy: 'Full Buy',
    fullBuy_desc: 'A round with full weapons and utility.',
    popFlash: 'Pop Flash',
    popFlash_desc: 'A flash that detonates almost immediately, leaving no reaction time.',
    preAim: 'Pre-aim',
    preAim_desc:
      'Where the crosshair sat BEFORE the duel started. This is crosshair placement.',
    spray: 'Spray',
    spray_desc: 'A sustained burst, where recoil control decides the outcome.',
    kast: 'KAST',
    kast_desc:
      'Percentage of rounds where the player got a Kill, Assist, Survived or was Traded.',
    adr: 'ADR',
    adr_desc: 'Average damage per round.',
    knifeRound: 'Round Faca',
    knifeRound_desc:
      'The opening knife round on Gamers Club and FACEIT that decides sides. Excluded from stats.',
  },
  errors: {
    generic: 'Something went wrong',
    povDemo: 'This looks like a POV demo (recorded by a player).',
    povDemoHint:
      'The analyser needs a GOTV demo recorded by the server, because a POV only records what that one player could see.',
    duplicateDemo: 'This demo has already been imported.',
    unsupportedMap: 'Map has no vendored radar.',
    transport: 'Could not reach the local process.',
  },
};
