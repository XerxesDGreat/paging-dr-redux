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
    const entityType = 'foo';

    it('should create the proper request page action object', () => {
        const paginator = getPaginator(entityType, apiCallMock);
        const page = 4;
        const queryParams = {};
        const expectedActionObject = {
            type: REQUEST_PAGE,
            payload: {},
            meta: {
                page: page,
                filters: queryParams,
                entityType: entityType
            }
        };
        expect(paginator.actionCreators.requestPage(page, queryParams)).toEqual(expectedActionObject);

        queryParams['category_id'] = 15;
        expectedActionObject.meta.filters = queryParams;
        expect(paginator.actionCreators.requestPage(page, queryParams)).toEqual(expectedActionObject);
    });

    it('should create the proper response page action object with default options', () => {
        const paginator = getPaginator(entityType, apiCallMock);
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
                paginated: true,
                entityType
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
        const paginator = getPaginator(entityType, apiCallMock, options);
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
                entityType,
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

describe('Reducer operations', () => {
    const entityType = 'asdf';
    let paginator;
    const previousState = {foo: 'bar'};
    const count = 100;
    const page = 4;
    const filters = {};

    const urlTemplate = 'http://example.com?page=__page__';
    const getNext = curPage => urlTemplate.replace('__page__', curPage + 1);
    const getPrevious = curPage => curPage === 1 ? null : urlTemplate.replace('__page__', curPage - 1);

    beforeEach(() => {
        paginator = getPaginator(entityType, apiCallMock);
    });

    const getActionObject = (results, meta={}) => ({
        type: RECEIVE_PAGE,
        payload: results,
        meta: {count, entityType, paginated: true, ...meta}
    });

    describe('Pagination', () => {
        describe('The state should be unchanged', () => {

            it('when anything but RECEIVE_PAGE is received, but the entity type matches', () => {
                const action = {
                    type: REQUEST_PAGE,
                    meta: {entityType}
                };
                expect(paginator.paginationReducer(previousState, action)).toEqual(previousState);

                action.type = 'ASASERKNALKASEJRLN';
                expect(paginator.paginationReducer(previousState, action)).toEqual(previousState);

                // and once with no state passed
                expect(paginator.paginationReducer(undefined, action)).toEqual(paginationInitialState);
            });

            it('when a non-matching entityType is encountered with a RECEIVE_PAGE action', () => {
                const action = {
                    type: RECEIVE_PAGE,
                    meta: {
                        entityType: "not what you're looking for"
                    }
                };
                expect(paginator.paginationReducer(previousState, action)).toEqual(previousState);
            });
        });

        describe("The state should be updated correctly upon RECEIVE_PAGE with matching entityType", () => {

            const getState = (pages, page, filters, next, previous) => ({
                pages, page, filters, next, previous, count, entityType, paginated: true
            });

            describe("Using a default paginator", () => {
                it('starting at empty', () => {
                    const results = [{id: 'item1'}, {id: 'item2'}];
                    const actionObject = getActionObject(results, {
                        next: getNext(page),
                        previous: getPrevious(page),
                        page,
                        filters
                    });

                    const pages = {
                        '': {
                            '4': ['item1', 'item2']
                        }
                    };
                    const expectedState = getState(pages, page, filters, getNext(page), getPrevious(page));
                    expect(paginator.paginationReducer(undefined, actionObject)).toEqual(expectedState);
                });

                describe("Starting with an existing state", () => {
                    let startingPages;
                    let oldState;

                    beforeEach(() => {
                        startingPages = {
                            '': {
                                '4': ['item1', 'item2']
                            }
                        };
                        oldState = getState(startingPages, page, filters, getNext(page), getPrevious(page));
                    });

                    it('Keeping filters unchanged', () => {
                        const results = [{id: 'item3'}, {id: 'item4'}];
                        const actionObject = getActionObject(results, {
                            next: getNext(page + 1),
                            previous: getPrevious(page + 1),
                            page: page + 1,
                            filters
                        });

                        const expectedPages = {
                            '': {
                                '4': ['item1', 'item2'],
                                '5': ['item3', 'item4']
                            }
                        };
                        const expectedState = getState(expectedPages, page + 1, filters, getNext(page + 1),
                            getPrevious(page + 1));

                        expect(paginator.paginationReducer(oldState, actionObject)).toEqual(expectedState);
                    });

                    it('Changing filters', () => {
                        const results = [{id: 'item1'}, {id: 'item4'}];
                        const newFilters = {'category_id': 1};
                        const actionObject = getActionObject(results, {
                            next: getNext(page + 1),
                            previous: getPrevious(page + 1),
                            page: page + 1,
                            filters: newFilters
                        });

                        const expectedPages = {
                            '': {
                                '4': ['item1', 'item2']
                            },
                            'category_id=1': {
                                '5': ['item1', 'item4']
                            }
                        };
                        const expectedState = getState(expectedPages, page + 1, newFilters, getNext(page + 1),
                            getPrevious(page + 1));

                        expect(paginator.paginationReducer(oldState, actionObject)).toEqual(expectedState);
                    });
                });
            });

            describe("Using a custom paginator", () => {
                it('starting at empty', () => {
                    const paginator = getPaginator(entityType, apiCallMock, {entityIdKey: 'foo'});

                    const results = [{foo: 'item1'}, {foo: 'item2'}];
                    const actionObject = getActionObject(results, {
                        next: getNext(page),
                        previous: getPrevious(page),
                        page,
                        filters
                    });

                    const expectedPages = {
                        '': {
                            '4': ['item1', 'item2']
                        }
                    };
                    const expectedState = getState(expectedPages, page, filters, getNext(page), getPrevious(page));
                    expect(paginator.paginationReducer(undefined, actionObject)).toEqual(expectedState);
                });
            });
        });
    });

    describe('Entity', () => {
        describe('should return the same state', () => {
            it('when any action but RECEIVE_PAGE is received', () => {
                const action = {
                    type: REQUEST_PAGE,
                    meta: {entityType}
                };
                expect(paginator.entitiesReducer(previousState, action)).toEqual(previousState);

                action.type = 'lnaienaliesrjilnve';
                expect(paginator.entitiesReducer(previousState, action)).toEqual(previousState);

                // and once with no state passed
                expect(paginator.entitiesReducer(undefined, action)).toEqual(entitiesInitialState);
            });

            it('when a non-matching entityType is encountered with a RECEIVE_PAGE action', () => {
                const action = {
                    type: RECEIVE_PAGE,
                    meta: {
                        entityType: "not what you're looking for"
                    }
                };

                expect(paginator.entitiesReducer(previousState, action)).toEqual(previousState);
            })
        });

        describe('the state should be updated properly', () => {
            describe('when RECEIVE_PAGE action is received', () => {
                const items = [
                    {id: 'item0', foo: 'bar0'},
                    {id: 'item1', foo: 'bar1'},
                    {id: 'item2', foo: 'bar2'},
                    {id: 'item3', foo: 'bar3'},
                ];

                describe('using default paginator', () => {
                    it('beginning from empty state', () => {
                        const actionObject = getActionObject(items.slice(0, 2));

                        const expectedState = {
                            item0: items[0],
                            item1: items[1]
                        };

                        expect(paginator.entitiesReducer(undefined, actionObject)).toEqual(expectedState);
                    });

                    it('adding to existing state', () => {
                        const actionObject = getActionObject(items.slice(2,4));

                        const existingState = {
                            item0: items[0],
                            item1: items[1]
                        };

                        const expectedState = {
                            ...existingState,
                            item2: items[2],
                            item3: items[3]
                        };

                        expect(paginator.entitiesReducer(existingState, actionObject)).toEqual(expectedState);
                    });

                    it('updating existing items in state', () => {
                        const response = [{id: items[3].id, foo: 'baz'}];
                        const actionObject = getActionObject(response);

                        const existingState = {
                            item3: items[3]
                        };

                        const expectedState = {
                            item3: response[0]
                        };

                        expect(paginator.entitiesReducer(existingState, actionObject)).toEqual(expectedState);
                    });
                });

                describe('using a custom paginator', () => {
                    beforeEach(() => {
                        paginator = getPaginator(entityType, apiCallMock, {entityIdKey: 'foo'});
                    });

                    it('starting from empty', () => {
                        const actionObject = getActionObject(items.slice(0, 2));

                        const expectedState = {
                            bar0: items[0],
                            bar1: items[1]
                        };

                        expect(paginator.entitiesReducer(undefined, actionObject)).toEqual(expectedState);
                    });
                });
            });
        });
    });
});

describe('Making queries', () => {
    const entityType = 'foo';
    let paginator;
    let state;

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
        paginator = getPaginator(entityType, apiCallMock);
        state = getBaseState();
    });

    afterEach(() => {
        Promise = mockPromises.getOriginalPromise();
    });

    it('query-making functions should be properly curried', () => {
        expect(paginator.navigation.fetchPage(getBaseState())).toEqual(expect.any(Function));
        expect(paginator.navigation.fetchNextPage(getBaseState())).toEqual(expect.any(Function));
        expect(paginator.navigation.fetchPreviousPage(getBaseState())).toEqual(expect.any(Function));
    });

    it('should raise an error when there is no previous page', () => {
        expect(() => paginator.fetchPreviousPage(getBaseState())()).toThrow();
    });

    it('should query for the previous page when one exists', () => {
        state.pagination.previous = 'not null';
        state.pagination.page = 2;
        paginator.navigation.fetchPreviousPage(state)()(dispatch);
        expect(apiCallMock).toHaveBeenCalled();
        expect(apiCallMock).lastCalledWith({page: 1});
    });

    it('should raise an error when there is no next page', () => {
        expect(() => paginator.fetchNextPage(getBaseState())()).toThrow();
    });

    it('should query for the next page when one exists', () => {
        state.pagination.next = 'not null';
        paginator.navigation.fetchNextPage(state)()(dispatch);
        expect(apiCallMock).toHaveBeenCalled();
        expect(apiCallMock).lastCalledWith({page: 2});
    });

    describe('if there are no overrides, it should send the query params in the state when fetching a page', () => {
        it('using the default paginator', () => {
            paginator.navigation.fetchPage(state)()(dispatch);
            expect(apiCallMock).toBeCalled();

            // fetchPage adds the page number to the filter params
            const queryParamsWithDefaultPage = Object.assign({}, state.pagination.filters, {page: 1});
            expect(apiCallMock).lastCalledWith(queryParamsWithDefaultPage);
        });

        it('using a custom paginator', () => {
            // we can also override the page property if the api expects something different
            const customOptions = {pageKey: 'foo'};
            const customPaginator = getPaginator(entityType, apiCallMock, customOptions);
            customPaginator.navigation.fetchPage(state)()(dispatch);
            expect(apiCallMock).toBeCalled();
            const queryParamsWithCustomPage = Object.assign({}, state.pagination.filters, {foo: 1});
            expect(apiCallMock).lastCalledWith(queryParamsWithCustomPage);
        });
    });

    it('should reset back to page 1 if the query params are overridden (i.e. switching filters)', () => {
        state.pagination.page = 4;
        const queryParams = {category_id: 15};
        paginator.navigation.fetchPage(state)(4, queryParams)(dispatch);
        const expectedQueryParams = Object.assign({}, queryParams, {page: 1});
        expect(apiCallMock).lastCalledWith(expectedQueryParams);
    });
});