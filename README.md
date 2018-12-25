# SpaceAce

A fancy immutable storage library for JavaScript

[![Build Status](https://travis-ci.org/JonAbrams/SpaceAce.svg?branch=master)](https://travis-ci.org/JonAbrams/SpaceAce)

## Intro

SpaceAce is a JS library for storing and updating the _state_ of your front-end application.

Like Redux, it has unidirectional data flow, uses an immutable state, allows for clearly defined actions, but makes it much easier to generate new states.

* [Introductory blog post](https://medium.com/@jonathanabrams/introducing-spaceace-a-new-kind-of-front-end-state-library-5215b18adc11)
* [SpaceAce Todo App on CodeSandbox](https://codesandbox.io/s/k3opnmolo5)
* [Original Redux Todo App on CodeSandbox](https://codesandbox.io/s/ql8k7wr079) (for comparison)

## Benefits

* **Immutable** – Centralized state with easy to track changes.
* **Modular** – View components can manage their own part of the state, update logic doesn't need to be centralized. Also known as [loose coupling](https://en.wikipedia.org/wiki/Loose_coupling).
* **Convenient** – Ridiculously easy to update the state in the most common cases, such as a user editing a text field.
* **Framework Agnostic** – Designed with React in mind, but works with any stateless view library. Has no external dependencies. Requires only ES5, which can be [polyfilled](https://github.com/es-shims/es5-shim)/[transpiled](https://babeljs.io).
* **Small** – ~7.9K uncompressed, ~2.2K gzipped. No dependencies.
* Works with Redux DevTools

## Install

```bash
npm install spaceace
# or
yarn add spaceace
```

## Documentation

* [What is a space?](#what-is-a-space)
* [React App Example](#react-app-example)
* [Updating Spaces](#updating-spaces)
  * [Immediate Update](#immediate-update-object)
  * [Quick Actions](#quick-actions-string)
  * [Custom Actions](#custom-actions-function)
  * [Action Named Params](#action-named-params)
  * [Promises and Async](#promises-and-async)
  * [Arrays](#arrays)
* [Utility Functions](#utility-functions)
  * [subscribe](#subscribe)
  * [isSpace](#isspace)
  * [rootOf](#rootof)
* [toJSON](#tojson)
* [Redux DevTools](#redux-devtools)
* [FAQ](#faq)

### What is a Space?

```js
import { createSpace } from 'spaceace';
const space = createSpace({ name: 'Bilbo', todos: [] });
console.log(space.name); // Bilbo
```

A lot of developers don't know that JavaScript functions can have attributes, just like objects. SpaceAce takes advantage of that feature.

Each `Space` is a function, but with a twist. You can access attributes, like you would any object literal, but you can also call it like a function to change its’ contents. But since each space is immutable, the contents are not directly changed, instead a new space is returned:

```js
const newSpace = space({ name: 'Frodo' });
console.log(newSpace.name); // Frodo
console.log(newSpace.todos); // []
```

Although, you'll want to instead subscribe to a space to easily update your app:

```js
subscribe(space, ({ newSpace }) => {
  // called whenever the passed in space/newSpace is updated
  renderApp(newSpace);
});
renderApp(space); // initial render
```

Since most changes to your application's state is caused by user interactions, it’s very easy to bind _actions_ to events:

```jsx
const clearName = ({ merge }, event) => {
  // The first parameter is an object with the space and methods for changing it
  // Treat these as "named param"
  // The rest of the parameters are whatever was eventually passed to the
  // wrapped function.
  event.preventDefault();
  merge({ name: '' });
};

const ClearButton = space => (
  <button onClick={space(clearName)}>Clear name</button>
);
```

You'll find that most actions just take in a value (or a value from an event) and apply it to a particular attribute, SpaceAce provides a shortcut, just give the name of the attribute that needs updating:

```jsx
// 'name' is a string, so `space` knows to apply the event's value onto
// the corresponding attribute in `space`
const NameField = space => <input value={space.name} onChange={space('name')} />;
)
```

If a space has any objects or arrays as children, they're automatically turned into spaces. This allows them to easily be passed into components. If a child space gets updated, all parent spaces are notified. This allows components to manage their own spaces, but for the application's root space to still see and access everything, refreshing views when necessary.

```js
const addTodo = ({ push }, content) => {
  // In addition to `push`, array spaces also have these functions available:
  // `remove`, `unshift`, `replace`
  push({ done: false, content });
};
space.todos(addTodo)('Destroy ring');
```

## React App Example

SpaceAce can be used with any front-end view library (such as Vue and Angular), but the example below is with React.

**index.js**

```jsx
import react from 'react';
import ReactDOM from 'react-dom';
import { createSpace, subscribe } from 'spaceace';
import Container from './Container';

// Create the initial root "space" along with its initial state
const rootSpace = createSpace({ name: 'Jon', todos: [] });

// Subscribe to any changes that occur within the space
// so the app can be re-rendered
subscribe(rootSpace, ({ newSpace, oldSpace, causedBy }) => {
  // Example `causedBy`s:
  // '#addTodo', 'todos[1]#toggleDone'
  console.log(`Re-render of <Container /> caused by ${causedBy}`);
  renderApp(newSpace); //re-render on space change
});
renderApp(rootSpace); // initial render

function renderApp(space) {
  ReactDOM.render(
    <App space={space} />,
    document.getElementById('react-container')
  );
}
```

**App.js**

```jsx
import uuid from 'uuid/v4';
import Todo from './Todo';

export default function App({ space }) {
  return (
    <div>
      <h2>{name}'s Todos:</h2>
      <button onClick={space(addTodo)}>Add Todo</button>
      <ul className="todos">
        {space.map(todo => <Todo space={todo} key={todo.id} />)}
      </ul>
    </div>
  );
}

const addTodo = ({ merge, space }, event) => {
  event.preventDefault();

  merge({
    todos: space.todos.concat({
      content: 'A new TODO',
      done: false,
      id: uuid(),
    }),
  });
};
```

**Todo.js**

```jsx
// You can rename the space to something more meaningful
// it’s recommended that the prop still be called `space`, so when you’re
// working on the parent component, you’ll know it expects a space to be passed in
export default const Todo = ({ space: todo }) => {
  const doneClassName = todo.done ? 'done' : '';

  return (
    <li>
      <form onSubmit={todo(saveTodo)}>
        {/*
            todo('done') sets `todo.done` to true/false when the checkbox’s
            onChange is triggered
        */}
        <input type="checkbox" checked={todo.done} onChange={todo('done')} />
        {/*
          todo('content') sets `todo.content` to whatever is typed into
          the text input.
        */}
        <input value={todo.content} onChange={todo('content')} />
        <button disabled={todo.saving}>Save</button>
      </form>
    </li>
  );
};

const saveTodo = async ({ space: todo, merge }, event) => {
  event.preventDefault();

  merge({ saving: true });

  // `todo.toJSON()` returns the space as a simple JS object
  // JSON.stringify(space) auto-calls `space.toJSON()` before stringifying
  await fetch('/api/todos', { method: 'POST', body: todo.toJSON() });

  merge({ saving: false });
};
```

## Updating Spaces

There are three ways to update spaces. Each method involves calling the space as a function, the type of value you pass in determines which of the three update methods is used: Immediate updates (object), quick actions (string), and custom actions (function).

### Immediate Update (object)

Immediately "changes" the space by shallowly merging the given object onto the space. A new space is returned with the changes applied and subscribers are immediately invoked.

```js
const space = createSpace({ name: 'Frodo', race: 'Hobbit’ });
const newSpace = space({ name: 'Bilbo' }); // { name: 'Bilbo', race: 'Hobbit’ }
```

### Quick Actions (string)

Returns a callback function that will change the specified attribute when called. If the parameter is an _event_, the event’s target’s value will be used, and `event.preventDefault()` will automatically be called. Very useful for `input`, `select`, and `button` elements.

If the event's target is of `input[type="number"]`, the value will be cast to type `number`.

If the event's target is of `input[type="checkbox"]`, the value is taken from the _checked_ property instead, which is a boolean.

```jsx
export default const Todo = ({ space: todo }) => {
  return (
    <li>
      <input type="checkbox" checked={todo.done} onChange={todo('done')} />
      <input value={todo.content} onChange={todo('content')} />
    </li>
  );
};
```

### Custom Actions (function)

A custom action is a function that is passed to a space. It returns a wrapped function. When the wrapped function is called, the action is called with a few named parameters (as the first actual parameter). The rest of the parameters are whatever is passed to the wrapped function when it’s eventually called.

Every time you change a space within a custom action, subscribers will be notified. Every change you apply will apply on the latest version of the space.

### Action named params

[Named params](http://exploringjs.com/es6/ch_parameter-handling.html#sec_named-parameters) passed to custom actions.

* **space** – space – The space that the action belongs to. Very useful for applying new values based on existing values.
* **rootSpace** – space – The root space that `space` belongs to. Should be used sparingly, as reading or writing to the rootSpace from a child space makes your code more tightly coupled (aka less modular).
* **getSpace** — function() -> space – Returns the latest version of the space that this action was called on. Use inside of promises or after any async call to make sure you have this space’s latest version!
* **merge** – function(object) -> space – Copies each property from the passed in object onto the space. This is a non-recursive (aka shallow) merge. Returns the new space.
* **replace** – function(object) -> space – Replaces the contents of the current space with the object or array you pass to it. Returns the new space.

### Promises and Async

Custom actions can optionally be async functions. If they're async (i.e. return a promise), the wrapped action will also return a promise, which is resolved when the custom action is resolved. Return values like this are typically only needed when writing tests.

**Note**: After an `await`, the `space` that's passed in at the top of the action may be out of date, it’s _highly_ recommended to always use `getSpace()` to get the latest version of the space after an `await` (or inside a callback).

### Arrays

Arrays in a space are proper JS arrays, but are frozen. You cannot update them like you can normal spaces. These arrays do have some similarities to spaces though. You can call `toJSON()` on arrays taken from spaces to get a version of the array containing only plain object literals. If you call `isSpace(…)` on an array taken from a space, it will return true.

To update an array in a space, modify its parent by assigning a fresh new array:

```jsx
const changeTodos = ({ merge, space }, itemToRemove) => {
  // Add an item to the beginning
  space = merge({
    todos: [
      {
        content: 'A new TODO',
        done: false,
        id: uuid(),
      },
      ...space.todos
    ]
  });

  // Add an item to the end
  space = merge({
    todos: [
      ...space.todos,
      {
        content: 'A new TODO',
        done: false,
        id: uuid(),
      }],
  });

  // Insert an item
  space = merge({
    todos: [
      ...space.todos.slice(0, 2),
      {
        content: 'A new TODO',
        done: false,
        id: uuid(),
      },
      ...space.todos.slice(2)
    ],
  });

  // Remove an item
  merge({
    todos: space.todos.filter(item => item !== itemToRemove);
  })
};
```

## Utility Functions

### subscribe

Act on, or cancel, state changes.

Parameters:

1. A space that you want to subscribe to.
2. A subsriber function that is called whenever the space is updated.

The subscriber function is called with the following named params:

* **newSpace**: The new space that was just created.
* **oldSpace**: The old version of the space that existing before it was changed.
* **causedBy**: A string specifying which part of the space triggered the change, and the name of the action responsible.
* **cancel**: A function, when called, prevents future subsribers from being called.

```js
import { createSpace, subscribe } from 'spaceace';

const space = createSpace({});

subscribe(space, ({ newSpace, causedBy }) => {
  console.log(newSpace.toJSON(), 'Space updated by ', causedBy);
  renderApp(newSpace);
});
```

* Subscribers can optionally **act as middleware**. If a subscriber returns an object, it will be turned into a space, and future subscribers will receive it as their `newSpace`.
* Subscribers are called in the order that they're subscribed, synchronously.
* Parent spaces receive the latest returned version after all child space subscribers are called.
* All future subscribers can be skipped by calling the passed in named param `cancel`.

If you want your "middleware" to not apply changes immediately, but instead do something async and then apply the changes, consider using [`cancel()`](#subscribe), and then applying changes using an [immediate update](#immediate-update-object) when you’re ready.

```js
subscribe(space.address, ({ oldSpace, newSpace, cancel }) => {
  const stateCode = newSpace.stateCode.toUpperCase();
  if (stateCode !== oldSpace.stateCode) {
    if (!listOfUSStates.includes(stateCode)) {
      // Cancel the update if the provided code is not allowed
      cancel();
      return;
    }

    // Alter the specified stateCode to uppercase
    return {
      ...newSpace,
      stateCode,
    };
  }
});

subscribe(space, ({ newSpace }) => {
  // Receives `newSpace.address` with `stateCode` uppercase
  renderApp(newSpace);
});
```

### isSpace

Returns: `true` if the given value is a space, `false` otherwise.

```js
import { createSpace, isSpace } from 'spaceace';

isSpace(createSpace({})); // returns true
isSpace({}); // returns false
```

### rootOf

Parameter: A space

Returns: The root space associated with the given space.

**Note**: This function goes all the way up in the chain of parent spaces, returning the latest root space of the parameter. This means you can safely do `rootOf(space)` anywhere in a custom action, and always get the latest version.

```js
import { createSpace, rootOf } from 'spaceace';

const space = createSpace({ user: { name: 'Frodo' } });

rootOf(space.user) === space; // true

space.user(({ merge, space }, name) => {
  merge({ name });
  rootOf(space).user.name === 'Sam'; // true
})('Sam');
```

### newestSpace

Parameter: A space

Returns: The newest copy of the space, at the same level.

```js
import { createSpace, newestSpace } from 'spaceace';

const space = createSpace({ user: { name: 'Frodo' } });
const latestSnapshot = space.user({ name: 'Sam' });

latestSnapshot.name === 'Sam'; // true
newestSpace(space.user).name === 'Sam'; // true
```

## toJSON

Returns: The contents of a space as an object literal.

This is called automatically by `JSON.stringify`, that’s a built-in feature of JS.

```js
const space = createSpace({ user: 'Frodo', todos: [] });
space.toJSON(); // { user: 'Frodo', todos: [] }
JSON.stringify(space); // '{ "user": "Frodo", "todos": [] }'
```

## Redux DevTools

Even though the Redux DevTools broswer extension was originally made for Redux, it works with any immutable store, including SpaceAce!

it’s as easy as:

1. Install [Redux DevTools](http://extension.remotedev.io/) in your browser.
2. Hook up you root space to the extension, if it’s detected:

```js
const rootSpace = createSpace({ [pageName]: {}, ...initialState, user });

let sendToDevtools;
if (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION__) {
  const devtools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({
    name: 'rootSpace',
  });
  sendToDevtools = devtools.send;
  devtools.init(rootSpace);
  let devtoolsUpdater = ({ replace }, newState) => replace(newState);
  devtoolsUpdater = rootSpace(devtoolsUpdater);
  devtools.subscribe(message => {
    if (
      message.type === 'DISPATCH' &&
      ['JUMP_TO_ACTION', 'JUMP_TO_STATE'].includes(message.payload.type)
    ) {
      devtoolsUpdater(JSON.parse(message.state));
    }
  });
}

subscribe(rootSpace, ({ newSpace, oldSpace, causedBy }) => {
  if (sendToDevtools && causedBy !== '#devtoolsUpdater') {
    sendToDevtools(causedBy, newSpace);
  }
});
```

## FAQ

**How do I add middleware like in Redux?**

I haven't encountered a need for it yet, please add an issue if you’re interested!

**Are spaces really immutable?**

Yes? Ok… you got me.

Each space is indeed frozen, all of its child spaces, arrays, and values are also frozen. If a space has changed, you can tell by doing an equality check between both versions, if they're equal to each other, then all their properties are guaranteed to be the identical. it’s safe to pass a space into a [Pure Component](https://reactjs.org/docs/react-api.html#reactpurecomponent), for example.

But! There are a few hidden, non-enumerable, properties on every space (and array) that are mutable. They're not meant to be changed by you, they're used by SpaceAce to track subscribers and newer versions of the same space.

**Has this been used in production?**

Yes! Checkout out https://www.trustedhealth.com/

**Is there an example app?**

Yup-a-roni! I modified [Redux's sample todo list](https://codesandbox.io/s/github/reduxjs/redux/tree/master/examples/todos) app to use [SpaceAce instead](https://codesandbox.io/s/zl1n53mwwl)

**Won’t action names be garbled in product? Can I use constants for action names?**

Yes, to both. Since most productions code is minified, and the names of custom actions are inferred from their function's name, the action name might end up looking like `a` or `b1` in production.

I've found this to not be a problem since I've never needed to troubleshoot state issues in production, but if you need this it can fixed by using string constants for action names.

Feel free to experiment as to where you store these actions and/or constants.

```jsx
// actions.js

export const ADD_TODO = 'ADD_TODO';

export const actions = {
  [ADD_TODO]({ merge, space }) {
    merge({
      todos: space.todos.concat({
        content: 'A new TODO',
        done: false,
        id: uuid(),
      }),
    });
  },
};

// someComponent.js

import { actions, ADD_TODO } from '../actions';
//…
<button onClick={space(actions[ADD_TODO])}>…</button>;
```

## License

MIT

## Author

Created with the best of intentions by [Jon Abrams](https://twitter.com/JonathanAbrams)
