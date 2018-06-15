# SpaceAce

A fancy immutable storage library for JavaScript

[![Build Status](https://travis-ci.org/JonAbrams/SpaceAce.svg?branch=master)](https://travis-ci.org/JonAbrams/SpaceAce)

## Intro

SpaceAce is a "flux-like" library for storing and updating the _state_ of your front-end application.

It was created by a fan of Redux that grew a bit frustrated using it in practice. SpaceAce is designed to be more modular and with an API designed to help with your most common tasks.

Any and all [feedback is welcome](https://twitter.com/JonathanAbrams)!

## Benefits

* **Immutable** – Centralized state with easy to track changes.
* **Modular** – View components can manage their own part of the state, update logic is not centralized.
* **Conveniet** – Various methods and features to make your life as a developer easier.
* **Framework Agnostic** – Designed with React in mind, but works with any stateless view library/framework. Has no external dependencies. Requires only ES5.
* **Small** – ~9K uncompressed, ~2.5K gzipped.

## Documentation

* [What is a space?](#what-is-a-space)
* [React App Example](#react-app-example)
* [Updating Spaces](#updating-spaces)
  * [Immediate Update](#immediate-update-object)
  * [Quick Actions](#quick-actions-string)
  * [Custom Actions](#custom-actions-function)
  * [Action Named Params](#action-named-params)
  * [Promises](#promises)
  * [Self-Destruct](#self-destruct)
* [Utility Functions](#utility-functions)
  * [subscribe](#subscribe)
  * [isSpace](#isspace)
  * [isSpaceArray](#isspacearray)
  * [rootOf](#rootof)
* [Array Methods](#array-methods)
* [toJSON](#tojson)
* [FAQ](#faq)

### What is a Space?

```js
const space = new Space({ name: 'Bilbo', todos: [] });
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

Since most changes to your application's state is caused by user interactions, it's very easy to bind _actions_ to events:

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
import Space, { subscribe } from 'spaceace';
import Container from './Container';

// Create the root "space" along with its initial state
const space = new Space({ name: 'Jon', todos: [] });

// Subscribe to any changes that occur within the space
// so the app can be re-rendered
subscribe(space, ({ newState, oldState, causedBy }) => {
  // Example `causedBy`s:
  // 'todoList#addTodo', 'todos[akd4a1plj]#toggleDone'
  console.log(`Re-render of <Container /> caused by ${causedBy}`);
  renderApp(space);
});
renderApp(space); // initial render

function renderApp(space) {
  ReactDOM.render(
    <App space={space} />,
    document.getElementById('react-container')
  );
}
```

**App.js**

```jsx
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

const addTodo = ({ push }, event) => {
  event.preventDefault();

  push({ content: 'A new TODO', done: false });
};
```

**Todo.js**

```jsx
// You can rename the space to something more meaningful
// It's recommended that the prop still be called `space`, so when working on
// the parent you know to this component a space
export default const Todo = ({ space: todo }) => {
  const doneClassName = todo.done ? 'done' : '';

  return (
    <li>
      <form onSubmit={todo(saveTodo)}>
        <input type="checkbox" checked={todo.done} onChange={todo(toggleDone)} />
        {/* todo('msg') returns a function that updates the 'msg' attribute on the
        todo space! */}
        <input value={todo.content} onChange={todo('content')} />
        <button disabled={todo.saving}>Save</button>
      </form>
    </li>
  );
};

// In this case, only the `done` attribute is changed on the todo
const toggleDone = ({ space, merge }) => merge({ done: !space.done });

const saveTodo = async ({ space, merge }, event) => {
  event.preventDefault();

  merge({ saving: true });

  await fetch('/api/todos', { method: 'POST', body: space.toJSON() });

  merge({ saving: false });
};
```

## Updating Spaces

There are three ways to update spaces. Each method involves calling the space, the type of value you pass in determines how the update occurs: Immediate updates (object), quick actions (string), and custom actions (function).

### Immediate Update (object)

Immediately "changes" the space by merging the given object onto the space. A new space is returned with the changes applied and subscribers are immediately invoked.

```js
const space = new Space({ name: 'Frodo', race: 'hobbit' });
const newSpace = space({ name: 'Bilbo' }); // { name: 'Bilbo', race: 'hobbit' }
```

### Quick Actions (string)

Returns a callback function that will change the specified attribute when called. If the parameter is an _event_, the event’s target’s value will be used, and `event.preventDefault()` will automatically be called. Very useful for `input`, `select`, and `button` elements.

If the event's origin is of `type="number"`, the value will be of type `number`.

If the event's origin is a checkbox, the value is taken from the _checked_ property instead, which is a boolean.

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

A custom action is a function that is passed to a space. It returns a wrapped function. When the wrapped function is called, the action is called with a bunch of named parameters (as the first actual parameter), they differ depending on whether the space represents an object or an array. The rest of the parameters are whatever is passed to the wrapped function whenever it's called.

You can change a space as much as you like in a single action, but subscribers won't be notified until the action is done.

### Action named params

[Named params](http://exploringjs.com/es6/ch_parameter-handling.html#sec_named-parameters) passed to custom actions.

Available on array spaces and object spaces:

* **space** – space – The space that the action belongs to. Very useful for applying new values based on existing values.
* **replace** – function(object|array) – Replaces the contents of the current space with the object or array you pass to it. Typically used with array spaces.
* **getSpace** — function – Returns the latest version of the space that this action was called on. Use inside of promises or any async callback!

Available on object spaces only:

* **merge** – function(object) – Copies each property from the passed in object onto the space. This is a non-recursive (aka shallow) merge.

Available on array spaces only:

* **push** – function(item) – If the space is an array, this adds a value to the end of it.
* **unshift** – function(item) – If the space is an array, this adds a value to the beginning of it.
* **remove** – function(function(item, index)) – Calls the given function with each item in the list. For any call that returns a truthy value, that item is removed from the array.

### Promises and Async

Custom actions can optionally be async functions. If they're async (i.e. return a promise), the wrapped action will also return a promise, which is resolved when the custom action is resolved.

**Note**: After an `await`, the `space` that's passed in at the top of the action may be out of date, it's _highly_ recommended that you use `getSpace()` to get the latest version of the space after an `await` (or inside a callback). If you need the latest rootSpace, do: `rootOf(getSpace())`.

## Utility Functions

### subscribe

Parameters:

1. A space that you want to subscribe to.
2. A subsriber function that is called whenever the space is updated.

The subscriber function is called with the following named params:

* **newSpace**: The new space that was just created.
* **oldSpace**: The old version of the space that existing before it was changed.
* **causedBy**: A string container which part of the space triggered the change, and the name of the action responsible.

```js
import Space, { subscribe } from 'spaceace';

const space = new Space({});

subscribe(space, ({ newSpace, causedBy }) => {
  console.log(newSpace.toJSON(), 'Space updated by ', causedBy);
  renderApp(newSpace);
});
```

### isSpace

Returns: `true` if the given value is a space, `false` otherwise.

```js
import Space, { isSpace } from 'spaceace';

isSpace(new Space({})); // returns true
isSpace(new Space([])); // returns true
isSpace({}); // returns false
```

### isSpaceArray

Returns: `true` if the given value is a space that contains an array, `false` otherwise.

```js
import Space, { isSpaceArray } from 'spaceace';

const space = new Space({ todos: [] });
isSpaceArray(space.todos); // returns true
isSpaceArray(space; // returns false
isSpaceArray({}); // returns false
isSpaceArray([]); // returns false
```

### rootOf

Parameter: A space

Returns: The root space associated with the given space.

```js
import Space, { rootOf } from 'spaceace';

const space = new Space({ user: { name: 'Frodo' } });

rootOf(space.user) === space; // true
```

## Array Methods

The following functions work the same as their JavaScript array counterparts. Except they never mutate the space they're called on, they only return a fresh array.

[map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map), [filter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter), [slice](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice), and [sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)

```js
const TodoList = space => (
  <ul>{space.todos.map(todo => <Todo space={todo} key={todo.id} />)}</ul>
);
```

## toJSON

Returns: The contents of a space as either a real array or object literal.

```js
const space = new Space({ user: 'Frodo', todos: [] });
space.toJSON(); // { user: 'Frodo', todos: [] }
space.todos.toJSON(); // []
```

## FAQ

**How do I add middleware like in Redux?**

Hopefully that feature will come in v2!

**Is this Flux-compatible**

Not quite, but it does take a lot of inspiration from Flux.

## License

MIT

## Author

Created with the best of intentions by [Jon Abrams](https://twitter.com/JonathanAbrams)
