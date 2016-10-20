module.exports.options = {
    model: {},
    entry: "body",
    renderEngine: function(data, template, cb) {
        cb(template(data));
    }
}