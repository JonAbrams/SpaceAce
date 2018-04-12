(function() {
  /*
  *
  * Table of Contents:
  * 1. Helper functions
  * 2. Space class/constructor function declaration
  * 3. Public utility functions
  * 4. Export
  *
  */

  /*
    *** Helper Functions ***
  */

  function createMergeFunc(space, causedBy) {
    return function merge(mergeObj) {
      space = this._newSpace || space;
      var newSpace = mergeAndNotifySubscribers(space, mergeObj, causedBy);
      Object.defineProperty(this, '_newSpace', {
        value: newSpace,
        configurable: true,
      });
      return newSpace;
    };
  }

  function getActionParams(space, value, args, causedBy) {
    var actionParams = {
      space: space,
      value: value,
      values: Array.prototype.slice.apply(args),
      event: value && typeof value.target === 'object' ? value : undefined,
      merge: createMergeFunc(space, causedBy),
    };
    actionParams.merge = actionParams.merge.bind(actionParams);
    return actionParams;
  }

  function isObject(val) {
    return val instanceof Object && val.constructor === Object;
  }

  function mergeAndNotifySubscribers(oldSpace, mergeObj, causedBy) {
    var newSpace = new Space(
      oldSpace,
      mergeObj,
      oldSpace._name,
      oldSpace._parent
    );
    newSpace._subscribers.forEach(function(subscriber) {
      subscriber({
        newSpace: newSpace,
        oldSpace: oldSpace,
        causedBy: causedBy,
      });
    });
    if (oldSpace._parent) {
      var parentMergeObj = {};
      parentMergeObj[oldSpace._name] = toObj(newSpace);

      var newCausedBy =
        causedBy[0] === '#'
          ? oldSpace._name + causedBy
          : oldSpace._name + '.' + causedBy;
      mergeAndNotifySubscribers(oldSpace._parent, parentMergeObj, newCausedBy);
    }

    return newSpace;
  }

  /*
    *** Space class/constructor ***
  */

  function Space(stateOrOldSpace, mergeObj, name, parent) {
    function space(keyOrAction, actionName) {
      if (typeof keyOrAction === 'string') {
        var key = keyOrAction;

        return function attrSetter(value) {
          var causedBy = '#set:' + key;
          var mergeObj = {};
          mergeObj[key] = value;
          mergeAndNotifySubscribers(space, mergeObj, causedBy);
        };
      }

      if (typeof keyOrAction === 'function') {
        var action = keyOrAction;
        actionName = actionName || action.name || 'unknown';

        return function actionWrapper(event) {
          var causedBy = '#' + actionName;
          var actionParams = getActionParams(space, event, arguments, causedBy);
          var mergeObj = action(actionParams);
          mergeAndNotifySubscribers(
            actionParams._newSpace || space,
            mergeObj,
            causedBy
          );
        };
      }
    }

    var subscribers = [];
    var state = stateOrOldSpace || {};

    if (isSpace(stateOrOldSpace) && mergeObj) {
      var oldSpace = stateOrOldSpace;
      subscribers = oldSpace._subscribers;
      name = oldSpace._name;
      state = Object.assign({}, oldSpace._state, mergeObj);
    }

    var keys = Object.keys(state);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var val = state[key];

      if (isSpace(val)) {
        space[key] = val;
      } else if (Array.isArray(val) || isObject(val)) {
        space[key] = new Space(val, null, key, space);
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

    /* Attach methods */
    Object.defineProperty(space, 'toJSON', { value: toJSON });
    Object.defineProperty(space, 'toString', { value: toString });

    if (space._isArray) {
      Object.defineProperty(space, 'length', { value: keys.length });
      ['map', 'slice'].forEach(function(method) {
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
  Space.toObj = toObj;
  Space.isSpace = isSpace;

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

  function toObj(space) {
    return space.toJSON();
  }

  function isSpace(space) {
    return !!space && !!space._isSpace;
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
