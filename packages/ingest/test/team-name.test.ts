import { describe, expect, it } from 'vitest';
import {
  cleanPlayerName,
  cleanTeamName,
  majorityName,
  normalizeForMatch,
  pickTeamName,
  teamNamesFromFileName,
} from '../src/pass-a.js';
import { detectPov, detectSource } from '../src/demo-probe.js';

describe('cleanPlayerName', () => {
  it('remove nivel, selo e simbolo de assinatura', () => {
    expect(cleanPlayerName('⓫ ✓ ★ TTV@FenixBladeCS')).toBe('TTV@FenixBladeCS');
    expect(cleanPlayerName('⓪ ✓ ★ Contabilidade')).toBe('Contabilidade');
    expect(cleanPlayerName('⓮ ✓ ☆ Gold 019')).toBe('Gold 019');
    expect(cleanPlayerName('⓯ Donk666')).toBe('Donk666');
  });

  it('deixa nome limpo em paz', () => {
    expect(cleanPlayerName('s1mple')).toBe('s1mple');
  });

  it('nao devolve string vazia quando o nome so tem simbolos', () => {
    expect(cleanPlayerName('★★★')).toBe('★★★');
  });

  it('preserva nick que comeca com digito de verdade', () => {

    expect(cleanPlayerName('1nfern0')).toBe('1nfern0');
    expect(cleanPlayerName('⓫ ✓ 1nfern0')).toBe('1nfern0');
  });
});

describe('teamNamesFromFileName', () => {
  it('extrai os dois times do padrao de nome da Gamers Club', () => {
    const name =
      '2026-09-09__2258__1__27829555__de_overpass__team-contabilidade__vs__team-ttvfenixbladecs.dem';
    expect(teamNamesFromFileName(name)).toEqual(['contabilidade', 'ttvfenixbladecs']);
  });

  it('devolve null quando o nome nao segue o padrao', () => {
    expect(teamNamesFromFileName('minha-demo.dem')).toBeNull();
    expect(teamNamesFromFileName('match730_003xyz.dem')).toBeNull();
  });
});

describe('pickTeamName', () => {
  const slugs: [string, string] = ['contabilidade', 'ttvfenixbladecs'];

  it('escolhe o slug que casa com um jogador daquele time', () => {
    const ctTeam = ['⓪ ✓ ★ Contabilidade', '⓫ ✓ ☆ nrv-'];
    const tTeam = ['⓫ ✓ ★ TTV@FenixBladeCS', '⓯ Donk666'];

    expect(pickTeamName(slugs, ctTeam)).toBe('contabilidade');
    expect(pickTeamName(slugs, tTeam)).toBe('ttvfenixbladecs');
  });

  it('ignora acentos, simbolos e caixa ao comparar', () => {
    expect(pickTeamName(['joao', 'outro'], ['⓫ João'])).toBe('joao');
  });

  it('devolve null quando nenhum slug casa — melhor generico que errado', () => {
    expect(pickTeamName(slugs, ['s1mple', 'ZywOo'])).toBeNull();
  });

  it('ignora slug curto demais para ser sinal', () => {
    expect(pickTeamName(['ab', 'cd'], ['ab', 'cd'])).toBeNull();
  });
});

describe('normalizeForMatch', () => {
  it('reduz a letras e digitos minusculos', () => {
    expect(normalizeForMatch('TTV@FenixBladeCS')).toBe('ttvfenixbladecs');
    expect(normalizeForMatch('Contabilidade')).toBe('contabilidade');
    expect(normalizeForMatch('João-123')).toBe('joao123');
  });
});

describe('detectSource', () => {
  it('reconhece a Gamers Club pelo nome do servidor', () => {
    expect(detectSource('Registre-se e jogue @ gamersclub.com.br')).toBe('gamers_club');
  });

  it('reconhece FACEIT', () => {
    expect(detectSource('FACEIT.com register to play here')).toBe('faceit');
  });

  it('cai em unknown quando nao reconhece', () => {
    expect(detectSource('meu servidor caseiro')).toBe('unknown');
  });
});

describe('detectPov', () => {
  it('aceita a gravacao de servidor com 10 jogadores', () => {
    expect(detectPov('SourceTV Demo', 10)).toBeNull();
    expect(detectPov('GOTV Demo', 10)).toBeNull();
  });

  it('recusa quando client_name traz o nome de um jogador', () => {
    const reason = detectPov('jorgeeee', 10);
    expect(reason).toMatch(/nao uma gravacao de servidor/i);
    expect(reason).toContain('jorgeeee');
  });

  it('recusa GOTV com menos de 10 jogadores humanos', () => {
    expect(detectPov('SourceTV Demo', 9)).toMatch(/9 jogadores humanos/);
    expect(detectPov('SourceTV Demo', 1)).toMatch(/1 jogadores humanos/);
    expect(detectPov('SourceTV Demo', 0)).toMatch(/0 jogadores humanos/);
  });

  it('aceita mais de 10 (coach, substituto conectado)', () => {
    expect(detectPov('SourceTV Demo', 12)).toBeNull();
  });

  it('nao se importa com caixa em client_name', () => {
    expect(detectPov('sourcetv demo', 10)).toBeNull();
    expect(detectPov('SOURCETV', 10)).toBeNull();
  });
});

describe('cleanTeamName', () => {
  it('tira o "Team " da frente, convencao da Gamers Club', () => {
    expect(cleanTeamName('Team psycho')).toBe('psycho');
    expect(cleanTeamName('Team TTV@FenixBladeCS')).toBe('TTV@FenixBladeCS');
  });

  it('nome de campeonato passa inteiro', () => {
    expect(cleanTeamName('MIBR')).toBe('MIBR');
    expect(cleanTeamName('FURIA')).toBe('FURIA');
  });

  it('lado nao e nome de time', () => {
    for (const generic of ['CT', 'TERRORIST', 'Counter-Terrorists', 'unassigned', '', '   ']) {
      expect(cleanTeamName(generic), generic).toBeNull();
    }
  });

  it('"Team" sozinho nao vira nome vazio', () => {
    expect(cleanTeamName('Team')).toBe('Team');
    expect(cleanTeamName('Team CT')).toBeNull();
  });

  it('espaco sobrando nao muda o nome', () => {
    expect(cleanTeamName('  Team   psycho  ')).toBe('psycho');
  });
});

describe('majorityName', () => {
  it('o nome que mais se repete entre os cinco', () => {
    expect(majorityName(['MIBR', 'MIBR', 'MIBR', 'MIBR', 'MIBR'])).toBe('MIBR');

    expect(majorityName(['FURIA', 'FURIA', 'FURIA', 'FURIA', 'outro'])).toBe('FURIA');
  });

  it('sem nome nenhum, nulo — e a UI cai para o nome do arquivo', () => {
    expect(majorityName([])).toBeNull();
  });
});
