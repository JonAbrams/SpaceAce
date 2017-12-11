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

  function isObject(val) {
    return val instanceof Object && val.constructor === Object;
  }

  function isArray(val) {
    return Object.prototype.toString.call(val) === '[object Array]';
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

    state = isArray(state) ? state.slice() : Object.assign({}, state);

    Object.keys(state).forEach(function(key) {
      var item = state[key];
      if (item instanceof Space) {
        state[key] = generateState(item.preState);
      } else if (isArray(item)) {
        state[key] = item.map(function(item) {
          return isObject(item) ? generateState(item) : item;
        });
      } else if (isObject(item)) {
        state[key] = Object.assign({}, item);
      } else {
        state[key] = item;
      }
    });
    return Object.freeze(state);
  }

  function applyMerge(state, mergeObj, causedBy) {
    var mergedSpaces = [];
    Object.keys(mergeObj).forEach(function(key) {
      var stateVal = state[key];
      var mergeVal = mergeObj[key];
      if (stateVal instanceof Space) {
        var childSpaces = applyMerge(stateVal.preState, mergeVal, causedBy);
        mergedSpaces = mergedSpaces.concat(childSpaces);
        if (childSpaces.length === 0) {
          // Only include this space if no children already included
          mergedSpaces.push(stateVal);
        }
      } else if (isObject(stateVal) && isObject(mergeVal)) {
        mergedSpaces = mergedSpaces.concat(
          applyMerge(stateVal, mergeVal, causedBy)
        );
      } else {
        state[key] = mergeVal;
      }
    });
    return mergedSpaces;
  }

  function mergeState(space, mergeObj, causedBy, skipNotify) {
    // Nothing was returned by action, so do nothing
    if (mergeObj === undefined) return;
    // Null was given, if it's a list item, remove from list
    if (mergeObj === null && space.key) {
      var id = space.state.id;
      if (!id && !isArray(space.nextParent.preState)) {
        throw new Error('Unexpected null returned from action');
      }

      var list = space.nextParent.preState;
      var index = findIndexById(list, id);
      list.splice(index, 1);
      notifyChange(space, causedBy);
      return;
    }

    if (isArray(mergeObj)) {
      space.preState = mergeObj.slice();
      if (!skipNotify) notifyChange(space, causedBy);
    }

    // Always make fresh copy of the existing state
    space.preState = isArray(space.preState)
      ? space.preState.slice()
      : Object.assign({}, space.preState);

    // Recursively merge
    var mergedChildSpaces = applyMerge(space.preState, mergeObj, causedBy);
    mergedChildSpaces.forEach(function(space) {
      notifyChange(space, causedBy);
    });
    if (mergedChildSpaces.length === 0) {
      // If a child space was notified, no need to notify this space
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

  Space.prototype.bindTo = function bindTo(callback) {
    var self = this;
    var causedBy;
    var passThroughParams = [].slice.call(arguments, 1);

    function handlePromise(promise) {
      promise.then(function(pMergeObj) {
        mergeState(self, pMergeObj, causedBy);
      });
    }

    return function() {
      var mergeObj = callback.apply(
        this,
        [self].concat(passThroughParams, [].slice.call(arguments))
      );
      causedBy = self.name + '#' + (callback.name || 'unknown');
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
            mergeState(self, result.value, causedBy);
          }
        }
      } else {
        // Otherwise, merge the results asap
        mergeState(self, mergeObj, causedBy);
      }
    };
  };

  Space.prototype.setState = function setState(mergeObj, actionName) {
    if (isArray(this.state)) {
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

    if (isArray(this.preState)) {
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
    } else if (isObject(item) || isArray(item) || item == null) {
      subSpace = new Space(item || {}, this.options, this);
      if (id) {
        defineKeyGetter(subSpace); // Useful for rendering in React
        this.preState[index] = subSpace;
      } else {
        this.preState[name] = subSpace;
      }
    } else {
      const itemType =
        typeof item === 'object' ? item.constructor.name : typeof item;
      throw new Error(
        'Cannot attach sub-space to ' + name + ' with type ' + itemType
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
