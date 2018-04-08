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

  /*
    *** Space class/constructor ***
  */

  function Space(state) {
    state = state || {};
    function space(key) {
      return function actionCaller(value) {
        var mergeObj = {};
        mergeObj[key] = value;
        space._subscribers.forEach(function(subscriber) {
          subscriber({
            newSpace: new Space(Object.assign({}, state, mergeObj)),
            oldSpace: space,
            causedBy: space._name + '#set',
          });
        });
      };
    }
    var keys = Object.keys(state);
    for (var i = 0; i < keys.length; i++) {
      space[keys[i]] = state[keys[i]];
    }

    /* Attach methods, not enumerable by default */
    Object.defineProperty(space, 'toJSON', { value: toJSON });
    Object.defineProperty(space, 'toString', { value: toString });
    Object.defineProperty(space, '_isSpace', { value: true });
    Object.defineProperty(space, '_subscribers', { value: [] });
    Object.defineProperty(space, '_name', { value: 'root' });

    return space;
  }

  /* Static methods */

  Space.subscribe = subscribe;
  Space.spaceToObj = spaceToObj;
  Space.isSpace = isSpace;

  /* Instance methods */

  function toJSON() {
    return Object.assign({}, this);
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
