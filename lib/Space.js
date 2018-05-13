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
    var newState = space.toJSON().slice();
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
    var newState = space.toJSON().slice();
    newState.unshift(newItem);

    return replaceSpace(space, newState);
  }

  function wrapParam(space, param) {
    return function(arg) {
      space = newestSpace(space);
      var newSpace = param(space, arg);
      if (newSpace !== space) space._newerSpaces.unshift(newSpace);
      return newSpace;
    };
  }

  function newestSpace(space) {
    var newer = space._newerSpaces[0];
    return newer ? newestSpace(newer) : space;
  }

  function getActionParams(space, value, args, causedBy) {
    return {
      space: space,
      value: value,
      values: Array.prototype.slice.apply(args),
      event:
        value && value.target && typeof value.target === 'object'
          ? value
          : undefined,
      rootSpace: getRootSpace(space),
      merge: wrapParam(space, mergeSpace),
      replace: wrapParam(space, replaceSpace),
      push: wrapParam(space, push),
      remove: wrapParam(space, remove),
      unshift: wrapParam(space, unshift),
      getSpace: wrapParam(space, newestSpace),
    };
  }

  function getRootSpace(space) {
    if (space._parent) return getRootSpace(space._parent);
    return newestSpace(space);
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
      Object.assign({}, oldSpace.toJSON(), mergeObj),
      oldSpace._name,
      oldSpace._parent,
      oldSpace
    );
  }

  function replaceAndNotifySubscribers(oldSpace, newState, causedBy) {
    var newSpace = replaceSpace(oldSpace, newState);

    notifySubscribers(newSpace, oldSpace, causedBy);

    return newSpace;
  }

  function replaceSpace(oldSpace, newState) {
    return new Space(newState, oldSpace._name, oldSpace._parent, oldSpace);
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

      if (isSpaceArray(newSpace._parent)) {
        var newParentState = [];
        newParentState.splice(newSpace._name, 1, newSpace);
        replaceAndNotifySubscribers(
          newSpace._parent,
          newParentState,
          parentCausedBy
        );
      } else {
        var parentMergeObj = {};
        parentMergeObj[newSpace._name] = newSpace.toJSON();

        mergeAndNotifySubscribers(
          newSpace._parent,
          parentMergeObj,
          parentCausedBy
        );
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

        return function actionWrapper(event) {
          var causedBy = '#' + actionName;
          var actionParams = getActionParams(space, event, arguments, causedBy);
          var mergeObj = action(actionParams);
          var newSpace = newestSpace(space);

          if (mergeObj && typeof mergeObj.then === 'function') {
            notifySubscribers(newSpace, space, causedBy);

            return mergeObj.then(function(mergeObj) {
              newSpace = newestSpace(space);
              notifySubscribers(newSpace, space, causedBy);
              return newSpace;
            });
          } else if (Space.secretCompatMode && isObject(mergeObj)) {
            mergeAndNotifySubscribers(newSpace, mergeObj, causedBy);
          } else if (mergeObj === null && isSpaceArray(space._parent)) {
            replaceAndNotifySubscribers(
              space._parent,
              space._parent.filter(function(item) {
                return item !== space;
              }),
              causedBy
            );
          } else if (mergeObj === undefined || isSpace(mergeObj)) {
            notifySubscribers(newSpace, space, causedBy);
          }
        };
      }
    }

    var subscribers = [];
    state = state || {};

    if (oldSpace) subscribers = oldSpace._subscribers;

    /* Set the attributes on the space */
    var keys = Object.keys(state);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var val = state[key];

      if (isSpace(val)) {
        space[key] = val;
      } else if (Array.isArray(val) || isObject(val)) {
        space[key] = new Space(val, key, space);
      } else {
        Object.defineProperty(space, key, { value: val, enumerable: true });
      }
    }

    /* Add internal values */
    Object.defineProperty(space, '_state', { value: state });
    Object.defineProperty(space, '_isSpace', { value: true });
    Object.defineProperty(space, '_subscribers', { value: subscribers });
    Object.defineProperty(space, '_name', { value: name || '' });
    Object.defineProperty(space, '_parent', { value: parent });
    Object.defineProperty(space, '_isArray', { value: Array.isArray(state) });
    Object.defineProperty(space, '_newerSpaces', { value: [] });

    /* Attach methods */
    Object.defineProperty(space, 'toJSON', { value: toJSON });
    Object.defineProperty(space, 'toString', { value: toString });

    if (space._isArray) {
      Object.defineProperty(space, 'length', { value: keys.length });
      ['filter', 'map', 'slice'].forEach(function(method) {
        Object.defineProperty(space, method, {
          value: Array.prototype[method],
        });
      });
      Object.defineProperty(space, 'sort', { value: sort });
    } else {
      Object.defineProperty(space, 'length', { value: undefined });
    }

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

  function sort(sorter) {
    return this.slice().sort(sorter);
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

    if (space._parent) return rootOf(space._parent);
    return space;
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
