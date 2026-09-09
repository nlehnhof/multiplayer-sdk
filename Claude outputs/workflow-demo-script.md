# "I Added Multiplayer to 3 Games With One AI Skill" — Demo Script

Hypothetical creator content for the multiplayer-agent-sdk launch. Three already-built local/single-player games, each getting real-time multiplayer bolted on live using the SDK through Claude Code. No games are actually built here — this is the on-camera workflow narration only.

---

## Game 1 (Intermediate): "SplitDeck" — a 4-player Rummy-style card game

**Starting point:** a working local hotseat card game. Turn-based, small state (hand, discard pile, whose turn it is).

**On stream:**

"Alright, I already built this card game solo — works great on one screen, but my friends can't play from their own laptops. Let's fix that." I open the project in Claude Code, the multiplayer-agent-sdk plugin's already installed, and just ask it: *"Add multiplayer so up to 4 people can join a room with a code and take turns."*

The agent reads the game's existing turn logic, sees the state is just a small JSON blob that changes once per turn, and picks the default PartyKit adapter without me having to think about backends at all. It scaffolds a join-code lobby screen from the SDK's prebuilt component, wires each player's hand to only sync to them (nobody sees anyone else's cards), and generates the turn-passing logic off the `currentPlayer` field that was already in my code.

Test is two browser tabs side by side — join the same code, play a few turns, everything shows up instantly because there's so little data moving. One command deploys the PartyKit worker. Total time: about 15 minutes, most of it me explaining what I want out loud for the video.

**The one gotcha I call out:** someone refreshes their tab mid-game. The SDK holds room state for a grace period so they rejoin with their hand intact instead of getting kicked. That's the kind of thing I would've forgotten to handle myself.

---

## Game 2 (Hard): "Nightfall Run" — 2-4 player real-time co-op survival

**Starting point:** a single-player top-down game with a real-time game loop — player moves every frame, enemies and loot exist in a shared world.

**On stream:**

"This one's different — everybody needs to see everybody else moving smoothly, in real time, not turn by turn." Same starting prompt style, but the agent immediately flags that this isn't a turn-based state diff anymore — it's continuous position data, so it switches sync strategy: client-side prediction for each player's own movement, server-authoritative state for shared stuff like enemies and loot, and it sets an actual tick rate instead of "sync whenever something changes."

Here's the part I like showing on camera: the agent doesn't just guess and generate. It asks me a couple of questions first — how many players max, do I want lag compensation on hits — because this tier has real tradeoffs, not just plumbing. That's the SDK being honest about scope instead of one-shotting something that'll feel bad.

Testing two tabs isn't enough anymore — I throttle my network in devtools to fake real latency and watch the interpolation smooth out the other player's movement instead of teleporting. Deploy's still one command, but I spend a good chunk of stream time tuning the interpolation window until movement actually *feels* good, not just technically correct. Total arc: a couple hours, most of it feel-tuning, not integration.

---

## Game 3 (Expert): "Vector Duel" — competitive 1v1 real-time arena duel with matchmaking and spectators

**Starting point:** a couch-only 2-player duel game — twitchy, precise, needs to feel instant even under real internet latency.

**On stream:**

"This is the one where I stop pretending it's easy." I tell the agent I want ranked 1v1 matchmaking, spectators, and it needs to hold up at 80ms+ ping without feeling laggy. Client prediction alone isn't enough for something this twitchy, so this is where the SDK's advanced integration layer comes in — deterministic simulation with rollback-style reconciliation instead of naive state syncing.

The agent doesn't just generate code here — it writes up a short proposed architecture first (deterministic sim, input-only network messages, rollback buffer depth) and has me sign off before touching anything, the same way I'd want a senior engineer to check with me before a big architectural call. Matchmaking comes from the SDK's queue primitive pairing two waiting players into a fresh room; spectators connect through a read-only room mode so they can watch without being able to affect state.

I can't fake this test with two browser tabs and devtools throttling anymore — I pull in a second physical device on a different network to get real jitter. And honestly, on camera, I say it straight: this is close to the edge of what the SDK's built for. It's designed for hobbyist and indie real-time games, not competitive anti-cheat-hardened esports infrastructure — so past this point I'm doing real engineering work myself, the SDK just got me 80% of the way instead of 0%. Backend-wise this is also where I'd reach for the paid managed tier instead of the free default, since rollback plus spectator load wants a beefier backend than the free tier's built for. Multi-day arc, several iterations, and I'm upfront that the last mile here is mine, not the AI's.

---

## Why show all three tiers

The intermediate game is the "wow, that just worked" hook. The hard game shows the SDK making real judgment calls instead of blindly generating. The expert game is the credibility moment — showing where the tool's honest limits are builds more trust than pretending it can do everything, and it's a natural pointer toward the paid "pro integration pack" for anyone who needs that last tier.
