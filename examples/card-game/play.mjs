// Real end-to-end check for the "War" card-game example: two actual
// WebSocket clients against a running `partykit dev` server (no mocks).
// Both players repeatedly flip until the game finishes, then the result is
// asserted.
//
// Usage: run `npm run smoke:server` in one terminal, then `npm run smoke:play`
// in another (see README.md).
import { connectPartyKitClient } from '@multiplayer-agent-sdk/adapter-partykit';

const host = process.env.PARTYKIT_HOST ?? '127.0.0.1:2001';
const roomId = `war-${Date.now()}`;

function connect(playerId) {
  return connectPartyKitClient({ host, roomId, player: { id: playerId } });
}

function waitForSync(conn) {
  return new Promise((resolve) => {
    const unsubscribe = conn.onStateChange((state) => {
      unsubscribe();
      resolve(state);
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const alice = connect('alice');
  await waitForSync(alice);
  console.log('alice joined, status:', alice.state.status);

  const bob = connect('bob');
  await waitForSync(bob);
  console.log('bob joined, status:', bob.state.status);
  assert(bob.state.status === 'playing', 'game should start once both players have joined');
  assert(bob.state.hands.alice.length === 26, 'alice should have 26 cards');
  assert(bob.state.hands.bob.length === 26, 'bob should have 26 cards');

  let latest = bob.state;
  let rounds = 0;
  // War (even without the war-chain-on-tie mechanic) can legitimately run
  // for hundreds of rounds before a hand empties out (a 2000-game in-memory
  // simulation of this exact RoomDefinition topped out at 422 rounds), so a
  // generous cap costs little.
  const maxRounds = 2000;
  const t0 = Date.now();

  while (latest.status === 'playing' && rounds < maxRounds) {
    // Alternate turns, waiting for a sync after each flip, so there's never
    // a race between "alice's card landed on the table" and "the round
    // resolved" — bob always flips second and observes the resolved state.
    const aliceFlipSync = waitForSync(alice);
    alice.send({ type: 'flip' });
    await aliceFlipSync;

    const bobFlipSync = waitForSync(bob);
    bob.send({ type: 'flip' });
    latest = await bobFlipSync;
    rounds++;
    if (rounds % 100 === 0) {
      console.log(`  ...round ${rounds}, alice=${latest.hands.alice.length} bob=${latest.hands.bob.length} (${Date.now() - t0}ms elapsed)`);
    }
  }

  console.log(`game finished after ${rounds} rounds`);
  console.log('final status:', latest.status, 'overallWinner:', latest.overallWinner);

  assert(latest.status === 'finished', `game did not finish within ${maxRounds} rounds`);
  assert(
    latest.overallWinner === 'alice' || latest.overallWinner === 'bob' || latest.overallWinner === null,
    'overallWinner should be alice, bob, or null'
  );

  if (latest.overallWinner === 'alice') {
    assert(latest.hands.bob.length === 0, 'losing hand (bob) should be empty');
  } else if (latest.overallWinner === 'bob') {
    assert(latest.hands.alice.length === 0, 'losing hand (alice) should be empty');
  }

  alice.disconnect();
  bob.disconnect();
  console.log('\n✅ War card-game smoke test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ War card-game smoke test failed:', err);
  process.exit(1);
});
