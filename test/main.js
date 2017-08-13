const assert = require('assert');
const Space = require('../lib/Space');

describe('Space', function() {
  beforeEach(function() {
    this.space = new Space({
      initialState: 'here',
      count: 1,
      child: {}
    });
  });

  it('returns Space instance', function() {
    assert(new Space() instanceof Space);
  });

  it('instance is frozen', function () {
    assert(Object.isFrozen(this.space.state));
  });

  it('calls subscriber on subscribing', function(done) {
    const space = new Space();
    space.subscribe(causedBy => {
      assert.deepEqual(causedBy, 'initialized');
      done();
    });
  });

  it('spaces only have these enumerated keys', function() {
    const publicMethods = ['state', 'setState', 'subSpace', 'parentSpace'];
    const childSpace = this.space.subSpace('child');
    assert.deepEqual(Object.keys(this.space), publicMethods);
    assert.deepEqual(Object.keys(childSpace), publicMethods);
  });

  it('has initial state', function() {
    assert.deepEqual(this.space.state, { initialState: 'here', count: 1, child: {} });
  });

  it('updates the state', function() {
    const oldState = this.space.state;
    this.space.setState(({ state }) => ({ count: state.count + 1 }))();
    assert.deepEqual(this.space.state, { initialState: 'here', count: 2, child: {} });
    assert.notEqual(this.space.state, oldState);
  });

  it('can update directly', function(done) {
    const oldState = this.space.state;
    this.space.subscribe(causedBy => {
      if (causedBy === 'initialized') return;
      assert.equal(causedBy, 'root#unknown');
      done();
    });
    this.space.setState({ count: 42 });
    assert.deepEqual(this.space.state, { initialState: 'here', count: 42, child: {} });
  });

  it('actions pass in event', function() {
    let called = false;
    this.space.setState((space, event) => { called = event.called; })({ called: 'once' });
    assert.equal(called, 'once');
  });

  it('can specify action name', function() {
    this.space.subscribe(causedBy => {
      if (causedBy === 'initialized') return;
      assert.equal(causedBy, 'root#customName');
    });
    this.space.setState({ val: true}, 'customName');
    this.space.setState(() => ({ val: true}), 'customName');
  });

  describe('subscribers', function() {
    beforeEach(function() {
      this.subscriberCalled = false;
      this.subscriber = causedBy => {
        if (causedBy === 'initialized') return;
        this.subscriberCalled = true;
      };
      this.space.subscribe(this.subscriber);
    });

    it('registers subscribers', function() {
      assert.equal(this.space.subscribers[0], this.subscriber);
    });

    it('calls subscribers when state is changed via action', function() {
      assert(!this.subscriberCalled);
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        assert.equal(this.space.state.count, 2);
      });
      this.space.setState(() => ({ count: 2 }))();
      assert(this.subscriberCalled);
    });

    it('does NOT call subscribers when no value is returned', function() {
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        assert(false);
      });
      this.space.setState(() => {})();
    });

    it('sets causedBy', function() {
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        assert.deepEqual(causedBy, 'root#myAction');
      });

      this.space.setState(function myAction() {
        return { val: 'is set'};
      })();
    });
  });


  describe('child spaces', function() {
    beforeEach(function() {
      this.subSpaceByName = this.space.subSpace('child');
      this.space.setState(({ subSpace }) => ({
        actionChild: subSpace({ value: 'present' })
      }))();
    });

    it('propagates changes upwards', function() {
      this.subSpaceByName.setState(() => ({ value: 'is there' }))();
      assert.equal(this.space.state.child.value, 'is there');
    });

    it('uses existing sub space', function() {
      assert.equal(this.space.subSpace('child'), this.subSpaceByName);
    });

    it('gives empty state by default', function() {
      assert.deepEqual(this.space.subSpace('emptyChild').preState, {});
      assert.deepEqual(this.space.subSpace('emptyChild').state, {});
    });

    it('supports adding subspaces by action', function() {
      assert(this.space.preState.actionChild instanceof Space);
      assert.equal(this.space.state.actionChild.value, 'present');
    });

    it('removes spaces by returning null for that space', function() {
      assert(this.space.state.child);
      this.space.setState(() => ({ child: null }))();
      assert.equal(this.space.state.child, null);
    });

    it('throws list subSpaces missing id', function() {
      assert.throws(() => {
        this.space.setState(({ subSpace }) => ({
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

    it('can update siblings', function() {
      this.subSpaceByName.parentSpace('root').setState(() => ({
        actionChild: {
          addedValue: 'present'
        }
      }))();
      assert.equal(this.space.subSpace('actionChild').state.addedValue, 'present');
    });

    it('can update nephews', function() {
      this.space.subSpace('actionChild').subSpace('actionChildChild').setState(() => ({
        value: 'starting'
      }))();
      this.subSpaceByName.parentSpace('root').setState(() => ({
        actionChild: {
          actionChildChild: {
            addedValue: 'present'
          }
        }
      }))();
      assert.deepEqual(
        this.space.subSpace('actionChild').subSpace('actionChildChild').state,
        {
          addedValue: 'present',
          value: 'starting'
        }
      );
    });

    describe('child spaces in lists', function() {
      beforeEach(function() {
        this.space.setState(({ subSpace }) => ({
          list: [
            subSpace({ value: 'present', id: 'abc12-3' }),
            { notSubSpace: true, id: '1234' }
          ]
        }))();
      });

      it('supports subSpaces in lists', function() {
        assert.deepEqual(this.space.state, {
          initialState: 'here',
          count: 1,
          child: {},
          actionChild: { value: 'present' },
          list: [
            {value: 'present', id: 'abc12-3' },
            { notSubSpace: true, id: 1234 }
          ]
        });
      });

      it('can get spaces from list', function() {
        const listItemSpace = this.space.subSpace('list', 'abc12-3');
        assert.equal(listItemSpace.state.value, 'present');
      });

      it('can turn non-spaces into spaces from list', function() {
        const listItemSpace = this.space.subSpace('list', '1234');
        assert(listItemSpace.state.notSubSpace);
        assert.equal(listItemSpace.nextParent, this.space);
      });

      it('can respawn list spaces', function() {
        let listItemSpace = this.space.subSpace('list', '1234');
        listItemSpace = this.space.subSpace('list', '1234');
        assert(listItemSpace.state.notSubSpace);
      });

      it('removes spaces when null is returned from action', function() {
        const listItemSpace = this.space.subSpace('list', 'abc12-3');
        assert.equal(this.space.state.list.length, 2);
        listItemSpace.setState(() => null)();
        assert.equal(this.space.state.list.length, 1);
      });

      it('provides a key prop', function() {
        assert('key' in this.space.subSpace('list', 'abc12-3'));
        assert.equal(this.space.subSpace('list', 'abc12-3').key, 'abc12-3');
      });

      it('key prop changes when ID changes', function() {
        const itemSpace = this.space.subSpace('list', 'abc12-3');
        itemSpace.setState({ id: 'abc' });
        assert.equal(this.space.subSpace('list', 'abc').key, 'abc');
      });

      it('sets causedBy', function() {
        const itemSpace = this.space.subSpace('list', 'abc12-3');
        this.space.subscribe(causedBy => {
          if (causedBy === 'initialized') return;
          assert.equal(causedBy, 'list[abc12-3]#myAction');
        });

        itemSpace.setState(function myAction() {
          return { val: 'is set'};
        })();
      });
    });

    describe('children and parent subscribers', function() {
      it('calls subscribers from inside -> out', function() {
        let timesCalled = 0;
        // the subspace's subscribers are called before the parent's
        this.space.subscribe(causedBy => {
          if (causedBy === 'initialized') return;
          timesCalled++;
          assert.equal(timesCalled, 2);
        });
        this.subSpaceByName.subscribe(causedBy => {
          if (causedBy === 'initialized') return;
          timesCalled++;
          assert.equal(timesCalled, 1);
        });
        this.subSpaceByName.setState(() => ({ updated: 'happened' }))();
        assert.equal(timesCalled, 2);
      });
    });
  });

  describe('space with an array as state', function() {
    beforeEach(function() {
      this.initialState = ['item', { val: true }];
      this.spaceList = new Space(this.initialState);
    });

    it('returns correct state', function() {
      assert.deepEqual(this.spaceList.state, this.initialState);
      assert(Array.isArray(this.spaceList.state));
    });

    it('can be updated', function() {
      this.spaceList.setState(this.spaceList.state.concat('end'));
      assert.deepEqual(this.spaceList.state, ['item', { val: true }, 'end']);
      this.spaceList.setState(this.spaceList.state.slice(0,1));
      assert.deepEqual(this.spaceList.state, ['item']);
    });

    describe('is a child', function() {
      beforeEach(function() {
        this.space.setState({
          subList: [1,2,3]
        });
      });

      it('state is expected array', function() {
        const state = this.space.subSpace('subList').state;
        assert.deepEqual(state, [1,2,3]);
      });
    });
  });
});
