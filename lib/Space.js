(function() {
  /*
  *
  * Table of Contents:
  * 1. Action params
  * 2. Space class/constructor function declaration
  * 3. Public utility functions
  * 4. Export
  *
  */

  /*
    *** Action Params ***
  */

  function wrapParam(space, param, causedBy) {
    return function(arg) {
      space = newestSpace(space);
      var newSpace = param(space, arg);
      notifySubscribers(newSpace, space, causedBy);
      return newSpace;
    };
  }

  function newestSpace(space) {
    var newer = space._newerSpaces[0];
    return newer ? newestSpace(newer) : space;
  }

  function wrapNewestSpace(space) {
    return function() {
      return newestSpace(space);
    };
  }

  function getActionParams(space, causedBy) {
    return {
      space: space,
      merge: wrapParam(space, mergeSpace, causedBy),
      replace: wrapParam(space, replaceSpace, causedBy),
      getSpace: wrapNewestSpace(space),
      rootSpace: rootOf(space),
    };
  }

  function isObject(val) {
    return val instanceof Object && val.constructor === Object;
  }

  function asObj(space) {
    var obj = {};
    Object.keys(space).forEach(function(key) {
      obj[key] = space[key];
    });
    return obj;
  }

  function mergeAndNotifySubscribers(oldSpace, mergeObj, causedBy) {
    oldSpace = newestSpace(oldSpace);
    var newSpace = mergeSpace(oldSpace, mergeObj);

    notifySubscribers(newSpace, oldSpace, causedBy);

    return newSpace;
  }

  function mergeSpace(oldSpace, mergeObj) {
    return new Space(
      Object.assign(asObj(oldSpace), mergeObj),
      oldSpace._name,
      isSpace(oldSpace._parent) && newestSpace(oldSpace._parent),
      oldSpace
    );
  }

  function replaceSpace(oldSpace, newState) {
    return new Space(
      newState,
      oldSpace._name,
      isSpace(oldSpace._parent) && newestSpace(oldSpace._parent),
      oldSpace
    );
  }

  function isSimpleName(name) {
    return /^[_$A-Za-z]([_$\w])*$/.test(name);
  }

  function isNumeric(name) {
    // Convert to a number, then back to a string, is it the same?
    return +name + '' === name;
  }

  function notifySubscribers(newSpace, oldSpace, causedBy) {
    newSpace._subscribers.forEach(function(subscriber) {
      subscriber({
        newSpace: newSpace,
        oldSpace: oldSpace,
        causedBy: causedBy,
      });
    });
    if (newSpace._parent) {
      var parentCausedBy;
      if (isSimpleName(newSpace._name)) {
        parentCausedBy = newSpace._name;
      } else {
        parentCausedBy =
          '[' +
          (isNumeric(newSpace._name)
            ? newSpace._name
            : '"' + newSpace._name + '"') +
          ']';
      }
      if (causedBy[0] !== '#' && causedBy[0] !== '[') {
        parentCausedBy = parentCausedBy + '.';
      }
      parentCausedBy += causedBy;

      if (newSpace._parent) {
        notifySubscribers(newSpace._parent, oldSpace._parent, parentCausedBy);
      }
    }
  }

  /*
    *** Space class/constructor ***
  */

  function Space(state, name, parent, oldSpace) {
    /*
      The below function is the new space!
      When it's called, it return an update function.
      It will have attributes and methods attached to it,
      so it can be rendered.
    */
    var space = function space(keyOrActionOrMergeObj, actionName) {
      if (isObject(keyOrActionOrMergeObj)) {
        var causedBy = actionName ? '#' + actionName : '#immediateMerge';
        var mergeObj = keyOrActionOrMergeObj;
        return mergeAndNotifySubscribers(space, mergeObj, causedBy);
      }

      if (typeof keyOrActionOrMergeObj === 'string') {
        var key = keyOrActionOrMergeObj;

        return function attrSetter(eventOrValue) {
          var causedBy = '#set:' + key;
          var mergeObj = {};
          var value = eventOrValue;
          if (eventOrValue && eventOrValue.target) {
            var event = eventOrValue;
            var target = event.target;
            if (target.type === 'number') {
              value = parseInt(target.value, 10);
            } else if (target.type === 'checkbox') {
              value = target.checked;
            } else {
              value = target.value;
            }
          }
          mergeObj[key] = value;
          return mergeAndNotifySubscribers(space, mergeObj, causedBy);
        };
      }

      if (typeof keyOrActionOrMergeObj === 'function') {
        var action = keyOrActionOrMergeObj;
        actionName = actionName || action.name || 'unknown';

        return function actionWrapper() {
          var causedBy = '#' + actionName;
          var actionParams = getActionParams(space, causedBy);
          var mergeObj = action.apply(
            this, // pass-through context
            [actionParams].concat(Array.prototype.slice.call(arguments))
          );

          if (mergeObj && typeof mergeObj.then === 'function') {
            return mergeObj.then(function() {
              return newestSpace(space);
            });
          }

          return newestSpace(space);
        };
      }
    };

    var subscribers = [];
    state = state || {};

    if (Array.isArray(state)) {
      if (oldSpace != null && !Array.isArray(oldSpace)) {
        throw new Error('Cannot replace an array with a non-array');
      }
      // The space is a real array instead of a function, cannot be updated directly
      // But we still need the hidden properties on it for parent/newerSpaces tracking
      space = [];
    }

    /* Set the attributes on the space */
    var keys = Object.keys(state);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var val = state[key];
      var prevSpace = oldSpace && oldSpace[key];

      if (isSpace(val)) {
        space[key] = val;
        state[key] = val._state;
      } else if (prevSpace && prevSpace._state === state[key]) {
        space[key] = prevSpace;
      } else if (Array.isArray(val) || isObject(val)) {
        space[key] = new Space(val, key, space, prevSpace);
      } else {
        Object.defineProperty(space, key, {
          value: Object.freeze(val),
          enumerable: true,
        });
      }
    }

    Object.defineProperty(space, '_state', { value: Object.freeze(state) });
    Object.defineProperty(space, '_isSpace', { value: true });
    Object.defineProperty(space, '_name', { value: name || '' });
    Object.defineProperty(space, '_newerSpaces', { value: [] });

    /* Attach methods */
    Object.defineProperty(space, 'toJSON', { value: toJSON });
    Object.defineProperty(space, 'toString', { value: toString });

    if (!state.name) Object.defineProperty(space, 'name', { value: undefined });

    if (oldSpace) {
      subscribers = oldSpace._subscribers;
      // parent might be 'new', only refresh it if fully baked
      if (parent && parent._isSpace) {
        parent = newestSpace(parent);
        var newParentState = Array.isArray(parent)
          ? parent.slice()
          : asObj(parent);
        newParentState[name] = space;
        parent = new Space(
          newParentState,
          parent._name,
          parent._parent,
          parent
        );
      }
      oldSpace._newerSpaces.unshift(space);
    }

    Object.defineProperty(space, '_parent', { value: parent });
    Object.defineProperty(space, '_subscribers', { value: subscribers });

    return Object.freeze(space);
  }

  /* Static methods */

  Space.subscribe = subscribe;
  Space.isSpace = isSpace;
  Space.rootOf = rootOf;
  Space.createSpace = createSpace;

  /* Instance methods */

  function toJSON() {
    return this._state;
  }

  function toString() {
    return JSON.stringify(this.toJSON());
  }

  /*
    *** Public utility functions ***
  */

  function subscribe(space, callback) {
    space._subscribers.push(callback);
  }

  function isSpace(space) {
    return !!space && !!space._isSpace;
  }

  function rootOf(space) {
    if (!space._isSpace) {
      throw new Error('Call rootOf with spaces only');
    }

    if (space._parent) return rootOf(newestSpace(space)._parent);
    return newestSpace(space);
  }

  function createSpace() {
    return Space.apply(null, arguments);
  }

  /*
    *** Export ***
  */

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Space;
  } else {
    window.Space = Space;
  }
})();
