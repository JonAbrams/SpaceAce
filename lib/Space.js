(function() {
  /*
  *
  * Table of Contents:
  * 1. Helper functions
  * 2. Space class/constructor function declaration
  * 3. Space method declarations
  * 4. Exporting
  *
  */

  /*
  *** Helper Functions ***
  */

  function findIndexById(arr, id) {
    for (var i = 0; i < arr.length; i++) {
      var itemId = (arr[i].id || arr[i].key) + '';
      if (itemId === id + '') return i;
    }
    return -1;
  }

  // Called whenever state is changed, so subscribers are notified
  function notifyChange(space, causedBy) {
    space.subscribers.forEach(function(subscriber) {
      subscriber(causedBy);
    });

    var nextParent = space.nextParent;
    if (nextParent) {
      // Parent state needs to be regenerated since child state changed
      nextParent.generatedState = generateState(nextParent.preState);
      notifyChange(space.nextParent, causedBy);
    }
  }

  function defineKeyGetter(space) {
    Object.defineProperty(space, 'key', {
      enumerable: true,
      get: function() {
        return space.state.id;
      },
    });
  }

  // Given a "preState" object, replaces nested spaces with their states
  function generateState(state) {
    if (state instanceof Space) {
      var space = state;
      return generateState(space.preState);
    }

    state = Array.isArray(state) ? state.slice() : Object.assign({}, state);

    Object.keys(state).forEach(function(key) {
      var item = state[key];
      if (item instanceof Space) {
        state[key] = generateState(item.preState);
      } else if (Array.isArray(item)) {
        state[key] = item.map(function(item) {
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
    Object.keys(mergeObj).forEach(function(key) {
      var stateVal = state[key];
      if (stateVal instanceof Space) {
        applyMerge(stateVal.preState, mergeObj[key]);
      } else {
        state[key] = mergeObj[key];
      }
    });
  }

  function mergeState(space, mergeObj, causedBy) {
    // Nothing was returned by action, so do nothing
    if (mergeObj === undefined) return;
    // Null was returned, if it's a list item, remove from list
    if (mergeObj === null && space.key) {
      var id = space.state.id;
      if (!id && !Array.isArray(space.nextParent.preState)) {
        throw new Error('Unexpected null returned from action');
      }

      var list = space.nextParent.preState;
      var index = findIndexById(list, id);
      list.splice(index, 1);
      space.generatedState = generateState(space.preState);
      notifyChange(space, causedBy);
      return;
    }

    // An array was returned, overwrite the previous state with it
    if (Array.isArray(mergeObj)) {
      space.preState = mergeObj;
      space.generatedState = generateState(space.preState);
      notifyChange(space, causedBy);
      return;
    }

    var skipNotify = false;
    // An object with attributes returned, update each key refenced
    Object.keys(mergeObj).forEach(function(key) {
      var val = mergeObj[key];
      if (Array.isArray(val)) {
        var list = val;
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
      } else if (space.preState[key] instanceof Space) {
        mergeState(space.preState[key], mergeObj[key], causedBy);
        skipNotify = true; // The child space will cause this space to notify instead
        delete mergeObj[key];
      }
    });
    space.preState = Array.isArray(space.preState)
      ? space.preState.slice()
      : Object.assign({}, space.preState);
    applyMerge(space.preState, mergeObj);
    if (!skipNotify) {
      space.generatedState = generateState(space.preState);
      notifyChange(space, causedBy);
    }
  }

  /*
  *** Space class/constructor function declaration ***
  */

  function Space(initialState, nextParent) {
    Object.defineProperty(this, 'state', {
      get: Space.prototype.getState,
      enumerable: true,
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
        writable: true,
      },
      generatedState: {
        value: generateState(initialState),
        writable: true,
        enumerable: false,
      },
      subscribers: {
        value: [],
        enumerable: false,
      },
      name: {
        value: 'root',
        writable: true,
        enumerable: false,
      },
      nextParent: {
        value: nextParent || null,
        writable: true,
        enumerable: false,
      },
    });
  }

  /*
  *** Space method declarations ***
  */

  Space.prototype.setState = function setState(action, actionName) {
    var self = this;
    var causedBy;

    if (typeof action === 'object') {
      var mergeObj = action;
      causedBy = self.name + '#' + (actionName || 'unknown');
      mergeState(self, mergeObj, causedBy);
    } else if (typeof action === 'function') {
      return function(event) {
        var mergeObj = action(self, event);
        causedBy = self.name + '#' + (actionName || action.name || 'unknown');
        mergeState(self, mergeObj, causedBy);
      };
    }
  };

  Space.prototype.subSpace = function space(nameOrId) {
    var item, name, id, index;

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

    var subSpace;

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
    return this.generatedState;
  };

  Space.prototype.parentSpace = function parentSpace(parentName) {
    if (this.name === parentName) return this;
    if (!this.nextParent) return null;
    return this.nextParent.parentSpace(parentName);
  };

  /*
  *** Exporting ***
  */

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Space;
  } else {
    window.Space = Space;
  }
})();
