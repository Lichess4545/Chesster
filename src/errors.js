/*eslint no-extend-native: ["error", { "exceptions": ["Error"] }]*/

//------------------------------------------------------------------------------
// A file to hold various error handling facilities that aren't specific
// to other modules. 
//
// Started off as a place to include exceptions-to-json code.
//------------------------------------------------------------------------------


function patchErrorWith_toJSON_Method() {
    if (!('toJSON' in Error.prototype)) {
        Object.defineProperty(Error.prototype, 'toJSON', {
            value: function () {
                var alt = {};

                Object.getOwnPropertyNames(this).forEach(function (key) {
                    alt[key] = this[key];
                }, this);

                return alt;
            },
            configurable: true,
            writable: true
        });
    }
}

function init() {
    patchErrorWith_toJSON_Method()
}

module.exports.patchErrorWith_toJSON_Method = patchErrorWith_toJSON_Method;
module.exports.init = init;
