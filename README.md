# SpaceAce

A fancy immutable storage library for JavaScript

[![Build Status](https://travis-ci.org/JonAbrams/SpaceAce.svg?branch=master)](https://travis-ci.org/JonAbrams/SpaceAce) [![Join the chat at https://gitter.im/SpaceAceJS/Lobby](https://badges.gitter.im/SpaceAceJS/Lobby.svg)](https://gitter.im/SpaceAceJS/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

## Intro

SpaceAce is used to store the _state_ of your front-end application. Think of it as a replacement for `this.setState(…)` in your React apps.

The goal is a library that is as powerful and useful as Redux, but more modular with an easier to use API.

Any and all [feedback is welcome](https://twitter.com/JonathanAbrams)!

## Benefits

- **Immutable** – Centralized state with easy to track changes
- **Modular** – Easily create sub-states for each component
- **No Boilerplate** – Components can merge changes onto their part of the state themselves, no need to declare actions or have have a central reducer.
- **Convenient API** – Create sub-spaces and bind to events within your render functions.

## Example Usage

SpaceAce can be used with any front-end view library (such as Vue and Angular), but the examples below are done with React.

**index.js**
```jsx
import react from 'react';
import ReactDOM from 'react-dom';
import Space from 'spaceace';
import Container from './Container';

// Create the root "space" along with its initial state
const rootSpace = new Space({ name: 'Jon', todos: [] });
rootSpace.subscribe(causedBy => {
  // Example `causedBy`s:
  // 'todoList#addTodo', 'todos[akd4a1plj]#toggleDone'
  console.log(`Re-render of <Container /> caused by ${causedBy}`);
  ReactDOM.render(
    <Container space={rootSpace} />,
    document.getElementById('react-container')
  );
});
```

**Container.js**
```jsx
import react from 'react';
import TodoList from './TodoList';

export default function Container({ space }) {
  const state = space.state;

  return (
    <div>
      <h1>Welcome {state.name}</h1>
      <TodoList
        // subSpace takes over `state.todos`, turning it into a child space
        space={space.subSpace('todos')}
        name={state.name}
      />
    </div>
   );
```

**TodoList.js**
```jsx
import react from 'react';
import uuid from 'uuid/v4';
import Todo from 'Todo';

export default function TodoList({ space, name }) {
  const todos = space.state;

  return(
    <h2>{name}'s Todos:</h2>
    <button onClick={space.setState(addTodo)}>Add Todo</button>
    <ul className='todos'>
      {todos.map(todo =>
        <Todo space={space.subSpace(todo.id)} />
      )}
    </ul>
  );
};

// setState callbacks are given the space first, then the event.
// If the space is an array, the result overwrites the existing state
function addTodo(space, e) {
  const todos = space.state;

  e.preventDefault();

  return [
      // All items that exist in a list, like this one, need a unique 'id'
      // for when they are later accessed as a subSpace
      // uuid() is a handy module for generating a unique 'id'
      { id: uuid(), msg: 'A new TODO', done: false }
     ].concat(todos)
   };
 }
}
```

**Todo.js**
```jsx
import react from 'react';

export default function Todo({ space }) {
  const todo = space.state; // The entire state from this space is the todo
  const { setState } = space;
  const doneClassName = todo.done ? 'done' : '';

  return(
    <li className='todo'>
      <input type='checkbox' checked={done} onChange={setState(toggleDone)} />
      <span className={doneClassName}>{todo.msg}</span>
      <button onClick={setState(removeTodo)}>Remove Todo</button>
    </li>
  );
};

// The returned value from an action is merged onto the existing state
// In this case, only the `done` attribute is changed on the todo
function toggleDone({ state: todo }, e) {
  return { done: !todo.done };
}

// Returning null causes the space to be removed from its parent
function removeTodo(todoSpace, e) {
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

`Space` is the default class provided by the `spaceace` npm package.

Every instance of `Space` consists of:
- `state -> Object`: An immutable state, which can only be overwritten using an action.
- `subSpace(subSpaceName: String) -> Space`: Spawns a child space.
- `bindTo(eventHandler: Function) -> Function`: Wraps an event handler, passing in the space when eventually called. If object returned by eventHandler, it is recursively merged onto the space's state.
- `setState(mergeObject: Object, [changedBy: String])`: A method for changing a space's state by doing a recursive merge.
- `replaceState(newState: Object, [changedBy: String])`: A method for replacing a space's state.
- `subscribe(subscriber: Function) -> Function`: Adds a callback for when the state changes.
- `getRootSpace() -> Space`: Shortcut to access the top-most ancestor space.

### new Space(initialState: Object, [options: Object])

Returns a new space with its state defined by the passed in `initialState`.

Optionally pass in an object as a second parameter to change the default behaviour of the space, and any of its sub-spaces.

e.g.
```javascript
const rootSpace = new Space({ initialState: true, todos: [] }, {
  skipInitialNotification: true
});
```

**Options**

`skipInitialNotification` - Boolean – Default: false – If true, does not invoke subscribers immediately when they're added.

### state

`state` is a getter method on every space. It returns a frozen/immutable object
that can be used to render a view. It includes the state of any child spaces as well. Do not change it directly.

### subSpace(name: String)

Parameters:
 - String (the name of the key to spawn from)

 Returns:
  - A new space linked to the current space

Use `subSpace` to take part of the current space's state and return a child space based on it.

When a child space's state is updated, it notifies its parent space, which causes it to update its state (which includes the child's state) and notifies its subscribers, and then notifies its parent space, and so on.

`subSpace` is usually called in your component's render for convenience. It's safe to do so because it does not alter state when called.

If not existing attribute exists for a `subSpace` to attach to, an empty object will be added and used. Note that even though this causes the parent state to change, no notification is made.

e.g.
```jsx
const TodoApp = ({ getRootSpace }) => (
  <div>
    {getRootSpace().subSpace('todos').state.map(todo =>
      <Todo {...getRootSpace().subSpace('todos').subSpace(todo.id)} />
    )}
  </div>
);
```

or more properly:
```jsx
const TodoApp = ({ space }) => (
  <div>
    <TodoList space={space.subSpace('todos')} />
  </div>
);

const TodoList = ({ space: { state: todos, subSpace } }) => (
 <ul>
    {todos.map(todo => (
      <Todo space={subSpace(todo.id)} key={todo.id} />
    ))}
  </ul>);
);
```

### bindTo

Parameters:
  - Function (callback)
  - Pass-through params (optional)

Returns:
 - Function (the callback bounded to the space)

Wraps the given callback function and returns a new function. When the returned function is called, it calls the given callback, but with the space passed in as the first parameter. Any extra parameters given to `bindTo` are given to the callback when its called.

This new function can then be used as an event handler.

The event is passed in as the last parameter to the callback, useful for calling `event.preventDefault()`, or for reading `event.target.value`.

The value returned by your callback will be recursively merged onto the space's state. If the space's state is an array, the returned value will overwrite the state instead.

If the space is an item in a list, then returning `null` will remove it from the list.

If a promise is returned, SpaceAce will wait for it to resolve and then recursively merge the results onto the state (or replace if the state is an array).

SpaceAce supports [generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators), allowing you to return values multiple times by calling `yield` with a value that will be recursively merged onto the space's state. With generators, subscribers won't be notified until your function finally calls `return`.

e.g.
```jsx
const changeTodo = (space, event) => ({
  content: event.target.value,
  status: 'modified'
});

const toggleDone = ({ state: todo }) => ({
  done: !todo.done,
  status: 'modified'
});

const removeTodo = () => null;

const saveTodo = function* (space, renderedAt, event) => {
  event.preventDefault();
  console.log(
    "Saving todo. It was last rendered at: ",
    renderedAt.toISOString()
  );
  yield { status: 'saving' };
  return fetch(…).then(() => ({ status: 'saved' }))
    .catch(e => ({ status: 'errorSaving' }));
};

export default Todo = ({ state: todo, bindTo }) => (
  <div>
    <form onSubmit={bindTo(saveTodo, new Date())}>
      <input type="text" value={state.content} onChange={bindTo(changeTodo)} />
      <button onClick={bindTo(toggleDone)} type="button">
        {todo.done ? 'Restore' : 'Done'}
      </a>
      <button onClick={bindTo(removeTodo)} type="button">
        Remove
      </button>
      <button type="submit">
        Save to server
      </button>
    </form>
  </div>
);
```

### setState

Parameters:
  - Object (for merging onto state)
  - (optional) String – Used as a name for logging

Shallow merges the given object it into the space's state. Pass in a second parameter to give the update a name for the `causedBy` passed to subscribers.

If the space's state is an array, setState will throw an error. Use `replaceState` instead.

Often used to apply async data to a state. Use `bindTo` to apply changes caused by the user.

e.g.
```jsx
class TodoApp extends React.Component {
  async componentDidMount() {
    const { space } = this.props;
    const fetchResult = await fetch('/api/todos').then(res => res.json());

    space.setState({
      todos: fetchResult.todos
    }, 'todosFetch');
  }

  render() {
    …
  }
}
```

### replaceState

Parameter:
 - Object or array
 - (optional) String – Used as a name for logging

Replaces the space's state with the object or array provided. Pass in a second parameter to give the update a name for the `causedBy` passed to subscribers.

Should be used for altering a state that is an array, or for replaying state.

e.g.
```jsx
const addTodo = ({ state: todos, replaceState }) => {
  replaceState([...todos, {
    content: 'A brand new todo',
    done: false
  }]);
};

const TodoList = ({ state: todos, subSpace, bind }) => (
  <ul>
    {todos.map(todo => (
      <Todo {...subSpace(todo.id)} />
    ))}
    <button onClick={bindTo(addTodo)}>Add Todo</button>
  </ul>
);
```

### subscribe

Registers a callback function to be called whenever the space's state is updated.
This includes if a child space's state is updated.

It calls the subscriber with a single parameter: `causedBy`, which specifies why
the subscriber was invoked. It's useful for debugging purposes. The format of
`causedBy` is `spaceName#functionName`.

Note: For convenience, this subscriber is called immediately when it's declared, with _causedBy_ set to `'initialized'`.

e.g.
```jsx
const userSpace = new Space({ name: 'Jon' });

userSpace.subscribe(causedBy => {
  console.log('Re-rendered by: ', causedBy);
  ReactDOM.render(
    <Component {...userSpace} />,
    document.getElementById('react-container')
  );
});
```

### getRootSpace()

Example: `space.getRootSpace()`

Returns the top-most level space.

When deep in a sub-space in can be necessary to access the top-level space of the application. For example, you may have a `Login` component that needs to add the newly logged-in user's info to the root of the application's space, so that it can be available to other components in the app.

e.g.
```jsx
const handleSignup = async ({ state, getRootSpace() }, event) => {
  event.preventDefault();
  var result = await fetch(…, { body: state }).then(res => res.json());
  getRootSpace().setState({ user: result.userInfo });
};

const SignupForm = ({ state, bindTo }) => (
  <form onSubmit={bindTo(handleSignup)}>
    …
  </form>
)
```

#### Spawning Sub-Spaces

Calling `subSpace` with a string will turn that attribute of a space into a child space.

e.g. Given a space called `userSpace` with this state:
```javascript
{
  name: 'Jon',
  settings: {
    nightMode: true,
    fontSize: 12
  }
}
```

You can convert the `settings` into a child space with `userSpace.subSpace('settings')`.

Note that even though `settings` is now a space, the state of `userSpace` hasn't changed. At least not until the `settings` space is updated with a change.

## FAQ

**What's the difference between a state and a space?**

Think of state as an object with a bunch of values. A space contains that state, but
provides a few handy methods meant for interacting with it. So if you're in a component
that just needs to read from the state, then you don't need to give it a space, you can just give it the state. If that component needs to also update the state or spawn sub-spaces, then pass it the space.

**How do I add middleware like in Redux?**

Hopefully that feature will come in v2!

**Are spaces immutable?**

Sort of. The state you get from a space is an immutable object. You cannot change it directly, if you do so you may get an error. But… you can mutate the state by using the `bindTo`, `setState`, and `replaceState` functions provided by the state's space.

**Why do list items need an `id` key?**

Due to the fact that the state is immutable, if a sub-space for an item wants to update its state, SpaceAce needs to find it in the parent space's state. The way we've solved this is to use a unique id field. It's a similar concept to React's built-in `key` prop. In fact, every space in an array that has an `id` is automatically given an identical `key` field for convenience.

## License

MIT

## Author

Created with the best of intentions by [Jon Abrams](https://twitter.com/JonathanAbrams)
