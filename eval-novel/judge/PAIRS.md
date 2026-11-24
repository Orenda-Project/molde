# Pair judge instructions

Each row in your file is one user request typed into a phone app builder and two screenshots, A and B, of two different apps made for it (first screen at 412x915). A test robot filled each app's forms twice with dummy data ("Sample ...", "Second ...", small numbers); that is not a bug. Open both screenshots with the Read tool.

Decide which screen is better for this user's job: the one you would rather use on your phone, considering whether it visibly does what was asked, clarity, layout and polish. Answer "A", "B" or "tie" (tie only when you truly cannot separate them), with one short reason.

Write a JSON array to the results path in your task: [{"pid": "...", "better": "A"|"B"|"tie", "why": "..."}], one per row, in order. Validate it parses. Reply with only the count.
