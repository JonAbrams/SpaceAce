// Refreshes the state based on any changes to child spaces
function rewriteState(space) {
  const newState = Object.assign({}, space.state);
  Object.keys(space.children).forEach(function(spaceName) {
    const childState = space.children[spaceName].state;
    newState[spaceName] = childState;
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
  debugger;
  const mergeObj = action(this);

  if (!mergeObj) return;
  this.state = Object.assign({}, this.state, mergeObj);
  rewriteState(this);
};

Space.prototype.subSpace = function space(name) {
  // If the space already exists use it, otherwise create it
  const subSpace = this.children[name]
    ? this.children[name]
    : new Space(this.state[name]);
  this.children[name] = subSpace;

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
