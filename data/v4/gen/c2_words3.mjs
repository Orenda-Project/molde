// c2_words3.mjs: round 3 wording for add_field, add_chart, add_list (and the section forms), written the way a person talks.
// The thing is described by what it means or what the user wants to see. No type tokens, no colons, no code order.
// D is the description of the thing (made from the program line by c2_edits.mjs), Q a table phrase, W the way the user names the screen position.
export const TPL3 = {
  add_field: [
    'i want to record {D}{Q}', 'also let me note {D}{Q}', 'can you add a place to enter {D}{Q}?', 'we also need {D}{Q}', 'let me keep {D} too{Q}', 'please track {D}{Q}',
    'i forgot to ask for {D}{Q}', 'could the form ask for {D}{Q}?', 'add {D}{Q}', 'i need to write down {D}{Q}', 'let me fill in {D}{Q}', 'make the form collect {D}{Q}', 'it should also store {D}{Q}',
    'one more thing to enter, {D}{Q}', 'can i also put in {D}{Q}?', 'i would like to be able to enter {D}{Q}', 'the entries are missing {D}{Q}', 'also ask me for {D}{Q}', 'let me add {D}{Q}',
    'i want my entries to include {D}{Q}', 'please give the form room for {D}{Q}', 'could you make it possible to note {D}{Q}?', 'i keep wanting to write down {D}{Q}', 'a new question on the form please, {D}{Q}',
    'start keeping {D}{Q}', 'there is no way to enter {D}{Q}, please fix that', 'would you let me log {D}{Q}?', 'can the app remember {D}{Q}?', 'i also want to know {D}{Q}', 'put in a spot for {D}{Q}',
    'ask for {D}{Q} as well', 'include {D}{Q}', 'let each entry have {D}{Q}', 'i need one more detail, {D}{Q}', 'give me a box for {D}{Q}', 'extra detail to save, {D}{Q}',
    'we should be able to enter {D}{Q}', 'i want to type in {D}{Q}', 'can you make room for {D}{Q}?', 'also store {D}{Q}', 'please let me say {D}{Q}', 'i would like the form to take {D}{Q}',
    'record {D}{Q} as well', 'my entries should hold {D}{Q}', 'can we capture {D}{Q}?', 'let me save {D}{Q}', 'add a way to give {D}{Q}', 'the form needs a place for {D}{Q}', 'it would help to have {D}{Q}',
    'let me also say {D}{Q}', 'i need the app to take {D}{Q}', 'what i am missing is {D}{Q}', 'make sure i can enter {D}{Q}', 'could you add an input for {D}{Q}?', 'i want a field for {D}{Q}',
    'also keep a record of {D}{Q}', 'let me jot down {D}{Q}', 'we need to be able to say {D}{Q}', 'can i tell it {D}{Q}?', 'add something so i can enter {D}{Q}', 'give each one {D}{Q}',
    'one more input please, {D}{Q}', 'i would like to track {D}{Q}', 'next to the others, let me enter {D}{Q}',
  ],
  add_chart: [
    'show me {D}', 'i would like to see {D}', 'can you add {D}?', 'i want {D}', 'give me {D}', 'could we have {D}?', 'please put {D} on the screen', 'let me see {D}',
    'i keep wanting {D}', 'it would help to see {D}', 'add {D}', 'display {D}', 'i want to look at {D}', 'put {D} on the screen', 'can the screen show {D}?', 'make {D}',
    'build {D}', 'draw {D}', 'i need {D}', 'a picture of my numbers please, {D}', 'i would love to see {D}', 'let the screen have {D}', 'throw in {D}',
    'one more graph, {D}', 'would you show {D}?', 'i am missing {D}', 'also show {D}', 'it would be nice to have {D}', 'pls add {D}', 'next i want to see {D}', 'put in {D}',
    'can i get {D}?', 'i want a quick look at {D}', 'create {D}', 'let there be {D}', 'give the app {D}', 'the screen needs {D}', 'i would like the app to draw {D}',
    'show {D} for me', 'bring up {D}', 'i want to watch {D}', 'add a graph that shows {D}', 'can you draw me {D}?', 'let me check {D}',
    'could you turn my entries into {D}?', 'make a picture of {D}', 'i need to see {D}', 'visualise {D}', 'add something that shows {D}', 'let me keep an eye on {D}', 'a chart please, {D}',
    'set up {D}', 'i want to track visually {D}', 'put {D} where i can see it', 'let us have {D}', 'give me a view of {D}', 'would it be possible to see {D}?', 'put a graph on the screen, {D}',
  ],
  add_list: [
    'show me {D}', 'i would like to see {D}', 'can you add {D}?', 'i want {D}', 'give me {D}', 'could we have {D}?', 'please put {D} on the screen', 'let me see {D}',
    'i want to scroll through {D}', 'it would help to see {D}', 'add {D}', 'display {D}', 'i want to look back at {D}', 'put {D} on the screen', 'can the screen show {D}?', 'list {D}',
    'build {D}', 'i need {D}', 'let me read through {D}', 'i would love to see {D}', 'let the screen have {D}', 'throw in {D}', 'also show {D}', 'pls add {D}', 'next i want {D}',
    'put in {D}', 'can i get {D}?', 'i want to check {D}', 'create {D}', 'let there be {D}', 'the screen needs {D}', 'show {D} for me', 'bring up {D}', 'i want to browse {D}',
    'i want to be able to look at {D}', 'could you show me {D}?', 'let me go over {D}', 'make a place to see {D}', 'under that, show {D}',
    'i would like a way to look at {D}', 'add something that lists {D}', 'a place to read {D}, please', 'i want a screen area with {D}', 'bring {D} onto the screen', 'put {D} where i can see it', 'let us have {D}', 'give me a way to see {D}', 'add {D} to my screen', 'i need to be able to see {D}', 'keep {D} on the screen', 'let me review {D}',
    'also let me look at {D}', 'can you put up {D}?', 'just list {D}', 'give the app {D}', 'give me a look at {D}',
    'could you set up {D}?', 'i want to flip through {D}', 'let me find {D} on the screen', 'add a view of {D}', 'would you show {D} too?', 'let me look through {D}', 'one more view, {D}', ,
  ],
};
TPL3.add_section = [
  'show me {D}', 'i would like to see {D}', 'can you add {D}?', 'i want {D}', 'give me {D}', 'could we have {D}?', 'please put {D} on the screen', 'let me see {D}', 'add {D}', 'display {D}',
  'put {D} on the screen', 'can the screen show {D}?', 'create {D}', 'i need {D}', 'also show {D}', 'pls add {D}', 'next i want {D}', 'put in {D}', 'can i get {D}?', 'bring up {D}', 'make a place to see {D}',
  'add a view of {D}', 'let there be {D}', 'the screen needs {D}', 'give the app {D}', 'throw in {D}', 'i would love to see {D}', 'build {D}', 'one more thing on the screen, {D}', 'could you set up {D}?',
  'i would like the screen to have {D}', 'add this to my screen, {D}',
];

export const CLOSE_NEUTRAL = [', thanks', ', please', ', thank you', ' when you can', ', if that is ok', ', that would be great', ', thanks a lot'];
export const CLOSE_BY_CLS = {
  remove_one: [', i never look at it', ', it is just clutter', ', it takes up space'],
  reorder: [', i check it first', ', it reads better that way', ', that is the order i use it in'],
  rename_button: [', the old name is confusing', ', it is clearer that way'],
  rename_field: [', the old name is confusing', ', it is clearer that way'],
  add_option: [', i use it a lot', ', it comes up often'],
  sections: [', it is easier to read that way'],
};
