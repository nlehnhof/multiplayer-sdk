import { describe, expect, it } from 'vitest';
import { getRoomDefinitionGuide, listAdapters } from './index.js';

describe('listAdapters', () => {
  it('lists the partykit adapter as available', () => {
    const adapters = listAdapters();
    const partykit = adapters.find((a) => a.name === 'partykit');
    expect(partykit).toEqual({
      name: 'partykit',
      package: '@multiplayer-agent-sdk/adapter-partykit',
      status: 'available',
    });
  });

  it('lists colyseus and supabase as planned', () => {
    const adapters = listAdapters();
    const byName = Object.fromEntries(adapters.map((a) => [a.name, a]));
    expect(byName.colyseus.status).toBe('planned');
    expect(byName.supabase.status).toBe('planned');
  });

  it('returns exactly three adapters', () => {
    expect(listAdapters()).toHaveLength(3);
  });
});

describe('getRoomDefinitionGuide', () => {
  it('documents the RoomDefinition contract', () => {
    const guide = getRoomDefinitionGuide();
    expect(guide).toContain('interface RoomDefinition<TState, TAction, TMeta = unknown>');
    expect(guide).toContain('createState(): TState');
    expect(guide).toContain('onJoin(state: TState, player: PlayerInfo<TMeta>): TState');
    expect(guide).toContain('onLeave(state: TState, player: PlayerInfo<TMeta>): TState');
    expect(guide).toContain('onAction(state: TState, action: TAction, player: PlayerInfo<TMeta>): TState');
  });

  it('documents PlayerInfo and RoomOptions', () => {
    const guide = getRoomDefinitionGuide();
    expect(guide).toContain('interface PlayerInfo<TMeta = unknown>');
    expect(guide).toContain('interface RoomOptions');
  });

  it('includes a complete counter room example', () => {
    const guide = getRoomDefinitionGuide();
    expect(guide).toContain('counterDefinition');
    expect(guide).toContain("type: 'increment'");
    expect(guide).toContain("type: 'decrement'");
  });

  it('points at the PartyKit adapter for wiring', () => {
    const guide = getRoomDefinitionGuide();
    expect(guide).toContain('createPartyKitServer');
    expect(guide).toContain('connectPartyKitClient');
    expect(guide).toContain('@multiplayer-agent-sdk/adapter-partykit');
  });
});
