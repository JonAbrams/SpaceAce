/* eslint-env node, mocha */
'use strict';

const assert = require('assert');
const Space = require('../lib/Space');
const { subscribe, isSpace, isSpaceArray, rootOf } = Space;

describe('Space', function() {
  beforeEach(function() {
    this.initialState = {
      searchTerm: 'baggins',
      limit: 5,
      userInfo: {
        name: 'Jon',
        location: {
          city: 'San Mateo',
          state: 'CA',
          country: 'USA',
        },
      },
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
      'userInfo',
      'characters',
    ]);
  });

  it('provides expected state', function() {
    assert.deepEqual(this.space.toJSON(), this.initialState);
  });

  it('stringifies', function() {
    assert.equal(JSON.stringify(this.space), JSON.stringify(this.initialState));
    assert.equal(this.space.toString(), JSON.stringify(this.initialState));
  });

  it('prevents direct writing', function() {
    assert.throws(() => {
      this.space.searchTerm = 'sam';
    }, TypeError);
    assert.throws(() => {
      this.space.newVal = 'no good!';
    }, TypeError);
  });

  it('is frozen (let it go!)', function() {
    assert(Object.isFrozen(this.space));
  });

  describe('class methods', function() {
    describe('.isSpace', function() {
      it('identifies spaces', function() {
        assert(isSpace(this.space));
        assert(isSpace(this.space.characters));
        assert(isSpace(this.space.characters[0]));
        assert(!isSpace({}));
        assert(!isSpace());
      });
    });

    describe('.isSpaceArray', function() {
      it('identifies spaces that contain arrays', function() {
        assert(isSpaceArray(this.space.characters));
        assert(!isSpaceArray(this.space));
        assert(!isSpaceArray(this.space.characters[0]));
      });
    });

    describe('.rootOf', function() {
      it('returns the root space', function() {
        assert.strictEqual(rootOf(this.space.characters[0]), this.space);
      });

      it('throws when given non-space', function() {
        assert.throws(() => {
          rootOf({});
        });
      });
    });

    describe('.toJSON', function() {
      it('works', function() {
        assert.deepEqual(this.space.toJSON(), this.initialState);
      });
    });

    describe('.toString', function() {
      it('stringifies toJSON', function() {
        assert.strictEqual(
          this.space.toString(),
          JSON.stringify(this.space.toJSON())
        );
      });
    });
  });

  describe('direct updating', function() {
    it('returns new space', function() {
      const newSpace = this.space({ limit: 6 });
      assert.notStrictEqual(newSpace, this.space);
    });

    it('merges values', function() {
      this.space({ limit: 6 });
      assert.strictEqual(this.newSpace.limit, 6);
      assert(this.newSpace.userInfo);
    });
  });
  describe('action updating', function() {
    describe('quick actions', function() {
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

      it('provides correct causedBy for nested spaces', function() {
        this.space.characters[0]('evil')(true);
        assert.strictEqual(this.causedBy, 'characters[0]#set:evil');
        this.newSpace.characters[0].books(({ replace }) => replace([]))();
        assert.strictEqual(this.causedBy, 'characters[0].books#unknown');
      });

      it('applies values from events', function() {
        this.space('searchTerm')({ target: { value: 'frodo' } });
        assert.strictEqual(this.causedBy, '#set:searchTerm');
        assert.strictEqual(this.newSpace.searchTerm, 'frodo');
      });

      it('casts booleans from events', function() {
        this.space.characters[0]('evil')({
          target: { checked: true, type: 'checkbox', value: 'ignore' },
        });
        assert.strictEqual(this.causedBy, 'characters[0]#set:evil');
        assert.strictEqual(this.newSpace.characters[0].evil, true);

        this.newSpace.characters[0]('evil')({
          target: { checked: false, type: 'checkbox' },
        });
        assert.strictEqual(this.causedBy, 'characters[0]#set:evil');
        assert.strictEqual(this.newSpace.characters[0].evil, false);
      });

      it('casts number from events', function() {
        this.space('limit')({ target: { value: '10', type: 'number' } });
        assert.strictEqual(this.causedBy, '#set:limit');
        assert.strictEqual(this.newSpace.limit, 10);
      });
    });

    describe('actions', function() {
      it('updates the space', function() {
        function incLimit({ space, merge }) {
          merge({ limit: space.limit + 1 });
        }
        var space = this.space;
        space(incLimit)();
        // existing space doesn't change
        assert.strictEqual(space, this.space);
        assert.strictEqual(space.limit, 5);
        // correct values given to subscribers
        assert.notStrictEqual(this.newSpace, space);
        assert.strictEqual(this.newSpace.limit, 6);
        assert.strictEqual(this.oldSpace, space);
        assert.strictEqual(this.causedBy, '#incLimit');

        // Again!
        this.newSpace(incLimit)();
        assert.strictEqual(this.newSpace.limit, 7);
      });

      it('supports promises', function() {
        function incLimitPromise({ space, merge }) {
          merge({ searchTerm: '' });
          return Promise.resolve().then(() => {
            merge({ limit: space.limit + 1 });
          });
        }

        return this.space(incLimitPromise)().then(newSpace => {
          assert.strictEqual(this.newSpace, newSpace);
          assert.strictEqual(newSpace.limit, 6);
          assert.strictEqual(newSpace.searchTerm, '');

          // Subscibers called at end of action, and when promise resolved
          assert.strictEqual(this.numCalls, 2);
        });
      });

      describe('args', function() {
        it('passes in a value', function() {
          this.space(({ merge }, value) => merge({ limit: value }))(10);
          assert.strictEqual(this.newSpace.limit, 10);
        });

        it('passes in multiple values', function() {
          this.space(({ merge }, val1, val2) => merge({ limit: val1 + val2 }))(
            10,
            20
          );
          assert.strictEqual(this.newSpace.limit, 30);
        });

        it('passes in an event if present', function() {
          this.space(({ merge }, event) =>
            merge({ searchTerm: event.target.value })
          )({
            target: { value: '' },
          });
          assert.strictEqual(this.newSpace.searchTerm, '');

          this.space(({ event, merge }, value) =>
            merge({ searchTerm: event, val: value })
          )('cheese');
          assert.strictEqual(this.newSpace.searchTerm, undefined);
          assert.strictEqual(this.newSpace.val, 'cheese');
        });

        it('passes in a merge function', function() {
          const oldSpace = this.space;
          this.space(({ space, merge }) => {
            const newSpace = merge({ limit: 10, searchTerm: '' });
            assert.strictEqual(newSpace.limit, 10);
            assert.strictEqual(newSpace.searchTerm, '');

            merge({ newVal: true });

            assert.strictEqual(space, oldSpace);
            assert.notStrictEqual(newSpace, oldSpace);

            merge({ searchTerm: 'frodo' });
          })();

          assert.strictEqual(this.newSpace.searchTerm, 'frodo');
          assert.strictEqual(this.newSpace.newVal, true);
          assert.strictEqual(this.newSpace.limit, 10);
          assert.strictEqual(this.newSpace.characters.length, 2);
        });

        it('shallow merges only', function() {
          this.space(({ merge }) => {
            merge({ userInfo: { name: 'zivi' } });
          })();

          assert.deepEqual(this.newSpace.userInfo.toJSON(), { name: 'zivi' });
        });
      });

      it('notifies immediately', function() {
        this.space(({ merge }) => {
          merge({ limit: 10 });
          merge({ searchTerm: 'legolas' });
          assert.strictEqual(this.newSpace.limit, 10);
          assert.strictEqual(this.newSpace.searchTerm, 'legolas');
        })();
        assert.strictEqual(this.newSpace.limit, 10);
        assert.strictEqual(this.newSpace.searchTerm, 'legolas');
        assert.strictEqual(this.numCalls, 2);
      });

      it('provides getSpace', function() {
        return this.space(({ space, merge, getSpace }) => {
          // limit is 5
          merge({ limit: space.limit + 1 }); // change to 6

          return Promise.resolve().then(() => {
            merge({ limit: getSpace().limit + 1 }); // 7
            assert.strictEqual(space.limit, 5); // original is unchanged
            assert.strictEqual(getSpace().limit, 7); // latest is 7
            assert.strictEqual(this.newSpace.limit, 7); // global space is latest
          });
        })().then(() => {
          // Can safely see the final updated state after action's promise resolved
          assert.strictEqual(this.newSpace.limit, 7);
        });
      });

      describe('action names', function() {
        it('supports actions with no name', function() {
          this.space(({ value, merge }) => merge({ limit: value }))(10);
          assert.strictEqual(this.causedBy, '#unknown');
        });

        it('guesses actions names correctly', function() {
          var decLimit = ({ space, merge }) =>
            merge({ limit: space.limit - 1 });
          this.space(decLimit)();
          assert.strictEqual(this.causedBy, '#decLimit');
        });

        it('supports explicit action names', function() {
          this.space(({ value, merge }) => merge({ limit: value }), 'setLimit')(
            10
          );
          assert.strictEqual(this.causedBy, '#setLimit');
        });
      });
    });
  });

  describe('sub-spaces', function() {
    it('lists are subspaces', function() {
      assert(isSpace(this.space.characters));
    });

    it('objects are subspaces', function() {
      assert(isSpace(this.space.userInfo));
    });

    it('can be updated', function() {
      this.space.userInfo('name')('zivi');
      assert.strictEqual(this.newSpace.userInfo.name, 'zivi');
      assert.strictEqual(this.causedBy, 'userInfo#set:name');

      const setState = ({ merge }, state) => merge({ state });
      this.newSpace.userInfo.location(setState)('CA');
      assert.strictEqual(this.newSpace.userInfo.name, 'zivi');
      assert.strictEqual(this.newSpace.userInfo.location.state, 'CA');
      assert.strictEqual(this.causedBy, 'userInfo.location#setState');
    });

    it('can update rootSpace', function() {
      const updateUserInfoAndLimit = ({ merge, space }, name, email) => {
        merge({ name });
        rootOf(space)({ limit: 6 });
        merge({ email });
      };

      this.space.userInfo(updateUserInfoAndLimit)('Zivi', 'zivi@example.com');
      assert.strictEqual(this.newSpace.userInfo.name, 'Zivi');
      assert.strictEqual(this.newSpace.limit, 6);
      assert.strictEqual(this.newSpace.userInfo.email, 'zivi@example.com');
    });
  });

  describe('array spaces', function() {
    it('has items that are spaces', function() {
      assert(isSpace(this.space.characters[0]));
    });

    it('items can be updated', function() {
      this.space.characters[0]('evil')(true);
      assert.strictEqual(this.newSpace.characters[0].evil, true);
      assert(isSpaceArray(this.newSpace.characters));
    });

    it('has #map', function() {
      const characterNames = [];
      this.space.characters.map(character =>
        characterNames.push(character.name)
      );
      assert.deepEqual(characterNames, ['Bilbo Baggins', 'Frodo Baggins']);
    });

    it('has #slice', function() {
      const [lastCharacter] = this.space.characters.slice(-1);
      assert.strictEqual(lastCharacter.name, 'Frodo Baggins');
    });

    it('has sort', function() {
      const sortedByMostBooks = this.space.characters.sort(
        (a, b) => b.books.length - a.books.length
      );
      assert.deepEqual(sortedByMostBooks.map(c => c.name), [
        'Frodo Baggins',
        'Bilbo Baggins',
      ]);
    });

    it('has filter', function() {
      const bilboOnly = this.space.characters.filter(
        character => character.name === 'Bilbo Baggins'
      );
      assert.deepEqual(bilboOnly.map(c => c.name), ['Bilbo Baggins']);
    });

    describe('updating', function() {
      it('does not merge', function() {
        assert.throws(() => {
          this.space.characters(({ merge }) => {
            merge({ something: 'fails' });
          })();
        }, /You cannot merge onto an array, try replace instead\?/);

        assert.throws(() => {
          this.space.characters(({ merge }) => merge({ something: 'fails' }))();
        }, /You cannot merge onto an array, try replace instead\?/);
      });

      it('has replace', function() {
        this.space.characters(({ replace }) => {
          replace([{ name: 'Sauron', evil: true }]);
        })();

        assert.deepEqual(this.newSpace.characters.toJSON(), [
          { name: 'Sauron', evil: true },
        ]);
      });

      it('passes in push', function() {
        const arwen = { name: 'Arwen', species: 'Elf', evil: false };
        const boromir = { name: 'Boromir', species: 'Human', evil: false };
        this.space.characters(({ push }) => {
          push(arwen);
          push(boromir);
        })();

        assert.strictEqual(this.newSpace.characters.length, 4);
        assert.deepEqual(this.newSpace.characters[2].toJSON(), arwen);
        assert.deepEqual(this.newSpace.characters[3].toJSON(), boromir);
      });

      it('passes in unshift', function() {
        const arwen = { name: 'Arwen', species: 'Elf', evil: false };
        const boromir = { name: 'Boromir', species: 'Human', evil: false };
        this.space.characters(({ unshift }) => {
          unshift(arwen);
          unshift(boromir);
        })();

        assert.strictEqual(this.newSpace.characters.length, 4);
        assert.deepEqual(this.newSpace.characters[0].toJSON(), boromir);
        assert.deepEqual(this.newSpace.characters[1].toJSON(), arwen);
      });

      it('passes in remove', function() {
        this.space.characters(({ push }) =>
          push({ name: 'Sauron', evil: true })
        )();
        assert.strictEqual(
          this.newSpace.characters.filter(item => item.evil).length,
          1
        );
        this.newSpace.characters(({ remove }) => {
          remove(character => character.evil);
        })();
        assert.strictEqual(
          this.newSpace.characters.filter(item => item.evil).length,
          0
        );
      });
    });
  });
});
