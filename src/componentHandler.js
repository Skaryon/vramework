var registeredComponents = {};
module.exports = {
    registerComponent: function(component) {
        registeredComponents[component.name] = component;
    },
    get: function(name) {
        return registeredComponents[name];
    }
}