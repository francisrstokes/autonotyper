const {createTaskList} = require('./actions');

const alwaysTrue = () => true;
const noop = () => {};

const baseCallbacks = {
  onStepComplete: noop,
  onTaskComplete: noop,
  onComplete: noop
}

module.exports.createCodeTyper = (tasks_, capabilities = {}, callbacks_ = {}) => {
  if (!(typeof callbacks_ === 'object')) {
    throw new Error('callbacks argument must be an object');
  }

  if (!(typeof capabilities === 'object')) {
    throw new Error('capabilities argument must be an object');
  }

  const callbacks = {
    ...baseCallbacks,
    ...callbacks_
  };

  const tasks = createTaskList(tasks_);

  const state = {
    keyStrokeTime: 50,
    markers: {},
    taskIndex: 0,
    task: {
      typingIndex: 0,
      backspaceCount: -1,
      scrollTarget: {
        triggered: false,
        value: 0
      }
    },
    instantMode: false,
    code: '',
    cursor: 0
  };

  const gotoNextTask = () => {
    state.task.typingIndex = 0;
    state.task.backspaceCount = -1;
    state.taskIndex += 1;
  };

  const step = (canUpdate = alwaysTrue) => {
    if (!canUpdate()) {
      setTimeout(() => {
        step(canUpdate);
      }, 100);
      return;
    }

    if (state.taskIndex >= tasks.length) {
      callbacks.onComplete(state.code);
      return;
    }

    const activeTask = tasks[state.taskIndex];

    if (activeTask.action === 'stop') {
      callbacks.onComplete(state.code);
      return;
    }

    if (activeTask.action === 'modify_code') {
      state.code = activeTask.fn(state.code);
      gotoNextTask();
      return callbacks.onTaskComplete(state.code);
    }

    if (activeTask.action === 'type') {
      if (state.instantMode) {
        const nextCode = state.code.slice(0, state.cursor) +
          activeTask.code +
          state.code.slice(state.cursor, state.code.length);

        state.code = nextCode;
        state.cursor += activeTask.code.length;
        gotoNextTask();
        return callbacks.onTaskComplete(state.code);
      }

      const intervalRef = setInterval(() => {
        if (!canUpdate()) {
          return;
        }
        if (state.task.typingIndex < activeTask.code.length) {
          const nextCode = state.code.slice(0, state.cursor) +
            activeTask.code[state.task.typingIndex] +
            state.code.slice(state.cursor, state.code.length);

          state.code = nextCode;
          state.cursor += 1;
          state.task.typingIndex += 1;
          return callbacks.onStepComplete(state.code);
        } else {
          gotoNextTask();
          clearInterval(intervalRef);
          callbacks.onTaskComplete(state.code);
        }
      }, state.keyStrokeTime);
      return;
    }

    if (activeTask.action === 'wait') {
      if (state.instantMode) {
        gotoNextTask();
        return callbacks.onTaskComplete(state.code);
      }
      setTimeout(() => {
        gotoNextTask();
        callbacks.onTaskComplete(state.code);
      }, activeTask.time);
      return;
    }

    if (activeTask.action === 'set_instant_mode') {
      state.instantMode = activeTask.value;
      gotoNextTask();
      return callbacks.onTaskComplete(state.code);
    }

    if (activeTask.action === 'mark_cursor') {
      state.markers[activeTask.label] = state.cursor;
      gotoNextTask();
      return callbacks.onTaskComplete(state.code);
    }

    if (activeTask.action === 'goto_marker') {
      state.cursor = state.markers[activeTask.label];
      gotoNextTask();
      return callbacks.onTaskComplete(state.code);
    }

    if (activeTask.action === 'find_new_cursor_pos') {
      state.cursor = activeTask.fn(state.code, state.cursor);
      gotoNextTask();
      return callbacks.onTaskComplete(state.code);
    }

    if (activeTask.action === 'change_keystroke_time') {
      state.keyStrokeTime = activeTask.time;
      gotoNextTask();
      return callbacks.onTaskComplete(state.code);
    }

    if (activeTask.action === 'backspace') {
      if (state.instantMode) {
        state.code = state.code.slice(0, state.cursor - activeTask.n + 1) +
          state.code.slice(state.cursor + 1);

        state.cursor -= activeTask.n - 1;
        gotoNextTask();
        return callbacks.onTaskComplete(state.code);
      }

      if (state.task.backspaceCount === -1) {
        state.task.backspaceCount = activeTask.n;
      }

      const intervalRef = setInterval(() => {
        if (!canUpdate()) {
          return;
        }

        state.task.backspaceCount -= 1;
        state.code = state.code.slice(0, state.cursor) +
          state.code.slice(state.cursor + 1);

        if (state.task.backspaceCount > 0) {
          state.cursor -=  1;
          return callbacks.onStepComplete(state.code);
        } else {
          gotoNextTask();
          clearInterval(intervalRef);
          return callbacks.onTaskComplete(state.code);
        }
      }, state.keyStrokeTime);
      return;
    }

    if (activeTask.action === 'set_scroll_y') {
      if (capabilities && capabilities.setScrollY) {
        capabilities.setScrollY(activeTask.target);
      } else {
        throw new Error(`Action 'set_scroll_y' requires capability "setScrollY"`);
      }
      gotoNextTask();
      callbacks.onTaskComplete(state.code);
      return;
    }

    if (activeTask.action === 'scroll_y') {
      if (capabilities && capabilities.setScrollY && capabilities.getScrollY) {
        if (state.instantMode) {
          capabilities.setScrollY(capabilities.getScrollY() + activeTask.target);
          gotoNextTask();
          return callbacks.onTaskComplete(state.code);
        }
        state.task.scrollTarget = {
          triggered: true,
          value: capabilities.getScrollY() + activeTask.target
        };
        const intervalRef = setInterval(() => {
          const currentY = capabilities.getScrollY();
          if (currentY === state.task.scrollTarget.value) {
            state.task.scrollTarget.triggered = false;
            gotoNextTask();
            callbacks.onTaskComplete(state.code);
            clearInterval(intervalRef);
            return;
          }
          const direction = Math.sign(state.task.scrollTarget.value - currentY);
          const prev = currentY;
          capabilities.setScrollY(currentY + direction);

          // Can't scroll further
          if (prev === capabilities.getScrollY()) {
            state.task.scrollTarget.triggered = false;
            gotoNextTask();
            callbacks.onTaskComplete(state.code);
            clearInterval(intervalRef);
            return;
          }

          // No need to send a code update with callbacks.onStepComplete
        }, activeTask.everyMs);
        return;
      } else {
        throw new Error(`Action 'set_scroll_y' requires capabilities "setScrollY" and "getScrollY"`);
      }
    }

    // if we can't process this task, just go to the next task...
    gotoNextTask();
    callbacks.onTaskComplete(state.code);
  };

  return step;
};
