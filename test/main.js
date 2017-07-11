const assert = require('assert');
const Space = require('../index');

describe('Space', function() {
  beforeEach(function() {
    this.space = new Space({ initialState: 'here', count: 1 });
  });
  
  it('returns Space instance', function() {
    assert(new Space() instanceof Space);
  });

  describe('initial state provided', function() {
    it('sets the state', function() {
      assert.deepEqual(this.space.state, { initialState: 'here', count: 1 });
    });

    it('updates the state', function() {
      const oldState = this.space.state;
      this.space.actions.do(({ state }) => ({ count: state.count + 1 }));
      assert.deepEqual(this.space.state, { initialState: 'here', count: 2 });
      assert.notEqual(this.space.state, oldState);
    });
  });
});
