# paging-dr-redux
Paging Dr. Redux!, a bare-bones paginator designed to work with Redux.

## Dependencies
This is intended to be used with [Redux](https://redux.js.org/), typically within the context of a
[React](https://reactjs.org/) application, using [redux-thunk](https://github.com/reduxjs/redux-thunk); best results
will come if this is your setup.

This also uses [Flux Standard Actions](https://github.com/redux-utilities/flux-standard-action) for consistency's sake;
not a dependency, but it's a tool which you can use along with this lib.

## Installation
Using npm:
```bash
$ npm i --save paging-dr-redux
```

## Quick Start
First, we'll need to set up a function which calls the API and returns a promise. How you decide to implement that is
up to you; We'll use fetch for this example.
```javascript
// api.js

import queryStringUtil from 'query-string'

export const getTodos = (queryParamsObject = {}) => {
    const url = "http://example.com?" + queryStringUtil.stringify(queryParamsObject);
    return fetch(url)
        .then(
            response => response.json(),
            error => console.log(error)
        );
}
```

Now we'll create the paginator object we're going to use. For now, we'll use the default options for building the
paginator.
```javascript
// paginators.js

import getPaginator from 'paging-dr-redux';
import {getTodos} from './api';

export const todoPaginator = getPaginator('todo', getTodos); 
```

The paginator provides reducers, so we'll get those into our application
```javascript
// reducers.js

import {todoPaginator} from './paginators';
import {combineReducers} from 'redux';

const todoReducer = combineReducers({
    entities: todoPaginator.entitiesReducer,
    pagination: todoPaginator.paginationReducer
});

// maybe have other reducers here

const reducers = combineReducers({
    todos: todoReducer
});
export default reducers;
```

Build your store and app as you normally would, and now you have a paginator ready for your components! Here's a (pretty
thorough) example of what you can do
```javascript
// components/App.js

import React, { Component } from 'react';
import {connect} from 'react-redux';
import {todoPaginator} from "../paginators";

class App extends Component {
    constructor(props) {
        super(props);

        this.onNextClick = this.onNextClick.bind(this);
        this.onPreviousClick = this.onPreviousClick.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);
    }

    componentWillMount() {
        this.props.dispatch(this.props.fetchPage());
    }

    onNextClick() {
        if (!this.props.hasNext) {
            return;
        }
        this.props.dispatch(this.props.fetchNextPage());
    }

    onPreviousClick() {
        if (!this.props.hasPrevious) {
            return;
        }
        this.props.dispatch(this.props.fetchPreviousPage());
    }

    onFilterChange(evt) {
        this.props.dispatch(this.props.fetchPage(1, {category_id: evt.target.value}));
    }

    render() {
        const {
            hasPrevious,
            hasNext,
            currentPageItems,
            totalCount,
            filtersAsQueryString,
            currentPageNum,
        } = this.props;
        return (
            <div>
                <h1>Total of {totalCount} todo items</h1>
                <h2>There are {Object.keys(currentPageItems).length} in this list</h2>
                <h2>Filter: {filtersAsQueryString}</h2>
                <h2>On page {currentPageNum}</h2>

                <button onClick={this.onPreviousClick} disabled={!hasPrevious}>Previous</button>
                <button onClick={this.onNextClick} disabled={!hasNext}>Next</button>
                <select onChange={this.onFilterChange}>
                    {Array(8).fill().map((_, i) => <option value={i + 1} key={'s' + i}>{i + 1}</option>)}
                </select>
                <table>
                    <thead>
                        <tr>
                            <th>id</th>
                            <th>body</th>
                            <th>category</th>
                        </tr>
                    </thead>
                    <tbody>
                    {
                        currentPageItems.map(todo => (
                            <tr key={todo.id}>
                                <td>{todo.id}</td>
                                <td>{todo.body}</td>
                                <td>{todo.category_id}</td>
                            </tr>
                        ))
                    }
                    </tbody>
                </table>
            </div>
        )
    }
}

const mapStateToProps = state => {
    return {
        hasPrevious: partsPaginator.selectors.hasPrevious(state.todos),
        hasNext: partsPaginator.selectors.hasNext(state.todos),
        currentPageItems: partsPaginator.selectors.getCurrentPageItems(state.todos),
        totalCount: partsPaginator.selectors.getTotalCount(state.todos),
        filtersAsQueryString: partsPaginator.selectors.getFiltersAsQueryString(state.todos),
        currentPageNum: partsPaginator.selectors.getCurrentPageNum(state.todos),
        filters: partsPaginator.selectors.getFilters(state.todos),
        fetchNextPage: partsPaginator.navigation.fetchNextPage(state.todos),
        fetchPreviousPage: partsPaginator.navigation.fetchPreviousPage(state.todos),
        fetchPage: partsPaginator.navigation.fetchPage(state.todos),
    }
};

export default connect(mapStateToProps)(App);

```
## Revision History
### 1.0.0
Major version bump due to breaking changes in the API. This adds a specific type to the `getPaginator` function
in order to differentiate between different entity types which may be paginated, preventing sullying of the
entity space

### 0.1.4
Patch fix to repair an issue with nested promises

### 0.1.3
Use the `lib` dir, not the `dist` dir, as the target for compiled code

### 0.1.2
Updated README with instructions on how to use

### 0.1.1
Added transpile options, first upload to NPM

### 0.1.0
First working iteration
