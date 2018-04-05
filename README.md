# SpaceAce

A fancy immutable storage library for JavaScript

[![Build Status](https://travis-ci.org/JonAbrams/SpaceAce.svg?branch=master)](https://travis-ci.org/JonAbrams/SpaceAce)

## Intro

SpaceAce is used to store the _state_ of your front-end application. Think of it as a replacement for `this.setState(…)` in your React apps.

It was created by a user of Redux that grew frustrated of how frustrating it was to use. SpaceAce is designed to be more modular and with an API designed to help with your most common tasks.

Any and all [feedback is welcome](https://twitter.com/JonathanAbrams)!

## Benefits

* **Immutable** – Centralized state with easy to track changes
* **Modular** – Easily create sub-states for each component, each a _space_ with the same methods as its parent
* **No Boilerplate** – Easily merge changes onto any part of the state, no need to declare actions or have have a central reducer.
* **Convenient API** – Create sub-spaces and bind to events within your render functions.

## Example Usage

SpaceAce can be used with any front-end view library (such as Vue and Angular), but the examples below are done with React.

**index.js**

```jsx
import react from 'react';
import ReactDOM from 'react-dom';
import Space, { subscribe } from 'spaceace';
import Container from './Container';

// Create the root "space" along with its initial state
const space = new Space({ name: 'Jon', todos: [] });
subscribe(space, causedBy => {
  // Example `causedBy`s:
  // 'todoList#addTodo', 'todos[akd4a1plj]#toggleDone'
  console.log(`Re-render of <Container /> caused by ${causedBy}`);
  ReactDOM.render(
    <Container space={space} />,
    document.getElementById('react-container')
  );
});
```

**Container.js**

```jsx
import TodoList from './TodoList';

export default function Container({ space }) {
  return (
    <div>
      <h1>Welcome {space.name}</h1>
      <TodoList
        // subSpace takes over `state.todos`, turning it into a child space
        space={space.todos}
        name={space.name}
      />
    </div>
   );
```

**TodoList.js**

```jsx
import uuid from 'uuid/v4';
import Todo from 'Todo';

export default function TodoList({ space, name }) {
  return(
    <h2>{name}'s Todos:</h2>
    <button onClick={space(addTodo)}>Add Todo</button>
    <ul className='todos'>
      {space.map(todo =>
        <Todo space={todo} key={todo.id} />
      )}
    </ul>
  );
};

/*
  – Actions are given an object containing the space, and (if provided) an event object.
  – If the space is an array, the result overwrites the existing state
  – If the space is an object, the results are recursively merged onto the existing state
*/
function addTodo({ push, event }) {
  event.preventDefault();

  push({ msg: 'A new TODO', done: false });
}
```

**Todo.js**

```jsx
// Use ES6 to rename the space to something more meaningful
export default function Todo({ space: todo }) {
  const doneClassName = todo.done ? 'done' : '';

  return (
    <li className="todo">
      <input type="checkbox" checked={done} onChange={todo(toggleDone)} />
      <span className={doneClassName}>{todo.msg}</span>
      <button onClick={todo(removeTodo)}>Remove Todo</button>
    </li>
  );
}

// The returned value from an action is merged onto the existing state
// In this case, only the `done` attribute is changed on the todo
function toggleDone({ space: todo }) {
  return { done: !todo.done };
}

// Returning null causes the space to be removed from its parent, handy!
// Note: If you don't call `return` in an action, the space isn’t touched!
function removeTodo({ event: e }) {
  e.preventDefault();

  return null;
}
```

## Browser Compatibility

`lib/Space.js` targets ES5. It makes use of `Array.isArray`, `Object.freeze`, and `Object.defineProperties`. All major browsers from at least the past 5 years should be supported. If support for ancient browsers is needed, check out [es5-shim](https://github.com/es-shims/es5-shim).

Also, `Object.assign` is used, which is from ES6, which supports most browsers of the past couple years. You can use [es6-shim](https://github.com/es-shims/es6-shim) or just [object.assign](https://github.com/ljharb/object.assign) to add support for older browsers.

If you notice any other browser compatibility issues, please open an issue.

## Documentation

### What is a Space?

`Space` is the default "class" provided by the `spaceace` npm package.

Making a new instance of `Space` returns an object/function. You can access state on the object, like you would any object literal, or call it like a function to change its’ contents.

### new Space(initialState: Object, [options: Object])

Returns a new space with its state defined by the passed in `initialState`.

Optionally pass in an object as a second parameter to change the default behaviour of the space, and any of its sub-spaces.

e.g.

```javascript
const rootSpace = new Space(
  { initialState: true, todos: [] },
  { skipInitialNotification: true }
);
```

**Options**

`skipInitialNotification` - Boolean – Default: false – If true, does not invoke subscribers immediately when they’re added.

### Calling spaces (to change them!)

Spaces are objects (i.e. _state_) but can/should be called as a function to change their contents.

Depending on what you pass as a paremeter when calling a space, different behaviour will occur:

* space(keyName: string): Returns a callback function that will change the specified keyname when called with a parameter. If the parameter is an _event_, the event’s target’s value will be used, and `event.preventDefault()` will automatically be called for you. Consider this _simple event handling_.
* space(action: function): Returns a callback function that will in-turn call the given action. See the **Actions** section below for more! Consider this _advanced event handling_.
* space(mergeObj: object): **Immediately** calls subscribers with a cloned version of the space, with _mergeObj_ recursively applied. If the space is a list, it won’t merge, it will replace.

### Actions

Actions are the event handlers (i.e. callbacks) that you define that get called when _something_ happens and you want to change the space’s contents.

If you return an object within the action, it will be recursively merged onto the space, then invoke any subscribers.

**Note**: It’s ok to not return anything in an action, the space will remain untouched (unless you call **replace** or **merge**).

Each action is called with an object that has a bunch of useful stuff:

* **space** – object|array – The space that the action belongs to. Very useful for returning new values based on existing values.
* **event** – object|null – If a browser [event](https://developer.mozilla.org/en-US/docs/Web/API/Event) invokes this action, the event object will be passed in. Useful for [preventDefault](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault) and getting `event.target.value`.
* **rootSpace** – space – Since spaces can be children of other spaces, it’s often useful to access the top-most space.
* **replace** – function(object|array) – Replaces the contents of the current space with the object or array you pass to it.
* **merge** – function(object) – Merges the given object onto the space, recursively.
* **push** – function(item) – If the space is an array, this adds a value to the end of it.
* **unshift** – function(item) – If the space is an array, this adds a value to the beginning of it.
* **splice** – function(start[, deleteCount[, item1[, item2[, …]]]]) – It the space is an array, remove item specified at the _start_ index. _deleteCount_ is the number of items to be removed, default is 1. Optionally provide new items to be added at _start_. Behaves the same array [Array.prototype.splice](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice)

## FAQ

**Are spaces immutable?**

Sort of. Each space is an immutable object. You cannot change its contents directly, if you try, you’ll get an error. But… you can "mutate" the space by calling it like a function. Notice the scare quotes. This doesn’t change the current instance of the space, since it’s in-fact immutable. Instead, it creates a new space (cloned, but with changes applied), and passes it into any subscribers.

**How do I add middleware like in Redux?**

Hopefully that feature will come in v2!

## License

MIT

## Author

Created with the best of intentions by [Jon Abrams](https://twitter.com/JonathanAbrams)
