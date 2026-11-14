export const en = {
  app: {
    title: 'Vibecode',
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
    work: 'Work',
  },
  stats: {
    credits: '{{value, number}} Credits',
    tasksDone_one: '{{count, number}} task done',
    tasksDone_other: '{{count, number}} tasks done',
  },
} as const;
