// Real end-to-end check for the PartyKit adapter: two actual WebSocket
// clients against a running `partykit dev` server (no mocks). Exercises the
// same public API a game author would use.
//
// Usage: run `npm run smoke:server` in one terminal, then `npm run smoke:client`
// in another (see packages/adapter-partykit/README.md).
import { connectPartyKitClient } from '@multiplayer-agent-sdk/adapter-partykit';

const host = process.env.PARTYKIT_HOST ?? '127.0.0.1:1999';

function connect(playerId) {
  return connectPartyKitClient({ host, roomId: 'smoke-test-room', player: { id: playerId } });
}

function waitForSync(conn) {
  return new Promise((resolve) => {
    const unsubscribe = conn.onStateChange((state) => {
      unsubscribe();
      resolve(state);
    });
  });
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

async function main() {
  const alice = connect('alice');
  await waitForSync(alice);
  console.log('alice joined, initial state:', alice.state);
  assertEqual(alice.state.count, 0, 'initial count');

  const bob = connect('bob');
  await waitForSync(bob);
  console.log('bob joined, presence:', bob.presence.map((p) => p.id));
  assertEqual(bob.presence.length, 2, 'presence count after bob joins');

  const bobSeesIncrement = waitForSync(bob);
  alice.send({ type: 'increment' });
  const stateAfterIncrement = await bobSeesIncrement;
  console.log('state after alice increments (observed by bob):', stateAfterIncrement);
  assertEqual(stateAfterIncrement.count, 1, 'count after increment');

  const aliceSeesLeave = waitForSync(alice);
  bob.disconnect();
  const stateAfterLeave = await aliceSeesLeave;
  console.log('presence after bob disconnects (observed by alice):', alice.presence.map((p) => p.id));
  assertEqual(alice.presence.length, 1, 'presence count after bob leaves');
  assertEqual(stateAfterLeave.count, 1, 'count unchanged after leave');

  alice.disconnect();
  console.log('\n✅ smoke test passed: state and presence sync correctly over a real PartyKit connection.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ smoke test failed:', err);
  process.exit(1);
});
