import getPaginator, {
    REQUEST_PAGE,
    RECEIVE_PAGE,
    paginationInitialState,
    entitiesInitialState
} from './index';
import mockPromises from 'mock-promises';
import deepCopy from 'deep-copy';

let apiCallMock;

beforeEach(() => {
    apiCallMock = jest.fn();
});

describe('Pagination construction', () => {
    it('should build all the correct functions for valid state', () => {
        expect(getPaginator(apiCallMock))
            .toEqual(expect.objectContaining({
                selectors: expect.objectContaining({
                    hasNext: expect.any(Function),
                    hasPrevious: expect.any(Function),
                    getFilters: expect.any(Function),
                    getTotalCount: expect.any(Function),
                    getCurrentPageNum: expect.any(Function),
                    getFiltersAsQueryString: expect.any(Function),
                    getCurrentPageItems: expect.any(Function)
                }),
                navigation: expect.objectContaining({
                    fetchNextPage: expect.any(Function),
                    fetchPreviousPage: expect.any(Function),
                    fetchPage: expect.any(Function)
                }),
                actionCreators: expect.objectContaining({
                    requestPage: expect.any(Function),
                    receivePage: expect.any(Function)
                }),
                paginationReducer: expect.any(Function),
                entitiesReducer: expect.any(Function)
            }));
    });

    it('selector functions should throw an error if paginator state is missing', () => {
        const paginator = getPaginator(apiCallMock);
        const state = {};
        [
            paginator.selectors.hasNext,
            paginator.selectors.hasPrevious,
            paginator.selectors.getFilters,
            paginator.selectors.getTotalCount,
            paginator.selectors.getCurrentPageNum,
            paginator.selectors.getFiltersAsQueryString
        ].forEach((func) => {
            expect(() => {
                func(state);
            }).toThrow(/^Key .* does not exist in global state$/);
        });
    });

    it('navigation functions should be curried', () => {
        const paginator = getPaginator(apiCallMock);
        const state = {};
        [
            paginator.navigation.fetchNextPage,
            paginator.navigation.fetchPreviousPage,
            paginator.navigation.fetchPage
        ].forEach((func) => {
            expect(func(state)).toEqual(expect.any(Function));
        });
    })
});

describe('Selector operation', () => {
    const paginator = getPaginator(apiCallMock);

    it('hasNext should correctly respond to the existence of a next page', () => {
        const stateWithNext = {
            pagination: {
                next: 'http://www.example.com'
            }
        };
        expect(paginator.selectors.hasNext(stateWithNext)).toEqual(true);

        const stateWithoutNext = {
            pagination: {
                next: null
            }
        };
        expect(paginator.selectors.hasNext(stateWithoutNext)).toEqual(false);
    });

    it('hasPrevious should correctly respond when a previous page exists', () => {
        const stateWithPrevious = {
            pagination: {
                previous: 'http://www.example.com'
            }
        };
        expect(paginator.selectors.hasPrevious(stateWithPrevious)).toEqual(true);

        const stateWithoutPrevious = {
            pagination: {
                previous: null
            }
        };
        expect(paginator.selectors.hasPrevious(stateWithoutPrevious)).toEqual(false);
    });


    it('getFilters should return the same filters as in the state object', () => {
        const state = {
            pagination: {
                filters: {
                    category_id: 5
                }
            }
        };
        expect(paginator.selectors.getFilters(state)).toEqual({category_id: 5});
    });

    it('getFiltersAsQueryString should return the filters in a query string format', () => {
        const state = {
            pagination: {
                filters: {
                    category_id: 5,
                    year: 1990
                }
            }
        };
        expect(paginator.selectors.getFiltersAsQueryString(state)).toEqual('category_id=5&year=1990');
    });

    it('getTotalCount should return the same count as in the state object', () => {
        const state = {
            pagination: {
                count: 176
            }
        };
        expect(paginator.selectors.getTotalCount(state)).toEqual(176);
    });

    it('getCurrentPageNum should return the same current page as in the state object', () => {
        const state = {
            pagination: {
                page: 10
            }
        };
        expect(paginator.selectors.getCurrentPageNum(state)).toEqual(10);
    });

    it('getCurrentPageItems should return the correct item objects for this page', () => {
        const items = [
            {name: 'item1', id: 1},
            {name: 'item2', id: 2},
            {name: 'item3', id: 3}
        ];
        const state = {
            entities: {
                '1': items[0],
                '2': items[1],
                '3': items[2]
            },
            pagination: {
                pages: {
                    "": { // "" is the current filter state
                        1: [1, 3],
                        2: [2]
                    }
                },
                page: 1
            }
        };

        const expectedItems = [items[0], items[2]];
        expect(paginator.selectors.getCurrentPageItems(state)).toEqual(expectedItems);
    })
});

