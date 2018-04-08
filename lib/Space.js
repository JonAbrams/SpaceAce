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

  function copyInternals(oldSpace, newSpace) {
    Object.defineProperty(newSpace, '_subscribers', {
      value: oldSpace._subscribers,
    });
    Object.defineProperty(newSpace, '_name', { value: oldSpace._name });
  }

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

  function mergeAndNotifySubscribers(oldSpace, mergeObj, causedBy) {
    var newSpace = new Space(oldSpace, mergeObj);
    copyInternals(oldSpace, newSpace);
    newSpace._subscribers.forEach(function(subscriber) {
      subscriber({
        newSpace: newSpace,
        oldSpace: oldSpace,
        causedBy: causedBy,
      });
    });

    return newSpace;
  }

  /*
    *** Space class/constructor ***
  */

  function Space(stateOrOldSpace, mergeObj) {
    function space(keyOrAction, actionName) {
      if (typeof keyOrAction === 'string') {
        var key = keyOrAction;

        return function attrSetter(value) {
          var causedBy = space._name + '#set:' + key;
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
    var name = '';
    var state = stateOrOldSpace || {};

    if (isSpace(stateOrOldSpace) && mergeObj) {
      var oldSpace = stateOrOldSpace;
      subscribers = oldSpace._subscribers;
      name = oldSpace._name;
      state = Object.assign({}, oldSpace._state, mergeObj);
    }

    var keys = Object.keys(state);
    for (var i = 0; i < keys.length; i++) {
      space[keys[i]] = state[keys[i]];
    }

    /* Add internal values */
    Object.defineProperty(space, '_state', { value: state });
    Object.defineProperty(space, '_isSpace', { value: true });
    Object.defineProperty(space, '_subscribers', { value: subscribers });
    Object.defineProperty(space, '_name', { value: name });

    /* Attach methods */
    Object.defineProperty(space, 'toJSON', { value: toJSON });
    Object.defineProperty(space, 'toString', { value: toString });

    return space;
  }

  /* Static methods */

  Space.subscribe = subscribe;
  Space.spaceToObj = spaceToObj;
  Space.isSpace = isSpace;

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

  function spaceToObj(space) {
    if (isSpace(space)) return space.toJSON();
    return space;
  }

  function isSpace(space) {
    return !!space._isSpace;
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
