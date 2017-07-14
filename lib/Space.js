function findIndexById(arr, id) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].id === id) return i;
  }
}

// Refreshes the state based on any changes to child spaces
function rewriteState(space) {
  const newState = Object.assign({}, space.state);
  Object.keys(space.children).forEach(function(spaceName) {
    const childState = space.children[spaceName].state;
    const listMatch = spaceName.match(/^(\w+)\[([-\w]+)\]$/);
    if (listMatch) {
      // space is an item in a list
      const listName = listMatch[1];
      const itemId = listMatch[2];
      const index = findIndexById(space.state[listName], itemId);
      newState[listName][index] = childState;
    } else {
      newState[spaceName] = childState;
    }
  });

  space.state = newState;

  space.subscribers.forEach(function(subscriber) {
    subscriber(space);
  });
}

function Space(initialState) {
  this.state = initialState;

  this.doAction = this.doAction.bind(this);
  this.subSpace = this.subSpace.bind(this);

  this.subscribers = [];
  this.children = {};
}

Space.prototype.doAction = function doAction(action) {
  const self = this;
  return (function(event) {
    const mergeObj = action(self, event);

    if (mergeObj === undefined) return;
    if (mergeObj === null && self.parentSpace) {
      const listName = self.parentListName;
      delete self.parentSpace.children[listName + '[' + self.state.id + ']'];
      self.parentSpace.doAction(function removeItem() {
        const changeObj = {};

        changeObj[listName] = self.parentSpace.state[listName]
        .filter(function (item) {
          return !item.id || item.id !== self.state.id
        });
        return changeObj;
      })();
      return;
    }
    Object.keys(mergeObj).forEach(function(key) {
      const val = mergeObj[key];
      if (val instanceof Space) {
        const subSpace = val;
        // The val is a new (sub) space, assign it as a child
        self.children[key] = subSpace;

        // no need to merge it onto the state, rewriteState will do it
        delete mergeObj[key];

        subSpace.parentSpace = self;

        //subscribe to changes to its state
        subSpace.subscribe(function updateParentSpace() {
          rewriteState(self);
        });
      } else if (Array.isArray(val)) {
        let list = val;
        // iterate through list, if its a space, add it to the children hash
        // and replace it here with its state, otherwise, just take the state
        list = list.map(function(item, index) {
          if (item instanceof Space) {
            if (item.state.id === undefined) {
              throw new Error('All spaces in lists require an `id` attribute');
            }
            // list items are stored as keys in the parent spaces children
            // hash with the format `this.children('key[id]')`
            self.children[key + '[' + item.state.id + ']'] = item;
            item.parentSpace = self;
            item.parentListName = key;
            return item.state;
          } else {
            return item;
          }
        });
        mergeObj[key] = list;
      }
    });
    self.state = Object.assign({}, self.state, mergeObj);
    rewriteState(self);
  });
};

Space.prototype.subSpace = function space(nameOrState, id) {
  if (typeof nameOrState !== 'string') {
    // looks like initial state is passed in, just return a new space
    return new Space(nameOrState);
  }

  const name = nameOrState;
  let subSpace;

  // if id is provided, look it up from the specified list
  if (id) {
    subSpace = this.children[name + '[' + id + ']'];
  } else {
    // If the space already exists use it, otherwise create it
   subSpace = this.children[name]
      ? this.children[name]
      : new Space(this.state[name]);
    this.children[name] = subSpace;
  }

  // If the child space is ever updated, this space needs to be updated too
  const self = this;
  subSpace.subscribe(function updateParentSpace() {
    rewriteState(self);
  });

  return subSpace;
};

Space.prototype.subscribe = function subscribe(subscriber) {
  this.subscribers.push(subscriber);
};

module.exports = Space;
