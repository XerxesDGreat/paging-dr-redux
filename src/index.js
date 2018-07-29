import queryStringUtils from "query-string";

export const paginationInitialState = {
    pages: {},
    page: 1,
    filters: {},
    next: null,
    previous: null,
    count: 0
};

export const entitiesInitialState = {};

const defaultOptions = {
    entitiesKey: 'entities',
    paginatorsKey: 'pagination',
    entityIdKey: 'id',
    resultsKey: 'results',
    countKey: 'count',
    nextKey: 'next',
    previousKey: 'previous',
    pageKey: 'page'
};

//////////////////////////////////
// helpers. These are not exported
//////////////////////////////////
const getPaginatorState = (state, mergedOptions) => {
    return _getStateSegment(state, mergedOptions.paginatorsKey);
};

const getEntitiesState = (state, mergedOptions) => {
    return _getStateSegment(state, mergedOptions.entitiesKey);
};

const _getStateSegment = (state, segment) => {
    if (!(segment in state)) {
        throw new Error('Key [' + segment + '] does not exist in global state');
    }
    return state[segment];
};

//////////////////////////////////
// Action Types
//////////////////////////////////
export const REQUEST_PAGE = '@@page-by-page/REQUEST_PAGE';
export const RECEIVE_PAGE = '@@page-by-page/RECEIVE_PAGE';


//////////////////////////////////
// Paginator
//////////////////////////////////
const getPaginator = (entityType, apiCall, options = {}) => {
    const mergedOptions = Object.assign({}, defaultOptions, options);

    const selectors = ({
        hasNext: (state) => {
            return getPaginatorState(state, mergedOptions).next !== null;
        },
        hasPrevious: (state) => {
            return getPaginatorState(state, mergedOptions).previous !== null;
        },
        getFilters: (state) => {
            return getPaginatorState(state, mergedOptions).filters;
        },
        getTotalCount: (state) => {
            return getPaginatorState(state, mergedOptions).count;
        },
        getCurrentPageNum: (state) => {
            return getPaginatorState(state, mergedOptions).page;
        }
    });

    selectors.getFiltersAsQueryString = (state) => {
        return queryStringUtils.stringify(selectors.getFilters(state));
    };

    selectors.getCurrentPageItems = (state) => {
        const filterKey = selectors.getFiltersAsQueryString(state);
        const pageNum = selectors.getCurrentPageNum(state);
        try {
            const ids = getPaginatorState(state, mergedOptions).pages[filterKey][pageNum] || [];
            const entities = getEntitiesState(state, mergedOptions);
            return ids.map(id => entities[id]);
        } catch (Error) {
            return [];
        }
    };

    const paginationReducer = (state = paginationInitialState, action) => {
        if (action.meta.entityType !== entityType) {
            return state;
        }
        switch (action.type) {
            case RECEIVE_PAGE:
                const nextState = {...state};
                const filterString = queryStringUtils.stringify(action.meta.filters);
                const filteredPages = {...nextState.pages[filterString]} || {};
                filteredPages[action.meta.page] = action.payload.map(item => item[mergedOptions.entityIdKey]);
                nextState.pages[filterString] = filteredPages;
                Object.assign(nextState, action.meta);
                return nextState;
            default:
                return state;
        }
    };

    const entitiesReducer = (state = entitiesInitialState, action) => {
        if (action.meta.entityType !== entityType) {
            return state;
        }
        switch (action.type) {
            case RECEIVE_PAGE:
                const nextState = {...state};
                action.payload.forEach(item => {
                    nextState[item[mergedOptions.entityIdKey]] = item;
                });
                return nextState;
            default:
                return state;
        }
    };

    const fetchNextPage = state => (overrideQueryParams = {}) => {
        if (!selectors.hasNext(state)) {
            throw new Error('no next page');
        }
        const pageToFetch = selectors.getCurrentPageNum(state) + 1;
        return fetchPage(state)(pageToFetch, overrideQueryParams);
    };

    const fetchPreviousPage = state => (overrideQueryParams = {}) => {
        if (!selectors.hasPrevious(state)) {
            throw new Error('no previous page');
        }
        const pageToFetch = selectors.getCurrentPageNum(state) - 1;
        return fetchPage(state)(pageToFetch, overrideQueryParams);
    };

    // note if you give specific query params, it will reset page to 1
    const fetchPage = state => (page = 1, overrideQueryParams = {}) => {
        let pageToFetch, queryParams;
        if (Object.keys(overrideQueryParams).length > 0) {
            pageToFetch = 1;
            queryParams = Object.assign({}, selectors.getFilters(state), overrideQueryParams);
        } else {
            pageToFetch = page;
            queryParams = selectors.getFilters(state);
        }

        return function(dispatch) {
            dispatch(actionCreators.requestPage(pageToFetch, queryParams));
            return apiCall({
                ...queryParams,
                [mergedOptions.pageKey]: pageToFetch
            }).then(
                response => dispatch(actionCreators.receivePage(pageToFetch, queryParams, response)),
                error => {
                    console.log(error);
                    // do some actual error stuff
                }
            )
        }
    };

    const actionCreators = {
        requestPage: (page, queryParams) => ({
            type: REQUEST_PAGE,
            payload: {},
            meta: {
                page, entityType, filters: queryParams
            }
        }),
        receivePage: (page, queryParams, response) => ({
            type: RECEIVE_PAGE,
            payload: response[mergedOptions.resultsKey],
            meta: {
                entityType,
                count: response[mergedOptions.countKey],
                next: response[mergedOptions.nextKey],
                previous: response[mergedOptions.previousKey],
                page,
                filters: queryParams,
                paginated: true
            }
        })
    };

    return {
        navigation: {
            fetchNextPage,
            fetchPreviousPage,
            fetchPage
        },
        selectors,
        actionCreators,
        paginationReducer,
        entitiesReducer
    };
};


export default getPaginator;