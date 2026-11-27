// c2_words2.mjs: second batch of request wording (round 2 of c2), written without looking at any test wording.
// Adds indirect, messy and reasoned phrasings, references by role, and the wording of the new "add" kinds.
// TPL2 pools are merged into c2_words.mjs T by c2_edits.mjs. OPEN and CLOSE are shared openers and closers that are composed
// around any request (a few words before, a reason or politeness after), so one core gives many distinct skeletons.
export const TPL2 = {
  remove: [
    '{X} is useless, get rid of it', 'honestly {X} is just noise, take it away', 'what is {X} even for? remove it', 'i would like the screen without {X}', 'the app does not need {X}',
    'i never look at {X}', 'can we live without {X}?', 'can you clean up by removing {X}?', 'i find {X} confusing, drop it', '{X} takes too much space, cut it', 'rid me of {X}',
    'it would be better without {X}', 'please get {X} off the screen', 'wipe {X}', 'erase {X}', 'take {X} off my app', 'let us lose {X}', 'say goodbye to {X}', 'delete it, i mean {X}',
    'my brother thinks {X} is pointless, remove it', 'make the app simpler by removing {X}', 'the screen is crowded, {X} should go', 'i want less on the screen, start with {X}',
    'unneeded: {X}', 'remove {X} and leave everything else as it is', 'remove only {X}, keep the rest', 'only {X} should go', 'throw out {X}', 'could we skip {X}?', 'get {X} out of here',
    'there is no use for {X} in this app', 'nobody needs {X}', 'kindly remove {X}', 'if possible remove {X}', 'i changed my mind about {X}, remove it', '{X} was a mistake, take it out',
    'i no longer want {X}', 'stop having {X} in the app', 'the app can do without {X}', 'rm {X}', 'delete: {X}', 'take out {X}, nothing else', '{X} can disappear now', 'remove {X} for me',
    'i keep ignoring {X}, so remove it', 'goodbye {X}', '{X} is not for me, remove it', 'do away with {X}', 'wipe out {X}', 'i do not look at {X}, so it should not be there',
    'it is clutter: {X}', 'less is more, lose {X}',
  ],
  above: [
    'put {X} where {Y} is', 'can {X} come before {Y}?', 'i look at {X} first, so it should be over {Y}', '{X} is more important than {Y}, put it higher', 'move {X} up so it is ahead of {Y}',
    'i want {X} on top of {Y}', 'lift {X} above {Y}', '{X} before {Y} please', 'make {X} appear before {Y}', 'can you flip it so {X} is above {Y}?', '{X} over {Y}', 'stack {X} on top of {Y}',
    'shift {X} up past {Y}', 'it should be {X} and then {Y}', 'order matters: {X} then {Y}', 'show {X} before showing {Y}', 'raise {X} above {Y}', 'give {X} a spot above {Y}',
    'relocate {X} to before {Y}', 'could you move {X} up, above {Y}?', 'push {X} up above {Y}', 'i prefer {X} on top of {Y}', 'the order should have {X} ahead of {Y}', 'make {X} come first, ahead of {Y}',
    '{X} needs to sit higher than {Y}', 'above {Y} is where {X} belongs', 'i want {X} just above {Y}', 'i want {X} right before {Y}',
  ],
  below: [
    'can {X} come after {Y}?', '{X} is less important than {Y}, put it lower', 'i want {X} under {Y}', 'make {X} appear after {Y}', '{X} after {Y} please', 'tuck {X} under {Y}', 'move {X} down past {Y}',
    'lower {X} below {Y}', 'show {X} after showing {Y}', 'put {X} behind {Y}', 'relocate {X} to after {Y}', 'send {X} down below {Y}', 'i want {X} right after {Y}', 'i want {X} just under {Y}',
    'could you move {X} down under {Y}?', 'bring {X} down, below {Y}', 'push {X} below {Y}', 'make {X} come second, after {Y}', 'the order should have {X} behind {Y}', '{X} needs to sit lower than {Y}',
    'below {Y} is where {X} belongs', 'drop {X} down under {Y}', 'give {X} a spot under {Y}', '{X} comes after {Y}', 'let {X} follow {Y}', 'put {X} after {Y}, not before it',
  ],
  first: [
    'put {X} at the very start', 'i want {X} to be the first thing i see', '{X} should open the screen', 'start the screen with {X}', 'make {X} lead', 'lift {X} to the top of the screen', 'can {X} be first?',
    '{X} first please', 'move {X} up to the start', 'make {X} the opening element', 'i would like {X} on top of everything', 'put {X} ahead of everything', 'bring {X} up front', 'the top spot is for {X}',
    'let {X} be the first', 'shift {X} to the very top', 'the screen should begin with {X}', 'give {X} the first position', 'the highest place goes to {X}', 'i open the app for {X}, so put it first',
  ],
  last: [
    'put {X} at the very end', 'i want {X} to be the last thing on the screen', '{X} should close the screen', 'finish the screen with {X}', 'make {X} trail everything', 'sink {X} to the bottom of the screen',
    'can {X} be last?', '{X} last please', 'move {X} down to the end', 'make {X} the closing element', 'i would like {X} under everything', 'put {X} behind everything', 'bring {X} to the back',
    'the bottom spot is for {X}', 'let {X} be the last', 'shift {X} to the very bottom', 'the screen should end with {X}', 'give {X} the last position', 'the lowest place goes to {X}',
    'i rarely use {X}, so put it last',
  ],
  rename: [
    'the label on {X} is wrong, it should say {N}', 'i want to see {N} on {X}', 'make {X} read "{N}" instead of what it says now', 'put the word {N} on {X}', '{X} is a bad name, use {N}',
    'change what {X} says to {N}', 'call {X} {N}, it is clearer', 'rename: {X} to {N}', 'can you reword {X} as {N}?', 'the text of {X} should be {N}', 'new name for {X}: {N}', 'let {X} be called {N}',
    'could you change {X} so it says {N}?', 'when i look at {X} i want to read {N}', '{X} should have the label {N}', 'replace the label of {X} with {N}', 'i would like {X} to be named {N}', 'edit {X}: {N}',
    'call {X} "{N}" please', 'make the name of {X} "{N}"', 'it is confusing, so {X} -> "{N}"', 'rewrite {X} as {N}', 'the caption of {X} needs to be {N}', 'switch the text on {X} to {N}', '{X} ought to say {N}',
    'give {X} the name {N}', 'update {X} to say {N}', '{N} is better than what {X} says, use it', 'change {X} to "{N}"', 'rename {X} -> {N} please',
  ],
  rename_title: [
    'the app is called wrong, make it {N}', 'new app name: {N}', 'i want to name this app {N}', 'change what the app is called to {N}', 'the name at the top should be {N}', 'retitle the app {N}',
    'call the whole thing {N}', 'title it {N}', 'set the app name to {N}', 'make this app be called {N}', 'rename this app {N} please', 'app name: {N}', 'could the title be {N}?',
    'the heading of the app should say {N}', 'change the app title to "{N}"', 'i prefer the name {N}', 'it should be called {N}', 'the app should carry the name {N}', 'use {N} as the app name',
  ],
  rename_field: [
    'the {o} field has the wrong name, make it {n}', '{o} should really be {n}', 'i would like {o} renamed to {n}', 'rename {o} to {n} and keep everything i typed', 'change the field called {o} so it is called {n}',
    'swap the name {o} for {n}', 'every {o} should be {n} now, keep the data', 'make the {o} field be named {n} instead', 'call the column {o} by the name {n}', '{o} -> {n}, data stays',
    'instead of {o} i want {n}', '{n} instead of {o} please', 'new name for {o}: {n}', 'i want the name {n} rather than {o}', 'rename the {o} column to {n}', 'the {o} field needs a better name: {n}',
    'could {o} be renamed {n}?', 'edit the name of {o}: {n}', 'tidy up: {o} to {n}', 'rename {o}, new name {n}', 'please make {o} read {n} everywhere', 'change {o} into {n}', 'the word {o} should become {n} in the app',
    'switch {o} over to the name {n}', 'call my {o} {n} from now on', 'relabel {o} as {n} without losing data', 'rename the {o} to {n}, do not delete any entries', 'let me say {n} instead of {o}',
    '{o} is a confusing field name, {n} is better', 'make {o} be called {n} from now on',
  ],
  add_option: [
    '{O} should be in the list of choices too', 'i want {O} to show up as a choice for {F}', 'let {F} have {O} too', 'the choices for {F} are missing {O}', 'add {O} in {F} please', 'give {F} another option, {O}',
    'put {O} among the choices for {F}', 'extend {F} with {O}', '{F} needs {O} too', 'could you also offer {O} for {F}?', 'i sometimes need {O} for {F}', 'make {O} selectable for {F}',
    'i keep wanting {O}, but it is not in {F}', 'there is no {O} in {F}, please add one', 'can {F} also be {O}?', 'let me choose {O} in {F}', 'allow {O} for {F}', 'enable {O} as a pick for {F}',
    'an entry for {O} is needed in {F}', 'what about {O}? add it to {F}', 'please include {O} as another choice', '{O} also exists, add it', 'add {O} among the choices', 'i need to be able to pick {O}',
    'add {O}, it is missing', 'the list lacks {O}, add it', 'the choices should include {O}', 'i want one more option and it is {O}', 'throw in {O} as well', 'also support {O}',
    'another option please: {O}', 'new option: {O}', 'add option {O} to {F}', 'i forgot {O}, add it to {F}',
  ],
  opt_after: ['add {O} after {A}', 'put {O} right after {A}', 'insert {O} after {A}', 'i want {O} after {A}', '{O} goes after {A}', 'place {O} behind {A}', 'add the option {O} just after {A}', 'slot {O} in after {A}', 'put {O} next to {A}, after it', 'add {O} below {A} in the choices'],
  opt_before: ['add {O} before {B}', 'put {O} right before {B}', 'insert {O} ahead of {B}', 'i want {O} before {B}', '{O} goes before {B}', 'place {O} in front of {B}', 'add the option {O} just before {B}', 'slot {O} in before {B}', 'put {O} next to {B}, before it', 'add {O} above {B} in the choices'],
  opt_between: ['add {O} between {A} and {B}', 'put {O} in between {A} and {B}', '{O} belongs between {A} and {B}', 'slot {O} between {A} and {B}', 'insert {O} between {A} and {B}', 'i want {O} sitting between {A} and {B}', 'add the option {O}, between {A} and {B}', '{O} goes in the middle, after {A} and before {B}'],
  opt_end: ['add {O} at the end of {F}', 'put {O} last in {F}', 'add {O} to the end of the list for {F}', '{O} goes at the end of {F}', 'add {O} as the last choice of {F}', 'i want {O} as the final option of {F}'],
  setting_value: [
    'i want {S} to be {V} from now on', '{S} needs to be {V}', 'make it so {S} equals {V}', 'the new value of {S} is {V}', 'update {S} to {V}', 'the number for {S} should be {V}', '{S} should read {V}', 'turn {S} into {V}',
    'change {S}, it is {V} now', 'new value for {S}: {V}', '{S} = {V}', 'i want {V} for {S}', 'use {V} for {S}', 'switch {S} over to {V}', 'let {S} be {V}', 'correct {S}: it is {V}', 'fix {S}, it should be {V}',
    'edit {S} so it is {V}', 'please adjust {S} to {V}', '{S} must be {V} now', 'just make {S} {V}', 'could {S} be {V}?', 'set the value of {S} at {V}', 'reset {S} to {V}', '{V} is the right number for {S}',
    'i meant {V} for {S}', 'amend {S} to {V}', 'adjust: {S} {V}', '{S} is changing to {V}',
  ],
  range: [
    'i want to enter {F} values up to {V}', 'allow bigger {F}, up to {V}', '{F} is capped, make the cap {V}', 'my {F} can be as big as {V}', 'raise or change the {F} maximum to {V}', 'set the largest allowed {F} to {V}',
    '{F} upper limit is {V}', 'the most {F} can be is {V}', 'i need to type {F} up to {V}', 'let {F} go to {V}', 'the {F} ceiling should be {V}', 'limit for {F}: {V}',
  ],
  wrap: [
    'i want a heading {T} over {X}', 'give {X} a title card named {T}', '{X} should be inside a section called {T}', 'surround {X} with the {T} section', 'group {X} in a section: {T}',
    'create a section named {T} that holds {X}', 'i want {X} separated, in a section called {T}', 'make {X} a section called {T}', 'make {X} into its own labelled section, {T}', 'put {X} inside a card called {T}',
    'a section for {X} please, title {T}', 'title the part with {X} as {T}', 'i would like {X} under the heading {T}', 'headline for {X}: {T}', 'move {X} into a new section titled {T}', 'collect {X} in a section named {T}',
    'the section called {T} should contain {X}', 'enclose {X} in a card, call it {T}', 'label the area with {X} as {T}',
  ],
  split: [
    'divide the screen: {L}', 'i want the page grouped as {L}', 'group the screen into {L}', 'sort the screen into sections named {L}', 'it all runs together, add sections {L}', 'could you create sections: {L}?',
    'cut this into parts called {L}', 'make it tidy: sections for {L}', 'i want headings {L} on the screen', 'turn the screen into sections: {L}', 'organise the screen in sections {L}', 'part it into {L}',
    'break the page into {L}', 'add headings and cards for {L}', 'let us have sections called {L}', 'help me organise: {L} as sections', 'group related things under {L}', 'give me the sections {L}',
    'cards please: {L}', 'structure it as sections: {L}',
  ],
  // new kinds: D is a full description of the thing (name, type, range, unit, options, what it shows); Q a table phrase
  add_field: [
    'add {D}{Q}', 'i want {D}{Q}', 'can you add {D}{Q}?', 'please add {D}{Q}', 'i need to record {D}{Q}', 'could you give me {D}{Q}?', 'put {D}{Q}', 'include {D}{Q}', 'also keep {D}{Q}',
    'one more field: {D}{Q}', 'new field: {D}{Q}', 'let me enter {D}{Q}', 'there should be {D}{Q}', 'create {D}{Q}', 'i would like {D}{Q}', 'add another column: {D}{Q}', 'we are missing {D}{Q}',
    'the form needs {D}{Q}', 'tack on {D}{Q}', 'extend the data with {D}{Q}', 'i forgot {D}{Q}, add it', 'add one more thing to remember: {D}{Q}', 'make room for {D}{Q}', 'a new column please: {D}{Q}',
    'keep track of {D}{Q} as well', 'my entries need {D}{Q}', 'give every entry {D}{Q}', 'add a place to type {D}{Q}', 'could the form also have {D}{Q}?', 'i want to store {D}{Q}', 'add to the data: {D}{Q}',
    'insert {D}{Q}', 'pls add {D}{Q}', 'add {D}{Q}, that is all', 'something is missing: {D}{Q}', 'please make {D}{Q}', 'let there be {D}{Q}', 'i would like to note down {D}{Q}', 'extra field wanted: {D}{Q}',
    'can i get {D}{Q}?', 'build in {D}{Q}',
  ],
  add_stat: [
    'add {D}', 'i want {D}', 'show me {D}', 'can you put {D} on the screen?', 'please add {D}', 'give me {D}', 'i need {D}', 'could we have {D}?', 'put {D} on the screen', 'include {D}',
    'i would like to see {D}', 'there should be {D}', 'add {D} for me', 'make {D}', 'new: {D}', 'pls add {D}', 'also show {D}', 'one more number: {D}', 'a new number please: {D}', 'create {D}',
    'display {D}', 'i keep wanting {D}', 'let me see {D}', 'put in {D}', 'we need {D}', 'would you add {D}?', 'i am missing {D}', 'can the screen have {D}?', 'add on {D}', 'show {D} as well',
    'give the screen {D}', 'build {D}', 'i want to look at {D}', 'throw in {D}', 'insert {D}', 'could you show {D}?', 'let us add {D}', 'i would love {D}', 'add this: {D}', 'extra please: {D}',
  ],
  add_chart: [
    'add {D}', 'i want {D}', 'show me {D}', 'can you add {D}?', 'please add {D}', 'give me {D}', 'i need {D}', 'could we have {D}?', 'put {D} on the screen', 'include {D}',
    'i would like to see {D}', 'there should be {D}', 'draw {D}', 'make {D}', 'new: {D}', 'pls add {D}', 'also show {D}', 'one more thing to look at: {D}', 'a new graph please: {D}', 'create {D}',
    'display {D}', 'i keep wanting {D}', 'let me see {D}', 'put in {D}', 'we need {D}', 'would you add {D}?', 'i am missing {D}', 'can the screen have {D}?', 'add on {D}', 'plot {D}',
    'give the screen {D}', 'build {D}', 'i want to look at {D}', 'throw in {D}', 'insert {D}', 'could you show {D}?', 'let us add {D}', 'i would love {D}', 'add this: {D}', 'extra please: {D}',
  ],
  add_list: [
    'add {D}', 'i want {D}', 'show me {D}', 'can you add {D}?', 'please add {D}', 'give me {D}', 'i need {D}', 'could we have {D}?', 'put {D} on the screen', 'include {D}',
    'i would like to see {D}', 'there should be {D}', 'make {D}', 'new: {D}', 'pls add {D}', 'also show {D}', 'one more thing: {D}', 'create {D}', 'display {D}', 'let me see {D}',
    'put in {D}', 'we need {D}', 'would you add {D}?', 'i am missing {D}', 'can the screen have {D}?', 'add on {D}', 'build {D}', 'i want to look at {D}', 'throw in {D}', 'insert {D}',
    'could you show {D}?', 'let us add {D}', 'i would love {D}', 'add this: {D}', 'extra please: {D}', 'the app should show {D}', 'i want to scroll through {D}', 'give the screen {D}', 'show {D} as well', 'also add {D}',
  ],
  add_reminder: [
    'add {D}', 'i want {D}', 'set {D}', 'can you add {D}?', 'please add {D}', 'give me {D}', 'i need {D}', 'could you set up {D}?', 'put in {D}', 'include {D}',
    'i would like {D}', 'there should be {D}', 'make {D}', 'new: {D}', 'pls add {D}', 'also set {D}', 'one more reminder: {D}', 'create {D}', 'remind me: {D}', 'let me have {D}',
    'schedule {D}', 'we need {D}', 'would you add {D}?', 'i keep forgetting, so add {D}', 'can the app have {D}?', 'add on {D}', 'build {D}', 'ping me with {D}', 'throw in {D}', 'insert {D}',
    'could you add {D}?', 'let us add {D}', 'i would love {D}', 'add this: {D}', 'extra please: {D}', 'the app should have {D}', 'turn on {D}', 'i do not want to forget, add {D}', 'set up {D}', 'also add {D}',
  ],
};
// the pool "add_section" reuses add_list templates
TPL2.add_section = TPL2.add_list;

export const OPEN = [
  'hey,', 'ok so', 'hi,', 'quick one:', 'also,', 'so', 'actually,', 'btw', 'listen,', 'hmm,', 'one thing:', 'next,', 'alright,', 'okay,', 'right,', 'um,', 'sorry, one more:', 'by the way,',
  'when you have a minute,', 'real quick,', 'now,', 'last thing:', 'thanks, and', 'yo,', 'hello,', 'one small change:', 'small request:', 'something i noticed:', 'ok last thing,', 'new idea,',
];
export const CLOSE_N = [
  ', thanks', ', please', ', if that is ok', ' when you can', ', thanks a lot', ', that would be great', ', should be easy', ', not urgent', ', thank you', ', keep everything else the same',
  ', nothing else needs to change', ', just that', ', for my own use', ', i use this app daily', ', i will use it every day', ', it is for work', ', it will help me a lot', ', i look at this every day',
];
export const CLOSE_R = [
  ', it is really annoying otherwise', ', it keeps confusing me', ', it bugs me', ', it makes more sense that way', ', my kids keep asking', ', my wife asked for it', ', i showed it to a friend and they said so',
];
