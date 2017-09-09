const listNameRegex = /^(\w+)\[([-\w]+)\]$/;

function findIndexById(arr, id) {
  for (let i = 0; i < arr.length; i++) {
    let itemId = (arr[i].id || arr[i].key) + '';
    if (itemId === (id + '')) return i;
  }
  return -1;
}

function hasArray(space) {
  return Array.isArray(space.preState);
}

// Called whenever state is changed, so subscribers are notified
function notifyChange(space, causedBy) {
  space.subscribers.forEach(function(subscriber) {
    subscriber(causedBy);
  });
  if (space.nextParent) notifyChange(space.nextParent, causedBy);
}

function defineKeyGetter(space) {
  Object.defineProperty(space, 'key', {
    enumerable: true,
    get: function() {
      return space.state.id;
    }
  });
}

// Given a state object, replaces nested spaces with their states
function generateState(state) {
  if (state instanceof Space) {
    const space = state;
    return generateState(space.state);
  }

  state = Array.isArray(state) ? state.slice() : Object.assign({}, state);

  Object.keys(state).forEach(function (key) {
    const item = state[key];
    if (item instanceof Space) {
      state[key] = generateState(item.state);
    } else if (Array.isArray(item)) {
      state[key] = item.map(function (item) {
        return generateState(item);
      });
    } else if (item && typeof item === 'object') {
      state[key] = Object.assign({}, item);
    } else {
      state[key] = item;
    }
  });
  return Object.freeze(state);
}

function applyMerge(state, mergeObj) {
  Object.keys(mergeObj).forEach(function (key) {
    const stateVal = state[key];
    if (stateVal instanceof Space) {
      applyMerge(stateVal.preState, mergeObj[key]);
    } else {
      state[key] = mergeObj[key];
    }
  });
}

function mergeState(space, mergeObj, actionName) {
  actionName = actionName ? actionName : 'unknown';
  const actionLog = space.name + '#' + actionName;

  // Nothing was returned by action, so do nothing
  if (mergeObj === undefined) return;
  // Null was returned, if it's a list item, remove from list
  if (mergeObj === null && space.key) {
    const id = space.state.id;
    if (!id && !Array.isArray(space.nextParent.preState)) {
      throw new Error('Unexpected null returned from action');
    }

    const list = space.nextParent.preState;
    const index = findIndexById(list, id);
    list.splice(index, 1);
    notifyChange(space, actionLog);
    return;
  }

  // An array was returned, overwrite the previous state with it
  if (Array.isArray(mergeObj)) {
    space.preState = mergeObj;
    notifyChange(space, actionLog);
    return;
  }

  // An object with attributes returned, update each key refenced
  Object.keys(mergeObj).forEach(function(key) {
    const val = mergeObj[key];
    if (Array.isArray(val)) {
      const list = val;
      list.forEach(function(item) {
        if (item instanceof Space) {
          if (item.state.id === undefined) {
            throw new Error('All spaces in lists require an `id` attribute');
          }
          defineKeyGetter(item);
        }
      });
    } else if (val === null) {
      delete space.preState[key];
      delete mergeObj[key];
    }
  });
  applyMerge(space.preState, mergeObj);
  notifyChange(space, actionLog);
}

function Space(initialState, nextParent) {
  Object.defineProperty(this, 'state', {
    get: Space.prototype.getState,
    enumerable: true
  });
  this.setState = this.setState.bind(this);
  this.subSpace = this.subSpace.bind(this);
  this.parentSpace = this.parentSpace.bind(this);

  // Consider these private attributes
  // They are not part of the API
  // They are non-enumerable so that they don't get passed
  // down as props when doing `<Component {...mySpace} />`
  Object.defineProperties(this, {
    preState: {
      value: initialState,
      enumerable: false,
      writable: true
    },
    subscribers: {
      value: [],
      enumerable: false
    },
    name: {
      value: 'root',
      writable: true,
      enumerable: false
    },
    nextParent: {
      value: nextParent || null,
      writable: true,
      enumerable: false
    }
  });
}

Space.prototype.setState = function setState(action, actionName) {
  const self = this;

  if (typeof action === 'object') {
    const mergeObj = action;
    mergeState(self, mergeObj, actionName);
  } else if (typeof action === 'function') {
    return (function(event) {
      const mergeObj = action(self, event);
      mergeState(self, mergeObj, actionName || action.name);
    });
  }
};

Space.prototype.subSpace = function space(nameOrId) {
  let item, name, id, index;

  if (Array.isArray(this.preState)) {
    id = nameOrId;
    index = id && findIndexById(this.preState, id);
    if (index === -1) {
      throw new Error(
        'Could not find item with id ' + id + ' in ' + this.name
      );
    }
    item = this.preState[index];
  } else {
    name = nameOrId;
    item = this.preState[name];
  }

  let subSpace;

  // If the space already exists use it, otherwise create it, and attach it to
  // the parent space
  if (item instanceof Space) {
    subSpace = item;
  } else {
    subSpace = new Space(item || {}, this);
    if (id) {
      defineKeyGetter(subSpace); // Useful for rendering in React
      this.preState[index] = subSpace;
    } else {
      this.preState[name] = subSpace;
    }
  }

  subSpace.name = id ? this.name + '[' + id + ']' : name;

  return subSpace;
};

Space.prototype.subscribe = function subscribe(subscriber) {
  this.subscribers.push(subscriber);
  subscriber('initialized');
};

Space.prototype.getState = function getState() {
  return generateState(this.preState);
};

Space.prototype.parentSpace = function parentSpace(parentName) {
  if (this.name === parentName) return this;
  if (!this.nextParent) return null;
  return this.nextParent.parentSpace(parentName);
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Space;
} else {
  window.Space = Space;
}
