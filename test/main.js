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

  it('calls subscriber on subscribing', function() {
    const space = new Space();
    space.subscribe(causedBy => {
      assert.deepEqual(causedBy, 'initialized');
    });
  });

  it('can be JSONified', function() {
    const jsonStr = JSON.stringify(this.space);
    assert.deepEqual(JSON.parse(jsonStr), {
      state: {
        child: {},
        count: 1,
        initialState: 'here',
        nullItem: null,
      },
    });
  });

  describe('with skipInitialNotification', function() {
    it('does not call subscriber on subscribing', function() {
      const space = new Space({}, { skipInitialNotification: true });
      space.subscribe(causedBy => {
        assert.equal(1, 2);
      });
    });
  });

  it('spaces only have these enumerated keys', function() {
    const publicMethods = [
      'state',
      'setState',
      'subSpace',
      'bindTo',
      'replaceState',
      'getRootSpace',
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

    it('recursively merges onto sub-spaces and objects', function() {
      const childSpace = this.space.subSpace('child');
      childSpace.setState({ val: true });
      this.space.setState({ objChild: { val: 123 } });

      this.space.setState({
        count: 2,
        child: { otherVal: 'abc' },
        objChild: {
          otherVal: 321,
        },
      });

      assert.deepEqual(this.space.state, {
        initialState: 'here',
        count: 2,
        nullItem: null,
        child: { val: true, otherVal: 'abc' },
        objChild: { val: 123, otherVal: 321 },
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

    it('throws when given a function', function() {
      assert.throws(() => {
        this.space.setState(() => {});
      });
    });

    it('does not alter primitive values', function() {
      this.space.setState({ arr: ['string'] });
      assert.equal(this.space.state.arr[0], 'string');
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
      assert.equal(called, 'once');
      assert.equal(this.space.state, oldState);
    });

    it('can overwrite existing null values', function() {
      this.space.setState({ nullItem: null });
      assert.equal(this.space.state.nullItem, null);
    });

    it('supports regexes', function() {
      this.space.setState({ reg: /abc/ });
      assert.equal(this.space.state.reg.toString(), '/abc/');
      assert(this.space.state.reg instanceof RegExp);
    });

    it('passes through extra params on bind', function() {
      let called = false;
      this.space.bindTo((space, id, event) => {
        called = event.called;
        assert.equal(id, 'abc123');
      }, 'abc123')({ called: 'once' });
      assert.equal(called, 'once', 'additional');
    });

    it('replaces state if returned is an array', function() {
      this.space.bindTo(() => ['val'])();
      assert.deepEqual(this.space.state, ['val']);
    });

    it('supports promise returns', async function() {
      const promise = Promise.resolve({ newItem: 'is new' });
      this.space.bindTo(() => promise)();
      assert(!this.space.state.newItem);
      await promise;
      assert.equal(this.space.state.newItem, 'is new');
    });

    it('supports generators', function() {
      let notificationCount = 0;
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        notificationCount++;
      });
      this.space.bindTo(function* gen(space) {
        yield { nullItem: 'no longer null' };
        return { newItem: 'is new' };
      })();
      assert.deepEqual(this.space.state, {
        initialState: 'here',
        count: 1,
        child: {},
        nullItem: 'no longer null',
        newItem: 'is new',
      });
      assert.equal(notificationCount, 2);
    });

    it('supports yielded promises', async function() {
      let promise;
      let notificationCount = 0;
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        notificationCount++;
      });
      this.space.bindTo(function* gen(space) {
        promise = new Promise(resolve => {
          setTimeout(() => {
            resolve({ count: space.state.count + 1 });
          }, 0);
        });
        yield { yielded: true, count: 2 };
        yield promise;
        return { count: 5 };
      })();
      assert.deepEqual(this.space.state, {
        initialState: 'here',
        count: 5,
        child: {},
        nullItem: null,
        yielded: true,
      });
      assert.equal(notificationCount, 2);
      await promise;
      assert.equal(this.space.state.count, 6);
      assert.equal(notificationCount, 3);
    });
  });

  describe('#replaceState', function() {
    it('replaces the state', function() {
      let called = false;
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        called = true;
        assert.equal(causedBy, 'root#replacer');
      });
      this.space.replaceState({ abc: 123 }, 'replacer');
      assert.deepEqual(this.space.state, { abc: 123 });
      assert(called);
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

    it('calls subscribers when state is changed via bindTo', function() {
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

    it('unsubscribes', function() {
      const unsubscribe = this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        throw new Error('This should not be called!');
      });
      unsubscribe();
      this.space.setState({ changed: true });
    });
  });

  describe('child spaces', function() {
    beforeEach(function() {
      this.subSpaceByName = this.space.subSpace('child');
      this.space.setState({
        otherChild: { value: 'present' },
      });
    });

    it('propagates changes upwards', function() {
      this.subSpaceByName.setState({ value: 'is there' });
      assert.equal(this.space.state.child.value, 'is there');
    });

    it('uses existing sub space', function() {
      assert.equal(this.space.subSpace('child'), this.subSpaceByName);
    });

    it('does not touch child state if child is unaffected', function() {
      const oldState = this.subSpaceByName.state;
      // Parent changed
      this.space.setState({ change: true });
      assert.equal(oldState, this.subSpaceByName.state);
      // Sibling changed
      this.space.subSpace('otherChild').setState({ value: null });
      assert.equal(oldState, this.subSpaceByName.state);
      // Self changed
      this.space.setState({ child: { changed: true } });
      assert.notEqual(oldState, this.subSpaceByName.state);
    });

    it('subSpacing sets initial state to empty object', function() {
      // undefined
      assert.deepEqual(this.space.subSpace('missingChild').state, {});

      // null
      assert.deepEqual(this.space.subSpace('nullItem').state, {});
    });

    it('subSpacing throws when given invalid type as state', function() {
      this.space.setState({ primitive: 'a string', date: new Date() });
      assert.throws(() => {
        this.space.subSpace('primitive');
      }, /Cannot attach sub-space to primitive with type string/);

      assert.throws(() => {
        this.space.subSpace('date');
      }, /Cannot attach sub-space to date with type Date/);
    });

    it('can fetch root space', function() {
      this.subSpaceByName.setState({ gc: {} });
      const grandChild = this.subSpaceByName.subSpace('gc');
      assert.equal(this.subSpaceByName.getRootSpace(), this.space);
      assert.equal(grandChild.getRootSpace(), this.space);
    });

    it('can update children', function() {
      const childOne = this.space.subSpace('childOne');
      const childTwo = this.space.subSpace('childTwo');
      const gChild = childTwo.subSpace('gChild');
      assert.deepEqual(childOne.state, {});
      assert.deepEqual(childTwo.state, {});
      this.space.setState({
        childOne: { val: 'abc' },
        childTwo: { val: '123', gChild: { val: 'xyz' } },
      });
      assert.equal(childOne.state.val, 'abc');
      assert.equal(childTwo.state.val, '123');
      assert.equal(gChild.state.val, 'xyz');
    });

    it('can update siblings', function() {
      this.subSpaceByName.getRootSpace().setState({
        otherChild: {
          addedValue: 'present',
        },
      });
      assert.equal(
        this.space.subSpace('otherChild').state.addedValue,
        'present'
      );
    });

    it('can update nephews', function() {
      this.space.subSpace('otherChild').setState({ otherChildChild: {} });
      const deepSpace = this.space
        .subSpace('otherChild')
        .subSpace('otherChildChild');

      this.space
        .subSpace('otherChild')
        .subSpace('otherChildChild')
        .setState({
          value: 'starting',
        });

      let subscriberCalled = 0;
      this.space.subscribe(causedBy => {
        if (causedBy === 'initialized') return;
        assert.equal(causedBy, 'root#unknown');
        subscriberCalled += 1;
      });

      this.subSpaceByName.getRootSpace().setState({
        otherChild: {
          otherChildChild: {
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
          otherChild: { value: 'present' },
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
