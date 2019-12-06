// Utils
const strReverse = s => s.split('').reverse().join('');
const generateId = () => Math.random().toString(16).slice(2);
const beginSpacesRe = /^([ ]+)/g;
const getHead = a => a[a.length-1];
const concat = (a, b) => a.concat(b);
const flatten = a => a.reduce(concat, []);

// Regular Actions
module.exports.type = code => ({ action: 'type', code });
module.exports.findNewCursorPos = fn => ({ action: 'find_new_cursor_pos', fn });
module.exports.pauseForMilliseconds = time => ({ action: 'wait', time });
module.exports.changeKeystrokeTime = time => ({ action: 'change_keystroke_time', time });
module.exports.createCursorMarker = label => ({ action: 'mark_cursor', label });
module.exports.gotoCursorMarker = label => ({ action: 'goto_marker', label });
module.exports.setInstantMode = value => ({ action: 'set_instant_mode', value });
module.exports.backspace = (n = 1, wait=0) => ({ action: 'backspace', n, wait });
module.exports.scrollYByOffset = (target, everyMs = 10, instant = false) => ({ action: 'scroll_y', target, everyMs, instant });
module.exports.setScrollY = (target) => ({ action: 'set_scroll_y', target });
module.exports.stop = () => ({ action: 'stop' });
module.exports.modifyCode = (fn) => ({ action: 'modify_code', fn });

// Derrived Actions
module.exports.startAfterFirstInstanceOf = str =>{
  return module.exports.findNewCursorPos(code => {
    const offset = code.indexOf(str);
    if (offset === -1) {
      throw new Error(`Unable to find an instance of string "${str}"`);
    }
    return offset + str.length;
  });
}
module.exports.startAfterNextInstanceOf = str => {
  return module.exports.findNewCursorPos((code, cursor) => {
    const offset = code.slice(cursor).indexOf(str);
    if (offset === -1) {
      throw new Error(`Unable to find a next instance of string "${str}"`);
    }
    return cursor + offset + str.length;
  });
}
module.exports.startAfterPreviousInstanceOf = str => {
  return module.exports.findNewCursorPos((code, cursor) => {
    const nCharsBack = strReverse(code.slice(0, cursor)).indexOf(strReverse(str));
    if (nCharsBack === -1) {
      throw new Error(`Unable to find a previous instance of string "${str}"`);
    }
    return cursor - nCharsBack;
  });
}
module.exports.startAfterSequence = sequence => sequence.map(startAfterNextInstanceOf);
module.exports.alterCursor = fn => module.exports.findNewCursorPos((_, cursor) => fn(cursor));
module.exports.cursorForward = (n=1) => module.exports.alterCursor(c => c + n);
module.exports.cursorBack = (n=1) => module.exports.alterCursor(c => c - n);
module.exports.typeIndented = (code, level = 0, indentationMarker = '  ') => {
  return module.exports.type(
    indentationMarker.repeat(level) +
    code.replace(/\n/g, `\n${indentationMarker.repeat(level)}`)
  );
}

// Multi Actions
module.exports.repeatActions = (n, actions) => Array.from({length: n}, () => actions);
module.exports.typeIndentedBlock = (code, startLevel = 0, indentationMarker = '  ') => {
  const blockStack = [
    { level: 0, stack: [], id: generateId()}
  ];
  const entries = [];

  code.split('\n').forEach(line => {
    const res = line.match(beginSpacesRe);
    const level = res
      ? res[0].length / indentationMarker.length
      : line === ''
        ? getHead(blockStack).level
        : 0;

    if (level > blockStack.length - 1) {
      blockStack.push({
        level,
        stack: [],
        id: generateId()
      });
    } else if (level < blockStack.length - 1) {
      // pop the block and generate an entry for the previous block
      const b = blockStack.pop();
      const firstContent = (b.stack.length > 1 ? '\n' : '') + b.stack.slice(0, b.stack.length-1).join('\n');
      const lastContent = '\n' + b.stack[b.stack.length-1];
      entries.unshift([
        ...(firstContent === '\n'
          ? [module.exports.type('\n')]
          : [module.exports.typeIndented(firstContent, startLevel + b.level)]),
        module.exports.createCursorMarker(b.id),
        ...(lastContent === '\n'
          ? [module.exports.type('\n')]
          : [module.exports.typeIndented(lastContent, startLevel + b.level)]),
        gotoCursorMarker(b.id),
      ]);
    }

    // Add the line to the current block
    getHead(blockStack).stack.push(line.replace(beginSpacesRe, ''));
  });

  // finalise the last block
  const b = blockStack.pop();
  const firstContent = b.stack.slice(0, b.stack.length-1).join('\n');
  const lastContent = (b.stack.length > 1 ? '\n' : '') + b.stack[b.stack.length-1];

  entries.unshift([
    ...(firstContent === '\n'
      ? [module.exports.type('\n')]
      : [module.exports.typeIndented(firstContent, startLevel + b.level)]),
    module.exports.createCursorMarker(b.id),
    ...(lastContent === '\n'
      ? [type('\n')]
      : [module.exports.typeIndented(lastContent, startLevel + b.level)]),
    module.exports.gotoCursorMarker(b.id),
  ]);

  const flat = flatten(entries);

  return flat.slice(0, flat.length-1);
};

// Turn any set of Multi, Derrived, or Normal Actions into a flat list
module.exports.createTaskList = flatten;

