import { describe, expect, it } from 'vitest';
import { RoomEngine } from '@multiplayer-agent-sdk/core';
import type { PlayerInfo } from '@multiplayer-agent-sdk/core';
import { roomDefinition } from './room.js';
import { questions } from './questions.js';

function player(id: string): PlayerInfo {
  return { id, connectedAt: Date.now() };
}

function newEngine() {
  return new RoomEngine(roomDefinition);
}

describe('trivia room', () => {
  it('adds joining players to players and initializes their score', () => {
    const engine = newEngine();
    engine.join(player('p1'));
    engine.join(player('p2'));
    expect(engine.currentState.players).toEqual(['p1', 'p2']);
    expect(engine.currentState.scores).toEqual({ p1: 0, p2: 0 });
  });

  it('stays in the answering phase until every player has answered', () => {
    const engine = newEngine();
    engine.join(player('p1'));
    engine.join(player('p2'));
    engine.action('p1', { type: 'answer', choiceIndex: questions[0].correctIndex });
    expect(engine.currentState.phase).toBe('answering');
    expect(engine.currentState.answers).toEqual({ p1: questions[0].correctIndex });
  });

  it('flips to reveal once everyone has answered, scoring only correct answers', () => {
    const engine = newEngine();
    engine.join(player('p1'));
    engine.join(player('p2'));
    const correct = questions[0].correctIndex;
    const wrong = ((correct + 1) % 4) as 0 | 1 | 2 | 3;

    engine.action('p1', { type: 'answer', choiceIndex: correct });
    engine.action('p2', { type: 'answer', choiceIndex: wrong });

    expect(engine.currentState.phase).toBe('reveal');
    expect(engine.currentState.scores).toEqual({ p1: 1, p2: 0 });
  });

  it('rejects a second answer from the same player for the same question', () => {
    const engine = newEngine();
    engine.join(player('p1'));
    engine.join(player('p2'));
    engine.action('p1', { type: 'answer', choiceIndex: 0 });
    expect(() => engine.action('p1', { type: 'answer', choiceIndex: 1 })).toThrow(
      /already answered/i
    );
  });

  it('rejects answer actions during the reveal phase', () => {
    const engine = newEngine();
    engine.join(player('p1'));
    engine.action('p1', { type: 'answer', choiceIndex: 0 });
    expect(engine.currentState.phase).toBe('reveal');
    expect(() => engine.action('p1', { type: 'answer', choiceIndex: 1 })).toThrow(
      /answering phase/i
    );
  });

  it('rejects "next" during the answering phase', () => {
    const engine = newEngine();
    engine.join(player('p1'));
    engine.join(player('p2'));
    engine.action('p1', { type: 'answer', choiceIndex: 0 });
    expect(engine.currentState.phase).toBe('answering');
    expect(() => engine.action('p1', { type: 'next' })).toThrow(/reveal phase/i);
  });

  it('"next" advances to the next question and resets answers', () => {
    const engine = newEngine();
    engine.join(player('p1'));
    engine.action('p1', { type: 'answer', choiceIndex: 0 });
    engine.action('p1', { type: 'next' });
    expect(engine.currentState.questionIndex).toBe(1);
    expect(engine.currentState.phase).toBe('answering');
    expect(engine.currentState.answers).toEqual({});
  });

  it('"next" on the last question sets phase to finished', () => {
    const engine = newEngine();
    engine.join(player('p1'));
    for (let i = 0; i < questions.length; i++) {
      engine.action('p1', { type: 'answer', choiceIndex: questions[i].correctIndex });
      engine.action('p1', { type: 'next' });
    }
    expect(engine.currentState.phase).toBe('finished');
    expect(engine.currentState.scores.p1).toBe(questions.length);
  });
});
