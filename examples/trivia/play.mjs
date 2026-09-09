// End-to-end play-through of the trivia example against a real PartyKit dev
// server: two real WebSocket clients answer every question correctly and
// finish with matching, perfect scores. No mocks — mirrors the pattern in
// packages/adapter-partykit/smoke-test/client.mjs.
//
// Usage:
//   npm run build         # compiles src/questions.ts so this plain Node
//                          # script can import the question bank
//   npm run smoke:server  # terminal 1
//   npm run smoke:play    # terminal 2
import { connectPartyKitClient } from '@multiplayer-agent-sdk/adapter-partykit';
import { questions } from './dist/questions.js';

const host = process.env.PARTYKIT_HOST ?? '127.0.0.1:2002';

function connect(playerId) {
  return connectPartyKitClient({ host, roomId: 'trivia-play-room', player: { id: playerId } });
}

/** Resolves once `conn.state` satisfies `predicate` (now, or on a future sync). */
function waitFor(conn, predicate) {
  return new Promise((resolve) => {
    const check = (state) => {
      if (predicate(state)) {
        resolve(state);
        return true;
      }
      return false;
    };

    try {
      if (check(conn.state)) return;
    } catch {
      // Not synced yet; fall through to the subscription below.
    }

    const unsubscribe = conn.onStateChange((state) => {
      if (check(state)) unsubscribe();
    });
  });
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function main() {
  const alice = connect('alice');
  const bob = connect('bob');

  const bothPresent = (state) => state.players.includes('alice') && state.players.includes('bob');
  await Promise.all([waitFor(alice, bothPresent), waitFor(bob, bothPresent)]);
  console.log('alice and bob both joined the room.');

  for (let i = 0; i < questions.length; i++) {
    const correctIndex = questions[i].correctIndex;

    const aliceSeesReveal = waitFor(alice, (s) => s.phase === 'reveal' && s.questionIndex === i);
    const bobSeesReveal = waitFor(bob, (s) => s.phase === 'reveal' && s.questionIndex === i);

    alice.send({ type: 'answer', choiceIndex: correctIndex });
    bob.send({ type: 'answer', choiceIndex: correctIndex });

    await Promise.all([aliceSeesReveal, bobSeesReveal]);
    assertEqual(alice.state.scores.alice, i + 1, `alice score after question ${i}`);
    assertEqual(alice.state.scores.bob, i + 1, `bob score after question ${i} (seen by alice)`);
    console.log(`question ${i}: both players answered correctly, scores now`, alice.state.scores);

    const isLast = i === questions.length - 1;
    const aliceSeesNext = waitFor(
      alice,
      (s) => (isLast ? s.phase === 'finished' : s.phase === 'answering' && s.questionIndex === i + 1)
    );
    const bobSeesNext = waitFor(
      bob,
      (s) => (isLast ? s.phase === 'finished' : s.phase === 'answering' && s.questionIndex === i + 1)
    );

    alice.send({ type: 'next' });

    await Promise.all([aliceSeesNext, bobSeesNext]);
  }

  assertEqual(alice.state.phase, 'finished', 'final phase (alice)');
  assertEqual(bob.state.phase, 'finished', 'final phase (bob)');
  assertEqual(alice.state.scores.alice, questions.length, 'alice final score');
  assertEqual(alice.state.scores.bob, questions.length, 'bob final score (seen by alice)');
  assertEqual(bob.state.scores.alice, questions.length, 'alice final score (seen by bob)');
  assertEqual(bob.state.scores.bob, questions.length, 'bob final score');

  alice.disconnect();
  bob.disconnect();

  console.log('\n✅ trivia play-through passed: both players scored perfectly and reached "finished".');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ trivia play-through failed:', err);
  process.exit(1);
});
