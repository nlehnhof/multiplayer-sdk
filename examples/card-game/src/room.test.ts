import { describe, expect, it } from 'vitest';
import { RoomEngine } from '@multiplayer-agent-sdk/core';
import type { PlayerInfo } from '@multiplayer-agent-sdk/core';
import { roomDefinition, type Card, type WarState } from './room.js';

function player(id: string): PlayerInfo {
  return { id, connectedAt: Date.now() };
}

// Round-resolution and rejection tests build a WarState fixture directly and
// call roomDefinition.onAction/onLeave against it, rather than relying on the
// real Fisher-Yates shuffle (which uses Math.random) to land on specific
// hands. Dealing itself is exercised through RoomEngine + real join/shuffle,
// since that behavior (52 cards, 26/26 split, no duplicates) holds regardless
// of shuffle order.
function makeState(overrides: Partial<WarState> = {}): WarState {
  return {
    hands: {},
    table: {},
    roundWinner: null,
    wins: {},
    status: 'playing',
    overallWinner: null,
    roundsResolved: 0,
    ...overrides,
  };
}

describe('War room definition — dealing', () => {
  it('deals 52 unique cards split 26/26 when the second player joins', () => {
    const engine = new RoomEngine(roomDefinition);
    engine.join(player('p1'));
    expect(engine.currentState.status).toBe('waiting');
    expect(engine.currentState.hands.p1).toEqual([]);
    expect(engine.currentState.wins.p1).toBe(0);

    engine.join(player('p2'));
    const state = engine.currentState;
    expect(state.status).toBe('playing');
    expect(state.hands.p1).toHaveLength(26);
    expect(state.hands.p2).toHaveLength(26);

    const all = [...state.hands.p1!, ...state.hands.p2!];
    expect(all).toHaveLength(52);
    const keys = new Set(all.map((c) => `${c.rank}-${c.suit}`));
    expect(keys.size).toBe(52);
  });

  it('rejects a third join (maxPlayers: 2)', () => {
    const engine = new RoomEngine(roomDefinition);
    engine.join(player('p1'));
    engine.join(player('p2'));
    expect(() => engine.join(player('p3'))).toThrow(/full/i);
  });
});

describe('War room definition — flipping', () => {
  it('rejects a double flip from the same player before the other has flipped', () => {
    const state = makeState({
      hands: { p1: [{ rank: 10, suit: 'S' }], p2: [{ rank: 5, suit: 'H' }] },
      wins: { p1: 0, p2: 0 },
    });
    const afterFirstFlip = roomDefinition.onAction(state, { type: 'flip' }, player('p1'));
    expect(afterFirstFlip.table.p1).toBeDefined();
    expect(() => roomDefinition.onAction(afterFirstFlip, { type: 'flip' }, player('p1'))).toThrow(
      /already flipped/i
    );
  });

  it('rejects a flip once status is finished', () => {
    const state = makeState({ status: 'finished', overallWinner: 'p1' });
    expect(() => roomDefinition.onAction(state, { type: 'flip' }, player('p2'))).toThrow(/not active/i);
  });

  it('resolves a round: higher rank takes both cards and increments wins', () => {
    const initial = makeState({
      hands: { p1: [{ rank: 10, suit: 'S' }], p2: [{ rank: 5, suit: 'H' }] },
      wins: { p1: 0, p2: 0 },
    });
    const afterP1 = roomDefinition.onAction(initial, { type: 'flip' }, player('p1'));
    const final = roomDefinition.onAction(afterP1, { type: 'flip' }, player('p2'));

    expect(final.table).toEqual({});
    expect(final.roundsResolved).toBe(1);
    expect(final.roundWinner).toBe('p1');
    expect(final.wins.p1).toBe(1);
    expect(final.wins.p2).toBe(0);
    // p1 takes both cards onto the bottom of their (now empty) hand.
    const p1Ranks = final.hands.p1!.map((c: Card) => c.rank).sort((a, b) => a - b);
    expect(p1Ranks).toEqual([5, 10]);
    expect(final.hands.p2).toEqual([]);
    // p2's hand is now empty -> game over, p1 wins overall.
    expect(final.status).toBe('finished');
    expect(final.overallWinner).toBe('p1');
  });

  it('resolves a tied round by discarding both cards', () => {
    const initial = makeState({
      hands: { p1: [{ rank: 7, suit: 'S' }], p2: [{ rank: 7, suit: 'H' }] },
      wins: { p1: 0, p2: 0 },
    });
    const afterP1 = roomDefinition.onAction(initial, { type: 'flip' }, player('p1'));
    const final = roomDefinition.onAction(afterP1, { type: 'flip' }, player('p2'));

    expect(final.table).toEqual({});
    expect(final.roundWinner).toBeNull();
    expect(final.wins.p1).toBe(0);
    expect(final.wins.p2).toBe(0);
    expect(final.hands.p1).toEqual([]);
    expect(final.hands.p2).toEqual([]);
    // Both hands emptied simultaneously by the tie.
    expect(final.status).toBe('finished');
    expect(final.overallWinner).toBeNull();
  });

  it('plays a full game to completion via RoomEngine without error', () => {
    const engine = new RoomEngine(roomDefinition);
    engine.join(player('p1'));
    engine.join(player('p2'));

    let state = engine.currentState;
    let guard = 0;
    // 200 was too tight and made this test flaky: a 2000-game simulation of
    // this exact reducer topped out at 422 rounds (see play.mjs), so give a
    // comfortable margin above that observed worst case.
    while (state.status === 'playing' && guard < 2000) {
      state = engine.action('p1', { type: 'flip' });
      if (state.status !== 'playing') break;
      state = engine.action('p2', { type: 'flip' });
      guard++;
    }

    expect(state.status).toBe('finished');
    expect(() => engine.action('p1', { type: 'flip' })).toThrow(/not active/i);
  });
});

describe('War room definition — leaving', () => {
  it('forfeits the game to the remaining player when someone leaves mid-game', () => {
    const state = makeState({
      hands: { p1: [{ rank: 10, suit: 'S' }], p2: [{ rank: 5, suit: 'H' }] },
      wins: { p1: 0, p2: 0 },
    });
    const final = roomDefinition.onLeave(state, player('p1'));
    expect(final.status).toBe('finished');
    expect(final.overallWinner).toBe('p2');
  });

  it('does not forfeit if the game has not started (status: waiting)', () => {
    const state = makeState({ status: 'waiting', hands: { p1: [] } });
    const final = roomDefinition.onLeave(state, player('p1'));
    expect(final.status).toBe('waiting');
    expect(final.overallWinner).toBeNull();
  });
});
