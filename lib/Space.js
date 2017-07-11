function Space(initialState) {
  this.state = initialState;

  this.actions = {
    do: this.do.bind(this),
    space: this.space.bind(this),
  };

  this.subscribers = [];
}

Space.prototype.do = function doAction(action) {
  debugger;
  const mergeObj = action(this);

  if (!mergeObj) return;
  this.state = Object.assign({}, this.state, mergeObj);
};

Space.prototype.space = function space(action) {

};


module.exports = Space;
