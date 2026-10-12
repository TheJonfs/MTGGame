# The Open's measuring tools

Moved into the repo in Session 61 (they lived in a session scratch directory, which the OS cleans). All of them drive
`pnpm open:rr` and read its shard files. Scratch output goes to `analysis/runs/scratch/` (git-ignored) unless
`OPEN_SCRATCH` says otherwise.

- `rr.sh tag games [open:rr args…]` — a table on N shards in parallel. See its header for the merge commands.
- `trials.py file [baseTag]` — paired trials of a change in one list's seat. Each line of the file is
  `tag|list|swap|extra open:rr args|baseTag`; a trial is compared game by game with the base run on the same seeds.
- `mrep.py <list> tags…` — a trial's match summary: matches, game one, later games, and the rate by opponent.
- `g1.py <list> tags…` — game one by opponent.
- `pair.py` — one pairing's paired difference between two runs.

Habits these tools do not enforce: start every batch before editing source (a process loads the code when it starts);
never reuse a tag; check a merged table's `games` count against pairings × games before reading it.
