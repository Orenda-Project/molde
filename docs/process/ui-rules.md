# UI design rules for Molde

Kamal's house rules for any UI job, adapted for Molde (a mobile app, a design kit and generated mini-apps). Apply them to every issue labelled `ui`. The audit tool is the `unslop-ui` skill by heydamir (CC BY 4.0, https://github.com/heydamir/unslop); keep this credit when copying its text.

## Process
1. Run the unslop-ui audit first. Start from its `references/signs.md` list and write down each sign with where it lives. Then decide heavy, light or none. Never change a good screen just to change it.
2. A product with a real art direction keeps its brand. Its moments (the signature visuals, icons, characters) carry the personality; the chrome around them stays quiet. Do not strip the brand to look like a SaaS dashboard. Adapt, and say what was adapted.
3. Check every layout at 360x640, 412x915, 600x960 (7-inch), 800x1280 (10-inch) and a wide desktop. Take the screenshots from the production build, never from a mock-up.
4. Gauntlet: after each fix pass run an independent critic (haiku, both orders against a real reference) and a machine check (overflow, tiny text, small targets). Fix, re-run. Do not self-grade. See `docs/process/gauntlet.md`.
5. Report each pass in a few lines.

## Rules that always apply
- Spacing on a 4 px scale with one gap per kind of thing.
- Same thing, same size.
- Nested radius: inner radius = outer radius minus padding.
- Text contrast at least 4.5:1 (3:1 for large text and UI parts).
- Touch targets at least 44 px.
- Visible focus.
- No state shown by color alone.
- No single word alone on a heading's last line.
- One accent color, used rarely.
- Real-looking data, not lorem ipsum.
- Quiet badges.
