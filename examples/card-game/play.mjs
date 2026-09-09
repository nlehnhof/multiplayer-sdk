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

// A single flip and a fully-resolved round both broadcast as a plain "sync"
// message, so "wait for the next sync" is ambiguous: a stale broadcast from
// the *other* player's flip can arrive just as we start waiting and resolve
// this promise before our own flip's round-resolution sync ever does. That
// leaves the round genuinely unresolved, so the next flip gets rejected
// (non-fatal 'error' message, no sync) and the script hangs forever waiting
// on a sync that will never come. `roundsResolved` is a monotonic counter
// bumped exactly once per resolved round (see src/room.ts), so waiting for
// it to exceed a known baseline is unambiguous regardless of message timing.
function waitForRoundResolved(conn, baseline) {
  return new Promise((resolve) => {
    if (conn.state.roundsResolved > baseline) {
      resolve(conn.state);
      return;
    }
    const unsubscribe = conn.onStateChange((state) => {
      if (state.roundsResolved > baseline) {
        unsubscribe();
        resolve(state);
      }
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
  assert(bob.state.handCounts.alice === 26, 'alice should have 26 cards');
  assert(bob.state.handCounts.bob === 26, 'bob should have 26 cards');
  assert(bob.state.myHand.length === 26, "bob's own hand should be visible to bob");
  assert(!('hands' in bob.state), 'the raw shared WarState.hands must not reach the client (ADR 0002)');

  let latest = bob.state;
  let rounds = 0;
  // War (even without the war-chain-on-tie mechanic) can legitimately run
  // for hundreds of rounds before a hand empties out (a 2000-game in-memory
  // simulation of this exact RoomDefinition topped out at 422 rounds), so a
  // generous cap costs little.
  const maxRounds = 2000;
  const t0 = Date.now();

  while (latest.status === 'playing' && rounds < maxRounds) {
    // Alice flips first (lands on the table, round not yet resolved — no
    // wait needed here since bob's flip is what completes the round), then
    // bob flips and we wait specifically for `roundsResolved` to advance,
    // not just for "a sync" (see waitForRoundResolved for why that matters).
    const baseline = bob.state.roundsResolved;
    alice.send({ type: 'flip' });
    const bobFlipResolved = waitForRoundResolved(bob, baseline);
    bob.send({ type: 'flip' });
    latest = await bobFlipResolved;
    rounds++;
    if (rounds % 100 === 0) {
      console.log(`  ...round ${rounds}, alice=${latest.handCounts.alice} bob=${latest.handCounts.bob} (${Date.now() - t0}ms elapsed)`);
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
    assert(latest.handCounts.bob === 0, 'losing hand (bob) should be empty');
  } else if (latest.overallWinner === 'bob') {
    assert(latest.handCounts.alice === 0, 'losing hand (alice) should be empty');
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
