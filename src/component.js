var o = require('./options.js');
module.exports = function(optionsIn) {
    return Object.assign({
            name: null,
            template: function(data) {return ""},
            beforeRender: function(data, res) {
                res(data);
            },
            afterRender: function(html, res) {
                res(html);
            }
        }, optionsIn,{
            render: function(data, cb) {
                o.options.renderEngine(data, this.template, cb);
            }
        });
}