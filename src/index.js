var isNode=new Function("try {return this===global;}catch(e){return false;}"),
    Rill = require('rill'),
    app = new Rill(),
    o = require('./options.js'),
    $ = require('vQuery'),
    datastore = require('./datastore.js'),
    componentHandler = require('./componentHandler.js');

var vramework = {
    use: app.use.bind(app), 
    get: app.get.bind(app),
    $: $.bind($),
    registerComponent: componentHandler.registerComponent.bind(componentHandler),
    component: require('./component.js'),
    start: function() {
        app.use(function (context, next) {
            console.log("use",context)
            if (typeof context.res.body !== "undefined") {
                $(o.options.entry).html(context.res.body);
                $.update();
            }
            next();
        })
        app.listen();
        
    },
    View: require('./view.js')
}
 
module.exports = function(optionsIn, cb) {
    console.log(o.options)
    if (typeof optionsIn === "object")
        o.options = Object.assign(o.options, optionsIn);
    datastore.dispatch({
        type: "SET_GLOBAL",
        data: o.options.model
    });
    $(function () {
        cb(vramework);
    }, {
        autoUpdate: false
    });
};