/* eslint-env node, mocha */

const assert = require('assert');
const Space = require('../lib/Space');
const { subscribe, spaceToObj, isSpace } = Space;

describe('Space', function() {
  beforeEach(function() {
    this.initialState = {
      searchTerm: 'baggins',
      limit: 5,
      characters: [
        {
          name: 'Bilbo Baggins',
          species: 'Hobbit',
          evil: false,
          books: ['The Hobbit', 'Fellowship of the Ring'],
        },
        {
          name: 'Frodo Baggins',
          species: 'Hobbit',
          evil: false,
          books: [
            'Fellowship of the Ring',
            'The Two Towers',
            'The Return of the King',
          ],
        },
      ],
    };
    this.space = new Space(this.initialState);

    this.numCalls = 0;
    this.newSpace = null;
    this.oldSpace = null;
    this.causedBy = null;
    subscribe(this.space, ({ newSpace, oldSpace, causedBy }) => {
      this.numCalls++;
      this.newSpace = newSpace;
      this.oldSpace = oldSpace;
      this.causedBy = causedBy;
    });
  });

  it('is a function AND a space', function() {
    assert.strictEqual(typeof this.space, 'function');
    assert(isSpace(this.space));
  });

  it('provides expected enumerated keys', function() {
    assert.deepEqual(Object.keys(this.space), [
      'searchTerm',
      'limit',
      'characters',
    ]);
  });

  it('provides expected state', function() {
    assert.deepEqual(spaceToObj(this.space), this.initialState);
  });

  it('stringifies', function() {
    assert.equal(JSON.stringify(this.space), JSON.stringify(this.initialState));
    assert.equal(this.space.toString(), JSON.stringify(this.initialState));
  });

  describe('function updating', function() {
    describe('key setter', function() {
      it('updates single keys with a value', function() {
        var space = this.space;
        assert.strictEqual(typeof space('limit'), 'function');
        space('limit')(6);
        // existing space doesn't change
        assert.strictEqual(space, this.space);
        // correct values given to subscribers
        assert.notStrictEqual(this.newSpace, space);
        assert.strictEqual(this.newSpace.limit, 6);
        assert.strictEqual(this.oldSpace, space);
        assert.strictEqual(this.causedBy, '#set:limit');
      });

      it('adds single keys with a value', function() {
        var space = this.space;
        assert.strictEqual(space.newVal, undefined);
        space('newVal')(true);
        // existing space doesn't change
        assert.strictEqual(space, this.space);
        // correct values given to subscribers
        assert.notStrictEqual(this.newSpace, space);
        assert.strictEqual(this.newSpace.newVal, true);
        assert.strictEqual(this.oldSpace, space);
        assert.strictEqual(this.causedBy, '#set:newVal');
      });
    });

    describe('actions', function() {
      beforeEach(function() {
        this.incLimit = function incLimit({ space }) {
          return { limit: space.limit + 1 };
        };
        this.setLimit = ({ value: limit }) => ({ limit });
      });
      it('updates the space', function() {
        var space = this.space;
        space(this.incLimit)();
        // existing space doesn't change
        assert.strictEqual(space, this.space);
        assert.strictEqual(space.limit, 5);
        // correct values given to subscribers
        assert.notStrictEqual(this.newSpace, space);
        assert.strictEqual(this.newSpace.limit, 6);
        assert.strictEqual(this.oldSpace, space);
        assert.strictEqual(this.causedBy, '#incLimit');
      });

      it('passes in a value', function() {
        this.space(this.setLimit)(10);
        assert.strictEqual(this.newSpace.limit, 10);
      });

      it('supports actions with no name', function() {
        this.space(this.setLimit)(10);
        assert.strictEqual(this.causedBy, '#unknown');
      });

      it('guesses actions names correctly', function() {
        var decLimit = ({ space }) => ({ limit: space.limit - 1 });
        this.space(decLimit)();
        assert.strictEqual(this.causedBy, '#decLimit');
      });

      it('supports explicit action names', function() {
        this.space(this.setLimit, 'setLimit')(10);
        assert.strictEqual(this.causedBy, '#setLimit');
      });
    });
  });
});
