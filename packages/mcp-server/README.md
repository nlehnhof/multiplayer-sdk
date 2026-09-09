# @multiplayer-agent-sdk/mcp-server

An MCP (Model Context Protocol) server that gives a coding agent (Claude Code,
Cursor, etc.) grounded, authoritative guidance about the Multiplayer Agent
SDK's adapter interface — so it doesn't have to guess or hallucinate the
`RoomDefinition` contract or which backend adapters exist.

> **MVP skeleton.** This package exposes exactly two read-only tools and does
> no game-hosting or state management itself. It is intentionally minimal —
> the "Draft the MCP server skeleton and confirm it loads correctly in Claude
> Code and Cursor" checklist item, not a full-featured server. More
> capability (additional tools, resources, prompts) is expected post-MVP.

## Tools

- **`list_adapters`** — no input. Returns a JSON list of backend adapters
  (`partykit`, `colyseus`, `supabase`) and whether each is `available` now
  or `planned` post-MVP.
- **`get_room_definition_guide`** — no input. Returns a markdown guide
  containing the frozen `RoomDefinition`/`PlayerInfo`/`RoomOptions`
  TypeScript interfaces (copied verbatim from `packages/core/src/types.ts`),
  a complete minimal example (a counter room), and a pointer to
  `@multiplayer-agent-sdk/adapter-partykit`'s `createPartyKitServer` /
  `connectPartyKitClient` for wiring it up.

## Running it standalone

```bash
npm run build
node dist/index.js
```

The server communicates over stdio (no HTTP port). Running it directly from
a terminal will appear to hang with no output — that's expected, since it's
waiting for an MCP client to speak the protocol on stdin. A clean start
(no thrown error, no immediate exit) is the "loads correctly" bar. Press
Ctrl+C to stop it.

## Using it from Claude Code / Cursor

Either tool can be pointed at this server as a local MCP server via its
`node dist/index.js` entrypoint (or the `multiplayer-agent-sdk-mcp` bin once
this package is installed). Exact registration steps (Claude Code's
`.mcp.json` / `claude mcp add`, Cursor's MCP settings) are host-specific and
out of scope for this package's README.

## Development

```bash
npm run build       # tsup -> dist/
npm test            # vitest run
npm run typecheck   # tsc --noEmit
```
