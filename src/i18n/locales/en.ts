export const en = {
  app: {
    title: 'Tick to Done',
  },
  board: {
    column: {
      todo: 'To Do',
      inProgress: 'In Progress',
      review: 'Code Review',
      done: 'Done',
    },
    cardCount_one: '{{count, number}} card',
    cardCount_other: '{{count, number}} cards',
    dnd: {
      instructions: 'Drag a card with the mouse to move it to another column or to change its order.',
      roleDescription: 'Draggable card',
      pickedUp: 'Picked up {{card}}.',
      overColumn: '{{card}} is over {{column}}.',
      overNothing: '{{card}} is no longer over a column.',
      dropped: '{{card}} was dropped.',
      cancelled: 'Dragging was cancelled. {{card}} stays where it was.',
    },
  },
  card: {
    number: 'Task {{number}}',
    title: {
      anotherTask: 'Another task',
    },
    complexity: 'Complexity: {{value, number}}',
    implementation: 'Implementation: {{done, number}}/{{total, number}}',
    rework: 'Rework: {{done, number}}/{{total, number}}',
    returned: 'Returned from review',
    inReview: 'In review',
    approved: 'Approved',
    reward: '+{{value, number}} Credits',
    work: 'Work',
  },
  shop: {
    title: 'Shop',
    price: '{{value, number}} Credits',
    level: 'Level {{value, number}}',
    buy: 'Buy',
    maxed: 'Max',
    upgrade: {
      betterKeyboard: {
        name: 'Better Keyboard',
        effect: 'Work per click: {{current, number}} → {{next, number}}',
      },
      aiDeveloper: {
        name: 'AI Developer',
        effect: 'Works on the top tasks in In Progress by itself, tick by tick.',
      },
      autoAssign: {
        name: 'Auto Assign',
        effect: 'Takes the top task from To Do when AI has a free slot.',
      },
      autoSubmit: {
        name: 'Auto Submit',
        effect: 'Sends the top finished task to Code Review.',
      },
      autoComplete: {
        name: 'Auto Complete',
        effect: 'Moves the top approved task to Done.',
      },
      aiWorkPower: {
        name: 'AI Work Power',
        effect: 'AI work per tick: {{current, number}} → {{next, number}}',
      },
      aiTickSpeed: {
        name: 'AI Tick Speed',
        effect: 'AI tick: {{current, number(maximumFractionDigits: 3)}} s → {{next, number(maximumFractionDigits: 3)}} s',
        effectMaxed: 'AI tick: {{current, number(maximumFractionDigits: 3)}} s',
      },
      parallelProcessing: {
        name: 'Parallel Processing',
        effect: 'Tasks AI works on at once: {{current, number}} → {{next, number}}',
        effectToDoLimit: 'To Do limit: {{current, number}} → {{next, number}}',
        effectBoardLimit: 'Board limit: {{current, number}} → {{next, number}}',
      },
      fasterBacklog: {
        name: 'Faster Backlog',
        effect:
          'New task every {{current, number(maximumFractionDigits: 3)}} s → {{next, number(maximumFractionDigits: 3)}} s',
        effectMaxed: 'New task every {{current, number(maximumFractionDigits: 3)}} s',
      },
      biggerTasks: {
        name: 'Bigger Tasks',
        effect:
          'New task complexity: {{currentMin, number}}–{{currentMax, number}} → {{nextMin, number}}–{{nextMax, number}}',
      },
    },
  },
  automation: {
    title: 'Automation',
    timer: '{{name}} timer',
    working: 'Working',
    idle: 'Idle',
    aiPower: 'Work per tick: {{power, number}}',
    aiTick: 'Tick: {{tick, number(maximumFractionDigits: 3)}} s',
    aiSlots: 'Tasks at once: {{slots, number}}',
  },
  journal: {
    title: 'Activity',
    moved: {
      player: 'You moved {{card}} to {{column}}',
      autoAssign: 'Auto Assign took {{card}} into {{column}}',
      autoSubmit: 'Auto Submit sent {{card}} to {{column}}',
      autoComplete: 'Auto Complete moved {{card}} to {{column}}',
    },
    completed: {
      player: 'You completed {{card}}',
      autoAssign: 'Auto Assign completed {{card}}',
      autoSubmit: 'Auto Submit completed {{card}}',
      autoComplete: 'Auto Complete completed {{card}}',
    },
    reviewPassed: '{{card}} passed review',
    reviewReturned_one: '{{card}} returned to {{column}} with {{count, number}} unit of rework',
    reviewReturned_other: '{{card}} returned to {{column}} with {{count, number}} units of rework',
  },
  footer: {
    version: '{{name}} v{{version}}',
    separator: '·',
    stage: 'Prototype',
    source: 'GitHub',
    reset: {
      open: 'Reset progress',
      title: 'Reset progress?',
      text: 'Credits, upgrades and every task on the board will be lost. The game starts over from the first task. This cannot be undone.',
      cancel: 'Cancel',
      confirm: 'Reset',
    },
  },
  stats: {
    credits: '{{value, number}} Credits',
    tasksDone_one: '{{count, number}} task done',
    tasksDone_other: '{{count, number}} tasks done',
  },
} as const;
