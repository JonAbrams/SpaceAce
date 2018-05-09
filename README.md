# SpaceAce

A fancy immutable storage library for JavaScript

[![Build Status](https://travis-ci.org/JonAbrams/SpaceAce.svg?branch=master)](https://travis-ci.org/JonAbrams/SpaceAce)

## Intro

SpaceAce is used to store and update the _state_ of your front-end application.

It was created by a user of Redux that grew a bit frustrated. SpaceAce is designed to be more modular and with an API designed to help with your most common tasks.

Any and all [feedback is welcome](https://twitter.com/JonathanAbrams)!

## Benefits

* **Immutable** – Centralized state with easy to track changes.
* **Modular** – Every object/array in the space is also automatically a space too.
* **No Boilerplate** – Declare actions within the same file as your view components.
* **Auto-actions** – If you just need to set a value on the state when an event occurs, SpaceAce makes it easy to declare an action write in your render method.
* **Convenience APIs** – Spaces that are arrays have popular methods like `map`, `slice`, and `filter`. Class methods allow you to get the root space of any space, so you don’t need to pass everything down.
* **Framework Agnostic** – Designed with React in mind, but works with any stateless view library/framework. Has no external dependencies. Requires only ES5.

## Documentation

1. [Simple Example](#simple-example)
2. [What is a space?](#what-is-a-space)
   1. [Space basics](#space-basic)
   2. [Creating a space](#creating-a-space)
   3. [Sub-spaces](#sub-spaces)
3. [Updating spaces](#updating-spaces)
   1. [Quick actions](#quick-actions)
   2. [Custom actions](#custom-actions)
   3. [Action params](#action-params)
4. [Class methods](#class-methods)
   1. [.subscribe](#subscribe)
   2. [.isSpace](#isspace)
   3. [.isSpaceArray](#isspacearray)
   4. [.toObj](#toobj)
   5. [.rootOf](#rootof)
5. [Instance methods](#instance-methods)
   1. [toJSON](#tojson)
   2. [slice](#slice)
   3. [map](#map)
   4. [filter](#filter)
   5. [sort](#sort)

## Simple Example

SpaceAce can be used with any front-end view library (such as Vue and Angular), but the examples below are done with React.

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

/*
  – Actions are given an object containing the space, and (if provided) an event object.
  – If the space is an array, it’s also given push, remove, and unshift!
*/
function addTodo({ push, event }) {
  event.preventDefault();

  push({ id: uuid(), msg: 'A new TODO', done: false });
}
```

**Todo.js**

```jsx
// Use ES6 to rename the space to something more meaningful
export default function Todo({ space: todo }) {
  const doneClassName = todo.done ? 'done' : '';

  return (
    <li className="todo">
      /* todo(toggleDone) returns a function that calls toggleDone with the
      space passed in. */
      <input type="checkbox" checked={done} onChange={todo(toggleDone)} />
      /* todo('msg') returns a function that updates the 'msg' attribute on the
      todo space! */
      <input value={todo.msg} onChange={todo('msg')} />
      <button onClick={todo(removeTodo)}>Remove Todo</button>
    </li>
  );
}

// The returned value from an action is merged onto the existing state
// In this case, only the `done` attribute is changed on the todo
// Tip: Use ES6 arrow function syntax for simple actions to save precious typing!
const toggleDone = ({ space }) => ({ done: !space.done });

function removeTodo({ event }) {
  event.preventDefault(); // Not needed in this case, here for demonstration

  // Returning null causes the space to be removed from its parent!
  // Very handy for spaces that are in a list, like this todo is.
  // Note: If you don't call `return` in an action, the space isn’t touched!
  return null;
}
```

### What is a Space?

`Space` is the default "class" provided by the `spaceace` npm package.

Making a new instance of `Space` returns an object/function. You can access state on the object, like you would any object literal, or call it like a function to change its’ contents.

### new Space(initialState: Object)

Returns a new space with its state defined by the passed in `initialState`.

e.g.

```javascript
const rootSpace = new Space({ initialState: true, todos: [] });
```

### Calling spaces (to change them!)

Spaces are objects (i.e. _state_) but can/should be called as a function to change their contents.

Depending on what you pass as a paremeter when calling a space, different behaviour will occur:

* space(keyName: string): Returns a callback function that will change the specified keyname when called with a parameter. If the parameter is an _event_, the event’s target’s value will be used, and `event.preventDefault()` will automatically be called for you. Consider this _simple event handling_.
* space(action: function): Returns a callback function that will in-turn call the given action. See the **Actions** section below for more! Consider this _advanced event handling_.

### Actions

Actions are the event handlers (i.e. callbacks) that you define that get called when _something_ happens and you want to change the space’s contents.

If you return an object within the action, it will be recursively merged onto the space, then invoke any subscribers.

**Note**: If the space is a list/array, you cannot merge changes onto it. Instead use **replace** or one of the other array functions below.

**Note**: It’s ok to not return anything in an action, the space will remain unchanged (unless, of course, you call **replace** or **merge** somewhere in the action).

Each action is called with an object that has a bunch of useful stuff values and functions:

* **space** – object|array – The space that the action belongs to. Very useful for returning new values based on existing values.
* **event** – Event|null – If a browser [event](https://developer.mozilla.org/en-US/docs/Web/API/Event) invokes this action, the event object will be passed in. Useful for [preventDefault](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault) and getting `event.target.value`.
* **rootSpace** – space|null – Since spaces can be children of other spaces, it’s often useful to access the top-most space.
* **replace** – function(object|array) – Replaces the contents of the current space with the object or array you pass to it. Typically used with array spaces.
* **merge** – function(object) – If the space is an object, copies each property from the passed in object onto the space.
* **push** – function(item) – If the space is an array, this adds a value to the end of it.
* **unshift** – function(item) – If the space is an array, this adds a value to the beginning of it.
* **remove** – function(function(item, index)) – Calls the given function with each item in the list. For any call that returns a truthy value, that item is removed from the array.

## FAQ

**Are spaces immutable?**

Sort of. Each space is an immutable object. You cannot change its contents directly, if you try, you’ll get an error. But… you can "mutate" the space by calling it like a function. Notice the scare quotes. This doesn’t change the current instance of the space, since it’s in-fact immutable. Instead, it creates a new space (cloned, but with changes applied), and passes it into any subscribers.

**How do I add middleware like in Redux?**

Hopefully that feature will come in v2!

## License

MIT

## Author

Created with the best of intentions by [Jon Abrams](https://twitter.com/JonathanAbrams)
