const listNameRegex = /^(\w+)\[([-\w]+)\]$/;

function findIndexById(arr, id) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].id === id || arr[i].key === id) return i;
  }
}

// Called whenever state is changed, so subscribers are notified
function notifyChange(space, causedBy) {
  space.subscribers.forEach(function(subscriber) {
    debugger;
    subscriber(causedBy);
  });
  if (space.nextParent) notifyChange(space.nextParent, causedBy);
}

// Given a state object, replaces nested spaces with their states
function generateState(state) {
  if (state instanceof Space) {
    const space = state;
    return generateState(space.state);
  }

  Object.keys(state).forEach(function (key) {
    const item = state[key];
    if (item instanceof Space) {
      state[key] = generateState(item.state);
    } else if (Array.isArray(item)) {
      state[key] = item.map(function (item) {
        return generateState(item);
      });
    } else {
      state[key] = Object.freeze(item);
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

function Space(initialState, nextParent) {
  Object.defineProperty(this, 'state', {
    get: Space.prototype.getState,
    enumerable: true
  });
  this.doAction = this.doAction.bind(this);
  this.subSpace = this.subSpace.bind(this);
  this.parentSpace = this.parentSpace.bind(this);

  // Consider these private attributes
  // They are not part of the API
  // They are non-enumerable so that they don't get passed
  // down as props when doing `<Component {...mySpace} />`
  Object.defineProperties(this, {
    preState: {
      value: initialState,
      enumerable: false
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

Space.prototype.doAction = function doAction(action) {
  const self = this;
  return (function(event) {
    const mergeObj = action(self, event);
    const actionName = action.name ? action.name : 'unknownAction';
    const actionLog = self.name + '#' + actionName;

    // Nothing was returned by action, so do nothing
    if (mergeObj === undefined) return;
    // Null was returned, if it's a list item, remove from list
    if (mergeObj === null && self.nextParent) {
      const match = self.name.match(listNameRegex);
      const listName = match[1];
      const itemId = match[2];

      if (!match) {
        throw new Error('Unexpected null returned from action');
      }

      const list = self.nextParent.preState[listName];
      const index = findIndexById(list, itemId);
      list.splice(index, 1);

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
            Object.defineProperty(item, 'key', {
              enumerable: true,
              get: function() {
                return item.state.id;
              }
            });
          }
        });
      } else if (val === null) {
        delete self.preState[key];
        notifyChange(self, actionLog);
        return;
      }
    });
    applyMerge(self.preState, mergeObj);
    notifyChange(self, actionLog);
  });
};

Space.prototype.subSpace = function space(nameOrState, id) {
  if (typeof nameOrState !== 'string') {
    // looks like initial state is passed in, just return a new space
    return new Space(nameOrState, this);
  }

  const name = nameOrState;
  const index = id && findIndexById(this.preState[name], id);
  const item = id ? this.preState[name][index] : this.preState[name];
  let subSpace;

  // If the space already exists use it, otherwise create it
  if (item instanceof Space) {
    subSpace = item;
  } else {
    subSpace = new Space(item || {}, this);
    if (id) {
      this.preState[name][index] = subSpace;
    } else {
      this.preState[name] = subSpace;
    }
  }

  subSpace.name = id ? name + '[' + id + ']' : name;

  return subSpace;
};

Space.prototype.subscribe = function subscribe(subscriber) {
  this.subscribers.push(subscriber);
  subscriber('initialized');
};

Space.prototype.getState = function getState() {
  const self = this;
  const state = Object.assign({}, this.preState);
  return generateState(state);
};

Space.prototype.parentSpace = function parentSpace(parentName) {
  if (this.name === parentName) return this;
  if (!this.nextParent) return null;
  return this.nextParent.parentSpace(parentName);
};

module.exports = Space;
