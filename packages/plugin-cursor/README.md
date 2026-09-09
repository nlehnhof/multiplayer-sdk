# @multiplayer-agent-sdk/plugin-cursor

A minimal Cursor project rule carrying the same core guidance as the Claude
Code `add-multiplayer` skill, adapted to Cursor's rule conventions.

> **First-draft skeleton — not submission-ready.** Built to confirm the
> rule format is plausible and to give Cursor agents the same grounded
> guidance as Claude Code, per the build plan's "This week" checklist item.
> Submission to Cursor's Marketplace / cursor.directory is a separate,
> later, human task and is not attempted here.

## What's here

```
plugin-cursor/
├── .cursor/
│   └── rules/
│       └── multiplayer-agent-sdk.mdc
└── README.md
```

`multiplayer-agent-sdk.mdc` uses YAML frontmatter (`description`,
`alwaysApply: false`) followed by the same guidance as the Claude Code
skill: get the frozen `RoomDefinition` contract, write one `RoomDefinition`
for the game's rules, then wire it to
`@multiplayer-agent-sdk/adapter-partykit`.

`alwaysApply: false` with a `description` (and no `globs`) means the rule
is agent-requested — Cursor's agent decides whether to pull it in based on
relevance to the request, rather than attaching it to every session or
every file matching a glob. This seemed like the right default since
"add multiplayer to my game" is an occasional, not universal, request; a
`globs` field wasn't added since there's no single file pattern that
reliably indicates "this file is about adding multiplayer."

## What I verified vs. couldn't fully confirm

I checked Cursor's own docs (`cursor.com/docs/rules`) rather than relying
on memory, since this format has changed before. Based on that:

**Verified with reasonable confidence:**
- Project rules live in `.cursor/rules/` as `.mdc` files (YAML frontmatter
  + markdown body); a plain `.md` file there is ignored.
- The three frontmatter fields are `description`, `globs`, `alwaysApply`,
  and their combination determines whether a rule is always included,
  glob-attached, agent-requested, or manual-only (`@`-mention).
- `alwaysApply: false` + `description` (no `globs`) = agent-requested,
  which is what I used here.

**Not fully confirmed — flag before real use:**
- I did not test this rule inside an actual Cursor session (no way to
  launch Cursor from this environment) — only checked it against the
  documented schema. Whether Cursor's agent actually picks up this rule
  for a given prompt in practice, versus the documented behavior, is
  unverified.
- Cursor's rule docs describe `globs` as comma-separated glob patterns; I
  chose to omit `globs` entirely rather than guess a pattern, since no
  single file glob captures "the user wants multiplayer added" — worth
  reconsidering once there's a real example game in this repo to test
  against.
- Cursor's Marketplace / cursor.directory submission requirements (as
  opposed to the raw `.mdc` rule format) were not researched here.

## Marketplace listing copy (draft)

For the eventual Cursor Marketplace / cursor.directory submission — draft only, not submitted:

- **Name:** Multiplayer Agent SDK
- **One-line description:** Add real-time multiplayer to an existing game via a swappable realtime-backend adapter (PartyKit by default) — write one `RoomDefinition`, no networking code.
- **Tags:** multiplayer, realtime, game-dev, websocket, partykit
- **Longer description:** Turns local-state game logic into a multiplayer room by wrapping an existing realtime backend instead of hosting infrastructure. Targets 2-6 player turn-based/casual games (card games, trivia, tic-tac-toe, party games). Includes per-player state views for hidden information (opponent hands, unrevealed answers) and three complete reference games.
