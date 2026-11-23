# Molde dataset card

- language commit: `f473464` (migrated: False)
- counts: {'train': 292, 'val': 14, 'test': 44}
- by task: {'train': {'create': 277, 'edit': 15}, 'val': {'create': 13, 'edit': 1}, 'test': {'create': 40, 'edit': 4}}
- by source: {'corpus': {'train': 249, 'val': 11, 'test': 40}, 'examples': {'train': 28, 'val': 2}, 'edits': {'train': 15, 'val': 1, 'test': 4}}
- dropped: 0
- split: test = 40 corpus ids + 4 edit pairs, lowest sha1(seed+id); val = 5% by sha1; rest train
- system prompt: 'You write MoldeScript, a tiny language for small phone apps. Reply with the complete program only, no explanation. For an edit request you get the current program: reply with the full updated program.'
