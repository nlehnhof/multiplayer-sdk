import { describe, expect, it } from 'vitest';
import { RoomEngine } from './room-engine.js';
import type { PlayerInfo, RoomDefinition } from './types.js';

interface CounterState {
  count: number;
  players: string[];
}

type CounterAction = { type: 'increment' } | { type: 'decrement' };

function counterDefinition(maxPlayers?: number): RoomDefinition<CounterState, CounterAction> {
  return {
    options: { maxPlayers },
    createState: () => ({ count: 0, players: [] }),
    onJoin: (state, player) => ({ ...state, players: [...state.players, player.id] }),
    onLeave: (state, player) => ({
      ...state,
      players: state.players.filter((id) => id !== player.id),
    }),
    onAction: (state, action) => {
      if (action.type === 'increment') return { ...state, count: state.count + 1 };
      if (action.type === 'decrement') return { ...state, count: state.count - 1 };
      return state;
    },
  };
}

function player(id: string): PlayerInfo {
  return { id, connectedAt: Date.now() };
}

describe('RoomEngine', () => {
  it('initializes state from the definition', () => {
    const engine = new RoomEngine(counterDefinition());
    expect(engine.currentState).toEqual({ count: 0, players: [] });
    expect(engine.presence).toEqual([]);
  });

  it('tracks players through join and leave', () => {
    const engine = new RoomEngine(counterDefinition());
    engine.join(player('p1'));
    engine.join(player('p2'));
    expect(engine.currentState.players).toEqual(['p1', 'p2']);
    expect(engine.presence.map((p) => p.id)).toEqual(['p1', 'p2']);

    engine.leave('p1');
    expect(engine.currentState.players).toEqual(['p2']);
    expect(engine.presence.map((p) => p.id)).toEqual(['p2']);
  });

  it('leaving an unknown player is a no-op', () => {
    const engine = new RoomEngine(counterDefinition());
    engine.join(player('p1'));
    const before = engine.currentState;
    engine.leave('ghost');
    expect(engine.currentState).toBe(before);
  });

  it('applies actions from known players', () => {
    const engine = new RoomEngine(counterDefinition());
    engine.join(player('p1'));
    engine.action('p1', { type: 'increment' });
    engine.action('p1', { type: 'increment' });
    engine.action('p1', { type: 'decrement' });
    expect(engine.currentState.count).toBe(1);
  });

  it('rejects actions from players who never joined', () => {
    const engine = new RoomEngine(counterDefinition());
    expect(() => engine.action('ghost', { type: 'increment' })).toThrow(/unknown player/i);
  });

  it('enforces maxPlayers on join', () => {
    const engine = new RoomEngine(counterDefinition(1));
    engine.join(player('p1'));
    expect(() => engine.join(player('p2'))).toThrow(/room is full/i);
  });
});
