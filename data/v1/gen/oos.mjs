// out-of-scope clauses: the program covers the offline part only
export const OOS = [
  ['messaging', 'text my wife when I reach the goal'], ['messaging', 'send a WhatsApp message to my friends when I finish'], ['messaging', 'email me a summary every night'],
  ['messaging', 'message my doctor the numbers every week'], ['messaging', 'SMS my mother when I am done'], ['messaging', 'send the report to my boss by email'],
  ['sync', 'sync it between my phone and my wife\'s phone'], ['sync', 'share it with my family so they see it live'], ['sync', 'back it up to Google Drive automatically'],
  ['sync', 'let my team log in and see the same data'], ['sync', 'keep it in sync with my laptop'],
  ['internet', 'pull the latest prices from the internet'], ['internet', 'show live scores from the web'], ['internet', 'get the data from my Fitbit automatically'],
  ['internet', 'look up the weather online each day'], ['internet', 'post my progress on Instagram'], ['internet', 'import my bank transactions from my bank app'],
  ['camera', 'scan the barcode of each item with the camera'], ['camera', 'take a photo of the receipt and read the numbers from it'], ['camera', 'use the camera to recognise my food'],
  ['print', 'print a PDF report at the end of the month'], ['print', 'print receipts for my customers'],
  ['voice', 'let me add entries by speaking'], ['location', 'use my GPS location to fill things in'], ['location', 'show everything on a map'],
  ['other_apps', 'lock my other apps until I finish'], ['ai', 'let an AI coach read my data and give advice every day'],
];

// which kinds make sense for which archetype
export const OOS_FOR = {
  quantity: ['messaging', 'sync', 'internet', 'voice', 'ai', 'other_apps'],
  countlog: ['messaging', 'sync', 'voice', 'ai', 'internet'],
  habits: ['sync', 'messaging', 'ai', 'internet', 'voice'],
  expenses: ['camera', 'internet', 'print', 'sync', 'messaging', 'voice'],
  mixedlog: ['sync', 'print', 'ai', 'voice', 'messaging', 'internet'],
  stock: ['camera', 'print', 'sync', 'internet', 'messaging'],
  todo: ['sync', 'messaging', 'voice', 'ai'],
  ringcounter: ['sync', 'messaging', 'voice', 'other_apps', 'ai'],
  scoreboard: ['sync', 'internet', 'voice', 'messaging', 'camera'],
  timer: ['other_apps', 'sync', 'voice', 'ai', 'messaging'],
  ledger: ['messaging', 'print', 'sync', 'internet', 'voice'],
  datereminder: ['messaging', 'sync', 'internet', 'ai'],
};
