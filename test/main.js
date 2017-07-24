const assert = require('assert');
const Space = require('../index');

describe('Space', function() {
  beforeEach(function() {
    this.space = new Space({ initialState: 'here', count: 1, child: {} });
  });

  it('returns Space instance', function() {
    assert(new Space() instanceof Space);
  });

  it('calls subscriber on subscribing', function(done) {
    const space = new Space();
    space.subscribe(function (space, causedBy) {
      assert.deepEqual(causedBy, ['initialized']);
      done();
    });
  });

  it('spaces only have these enumerated keys', function() {
    const publicMethods = ['state', 'doAction', 'subSpace', 'parentSpace'];
    const childSpace = this.space.subSpace('child');
    assert.deepEqual(Object.keys(this.space), publicMethods);
    assert.deepEqual(Object.keys(childSpace), publicMethods);
  });

  it('has initial state', function() {
    assert.deepEqual(this.space.state, { initialState: 'here', count: 1, child: {} });
  });

  it('updates the state', function() {
    const oldState = this.space.state;
    this.space.doAction(({ state }) => ({ count: state.count + 1 }))();
    assert.deepEqual(this.space.state, { initialState: 'here', count: 2, child: {} });
    assert.notEqual(this.space.state, oldState);
  });

  it('actions pass in event', function() {
    let called = false;
    this.space.doAction((space, event) => { called = event.called; })({ called: 'once' });
    assert.equal(called, 'once');
  });

  describe('subscribers', function() {
    beforeEach(function() {
      this.subscriberCalled = false;
      this.subscriber = (space, causedBy) => {
        if (causedBy[0] === 'initialized') return;
        this.subscriberCalled = true;
        return { success: true };
      };
      this.space.subscribe(this.subscriber);
    });

    it('registers subscribers', function() {
      assert.equal(this.space.subscribers[0], this.subscriber);
    });

    it('calls subscribers when state is changed via action', function() {
      assert(!this.subscriberCalled);
      this.space.subscribe((space, causedBy) => {
        if (causedBy[0] === 'initialized') return;
        assert.equal(space.state.count, 2);
      });
      this.space.doAction(() => ({ count: 2 }))();
      assert(this.subscriberCalled);
    });

    it('does NOT call subscribers when no value is returned', function() {
      this.space.subscribe((space, causedBy) => {
        if (causedBy[0] === 'initialized') return;
        assert(false)
      });
      this.space.doAction(() => {})();
    });

    it('sets causedBy', function() {
      this.space.subscribe((space, causedBy) => {
        if (causedBy[0] === 'initialized') return;
        assert.deepEqual(causedBy, ['root#myAction']);
      });

      this.space.doAction(function myAction() {
        return { val: 'is set'};
      })();
    });
  });


  describe('child spaces', function() {
    beforeEach(function() {
      this.subSpaceByName = this.space.subSpace('child');
      this.subSpaceByAction = this.space.doAction(({ subSpace }) => ({
        actionChild: subSpace({ value: 'present' })
      }))();
    });

    it('propagates changes upwards', function() {
      this.subSpaceByName.doAction(() => ({ value: 'is there' }))();
      assert.equal(this.space.state.child.value, 'is there');
    });

    it('uses existing sub space', function() {
      assert.equal(this.space.subSpace('child'), this.subSpaceByName);
    });

    it('supports adding subspaces by action', function() {
      assert(this.space.children.actionChild);
      assert.equal(this.space.state.actionChild.value, 'present');
    });

    it('removes spaces by returning null for that space', function() {
      assert(this.space.state.child);
      this.space.doAction(() => ({ child: null }))();
      assert.equal(this.space.state.child, null);
    });

    it('throws list subSpaces missing id', function() {
      assert.throws(() => {
        this.space.doAction(({ subSpace }) => ({
          list: [subSpace({ value: 'present' })]
        }))();
      });
    });

    it('can reference parent spaces by name', function() {
      const grandChild = this.subSpaceByName.subSpace('gc');
      assert.equal(this.subSpaceByName.parentSpace('root'), this.space);
      assert.equal(grandChild.parentSpace('root'), this.space);
      assert.equal(grandChild.parentSpace('child'), this.subSpaceByName);
    });

    describe('child spaces in lists', function() {
      beforeEach(function() {
        this.space.doAction(({ subSpace }) => ({
          list: [subSpace({ value: 'present', id: 'abc12-3' })]
        }))();
      });

      it('supports subSpaces in lists', function() {
        assert.deepEqual(this.space.state, {
          initialState: 'here',
          count: 1,
          child: {},
          actionChild: { value: 'present' },
          list: [{value: 'present', id: 'abc12-3' }]
        });
      });

      it('can get spaces from list', function() {
        const listItemSpace = this.space.subSpace('list', 'abc12-3');
        assert.equal(listItemSpace.state.value, 'present');
      });

      it('removes spaces when null is returned from action', function() {
        const listItemSpace = this.space.subSpace('list', 'abc12-3');
        assert.equal(this.space.state.list.length, 1);
        listItemSpace.doAction(() => null)();
        assert.equal(this.space.state.list.length, 0);
      });

      it('provides a key prop', function() {
        assert('key' in this.space.subSpace('list', 'abc12-3'));
        assert.equal(this.space.subSpace('list', 'abc12-3').key, 'abc12-3');
      });

      it('key prop changes when ID changes', function() {
        const itemSpace = this.space.subSpace('list', 'abc12-3');
        itemSpace.doAction(() => ({ id: 'abc' }))();
        assert.equal(this.space.subSpace('list', 'abc12-3').key, 'abc');
      });

      it('sets causedBy', function() {
        const itemSpace = this.space.subSpace('list', 'abc12-3');
        this.space.subscribe((space, causedBy) => {
          if (causedBy[0] === 'initialized') return;
          assert.deepEqual(causedBy, ['list[abc12-3]#myAction', 'root']);
        });

        itemSpace.doAction(function myAction() {
          return { val: 'is set'};
        })();
      });
    });

    describe('children and parent subscribers', function() {
      it('calls subscribers from inside -> out', function() {
        let timesCalled = 0;
        // the subspace's subscribers are called before the parent's
        this.space.subscribe((space, causedBy) => {
          if (causedBy[0] === 'initialized') return;
          timesCalled++;
          assert.equal(timesCalled, 2);
        });
        this.subSpaceByName.subscribe((space, causedBy) => {
          if (causedBy[0] === 'initialized') return;
          timesCalled++;
          assert.equal(timesCalled, 1);
        });
        this.subSpaceByName.doAction(() => ({ updated: 'happened' }))();
        assert.equal(timesCalled, 2);
      });
    });
  });
});
