/* eslint-env node, mocha */
'use strict';

const assert = require('assert');
const {
  createSpace,
  subscribe,
  isSpace,
  rootOf,
  newestSpace,
} = require('../lib/Space');

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
    this.space = createSpace(this.initialState);

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

  it('supports undefined name', function() {
    assert.strictEqual(this.space.name, undefined);
    assert.strictEqual(this.space.userInfo.name, 'Jon');
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
    assert(Object.isFrozen(this.space.toJSON()));
    assert(Object.isFrozen(this.space.toJSON().characters));
  });

  describe('class methods', function() {
    describe('.isSpace', function() {
      it('identifies spaces', function() {
        assert(isSpace(this.space));
        assert(isSpace(this.space.characters)); // Arrays are pseudo-spaces
        assert(isSpace(this.space.characters[0]));
        assert(!isSpace({}));
        assert(!isSpace());
      });
    });

    describe('.rootOf', function() {
      it('returns the root space', function() {
        assert.strictEqual(rootOf(this.space.characters[0]), this.space);
      });

      it('goes all the way up the chain of parent spaces', function() {
        assert.strictEqual(rootOf(this.space.userInfo.location), this.space);
      });

      it('returns the newest copy of the root space', function() {
        this.space.userInfo.location({ city: 'San Diego' });
        assert.strictEqual(rootOf(this.space.userInfo.location), this.newSpace);
      });

      it('throws when given non-space', function() {
        assert.throws(() => {
          rootOf({});
        });
      });
    });

    describe('.newestSpace', function() {
      it('returns the same object if no updates were made', function() {
        const capture = this.space.userInfo;
        assert.strictEqual(newestSpace(capture), capture);
      });

      it('returns newest copy of current space', function() {
        const capture = this.space.userInfo.location;
        const newerSpace = capture({ city: 'San Diego' });
        assert.strictEqual(newestSpace(capture), newerSpace);
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

      it('uses square notation when appropriate', function() {
        this.space({
          'Has a space': {
            list: [{ 'sub-item': { item: 'Present' } }],
          },
        });
        this.newSpace['Has a space'].list[0]['sub-item'](
          { changed: true },
          'custom'
        );
        assert.equal(
          this.causedBy,
          '["Has a space"].list[0]["sub-item"]#custom'
        );
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

      it('supports promises/async', async function() {
        async function incLimitPromise({ getSpace, merge }) {
          merge({ searchTerm: '' });
          await new Promise(resolve =>
            setTimeout(() => {
              merge({ limit: 7 });
              resolve();
            })
          );
          merge({ limit: getSpace().limit + 1 });
        }

        const newSpace = await this.space(incLimitPromise)();
        assert.strictEqual(this.newSpace, newSpace);
        assert.strictEqual(newSpace.limit, 8);
        assert.strictEqual(newSpace.searchTerm, '');

        // Subscibers called whenever space changed
        assert.strictEqual(this.numCalls, 3);
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

        it('passes in a replace function', function() {
          this.space(({ replace }) => {
            replace({ allGone: true });
          })();

          assert.deepStrictEqual(this.newSpace.toJSON(), { allGone: true });
        });

        it('passes in a rootSpace', function() {
          this.space.userInfo(({ merge, rootSpace, space }) => {
            assert.strictEqual(rootSpace, this.space);
            assert.notStrictEqual(space, this.space);
            merge({ touched: true });
          })();

          assert(this.newSpace.userInfo.touched);
        });

        it('passes in getSpace', async function() {
          await this.space(async ({ space, merge, getSpace }) => {
            // limit is 5
            merge({ limit: space.limit + 1 }); // change to 6

            return Promise.resolve().then(() => {
              merge({ limit: getSpace().limit + 1 }); // 7
              assert.strictEqual(space.limit, 5); // original is unchanged
              assert.strictEqual(getSpace().limit, 7); // latest is 7
              assert.strictEqual(this.newSpace.limit, 7); // global space is latest
            });
          })();

          // Can safely see the final updated state after action's promise resolved
          assert.strictEqual(this.newSpace.limit, 7);
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

      it('updates latest spaces', async function() {
        await this.space(({ space, merge }) => {
          space.userInfo.location({ city: 'San Jose' });
          space.userInfo({ name: 'Noj' });
          merge({
            limit: 10,
            characters: space.characters.concat({
              name: 'Sauron',
              evil: true,
            }),
          });
          space.characters[0]({
            name: 'Milbo Baggins',
          });
        })();
        assert.strictEqual(this.newSpace.userInfo.name, 'Noj');
        assert.strictEqual(this.newSpace.userInfo.location.city, 'San Jose');
        assert.notStrictEqual(this.newSpace.userInfo, this.space.userInfo);
        assert.strictEqual(this.newSpace.limit, 10);
        assert.strictEqual(this.newSpace.characters[0].name, 'Milbo Baggins');
        assert.strictEqual(this.newSpace.characters[2].name, 'Sauron');

        assert.strictEqual(this.oldSpace.characters[0].name, 'Bilbo Baggins');
      });

      describe('action names', function() {
        it('supports actions with no name', function() {
          this.space(({ value, merge }) => merge({ limit: value }))(10);
          assert.strictEqual(this.causedBy, '#unknown');
        });

        it('guesses action names correctly', function() {
          var decLimit = ({ space, merge }) =>
            merge({ limit: space.limit - 1 });
          this.space(decLimit)();
          assert.strictEqual(this.causedBy, '#decLimit');
        });

        it('supports overriding action names', function() {
          this.space(({ value, merge }) => merge({ limit: value }), 'setLimit')(
            10
          );
          assert.strictEqual(this.causedBy, '#setLimit');
        });
      });
    });
  });

  describe('sub-spaces', function() {
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

  describe('arrays', function() {
    it('are arrays', function() {
      assert(Array.isArray(this.space.characters));
    });

    it('can have items that are spaces', function() {
      assert(isSpace(this.space.characters[0]));
    });

    it('items can be updated', function() {
      this.space.characters[0]('evil')(true);
      assert.strictEqual(this.causedBy, 'characters[0]#set:evil');
      assert.strictEqual(this.newSpace.characters[0].evil, true);
      assert.notStrictEqual(this.space.characters, this.newSpace.characters);
    });

    it('items can be added', function() {
      const newCharacter = {
        name: 'Sauron',
        evil: true,
      };
      this.space({
        characters: this.space.characters.concat(newCharacter),
      });
      assert.strictEqual(this.newSpace.characters.length, 3);
      assert(isSpace(this.newSpace.characters[2]));
      assert.strictEqual(this.newSpace.characters[2].name, 'Sauron');
      assert.strictEqual(this.newSpace.characters[2].toJSON(), newCharacter);
    });

    it('items can be removed', function() {
      this.space({
        characters: this.space.characters.slice(0, 1),
      });
      assert.strictEqual(this.newSpace.characters.length, 1);
      assert(!this.newSpace.characters[1]);
    });
  });

  describe('subscribe/middleware', function() {
    it('is called in order', function() {
      const results = [];
      subscribe(this.space, () => results.push('first'));
      subscribe(this.space, () => results.push('second'));
      subscribe(this.space, () => results.push('third'));
      assert.deepStrictEqual(results, []);
      this.space({ someVal: true });
      assert.deepStrictEqual(results, ['first', 'second', 'third']);
    });

    it('can cancel future subscribers', function() {
      const results = [];
      subscribe(this.space.userInfo, ({ cancel }) => {
        results.push('first');
        cancel();
      });
      subscribe(this.space.userInfo, () => results.push('second'));
      this.space.userInfo({ someVal: true });
      assert.deepStrictEqual(results, ['first']);

      // parent subscribers should never be called
      assert.strictEqual(this.numCalls, 0);
    });

    it('can provide replacement states', function() {
      const lSpace = this.space.userInfo.location;
      subscribe(lSpace, ({ newSpace }) => ({
        ...newSpace,
        state: newSpace.state.toUpperCase(),
      }));
      subscribe(lSpace, ({ newSpace }) =>
        assert.deepStrictEqual(
          { ...newSpace },
          {
            city: 'San Mateo',
            state: 'PA',
            country: 'USA',
          }
        )
      );
      lSpace({ state: 'pa' });

      // parent gets latest version
      assert.deepEqual(this.newSpace.userInfo.location.state, 'PA');
      assert.strictEqual(this.numCalls, 1);
    });
  });
});
