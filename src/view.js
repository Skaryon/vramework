var o = require('./options.js'),
    datastore = require('./datastore.js'),
    componentHandler = require('./componentHandler.js'),
    id=0;
module.exports = function(optionsIn) {
    id++;
    var options = Object.assign({
        model: {},
        component: null
    }, optionsIn, {
        id: id
    });
    var entryComponent = componentHandler.get(options.component);
    datastore.dispatch({
        type: "SET_VIEW_STATE",
        data: {
            id: id,
            model: options.model
        }
    });
    function middleware(context, next) {
        var data = datastore.getState().toJS();
        entryComponent.beforeRender(Object.assign(data[options.id], {_global:data.global}), function(data) {
            entryComponent.render(data, function(html) {
                entryComponent.afterRender(html, function(html) {
                    context.res.body = html;
                    next();
                });
            });
        });
    }
    return middleware;
}