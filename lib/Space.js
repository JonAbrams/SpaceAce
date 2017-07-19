const listNameRegex = /^(\w+)\[([-\w]+)\]$/;

function findIndexById(arr, id) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].id === id) return i;
  }
}

// Called whenever state is changed, so subscribers are notified
function notifyChange(space) {
  space.subscribers.forEach(function(subscriber) {
    subscriber(space);
  });
  if (space.parentSpace) notifyChange(space.parentSpace);
}

function Space(initialState) {
  Object.defineProperty(this, 'state', {
    get: Space.prototype.getState,
    enumerable: true
  });
  this.doAction = this.doAction.bind(this);
  this.subSpace = this.subSpace.bind(this);

  // Consider these private attributes
  // They are not part of the API
  // They are non-enumerable so that they don't get passed
  // down as props when doing `<Component {...mySpace} />`
  Object.defineProperties(this, {
    ownState: {
      value: initialState,
      enumerable: false
    },
    subscribers: {
      value: [],
      enumerable: false
    },
    children: {
      value: {},
      enumerable: false
    },
    name: {
      value: null,
      writable: true,
      enumerable: false
    },
    parentSpace: {
      value: null,
      writable: true,
      enumerable: false
    }
  });
}

Space.prototype.doAction = function doAction(action) {
  const self = this;
  return (function(event) {
    const mergeObj = action(self, event);

    if (mergeObj === undefined) return;
    if (mergeObj === null && self.parentSpace) {
      const match = self.name.match(listNameRegex);
      const listName = match[1];
      const itemId = match[2];

      if (!match) {
        throw new Error('Unexpected null returned from action');
      }

      const list = self.parentSpace.ownState[listName];
      const index = findIndexById(list, itemId);
      list.splice(index, 1);

      delete self.parentSpace.children[self.name];
      return;
    }
    Object.keys(mergeObj).forEach(function(key) {
      const val = mergeObj[key];
      if (val instanceof Space) {
        const subSpace = val;
        // The val is a new (sub) space, assign it as a child
        self.children[key] = subSpace;

        // no need to merge it onto the state, it'll be auto-inserted
        // with the state getter method
        delete mergeObj[key];

        subSpace.parentSpace = self;
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
            item.key = item.state.id;
            return { id: item.state.id };
          } else {
            return item;
          }
        });
        mergeObj[key] = list;
      } else if (val === null) {
        delete self.children[key];
        notifyChange(self);
        return;
      }
    });
    Object.assign(self.ownState, mergeObj);
    notifyChange(self);
  });
};

Space.prototype.subSpace = function space(nameOrState, id) {
  if (typeof nameOrState !== 'string') {
    // looks like initial state is passed in, just return a new space
    return new Space(nameOrState);
  }

  let name = id ? nameOrState + '[' + id + ']' : nameOrState;
  let subSpace;

  // If the space already exists use it, otherwise create it
  if (name in this.children) {
    subSpace = this.children[name];
  } else {
    subSpace = new Space(this.ownState[name]);
    this.children[name] = subSpace;
    subSpace.parentSpace = this;
    delete this.ownState[name];
  }
  if (!subSpace.name) subSpace.name = name;

  return subSpace;
};

Space.prototype.subscribe = function subscribe(subscriber) {
  this.subscribers.push(subscriber);
};

Space.prototype.getState = function getState() {
  const self = this;
  const state = Object.assign({}, this.ownState);
  Object.keys(this.children).forEach(function(spaceName) {
    const childState = self.children[spaceName].state;
    const listMatch = spaceName.match(listNameRegex);
    if (listMatch) {
      // space is an item in a list
      const listName = listMatch[1];
      const itemId = listMatch[2];
      const index = findIndexById(self.ownState[listName], itemId);
      state[listName][index] = childState;
    } else {
      state[spaceName] = childState;
    }
  });
  return Object.freeze(state);
};

module.exports = Space;
