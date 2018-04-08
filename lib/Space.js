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

  function getActionParams(space, value, args) {
    return {
      space: space,
      value: value,
      values: Array.prototype.slice.apply(args),
      event: value && typeof value.target === 'object' ? value : undefined,
    };
  }

  function mergeAndNotifySubscribers(space, mergeObj, causedBy) {
    space._subscribers.forEach(function(subscriber) {
      subscriber({
        newSpace: new Space(Object.assign({}, space._state, mergeObj)),
        oldSpace: space,
        causedBy: causedBy,
      });
    });
  }

  /*
    *** Space class/constructor ***
  */

  function Space(state) {
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
          var actionParams = getActionParams(space, event, arguments);
          var mergeObj = action(actionParams);
          mergeAndNotifySubscribers(space, mergeObj, causedBy);
        };
      }
    }
    state = state || {};
    var keys = Object.keys(state);
    for (var i = 0; i < keys.length; i++) {
      space[keys[i]] = state[keys[i]];
    }

    /* Add internal values */
    Object.defineProperty(space, '_state', { value: state });
    Object.defineProperty(space, '_isSpace', { value: true });
    Object.defineProperty(space, '_isSpace', { value: true });
    Object.defineProperty(space, '_subscribers', { value: [] });
    Object.defineProperty(space, '_name', { value: '' });

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
    return space.toJSON();
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
