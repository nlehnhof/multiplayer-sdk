// Real end-to-end smoke test for the tic-tac-toe example: two actual
// WebSocket clients against a running `partykit dev` server (no mocks).
// Plays a deterministic game to a win for X (top row) and asserts the
// resulting board/turn/status/winner along the way.
//
// Usage: run `npm run smoke:server` in one terminal, then `npm run
// smoke:play` in another (see README.md).
import { connectPartyKitClient } from '@multiplayer-agent-sdk/adapter-partykit';

const host = process.env.PARTYKIT_HOST ?? '127.0.0.1:2000';

function connect(playerId) {
  return connectPartyKitClient({ host, roomId: 'tic-tac-toe-smoke', player: { id: playerId } });
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
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${message}: expected ${b}, got ${a}`);
  }
}

async function mark(mover, watcher, cell) {
  const watcherSeesUpdate = waitForSync(watcher);
  mover.send({ type: 'mark', cell });
  return watcherSeesUpdate;
}

async function main() {
  const x = connect('x-player');
  await waitForSync(x);
  console.log('x-player joined, initial state:', x.state);
  assertEqual(x.state.symbols['x-player'], 'X', 'x-player symbol');
  assertEqual(x.state.turn, 'X', 'initial turn');
  assertEqual(x.state.status, 'playing', 'initial status');

  const o = connect('o-player');
  await waitForSync(o);
  console.log('o-player joined, presence:', o.presence.map((p) => p.id));
  assertEqual(o.state.symbols['o-player'], 'O', 'o-player symbol');
  assertEqual(o.presence.length, 2, 'presence count after o-player joins');

  // X takes the top row (0, 1, 2); O takes two middle-row cells (3, 4).
  // Board indices:
  //   0 1 2
  //   3 4 5
  //   6 7 8
  await mark(x, o, 0);
  await mark(o, x, 3);
  await mark(x, o, 1);
  await mark(o, x, 4);
  const finalState = await mark(x, o, 2);

  console.log('final state:', finalState);
  assertEqual(finalState.status, 'won', 'final status');
  assertEqual(finalState.winner, 'x-player', 'winner');
  assertDeepEqual(finalState.board, ['X', 'X', 'X', 'O', 'O', null, null, null, null], 'final board');

  // Further moves after the game is over should be rejected server-side
  // (surfaced as a non-fatal 'error' broadcast, not a thrown client error) —
  // state should remain unchanged.
  o.send({ type: 'mark', cell: 5 });
  await new Promise((resolve) => setTimeout(resolve, 200));
  assertDeepEqual(o.state.board, finalState.board, 'board unchanged after post-game move attempt');

  x.disconnect();
  o.disconnect();
  console.log('\n✅ tic-tac-toe smoke test passed: turn order, win detection, and sync all work end-to-end.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ tic-tac-toe smoke test failed:', err);
  process.exit(1);
});