describe('Action creator operations', () => {
    it('should create the proper request page action object', () => {
        const paginator = getPaginator(apiCallMock);
        const page = 4;
        const queryParams = {};
        const expectedActionObject = {
            type: REQUEST_PAGE,
            payload: {},
            meta: {
                page: page,
                filters: queryParams
            }
        };
        expect(paginator.actionCreators.requestPage(page, queryParams)).toEqual(expectedActionObject);

        queryParams['category_id'] = 15;
        expectedActionObject.meta.filters = queryParams;
        expect(paginator.actionCreators.requestPage(page, queryParams)).toEqual(expectedActionObject);
    });

    it('should create the proper response page action object with default options', () => {
        const paginator = getPaginator(apiCallMock);
        const page = 4;
        const queryParams = {};
        const results = [{id: 'item1'}, {id: 'item2'}];
        const count = 20;
        const next = apiCallMock + '?page=2';
        const previous = null;
        const response = {
            results,
            count,
            next,
            previous
        };
        const expectedActionObject = {
            type: RECEIVE_PAGE,
            payload: results,
            meta: {
                count,
                next,
                previous,
                page,
                filters: queryParams,
                paginated: true
            }
        };
        expect(paginator.actionCreators.receivePage(page, queryParams, response)).toEqual(expectedActionObject);

        queryParams['category_id'] = 15;
        expectedActionObject.meta.filters = queryParams;
        expect(paginator.actionCreators.receivePage(page, queryParams, response)).toEqual(expectedActionObject);
    });

    it('should create the proper response page action object with modified options', () => {
        const options = {
            resultsKey: 'booty',
            countKey: 'somethingSilly',
            nextKey: 'foo',
            previousKey: 'bar'
        };
        const paginator = getPaginator(apiCallMock, options);
        const page = 4;
        const queryParams = {};
        const results = [{id: 'item1'}, {id: 'item2'}];
        const count = 20;
        const next = apiCallMock + '?page=2';
        const previous = null;
        const response = {
            [options.resultsKey]: results,
            [options.countKey]: count,
            [options.nextKey]: next,
            [options.previousKey]: previous
        };
        const expectedActionObject = {
            type: RECEIVE_PAGE,
            payload: results,
            meta: {
                count,
                next,
                previous,
                page,
                filters: queryParams,
                paginated: true
            }
        };
        expect(paginator.actionCreators.receivePage(page, queryParams, response)).toEqual(expectedActionObject);
    });
});

