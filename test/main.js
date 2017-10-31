/* eslint-env node, mocha */

const assert = require('assert');
const Space = require('../lib/Space');

describe('Space', function() {
  beforeEach(function() {
    this.space = new Space({
      initialState: 'here',
      count: 1,
      child: {},
      nullItem: null,
    });
  });

  it('returns Space instance', function() {
    assert(new Space() instanceof Space);
  });

  it('instance is frozen', function() {
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
    const publicMethods = [
      'state',
      'setState',
      'subSpace',
      'bindTo',
      'replaceState',
      'parentSpace',
    ];
    const childSpace = this.space.subSpace('child');
    assert.deepEqual(Object.keys(this.space), publicMethods);
    assert.deepEqual(Object.keys(childSpace), publicMethods);
  });

  it('has initial state', function() {
    assert.deepEqual(this.space.state, {
      initialState: 'here',
      count: 1,
      child: {},
      nullItem: null,
    });
  });

  it('does not regenerate state on each get', function() {
    assert.equal(this.space.state, this.space.state);
  });

  describe('#setState', function() {
    it('updates the state', function() {
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        assert.equal(causedBy, 'root#unknown');
      });
      this.space.setState({ count: 42, initialState: null });
      assert.deepEqual(this.space.state, {
        initialState: null,
        count: 42,
        nullItem: null,
        child: {},
      });
    });

    it('can specify action name', function() {
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        assert.equal(causedBy, 'root#customName');
      });
      this.space.setState({ val: true }, 'customName');
      assert.deepEqual(this.space.state, {
        initialState: 'here',
        count: 1,
        nullItem: null,
        child: {},
        val: true,
      });
    });
  });

  describe('#bindTo', function() {
    it('updates state', function() {
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        assert.equal(causedBy, 'root#updater');
      });
      this.space.bindTo(function updater({ state: { count } }) {
        return { count: count + 1 };
      })();
      assert.deepEqual(this.space.state, {
        initialState: 'here',
        count: 2,
        child: {},
        nullItem: null,
      });
    });

    it('actions pass in extra params', function() {
      let called = false;
      const oldState = this.space.state;
      this.space.bindTo((space, event, additional) => {
        called = event.called;
        assert.equal(additional, 'additional');
      })({ called: 'once' }, 'additional');
      assert.equal(called, 'once', 'additional');
      assert.equal(this.space.state, oldState);
    });
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

    it('calls subscribers when state is changed via bind', function() {
      assert(!this.subscriberCalled);
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        assert.equal(this.space.state.count, 2);
      });
      this.space.bindTo(() => ({ count: 2 }))();
      assert(this.subscriberCalled);
    });

    it('does NOT call subscribers when no value is returned', function() {
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        assert(false);
      });
      this.space.bindTo(() => {})();
    });

    it('sets causedBy', function() {
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        assert.deepEqual(causedBy, 'root#myAction');
      });

      this.space.bindTo(function myAction() {
        return { val: 'is set' };
      })();
    });
  });

  describe('child spaces', function() {
    beforeEach(function() {
      this.subSpaceByName = this.space.subSpace('child');
      this.space.setState({
        actionChild: { value: 'present' },
      });
    });

    it('propagates changes upwards', function() {
      this.subSpaceByName.setState({ value: 'is there' });
      assert.equal(this.space.state.child.value, 'is there');
    });

    it('uses existing sub space', function() {
      assert.equal(this.space.subSpace('child'), this.subSpaceByName);
    });

    it('gives empty state by default', function() {
      assert.deepEqual(this.space.subSpace('emptyChild').preState, {});
      assert.deepEqual(this.space.subSpace('emptyChild').state, {});
    });

    it('throws list subSpaces missing id', function() {
      assert.throws(() => {
        this.space.bindTo(({ subSpace }) => ({
          list: [subSpace({ value: 'present' })],
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
      this.subSpaceByName.parentSpace('root').setState({
        actionChild: {
          addedValue: 'present',
        },
      });
      assert.equal(
        this.space.subSpace('actionChild').state.addedValue,
        'present'
      );
    });

    it('can update nephews', function() {
      const deepSpace = this.space
        .subSpace('actionChild')
        .subSpace('actionChildChild');

      this.space
        .subSpace('actionChild')
        .subSpace('actionChildChild')
        .setState({
          value: 'starting',
        });

      let subscriberCalled = 0;
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        assert.equal(causedBy, 'root#unknown');
        subscriberCalled += 1;
      });

      this.subSpaceByName.parentSpace('root').setState({
        actionChild: {
          actionChildChild: {
            addedValue: 'present',
          },
        },
      });

      assert.equal(subscriberCalled, 1);

      assert.deepEqual(deepSpace.state, {
        addedValue: 'present',
        value: 'starting',
      });
    });

    it('old copy of state renders attached grandchild spaces correctly', function() {
      const space = new Space({ child: { grandChild: { val: true } } });
      const oldState = space.state;
      assert.deepEqual(oldState.child.grandChild, { val: true });
      space.subSpace('child').subSpace('grandChild');
      assert.deepEqual(oldState.child.grandChild, { val: true });
    });

    describe('child spaces in lists', function() {
      beforeEach(function() {
        this.space.setState({
          list: [
            { value: 'present', id: 'abc12-3' },
            { value: 'another', id: '1234' },
          ],
        });
      });

      describe('list spaces', function() {
        beforeEach(function() {
          this.listSpace = new Space([{ id: 123, val: 'abc' }]);
        });

        it('can get child subSpaces', function() {
          assert(this.listSpace.subSpace('123') instanceof Space);
          assert.equal(this.listSpace.subSpace('123').state.val, 'abc');
        });

        it('throws when id not found', function() {
          assert.throws(
            () => this.listSpace.subSpace('321'),
            /Could not find item with id 321 in root/
          );
        });
      });

      it('supports subSpaces in lists', function() {
        assert.deepEqual(this.space.state, {
          initialState: 'here',
          count: 1,
          child: {},
          nullItem: null,
          actionChild: { value: 'present' },
          list: [
            { value: 'present', id: 'abc12-3' },
            { value: 'another', id: 1234 },
          ],
        });
      });

      it('can get spaces from list', function() {
        const listItemSpace = this.space.subSpace('list').subSpace('abc12-3');
        assert.equal(listItemSpace.state.value, 'present');
      });

      it('throws when id not found', function() {
        assert.throws(
          () => this.space.subSpace('list').subSpace('321'),
          /Could not find item with id 321 in list/
        );
      });

      it('removes spaces when null is given', function() {
        const listItemSpace = this.space.subSpace('list').subSpace('abc12-3');
        assert.equal(this.space.state.list.length, 2);
        listItemSpace.setState(null);
        assert.equal(this.space.state.list.length, 1);
      });

      it('provides a key attribute', function() {
        assert('key' in this.space.subSpace('list').subSpace('abc12-3'));
        assert.equal(
          this.space.subSpace('list').subSpace('abc12-3').key,
          'abc12-3'
        );
      });

      it('key prop changes when ID changes', function() {
        const itemSpace = this.space.subSpace('list').subSpace('abc12-3');
        itemSpace.setState({ id: 'abc' });
        assert.equal(this.space.subSpace('list').subSpace('abc').key, 'abc');
      });

      it('sets causedBy', function() {
        const itemSpace = this.space.subSpace('list').subSpace('abc12-3');
        this.space.subscribe(causedBy => {
          if (causedBy === 'initialized') return;
          assert.equal(causedBy, 'list[abc12-3]#myAction');
        });

        itemSpace.setState({ val: 'is set' }, 'myAction');
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
        this.subSpaceByName.setState({ updated: 'happened' });
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

    it('cannot be updated', function() {
      assert.throws(() => this.spaceList.setState({ not: 'good' }));
    });

    it('can be replaced', function() {
      this.spaceList.replaceState(this.spaceList.state.concat('end'));
      assert.deepEqual(this.spaceList.state, ['item', { val: true }, 'end']);
      this.spaceList.replaceState(this.spaceList.state.slice(0, 1));
      assert.deepEqual(this.spaceList.state, ['item']);
    });

    describe('is a child', function() {
      beforeEach(function() {
        this.space.setState({
          subList: [1, 2, 3],
        });
      });

      it('state is expected array', function() {
        const state = this.space.subSpace('subList').state;
        assert.deepEqual(state, [1, 2, 3]);
      });
    });
  });
});
