var redux = require('redux'),
    Immutable = require('immutable'),
    reducers = {
        "SET_GLOBAL": function(state, action) {
            return state.set("global", action.data);
        },
        "SET_VIEW_STATE": function(state, action) {
            return state.set(action.data.id, action.data.model);
        }
    },
    Immutable = require('immutable'),
    stateHandler = function(state, action) {
        if (typeof reducers[action.type] === "function")
            return reducers[action.type](state, action);
        else
            return state;
    },
    store = redux.createStore(stateHandler, Immutable.fromJS({}));

store.subscribe(function() {
    console.log("state change", store.getState().toJS())
})

module.exports = {
    getState: function() {
        return store.getState()
    },
    dispatch: function(action) {
        store.dispatch(action);
    },
    addReducer: function(type, reducer) {
        reducers[type] = reducer;
    },
    subscribe: function(cb) {
        store.subscribe(function() {
            cb(store.getState());
        });
    }
}