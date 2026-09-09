import { describe, expect, it } from 'vitest';
import { RoomEngine } from '@multiplayer-agent-sdk/core';
import type { PlayerInfo } from '@multiplayer-agent-sdk/core';
import { ticTacToeRoom } from './room.js';

function player(id: string): PlayerInfo {
  return { id, connectedAt: Date.now() };
}

function newGame() {
  const engine = new RoomEngine(ticTacToeRoom);
  engine.join(player('alice'));
  engine.join(player('bob'));
  return engine;
}

describe('ticTacToeRoom', () => {
  it('assigns X to the first joiner and O to the second', () => {
    const engine = newGame();
    expect(engine.currentState.symbols).toEqual({ alice: 'X', bob: 'O' });
    expect(engine.currentState.turn).toBe('X');
    expect(engine.currentState.status).toBe('playing');
  });

  it('rejects a 3rd join (maxPlayers enforced by RoomEngine)', () => {
    const engine = newGame();
    expect(() => engine.join(player('carol'))).toThrow(/room is full/i);
  });

  it('enforces turn order', () => {
    const engine = newGame();
    // It's X's (alice's) turn; bob (O) tries to move first.
    expect(() => engine.action('bob', { type: 'mark', cell: 0 })).toThrow(/not.*turn/i);

    engine.action('alice', { type: 'mark', cell: 0 });
    // Now it's bob's turn; alice tries again.
    expect(() => engine.action('alice', { type: 'mark', cell: 1 })).toThrow(/not.*turn/i);
  });

  it('rejects a move on an already-occupied cell', () => {
    const engine = newGame();
    engine.action('alice', { type: 'mark', cell: 4 });
    engine.action('bob', { type: 'mark', cell: 0 });
    expect(() => engine.action('alice', { type: 'mark', cell: 4 })).toThrow(/occupied/i);
  });

  it('rejects an out-of-range cell', () => {
    const engine = newGame();
    expect(() => engine.action('alice', { type: 'mark', cell: 9 })).toThrow(/invalid cell/i);
    expect(() => engine.action('alice', { type: 'mark', cell: -1 })).toThrow(/invalid cell/i);
  });

  it('detects a row win', () => {
    const engine = newGame();
    // alice (X): 0, 1, 2 | bob (O): 3, 4
    engine.action('alice', { type: 'mark', cell: 0 });
    engine.action('bob', { type: 'mark', cell: 3 });
    engine.action('alice', { type: 'mark', cell: 1 });
    engine.action('bob', { type: 'mark', cell: 4 });
    engine.action('alice', { type: 'mark', cell: 2 });

    expect(engine.currentState.status).toBe('won');
    expect(engine.currentState.winner).toBe('alice');
    expect(engine.currentState.board).toEqual(['X', 'X', 'X', 'O', 'O', null, null, null, null]);
  });

  it('detects a column win', () => {
    const engine = newGame();
    // alice (X): 0, 3, 6 | bob (O): 1, 2
    engine.action('alice', { type: 'mark', cell: 0 });
    engine.action('bob', { type: 'mark', cell: 1 });
    engine.action('alice', { type: 'mark', cell: 3 });
    engine.action('bob', { type: 'mark', cell: 2 });
    engine.action('alice', { type: 'mark', cell: 6 });

    expect(engine.currentState.status).toBe('won');
    expect(engine.currentState.winner).toBe('alice');
  });

  it('detects a diagonal win', () => {
    const engine = newGame();
    // alice (X): 0, 4, 8 | bob (O): 1, 2
    engine.action('alice', { type: 'mark', cell: 0 });
    engine.action('bob', { type: 'mark', cell: 1 });
    engine.action('alice', { type: 'mark', cell: 4 });
    engine.action('bob', { type: 'mark', cell: 2 });
    engine.action('alice', { type: 'mark', cell: 8 });

    expect(engine.currentState.status).toBe('won');
    expect(engine.currentState.winner).toBe('alice');
  });

  it('detects a draw when the board fills with no winner', () => {
    const engine = newGame();
    // Board (X=alice, O=bob):
    // X O X
    // X O O
    // O X X
    const moves: Array<[string, number]> = [
      ['alice', 0],
      ['bob', 1],
      ['alice', 2],
      ['bob', 4],
      ['alice', 3],
      ['bob', 5],
      ['alice', 7],
      ['bob', 6],
      ['alice', 8],
    ];
    for (const [id, cell] of moves) {
      engine.action(id, { type: 'mark', cell });
    }

    expect(engine.currentState.status).toBe('draw');
    expect(engine.currentState.winner).toBeNull();
    expect(engine.currentState.board.every((mark) => mark !== null)).toBe(true);
  });

  it('rejects further moves once the game is over', () => {
    const engine = newGame();
    engine.action('alice', { type: 'mark', cell: 0 });
    engine.action('bob', { type: 'mark', cell: 3 });
    engine.action('alice', { type: 'mark', cell: 1 });
    engine.action('bob', { type: 'mark', cell: 4 });
    engine.action('alice', { type: 'mark', cell: 2 }); // alice wins

    expect(() => engine.action('bob', { type: 'mark', cell: 5 })).toThrow(/already over/i);
  });

  it('forfeits to the other player when someone leaves mid-game', () => {
    const engine = newGame();
    engine.action('alice', { type: 'mark', cell: 0 });

    engine.leave('bob');

    expect(engine.currentState.status).toBe('won');
    expect(engine.currentState.winner).toBe('alice');
  });

  it('does not overwrite a completed game result on leave', () => {
    const engine = newGame();
    engine.action('alice', { type: 'mark', cell: 0 });
    engine.action('bob', { type: 'mark', cell: 3 });
    engine.action('alice', { type: 'mark', cell: 1 });
    engine.action('bob', { type: 'mark', cell: 4 });
    engine.action('alice', { type: 'mark', cell: 2 }); // alice wins

    engine.leave('alice');

    expect(engine.currentState.status).toBe('won');
    expect(engine.currentState.winner).toBe('alice');
  });
});
