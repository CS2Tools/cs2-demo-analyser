import { describe, expect, it } from 'vitest';
import { mergeChat } from '../src/chat.js';

const playerChat = (tick: number, text: string, teamonly: boolean, steamId = '1') => ({
  event_name: 'player_chat',
  tick,
  text,
  teamonly,
  user_steamid: steamId,
  user_name: 'ana',
});

const chatMessage = (tick: number, text: string, steamId = '1') => ({
  event_name: 'chat_message',
  tick,
  chat_message: text,
  user_steamid: steamId,
  user_name: 'ana',
});

describe('mergeChat', () => {
  it('le o texto de cada evento no campo que ele usa', () => {
    const out = mergeChat([playerChat(10, 'bora', true), chatMessage(20, 'gg')]);
    expect(out.map((m) => m.text)).toEqual(['bora', 'gg']);
  });

  it('o escopo so existe quando o evento tem: nunca e chutado', () => {
    const out = mergeChat([playerChat(10, 'rush B', true), playerChat(20, 'gg', false), chatMessage(30, 'gl')]);
    expect(out.map((m) => m.isTeamOnly)).toEqual([true, false, null]);
  });

  it('a mesma fala pelos dois eventos vira UMA linha, com o escopo', () => {
    const out = mergeChat([chatMessage(10, 'gg'), playerChat(10, 'gg', false)]);
    expect(out).toHaveLength(1);
    expect(out[0]!.isTeamOnly).toBe(false);
  });

  it('a ordem dos eventos nao muda o resultado', () => {
    const a = mergeChat([playerChat(10, 'gg', false), chatMessage(10, 'gg')]);
    const b = mergeChat([chatMessage(10, 'gg'), playerChat(10, 'gg', false)]);
    expect(a).toEqual(b);
  });

  it('mensagem vazia sai fora: e bind, nao conversa', () => {
    const out = mergeChat([playerChat(10, '', true), playerChat(20, '   ', true), playerChat(30, 'oi', true)]);
    expect(out.map((m) => m.text)).toEqual(['oi']);
  });

  it('sai em ordem de tick, nao na ordem em que os eventos chegaram', () => {
    const out = mergeChat([playerChat(30, 'c', true), playerChat(10, 'a', true), chatMessage(20, 'b')]);
    expect(out.map((m) => m.text)).toEqual(['a', 'b', 'c']);
  });

  it('mesmo texto de pessoas diferentes no mesmo tick nao vira uma so', () => {
    const out = mergeChat([playerChat(10, 'gg', false, '1'), playerChat(10, 'gg', false, '2')]);
    expect(out).toHaveLength(2);
  });

  it('evento que nao e chat e ignorado', () => {
    expect(mergeChat([{ event_name: 'player_death', tick: 1 }])).toEqual([]);
  });
});
