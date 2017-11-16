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

  function isPromise(val) {
    return val && typeof val.then === 'function';
  }

  function findIndexById(arr, id) {
    for (var i = 0; i < arr.length; i++) {
      var itemId = (arr[i].id || arr[i].key) + '';
      if (itemId === id + '') return i;
    }
    return -1;
  }

  // Called whenever state is changed, so subscribers are notified
  // Also regenerates state
  function notifyChange(space, causedBy) {
    space.generatedState = generateState(space.preState);
    space.subscribers.forEach(function(subscriber) {
      subscriber(causedBy);
    });

    var nextParent = space.nextParent;
    if (nextParent) {
      // Parent state needs to be notified since child state changed
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
          return typeof item === 'object' ? generateState(item) : item;
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

  function mergeState(space, mergeObj, causedBy, skipNotify) {
    // Nothing was returned by action, so do nothing
    if (mergeObj === undefined) return;
    // Null was given, if it's a list item, remove from list
    if (mergeObj === null && space.key) {
      var id = space.state.id;
      if (!id && !Array.isArray(space.nextParent.preState)) {
        throw new Error('Unexpected null returned from action');
      }

      var list = space.nextParent.preState;
      var index = findIndexById(list, id);
      list.splice(index, 1);
      notifyChange(space, causedBy);
      return;
    }

    if (Array.isArray(mergeObj)) {
      space.preState = mergeObj.slice();
      if (!skipNotify) notifyChange(space, causedBy);
    }

    skipNotify = skipNotify || false;
    // An object with attributes given, update each key refenced
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
      notifyChange(space, causedBy);
    }
  }

  /*
  *** Space class/constructor function declaration ***
  */

  function Space(initialState, options, nextParent) {
    Object.defineProperty(this, 'state', {
      get: Space.prototype.getState,
      enumerable: true,
    });

    this.setState = this.setState.bind(this);
    this.subSpace = this.subSpace.bind(this);
    this.bindTo = this.bindTo.bind(this);
    this.replaceState = this.replaceState.bind(this);
    this.getRootSpace = this.getRootSpace.bind(this);

    // Consider these private attributes
    // They are not part of the API
    // They are non-enumerable so that they don't get passed
    // down as props when doing `<Component {...mySpace} />`
    Object.defineProperties(this, {
      options: {
        value: options || {},
        enumerable: false,
      },
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

  Space.prototype.bindTo = function bindTo(wrapped) {
    var self = this;
    var causedBy;

    function handlePromise(promise) {
      promise.then(function(pMergeObj) {
        mergeState(self, pMergeObj, causedBy);
      });
    }

    return function() {
      var mergeObj = wrapped.apply(
        this,
        [self].concat([].slice.call(arguments))
      );
      causedBy = self.name + '#' + (wrapped.name || 'unknown');
      if (isPromise(mergeObj)) {
        // If the returned value is a promise, wait for it
        // Return promise to help with testability
        return handlePromise(mergeObj);
      } else if (mergeObj && typeof mergeObj.next === 'function') {
        // If the returned value is an iterator, keep requesting and
        // merging the next value until done
        var iterator = mergeObj;
        var result = {};
        while (!result.done) {
          result = iterator.next();
          if (isPromise(result.value)) {
            handlePromise(result.value);
          } else {
            // Merge result but don't notify yet, more changes may come
            mergeState(self, result.value, causedBy, true);
          }
        }
        notifyChange(self, causedBy);
      } else {
        // Otherwise, merge the results asap
        mergeState(self, mergeObj, causedBy);
      }
    };
  };

  Space.prototype.setState = function setState(mergeObj, actionName) {
    if (Array.isArray(this.state)) {
      throw new Error('This space has an array. Use replaceState instead.');
    }
    if (typeof mergeObj === 'function') {
      throw new Error(
        'Do not pass a function to Space#setState. Instead, use Space#bindTo.'
      );
    }
    var causedBy = this.name + '#' + (actionName || 'unknown');
    mergeState(this, mergeObj, causedBy);
  };

  Space.prototype.replaceState = function replaceState(obj, actionName) {
    var causedBy = this.name + '#' + (actionName || 'unknown');
    this.preState = obj;
    notifyChange(this, causedBy);
  };

  Space.prototype.subSpace = function subSpace(nameOrId) {
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
    } else if (typeof item === 'object' || item === undefined) {
      subSpace = new Space(item || {}, this.options, this);
      if (id) {
        defineKeyGetter(subSpace); // Useful for rendering in React
        this.preState[index] = subSpace;
      } else {
        this.preState[name] = subSpace;
      }
    } else {
      throw new Error(
        'Cannot attach sub-space to ' + name + ' with type ' + typeof item
      );
    }

    subSpace.name = id ? this.name + '[' + id + ']' : name;

    return subSpace;
  };

  Space.prototype.subscribe = function subscribe(subscriber) {
    var self = this;
    var index = this.subscribers.length;
    self.subscribers.push(subscriber);
    if (!this.options.skipInitialNotification) {
      subscriber('initialized');
    }

    return function unsubscribe() {
      self.subscribers.splice(index, 1);
    };
  };

  Space.prototype.getState = function getState() {
    return this.generatedState;
  };

  Space.prototype.getRootSpace = function getRootSpace() {
    if (!this.nextParent) return this;
    return this.nextParent.getRootSpace();
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