describe('Pagination reducer operations', () => {
    it('should return the same state upon anything but RECEIVE_PAGE', () => {
        const previousState = {foo: 'bar'}; // this value doesn't matter beyond comparison's sake
        const paginator = getPaginator(apiCallMock);

        expect(paginator.paginationReducer(previousState, {type: REQUEST_PAGE})).toEqual(previousState);
        expect(paginator.paginationReducer(previousState, {type: 'ASASERKNALKASEJRLN'})).toEqual(previousState);

        // and once with no state passed
        expect(paginator.paginationReducer(undefined, {type: REQUEST_PAGE})).toEqual(paginationInitialState);
    });

    it('should return the proper state upon RECEIVE_PAGE, starting at empty, with default options', () => {
        const page = 4;
        const queryParams = {};
        const results = [{id: 'item1'}, {id: 'item2'}];
        const count = 20;
        const next = apiCallMock + '?page=2';
        const previous = null;

        const paginator = getPaginator(apiCallMock);

        const actionObject = {
            type: RECEIVE_PAGE,
            payload: results,
            meta: {
                count,
                next,
                previous,
                page,
                filters: queryParams,
                paginated: true
            }
        };

        const expectedState = {
            pages: {
                '': {
                    '4': ['item1', 'item2']
                }
            },
            page,
            filters: queryParams,
            next,
            previous,
            count,
            paginated: true
        };
        expect(paginator.paginationReducer(undefined, actionObject)).toEqual(expectedState);
    });

    it('should return the proper state upon RECEIVE_PAGE, starting at empty, with custom options', () => {
        const page = 4;
        const queryParams = {};
        const results = [{foo: 'item1'}, {foo: 'item2'}];
        const count = 20;
        const next = apiCallMock + '?page=2';
        const previous = null;

        const paginatorOptions = {entityIdKey: 'foo'};

        const paginator = getPaginator(apiCallMock, paginatorOptions);

        const actionObject = {
            type: RECEIVE_PAGE,
            payload: results,
            meta: {
                count,
                next,
                previous,
                page,
                filters: queryParams,
                paginated: true
            }
        };

        const expectedState = {
            pages: {
                '': {
                    '4': ['item1', 'item2']
                }
            },
            page,
            filters: queryParams,
            next,
            previous,
            count,
            paginated: true
        };
        expect(paginator.paginationReducer(undefined, actionObject)).toEqual(expectedState);
    });

    it('should return the proper state upon RECEIVE_PAGE, starting with an existing state', () => {
        const oldPage = 4;
        const newPage = 5;
        const queryParams = {};
        const oldNext = apiCallMock + '?page=5';
        const newNext = apiCallMock + '?page=6';
        const oldPrevious = apiCallMock + '?page=3';
        const newPrevious = apiCallMock + '?page=4';
        const count = 140;
        const results = [{id: 'item3'}, {id: 'item4'}];

        const oldState = {
            pages: {
                '': {
                    '4': ['item1', 'item2']
                }
            },
            page: oldPage,
            filters: queryParams,
            next: oldNext,
            previous: oldPrevious,
            count,
            paginated: true
        };

        const actionObject = {
            type: RECEIVE_PAGE,
            payload: results,
            meta: {
                count,
                next: newNext,
                previous: newPrevious,
                page: newPage,
                filters: queryParams,
                paginated: true
            }
        };

        const expectedNewState = {
            pages: {
                '': {
                    '4': ['item1', 'item2'],
                    '5': ['item3', 'item4']
                }
            },
            page: newPage,
            filters: queryParams,
            next: newNext,
            previous: newPrevious,
            count,
            paginated: true
        };

        const paginator = getPaginator(apiCallMock);
        expect(paginator.paginationReducer(oldState, actionObject)).toEqual(expectedNewState);
    });

    it('should return the proper state upon RECEIVE_PAGE, starting with an existing state and changing filters', () => {
        const oldPage = 4;
        const newPage = 5;
        const oldQueryParams = {};
        const newQueryParams = {category_id: 1};
        const oldNext = apiCallMock + '?page=5';
        const newNext = apiCallMock + '?page=6';
        const oldPrevious = apiCallMock + '?page=3';
        const newPrevious = apiCallMock + '?page=4';
        const count = 140;
        const results = [{id: 'item1'}, {id: 'item4'}];

        const oldState = {
            pages: {
                '': {
                    '4': ['item1', 'item2']
                }
            },
            page: oldPage,
            filters: oldQueryParams,
            next: oldNext,
            previous: oldPrevious,
            count,
            paginated: true
        };

        const actionObject = {
            type: RECEIVE_PAGE,
            payload: results,
            meta: {
                count,
                next: newNext,
                previous: newPrevious,
                page: newPage,
                filters: newQueryParams,
                paginated: true
            }
        };

        const expectedNewState = {
            pages: {
                '': {
                    '4': ['item1', 'item2']
                },
                'category_id=1': {
                    '5': ['item1', 'item4']
                }
            },
            page: newPage,
            filters: newQueryParams,
            next: newNext,
            previous: newPrevious,
            count,
            paginated: true
        };

        const paginator = getPaginator(apiCallMock);
        expect(paginator.paginationReducer(oldState, actionObject)).toEqual(expectedNewState);
    });
});

describe('Entity reducer operations', () => {
    it('should return the same state upon anything but RECEIVE_PAGE', () => {
        const previousState = {foo: 'bar'};
        const paginator = getPaginator(apiCallMock);

        expect(paginator.entitiesReducer(previousState, {type: REQUEST_PAGE})).toEqual(previousState);
        expect(paginator.entitiesReducer(previousState, {type: 'lnaienaliesrjilnve'})).toEqual(previousState);

        // and once with no state passed
        expect(paginator.entitiesReducer(undefined, {type: REQUEST_PAGE})).toEqual(entitiesInitialState);
    });

    it('should return the proper state upon RECEIVE_PAGE', () => {
        const actionObject = {
            type: RECEIVE_PAGE,
            payload: [{id: 'item1'}, {id: 'item2'}],
            meta: {
                count: 20,
                next: apiCallMock + '?page=2',
                previous: null,
                page: 1,
                filters: {},
                paginated: true
            }
        };

        const expectedState = {
            item1: {
                id: 'item1'
            },
            item2: {
                id: 'item2'
            }
        };

        const paginatorWithDefaults = getPaginator(apiCallMock);

        // starting from scratch
        let stateFromPaginator = paginatorWithDefaults.entitiesReducer(undefined, actionObject);
        expect(stateFromPaginator).toEqual(expectedState);

        // adding state
        actionObject.payload = [{id: 'item3'}, {id: 'item4'}];
        expectedState['item3'] = actionObject.payload[0];
        expectedState['item4'] = actionObject.payload[1];
        stateFromPaginator = paginatorWithDefaults.entitiesReducer(stateFromPaginator, actionObject);
        expect(stateFromPaginator).toEqual(expectedState);

        // updating
        actionObject.payload = [{id: 'item3', foo: 'bar'}];
        expectedState['item3'] = actionObject.payload[0];
        stateFromPaginator = paginatorWithDefaults.entitiesReducer(stateFromPaginator, actionObject);
        expect(stateFromPaginator).toEqual(expectedState);

        // non-default id property
        const paginatorWithCustomOptions = getPaginator(apiCallMock, {entityIdKey: 'foo'});
        expectedState['bar'] = actionObject.payload[0];
        stateFromPaginator = paginatorWithCustomOptions.entitiesReducer(stateFromPaginator, actionObject);
        expect(stateFromPaginator).toEqual(expectedState);
    });
});

