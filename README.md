# SpaceAce

A fancy immutable storage library for JavaScript

## Status

No code exists yet. So far it's just a readme consisting of rough ideas that may turn into a library. Any feedback or ideas are welcome!

## Goal

To be as powerful and useful as Redux, but more modular with an easier to use API.

## Background

It's become standard practice in front-end JavaScript to have views that receive data via a one-way data flow. This was popularized by React and Flux/React. The idea is that the view components contain no state. Instead, they receive their data via properties given by parent components, which ultimately is given data from a single data store. This store's _state_ object is immutable. Instead of being changes, it's replaced with a slightly altered copy, and the new state is passed down through the components. This state is generated by a function known as a _reducer_. The reducer receives an action, and based on the action it takes the existing state and generates a new one. This new state is then passed to the view components, triggering a re-render of them.

This concept, referred to as _Flux_ has many advantages:

- It's much easier to reason through the changes your application experiences.
- You can easily log changes.
- You can even replay/undo state changes (useful when debugging).
- Has great libraries such as _Redux_ to help you get started.

That all sounds nice but it has its problems:
- It's not clear which parts of the store are relevant to each view component.
- It's hard to architect the application code around this concept. People often put all their actions in a single `actions.js`, and end up with a giant reducer in `reducer.js`. This goes against the goal of keeping all the code relevant to a component in a single file.
- This pattern results in a lot of boilerplate code. Actions are defined in one file, referenced multiple times in the same file, and then referenced in the app reducer. It'd be nice to define an action once, in the component that uses it, and then just call it.

## Usage

SpaceAce can be used with any front-end view library, but the examples below are done with React.

**index.js**
```jsx
import react from 'react';
import ReactDOM from 'react-dom';
import Space from 'spaceace';
import Container from './Container';

// Create the root "space" along with its initial state
const rootSpace = new Space({ name: 'Jon', todoList: { todos: [] } });
rootSpace.actions.subscribe((space, causedBy) => {
  // Example `causedBy`s:
  // ['initialized'], ['todoList#addTodo'], ['todoList.todos[akd4a1plj]#toggleDone']
  console.log(`Re-render of <Container /> caused by ${causedBy.join(', ')}`);
  ReactDOM.render(
    <Container {...rootSpace} />,
    // ^ same as <Container state={rootSpace.state} actions={rootSpace.actions} />
    document.getElementById('react-container')
  );
});
```

**Container.js**
```jsx
import react from 'react';
import TodoList from './TodoList';

export default function Container({ state, actions }) {
  // Create/Get child space that uses/takes over `state.todoList`
  const todoListSpace = actions.space('todoList');

  return (
    <div>
      <h1>Welcome {state.name}</h1>
      <TodoList
        // The ellipsis syntax auto sets the `state` and `actions` props
        // since those are `todoListSpace`'s attributes
        {...todoListSpace}
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

// state and actions auto-created for each space
export default function TodoList({ state, actions, name }) {
  const { todos } = state;

  return(
    <h2>{name}'s Todos:</h2>
    <button onClick={actions.do(addTodo)}>Add Todo</button>
    <ul className='todos'>
      {todos.map(todoSpace =>
        <Todo
          {...todoSpace}
          // the above does the same as:
          // state={todoSpace.state} actions={todoSpace.actions} key={todoSpace.state.id}
        />
      )}
    </ul>
  );
};

// Actions are given the event first, then the space
// The object that is returned is merged with the space's state
// In this case the `todos` attribute is overwritten
function addTodo(e, { state, actions }) {
  const { todos } = state;

  e.preventDefault();

  return {
    todos: [
      // actions.space(…) creates a space for the todo, with an initial state
      // An update to this new space will propagate up to TodoList's space
      // All spaces that exist in a list, like this one, need a unique 'id' or 'key' attribute
      actions.space({ id: uuid(), msg: '', done: false })
     ].concat(todos)
   };
 }
}
```

**Todo.js**
```jsx
import react from 'react';

export default function Todo({ state: todo, actions, onRemove }) {
  const doneClassName = todo.done ? 'done' : '';

  return(
    <li className='todo'>
      <input type='checkbox' checked={done} onChange={actions.do(toggleDone)} />
      <span className={doneClassName}>{todo.msg}</span>
      <button onClick={actions.do(removeTodo)}>Remove Todo</button>
    </li>
  );
};

// The returned value from an action is merged onto the existing state
// In this case, only the `done` attribute is changed
function toggleDone(e, { state }) {
  return { done: !todo.done };
}

function removeTodo(e) {
  e.preventDefault();

  // Returning null from an action causes this space to be removed from its parent
  // In this case, this causes this todo to be removed from the parent's list
  // of todos
  return null;
}
```

## Documentation

### What is a Space?

`Space` is the default class provided by the `spaceace` npm package.

Every `space` consists of:
- An immutable state, which can only be overwritten using an action.
- A method for subscribing to updates

You create a new space by calling `new Space(…)` e.g.
```javascript
const rootSpace = new Space({ initialState: true, todoList: { todos: [] } });
```

If you have a space, and want to create a child space, call `actions.space({ ... initialState })` or
`actions.space('keyName')`. If a string is provided, the space will attach to the specified key of
the current space.
