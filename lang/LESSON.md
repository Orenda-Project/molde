# Lessons: content given, UI written by the tiny model

A bigger model (or a person) writes a lesson as JSON in the shape below. The tiny model writes the
MoldeScript program that presents it, and edits that program when the learner asks ("make it
flashcards", "one step at a time", "bigger text"). The program never copies lesson text: it names
the lesson's parts (`each section`, `question where kind = mc`, `lesson.title`), so programs stay
short and the content stays exactly as written.

- Contract checker and loader: `lang/lesson.mjs` (`validateLesson`, `lessonRows`).
- Three example lessons: `lang/lessons/g3-maths-halves-quarters.json` (Grade 3 maths),
  `lang/lessons/g6-science-water-cycle.json` (Grade 6 science),
  `lang/lessons/teacher-checking-understanding.json` (teacher training).
- 12 programs over them: `lang/examples/lessons/` (`g3-`, `g6-`, `tt-` say which lesson);
  10 edit pairs: `lang/examples/lesson-edits/`.
- Run one: `node lang/mo.mjs tree lang/examples/lessons/g6-tabs.mo --lesson=lang/lessons/g6-science-water-cycle.json`;
  in code: `load(src, { lesson })`, and `app.setLesson(lesson)` to swap it.

## 1. The content contract

| Key | Required | What |
|---|---|---|
| `title` | yes | the lesson's name (at most 200 characters) |
| `subject`, `audience` | no | e.g. "Maths", "Grade 3" |
| `minutes` | no | whole number, 1 to 600 |
| `objectives` | no | list of texts ("By the end you can ...") |
| `sections` | yes | 1 to 50, each `{id, title, blocks}`; `id` is lowercase letters, digits, `-`, `_` |
| `sections[].blocks` | yes | 1 to 60 blocks, in reading order (below) |
| `questions` | no | each `{id, section?, kind, prompt, ..., explanation?}` (below) |
| `terms` | no | key terms, each `{term, definition}` |
| `summary` | no | a short closing text |

Blocks (`kind` decides the other keys):

| `kind` | Keys | Shown as (std `blocks`) |
|---|---|---|
| `paragraph` | `text` | a paragraph |
| `list` | `items` (texts), `title?` | bullet items |
| `steps` | `items` (texts), `title?` | numbered steps |
| `example` | `text`, `title?` | a shaded card |
| `term` | `term`, `definition` | the term in the accent colour over its definition |
| `image` | `ref`, `alt`, `caption?` | the picture (the host resolves `ref`) with its caption; `alt` is what a screen reader says |

Questions:

| `kind` | Keys | `answer` |
|---|---|---|
| `mc` | `choices` (2 to 6 texts) | index of the right choice, from 0 |
| `tf` | none | `true` or `false` |
| `short` | none | the expected answer; a reply matches when it equals it ignoring case |

All three may have `explanation` (shown after answering) and `section` (a section `id`). Unknown
keys are refused, so a typo in the big model's output is caught, not silently dropped. A refused
lesson is not shown; `app.lessonProblems` lists every problem as a plain sentence
("questions[0].answer: the index (from 0) of the right choice.").

### JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Molde lesson",
  "type": "object",
  "additionalProperties": false,
  "required": ["title", "sections"],
  "properties": {
    "title": { "type": "string", "minLength": 1, "maxLength": 200 },
    "subject": { "type": "string", "minLength": 1 },
    "audience": { "type": "string", "minLength": 1 },
    "minutes": { "type": "integer", "minimum": 1, "maximum": 600 },
    "objectives": { "type": "array", "items": { "type": "string", "minLength": 1, "maxLength": 500 } },
    "summary": { "type": "string", "minLength": 1 },
    "sections": {
      "type": "array", "minItems": 1, "maxItems": 50,
      "items": {
        "type": "object", "required": ["id", "title", "blocks"],
        "properties": {
          "id": { "$ref": "#/$defs/id" },
          "title": { "type": "string", "minLength": 1, "maxLength": 200 },
          "blocks": { "type": "array", "minItems": 1, "maxItems": 60, "items": { "$ref": "#/$defs/block" } }
        }
      }
    },
    "questions": { "type": "array", "items": { "$ref": "#/$defs/question" } },
    "terms": {
      "type": "array",
      "items": { "type": "object", "required": ["term", "definition"], "properties": { "term": { "type": "string", "minLength": 1, "maxLength": 200 }, "definition": { "type": "string", "minLength": 1 } } }
    }
  },
  "$defs": {
    "id": { "type": "string", "pattern": "^[a-z0-9][a-z0-9_-]{0,39}$" },
    "text": { "type": "string", "minLength": 1 },
    "items": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1, "maxLength": 1000 } },
    "block": {
      "oneOf": [
        { "type": "object", "required": ["kind", "text"], "properties": { "kind": { "const": "paragraph" }, "text": { "$ref": "#/$defs/text" } } },
        { "type": "object", "required": ["kind", "items"], "properties": { "kind": { "enum": ["list", "steps"] }, "title": { "$ref": "#/$defs/text" }, "items": { "$ref": "#/$defs/items" } } },
        { "type": "object", "required": ["kind", "text"], "properties": { "kind": { "const": "example" }, "title": { "$ref": "#/$defs/text" }, "text": { "$ref": "#/$defs/text" } } },
        { "type": "object", "required": ["kind", "term", "definition"], "properties": { "kind": { "const": "term" }, "term": { "$ref": "#/$defs/text" }, "definition": { "$ref": "#/$defs/text" } } },
        { "type": "object", "required": ["kind", "ref", "alt"], "properties": { "kind": { "const": "image" }, "ref": { "$ref": "#/$defs/text" }, "alt": { "$ref": "#/$defs/text" }, "caption": { "$ref": "#/$defs/text" } } }
      ]
    },
    "question": {
      "type": "object", "required": ["id", "kind", "prompt", "answer"],
      "properties": {
        "id": { "$ref": "#/$defs/id" },
        "section": { "$ref": "#/$defs/id" },
        "kind": { "enum": ["mc", "tf", "short"] },
        "prompt": { "type": "string", "minLength": 1, "maxLength": 1000 },
        "choices": { "type": "array", "minItems": 2, "maxItems": 6, "items": { "type": "string", "minLength": 1, "maxLength": 300 } },
        "answer": { "oneOf": [{ "type": "integer", "minimum": 0 }, { "type": "boolean" }, { "type": "string", "minLength": 1, "maxLength": 300 }] },
        "explanation": { "$ref": "#/$defs/text" }
      },
      "allOf": [
        { "if": { "properties": { "kind": { "const": "mc" } } }, "then": { "required": ["choices"], "properties": { "answer": { "type": "integer" } } } },
        { "if": { "properties": { "kind": { "const": "tf" } } }, "then": { "properties": { "answer": { "type": "boolean" } } } },
        { "if": { "properties": { "kind": { "const": "short" } } }, "then": { "properties": { "answer": { "type": "string" } } } }
      ]
    }
  }
}
```

`validateLesson` checks the same rules plus what a schema cannot say: section and question ids are
unique, a question's `section` names a section, an `mc` answer is inside its choices.

## 2. In a program

A `lesson` line (after the `app` line) gives the program the lesson. It stands for these level-1
lines, which a program can read like any table:

```
table lessoninfo title text, subject text?, audience text?, minutes num?, summary long?
table section title text, n num
table block section ref section, kind pick paragraph|item|step|example|keyterm|image, title text?, body long?, pic image?, n num
table question section ref section?, kind pick mc|tf|short, prompt long, solution long?, explanation long?, n num
table option question ref question, label text, right bool, n num
table term word text, meaning long, n num
table objective body long, n num
let lesson = first(lessoninfo)
table answer question ref question, option ref option?, reply long?, right bool
table note section ref section, body long
table seen section ref section
```

- **Content** (`lessoninfo section block question option term objective`) is read-only: any add,
  set, edit, remove, toggle or new-row state on it is `E_READONLY`. Rows come in the lesson's own
  order (no `sort` needed); `n` is the position from 1. A `list` or `steps` block becomes one
  `item` or `step` row per item; a `term` block is kind `keyterm` (title = the term, body = the
  definition); an image is kind `image` (`pic` = the ref, title = alt, body = caption). `mc` and
  `tf` questions get `option` rows (`tf`: True, False) with `right` marked; `solution` is the right
  choice's text or the short answer.
- **The learner's data** (`answer note seen`) is stored like any table, so every data-safety rule
  holds: UI edits keep it, dropping the `lesson` line hides it and adding the line back brings it
  back, chat Undo keeps it. Content rows have ids made from the content's own ids, so an answer
  keeps pointing at its question after a UI edit and after the lesson is reloaded.
- Reading: `lesson.title`, `each section`, `each it.block`, `question where kind = mc`,
  `each x.option as o`, `count(x.answer)`, `last(x.answer).right`, `count(answer where right)`.
- The app line sets dark/light and the text size of the whole app: `app "Water cycle" drop blue dark large`.

## 3. Standard components (lang/std/lesson.mo)

| Use | Shows |
|---|---|
| `blocks` | inside `each section`: the section's blocks, each by its kind |
| `reader` | every section as a card (title, blocks); indented lines go into each card (`it` = the section) |
| `stepper` | one section at a time: a progress bar "Part 2 of 4", Back and Next; Next marks the section in `seen`; indented lines go into the card |
| `flashcards` | the terms one at a time; tap the card to turn it; Back and Next |
| `quiz [caption]` | the questions one at a time: options as buttons (or a box for a short answer), then Right!/Not quite., the answer and the explanation; at the end the score and Start again |
| `reveal hidden [, label]` | a button (default "Show the answer") that shows the text under it, and hides it again |
| `notes [caption]` | inside `each section`: the learner's notes on it and a box to add one |

Example (g6-steps-with-notes.mo, 8 lines):

```
app "Water cycle" drop teal
lesson
text lesson.title head
stepper
  notes "My notes on this part"
section "Parts finished", count(seen) "of" count(section)
  each section
    it.title if(count(it.seen) > 0, "✓", "") faint
```

## 4. What the renderer needs

No new node types. It needs: `app.size` (`small`, `large`, `huge` or null) to scale the whole app;
`image.src` holding a lesson picture ref, resolved by the host (a lesson bundle) rather than as a
user photo; `a11y` on an image now comes from the lesson (`alt it.title`).
