const test = require('tape');
const {createCodeTyper} = require('../src/index');
const actions = require('../src/actions');

test('type should emit step complete events for each character', t => {
  const testStr = 'hello world';
  t.plan(testStr.length);
  let charCount = 1;

  const step = createCodeTyper(
    [ actions.type(testStr) ],
    {},
    {
      onStepComplete: code => t.equal(code, testStr.slice(0, charCount++)),
      onTaskComplete: () => t.end()
    }
  );

  step();
});

test('type should emit task complete event', t => {
  t.plan(1);
  const testStr = 'hello world';
  const step = createCodeTyper(
    [ actions.type(testStr) ],
    {},
    {
      onTaskComplete: code => {
        t.equal(code, testStr);
        t.end();
      }
    }
  );

  step();
});

test('modifyCode should arbitrarily update code', t => {
  let i = 0;
  const step = createCodeTyper(
    [
      actions.type('abcdefgh'),
      actions.modifyCode(() => 'ijklmnop')
    ],
    {},
    {
      onTaskComplete: code => {
        if (i === 1) {
          t.equal(code, 'ijklmnop');
          t.end();
        } else {
          i++;
          step();
        }
      }
    }
  );

  step();
});

test('pauseForMilliseconds should wait the right amount of time to pass before continuing', t => {
  let isComplete = false;
  const tasks = [ actions.pauseForMilliseconds(1000) ];
  const step = createCodeTyper(tasks, {} , {
    onTaskComplete: () => {
      isComplete = true;
    }
  });

  setTimeout(() => {
    t.false(isComplete);
  }, 999);

  setTimeout(() => {
    t.true(isComplete);
    t.end();
  }, 1001);

  step();
});

test('pauseForMilliseconds should not wait if instant mode is on', t => {
  const tasks = [
    actions.setInstantMode(true),
    actions.pauseForMilliseconds(1000),
  ];

  let isComplete = false;
  const step = createCodeTyper(tasks, {}, {
    onComplete: () => {
      isComplete = true;
    },
    onTaskComplete: () => step()
  });

  setTimeout(() => {
    t.true(isComplete);
  }, 999);

  setTimeout(() => {
    t.true(isComplete);
    t.end();
  }, 1001);

  step();
});

test('cursor should be referencable via a marker', t => {
  const tasks = [
    actions.type('hello'),
    actions.createCursorMarker('here'),
    actions.type('la la la la la'),
    actions.gotoCursorMarker('here'),
    actions.type('in the middle')
  ];

  const step = createCodeTyper(tasks, {}, {
    onComplete: code => {
      t.equal(code, 'helloin the middlela la la la la');
      t.end();
    },
    onTaskComplete: () => step()
  });

  step();
});

test('alterCursor should move the cursor to an expected index', t => {
  const tasks = [
    actions.type('hello world'),
    actions.alterCursor(() => 0),
    actions.type('wayo')
  ];

  const step = createCodeTyper(tasks, {}, {
    onComplete: code => {
      t.equal(code, 'wayohello world');
    },
    onTaskComplete: () => step()
  });

  step();

  const tasks2 = [
    actions.type('hello world'),
    actions.alterCursor(() => 5),
    actions.type('wayo')
  ];

  const step2 = createCodeTyper(tasks2, {}, {
    onComplete: code => {
      t.equal(code, 'hellowayo world');
      t.end();
    },
    onTaskComplete: () => step2()
  });

  step2();
});

test('startAfterFirstInstanceOf', t => {
  const tasks = [
    actions.type('hello hello hello hello'),
    actions.startAfterFirstInstanceOf('hello'),
    actions.type('wayo')
  ];

  const step = createCodeTyper(tasks, {}, {
    onComplete: code => {
      t.equal(code, 'hellowayo hello hello hello');
      t.end();
    },
    onTaskComplete: () => step()
  });

  step();
});

test('startAfterNextInstanceOf', t => {
  const tasks = [
    actions.type('hello world'),
    actions.createCursorMarker('here'),
    actions.type(' stuff stuff stuff hello world'),
    actions.gotoCursorMarker('here'),
    actions.startAfterNextInstanceOf('hello'),
    actions.type('wayo')
  ];

  const step = createCodeTyper(tasks, {}, {
    onComplete: code => {
      t.equal(code, 'hello world stuff stuff stuff hellowayo world');
      t.end();
    },
    onTaskComplete: () => step()
  });

  step();
});

test('startAfterPreviousInstanceOf', t => {
  const tasks = [
    actions.type('hello world'),
    actions.createCursorMarker('here'),
    actions.type(' stuff stuff stuff hello world'),
    actions.gotoCursorMarker('here'),
    actions.startAfterPreviousInstanceOf('hello'),
    actions.type('wayo')
  ];

  const step = createCodeTyper(tasks, {}, {
    onComplete: code => {
      t.equal(code, 'hellowayo world stuff stuff stuff hello world');
      t.end();
    },
    onTaskComplete: () => step()
  });

  step();
});

test.only('backspace cursor preservation (instantMode = false)', t => {
  const tasks = [
    actions.setInstantMode(true),
    actions.type('hello world hello world'),
    actions.backspace(10),
    actions.type('oly smokes')
  ];

  const step = createCodeTyper(tasks, {}, {
    onComplete: code => {
      t.equal(code, 'hello world holy smokes');
      t.end();
    },
    onTaskComplete: () => step()
  });

  step();
});