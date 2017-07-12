const assert = require('assert');
const Space = require('../index');

describe('Space', function() {
  beforeEach(function() {
    this.space = new Space({ initialState: 'here', count: 1, child: {} });
  });

  it('returns Space instance', function() {
    assert(new Space() instanceof Space);
  });

  it('has initial state', function() {
    assert.deepEqual(this.space.state, { initialState: 'here', count: 1, child: {} });
  });

  it('updates the state', function() {
    const oldState = this.space.state;
    this.space.doAction(({ state }) => ({ count: state.count + 1 }));
    assert.deepEqual(this.space.state, { initialState: 'here', count: 2, child: {} });
    assert.notEqual(this.space.state, oldState);
  });

  it('registers subscribers', function() {
    const subscriber = function() { return { success: true }; };
    this.space.subscribe(subscriber);
    assert.equal(this.space.subscribers[0], subscriber);
  });

  describe('adding child spaces', function() {
    beforeEach(function() {
      this.subSpaceByName = this.space.subSpace('child');
    });

    it('propagates changes upwards', function() {
      this.subSpaceByName.doAction(() => ({ value: 'is there' }));
      assert.equal(this.space.state.child.value, 'is there');
    });

    it('uses existing sub space', function() {
      assert.equal(this.space.subSpace('child'), this.subSpaceByName);
    });
  });
});