describe('Making queries', () => {
    const getBaseState = () => {
        return deepCopy({
            entities: entitiesInitialState,
            pagination: paginationInitialState
        });
    };

    const dispatch = () => {};

    beforeEach(() => {
        Promise = mockPromises.getMockPromise(Promise);
        apiCallMock.mockReturnValue(new Promise({}));
    });

    afterEach(() => {
        Promise = mockPromises.getOriginalPromise();
    });

    it('query-making functions should be properly curried', () => {
        const paginator = getPaginator(apiCallMock);
        expect(paginator.navigation.fetchPage(getBaseState())).toEqual(expect.any(Function));
        expect(paginator.navigation.fetchNextPage(getBaseState())).toEqual(expect.any(Function));
        expect(paginator.navigation.fetchPreviousPage(getBaseState())).toEqual(expect.any(Function));
    });

    it('should raise an error when there is no previous page', () => {
        const paginator = getPaginator(apiCallMock);
        expect(() => paginator.fetchPreviousPage(getBaseState())()).toThrow();
    });

    it('should query for the previous page when one exists', () => {
        const paginator = getPaginator(apiCallMock);
        const state = getBaseState();
        state.pagination.previous = 'not null';
        state.pagination.page = 2;
        paginator.navigation.fetchPreviousPage(state)()(dispatch);
        expect(apiCallMock).toHaveBeenCalled();
        expect(apiCallMock).lastCalledWith({page: 1});
    });

    it('should raise an error when there is no next page', () => {
        const paginator = getPaginator(apiCallMock);
        expect(() => paginator.fetchNextPage(getBaseState())()).toThrow();
    });

    it('should query for the next page when one exists', () => {
        const paginator = getPaginator(apiCallMock);
        const state = getBaseState();
        state.pagination.next = 'not null';
        paginator.navigation.fetchNextPage(state)()(dispatch);
        expect(apiCallMock).toHaveBeenCalled();
        expect(apiCallMock).lastCalledWith({page: 2});
    });

    it('if there are no overrides, it should send the query params in the state when fetching a page', () => {
        const defaultPaginator = getPaginator(apiCallMock);
        const state = getBaseState();
        defaultPaginator.navigation.fetchPage(state)()(dispatch);
        expect(apiCallMock).toBeCalled();

        // fetchPage adds the page number to the filter params
        const queryParamsWithDefaultPage = Object.assign({}, state.pagination.filters, {page: 1});
        expect(apiCallMock).lastCalledWith(queryParamsWithDefaultPage);

        // we can also override the page property if the api expects something different
        const customOptions = {pageKey: 'foo'};
        const customPaginator = getPaginator(apiCallMock, customOptions);
        customPaginator.navigation.fetchPage(state)()(dispatch);
        expect(apiCallMock).toBeCalled();
        const queryParamsWithCustomPage = Object.assign({}, state.pagination.filters, {foo: 1});
        expect(apiCallMock).lastCalledWith(queryParamsWithCustomPage);
    });

    it('should reset back to page 1 if the query params are overridden (i.e. switching filters)', () => {
        const paginator = getPaginator(apiCallMock);
        const state = getBaseState();
        state.pagination.page = 4;
        const queryParams = {category_id: 15};
        paginator.navigation.fetchPage(state)(4, queryParams)(dispatch);
        const expectedQueryParams = Object.assign({}, queryParams, {page: 1});
        expect(apiCallMock).lastCalledWith(expectedQueryParams);
    });
});