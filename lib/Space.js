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

  function push(space, newItem) {
    var newState = space.slice();
    newState.push(newItem);
    return new Space(newState, space._name, space._parent, space);
  }

  function remove(space, shouldRemove) {
    var newState = space
      .filter(function(item, index) {
        return !shouldRemove(item, index);
      })
      .map(function(item) {
        return item.toJSON();
      });

    return new Space(newState, space._name, space._parent, space);
  }

  function unshift(space, newItem) {
    var newState = space.slice();
    newState.unshift(newItem);

    return replaceSpace(space, newState);
  }

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
      push: wrapParam(space, push, causedBy),
      remove: wrapParam(space, remove, causedBy),
      unshift: wrapParam(space, unshift, causedBy),
      getSpace: wrapNewestSpace(space),
    };
  }

  function isObject(val) {
    return val instanceof Object && val.constructor === Object;
  }

  function mergeAndNotifySubscribers(oldSpace, mergeObj, causedBy) {
    var newSpace = mergeSpace(oldSpace, mergeObj);

    notifySubscribers(newSpace, oldSpace, causedBy);

    return newSpace;
  }

  function mergeSpace(oldSpace, mergeObj) {
    if (isSpaceArray(oldSpace)) {
      throw new Error('You cannot merge onto an array, try replace instead?');
    }

    return new Space(
      Object.assign({}, oldSpace._state, mergeObj),
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
      if (isSpaceArray(newSpace._parent)) {
        parentCausedBy = '[' + newSpace._name + ']';
        if (causedBy[0] !== '#') parentCausedBy += '.';
      } else {
        parentCausedBy = newSpace._name;
        if (causedBy[0] !== '#' && causedBy[0] !== '[') {
          parentCausedBy = newSpace._name + '.';
        }
      }
      parentCausedBy += causedBy;

      if (newSpace._parent) {
        notifySubscribers(newSpace._parent, oldSpace._parent, parentCausedBy);
      }
    }
  }

  function wrapWithSlice(space, methodName) {
    return function() {
      return space._state[methodName].apply(space.slice(), arguments);
    };
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
    function space(keyOrActionOrMergeObj, actionName) {
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
          mergeAndNotifySubscribers(space, mergeObj, causedBy);
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
    }

    var subscribers = [];
    state = state || {};

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
        space[key] = new Space(val, key, space);
      } else {
        Object.defineProperty(space, key, {
          value: Object.freeze(val),
          enumerable: true,
        });
      }
    }

    /* Add internal values */
    Object.defineProperty(space, '_state', { value: Object.freeze(state) });
    Object.defineProperty(space, '_isSpace', { value: true });
    Object.defineProperty(space, '_name', { value: name || '' });
    Object.defineProperty(space, '_isArray', { value: Array.isArray(state) });
    Object.defineProperty(space, '_newerSpaces', { value: [] });

    /* Attach methods */
    Object.defineProperty(space, 'toJSON', { value: toJSON });
    Object.defineProperty(space, 'toString', { value: toString });

    if (space._isArray) {
      if (Object.getOwnPropertyDescriptor(space, 'length').configurable) {
        Object.defineProperty(space, 'length', {
          get: function() {
            console.warn(
              'Do not use the length property, use space.size instead.'
            );
          },
        });
      }
      Object.defineProperty(space, 'size', { value: state.length });
      Object.defineProperty(space, 'slice', { value: slice });
      ['sort', 'concat', 'filter', 'map', 'includes', 'join'].forEach(function(
        method
      ) {
        Object.defineProperty(space, method, {
          value: wrapWithSlice(space, method),
        });
      });
    }

    if (oldSpace) {
      subscribers = oldSpace._subscribers;
      if (parent) {
        parent = newestSpace(parent);
        var newParentState = isSpaceArray(parent)
          ? parent._state.slice()
          : Object.assign({}, parent._state);
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
  Space.isSpaceArray = isSpaceArray;
  Space.rootOf = rootOf;

  /* Instance methods */

  function toJSON() {
    return this._state;
  }

  function toString() {
    return JSON.stringify(this.toJSON());
  }

  function slice(start, end) {
    var sliced = [];
    start = start || 0;
    start = start < 0 ? this.size + start : start;
    end = end == null ? this.size : end;
    for (var i = start; i < Math.min(end, this.size); i++) {
      sliced.push(this[i]);
    }
    return sliced;
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

  function isSpaceArray(space) {
    return isSpace(space) && !!space._isArray;
  }

  function rootOf(space) {
    if (!isSpace(space)) {
      throw new Error('Call rootOf with spaces only');
    }

    if (space._parent) return rootOf(newestSpace(space)._parent);
    return newestSpace(space);
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
