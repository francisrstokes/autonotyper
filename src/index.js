const {stop, createTaskList} = require('./actions');

module.exports.createCodeTyper = (tasks_, capabilities = {}) => {
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

  const step = (onStepComplete, onTaskComplete, canUpdate) => {
    if (!canUpdate()) {
      setTimeout(() => {
        step(onStepComplete, onTaskComplete, canUpdate);
      }, 100);
      return;
    }

    const activeTask = state.taskIndex >= tasks.length
      ? stop()
      : tasks[state.taskIndex];

    if (activeTask.action === 'modify_code') {
      state.code = activeTask.fn(state.code);
      gotoNextTask();
      return onTaskComplete(state.code);
    }

    if (activeTask.action === 'type') {
      if (state.instantMode) {
        const nextCode = state.code.slice(0, state.cursor) +
          activeTask.code +
          state.code.slice(state.cursor, state.code.length);

        state.code = nextCode;
        state.cursor += activeTask.code.length;
        gotoNextTask();
        return onTaskComplete(state.code);
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
          return onStepComplete(state.code);
        } else {
          gotoNextTask();
          clearInterval(intervalRef);
          onTaskComplete(state.code);
        }
      }, state.keyStrokeTime);
      return;
    }

    if (activeTask.action === 'wait') {
      if (state.instantMode) {
        gotoNextTask();
        return onTaskComplete(state.code);
      }
      setTimeout(() => {
        gotoNextTask();
        onTaskComplete(state.code);
      }, activeTask.time);
      return;
    }

    if (activeTask.action === 'set_instant_mode') {
      state.instantMode = activeTask.value;
      gotoNextTask();
      return onTaskComplete(state.code);
    }

    if (activeTask.action === 'mark_cursor') {
      state.markers[activeTask.label] = state.cursor;
      gotoNextTask();
      return onTaskComplete(state.code);
    }

    if (activeTask.action === 'goto_marker') {
      state.cursor = state.markers[activeTask.label];
      gotoNextTask();
      return onTaskComplete(state.code);
    }

    if (activeTask.action === 'find_new_cursor_pos') {
      state.cursor = activeTask.fn(state.code, state.cursor);
      gotoNextTask();
      return onTaskComplete(state.code);
    }

    if (activeTask.action === 'change_keystroke_time') {
      state.keyStrokeTime = activeTask.time;
      gotoNextTask();
      return onTaskComplete(state.code);
    }

    if (activeTask.action === 'backspace') {
      if (state.instantMode) {
        state.code = state.code.slice(0, state.cursor - activeTask.n + 1) +
          state.code.slice(state.cursor + 1);

        state.cursor -= activeTask.n + 1;
        gotoNextTask();
        return onTaskComplete(state.code);
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
          return onStepComplete(state.code);
        } else {
          gotoNextTask();
          clearInterval(intervalRef);
          return onTaskComplete(state.code);
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
      onTaskComplete(state.code);
      return;
    }

    if (activeTask.action === 'scroll_y') {
      if (capabilities && capabilities.setScrollY && capabilities.getScrollY) {
        if (state.instantMode) {
          capabilities.scrollY(capabilities.getScrollY() + activeTask.target);
          gotoNextTask();
          return onTaskComplete(state.code);
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
            onTaskComplete(state.code);
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
            onTaskComplete(state.code);
            clearInterval(intervalRef);
            return;
          }

          // No need to send a code update with onStepComplete
        }, activeTask.everyMs);
        return;
      } else {
        throw new Error(`Action 'set_scroll_y' requires capabilities "setScrollY" and "getScrollY"`);
      }
    }

    // if we can't process this task, just go to the next task...
    gotoNextTask();
    onTaskComplete(state.code);
  };

  return step;
};
