type Row = Record<string, unknown>;

export interface ChatMessage {
  tick: number;
  steamId: string | null;
  name: string | null;
  text: string;

  isTeamOnly: boolean | null;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function mergeChat(rows: readonly Row[]): ChatMessage[] {
  const byKey = new Map<string, ChatMessage>();

  for (const row of rows) {
    const event = String(row['event_name'] ?? '');
    const isPlayerChat = event === 'player_chat';
    if (!isPlayerChat && event !== 'chat_message') continue;

    const body = text(isPlayerChat ? row['text'] : row['chat_message']);
    if (body === '') continue;

    const steamId = row['user_steamid'] === undefined || row['user_steamid'] === null
      ? null
      : String(row['user_steamid']);
    const message: ChatMessage = {
      tick: Number(row['tick'] ?? 0),
      steamId,
      name: typeof row['user_name'] === 'string' ? row['user_name'] : null,
      text: body,
      isTeamOnly: isPlayerChat ? row['teamonly'] === true : null,
    };

    const key = `${message.tick}|${steamId ?? ''}|${body}`;
    const existing = byKey.get(key);
    if (existing === undefined || (existing.isTeamOnly === null && message.isTeamOnly !== null)) {
      byKey.set(key, message);
    }
  }

  return [...byKey.values()].sort((a, b) => a.tick - b.tick);
}
