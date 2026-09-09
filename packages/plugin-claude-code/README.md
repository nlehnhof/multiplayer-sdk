# @multiplayer-agent-sdk/plugin-claude-code

A minimal Claude Code plugin exposing the Multiplayer Agent SDK's guidance
as a Skill (`add-multiplayer`).

> **First-draft skeleton — not submission-ready.** This is scaffolding built
> to confirm the plugin loads and the skill's guidance is correct, per the
> build plan's "This week" checklist item ("Draft the MCP server skeleton
> and confirm it loads correctly in Claude Code and Cursor"). Actual
> submission to the official `claude-plugins-official` marketplace is an
> explicit human task in the build plan ("Read Anthropic's
> `claude-plugins-official` contribution guidelines... before you're ready
> to submit") — not done here.

## What's here

```
plugin-claude-code/
├── .claude-plugin/
│   └── plugin.json              # plugin manifest
├── skills/
│   └── add-multiplayer/
│       └── SKILL.md             # the skill Claude Code loads
└── README.md
```

`plugin.json` declares `name`, `version`, `description`, `author`,
`homepage`, `repository`, `license`, and `keywords`. The `add-multiplayer`
skill tells an agent: get the frozen `RoomDefinition` contract (preferably
via the `@multiplayer-agent-sdk/mcp-server` MCP server's
`get_room_definition_guide` tool, falling back to reading
`adr/0001-adapter-interface.md` directly), write one `RoomDefinition` for
the game's rules, then wire it to `@multiplayer-agent-sdk/adapter-partykit`.

## What I verified vs. couldn't fully confirm

I checked the current schema against Anthropic's own
`anthropics/claude-code` repo (the `plugin-dev` plugin's
`plugin-structure` skill and its `manifest-reference.md`), not just
third-party blog posts, and against Claude Code's public plugins-reference
docs. Based on that:

**Verified with reasonable confidence:**
- `.claude-plugin/plugin.json` is the required manifest location, at the
  plugin root.
- `name` is the only required manifest field (kebab-case); everything else
  (`version`, `description`, `author`, `homepage`, `repository`, `license`,
  `keywords`, plus path overrides like `commands`, `agents`, `hooks`,
  `mcpServers`) is optional.
- Skills live at `skills/<skill-name>/SKILL.md`, one directory per skill,
  auto-discovered by Claude Code without needing a manifest entry.
- `SKILL.md` frontmatter uses `name`, `description`, and (optionally)
  `version`.

**Not fully confirmed — flag before real submission:**
- I did not find documentation of a manifest field that explicitly points
  at a non-default skills directory (unlike `commands`/`agents`/`hooks`/
  `mcpServers`, which do have documented override fields) — I've relied on
  the default `./skills` auto-discovery convention instead of adding an
  unverified field to `plugin.json`. If a `skills` override field exists,
  it isn't in the reference I fetched.
- I have not tested this plugin by actually installing it into a running
  Claude Code instance (e.g. via `/plugin marketplace add` or local plugin
  install) — only read the docs/spec. "Loads correctly" here means "matches
  the documented schema," not "verified against a live Claude Code load."
- `claude-plugins-official`'s specific submission requirements (beyond the
  generic plugin schema) were not reviewed here — that's the separate build
  plan checklist item assigned to a human.

## Trying it locally

Claude Code discovers plugins added via its plugin/marketplace commands, or
by pointing it at a local directory containing `.claude-plugin/plugin.json`
during development. Exact local-dev plugin-loading commands are Claude
Code-version-specific and weren't re-verified here; consult current Claude
Code docs (`code.claude.com/docs`) at submission time.
