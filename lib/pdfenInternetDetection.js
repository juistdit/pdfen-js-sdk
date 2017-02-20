
module.exports = function (window, pdfen) {
    if(typeof(Proxy) === "undefined") {
        return;
    }
    var isOnline = true;
    var errorCounter = 0;
    window.fetch = (function (old_fetch) {
        return function () {
            var ret = old_fetch.apply(this, arguments);
            ret.then = (function(then_old) {
                return function(callback, error) {
                    if(typeof callback !== "undefined"){
                        callback = (function (callback_old) {
                            return function () {
                                errorCounter = 0;
                                if(typeof pdfen.onInternetEnabled !== 'undefined' && !isOnline) {
                                    isOnline = true;
                                    pdfen.onInternetEnabled();
                                }
                                callback_old.apply(this, arguments);
                            };
                        })(callback);
                    }
                    then_old.apply(this, [callback, error]);
                };
            }) (ret.then);
            ret.catch(function(error){
                if(typeof pdfen.onInternetDisabled !== 'undefined' && isOnline && errorCounter < 3) {
                    errorCounter++;
                } else if(typeof pdfen.onInternetDisabled !== 'undefined' && isOnline) {
                    isOnline = false;
                    pdfen.onInternetDisabled();
                }
            });
            return ret;
        }
    }) (window.fetch);

    window.XMLHttpRequest = (function (XMLHttpRequest_old) {
        var result = function () { 
            var object = new (Function.prototype.bind.apply(XMLHttpRequest_old, arguments)); 
            var onerror = function() {
            }

            var onload = function () {
                
            }

            object.onerror = function () {
                if(typeof pdfen.onInternetDisabled !== 'undefined' && isOnline && errorCounter < 3) {
                    errorCounter++;
                } else if(typeof pdfen.onInternetDisabled !== 'undefined' && isOnline) {
                    isOnline = false;
                    pdfen.onInternetDisabled();
                }
                onerror.apply(this, arguments);
            }

            object.onload = function () {
                errorCounter = 0;
                if(typeof pdfen.onInternetEnabled !== 'undefined' && !isOnline) {
                    isOnline = true;
                    pdfen.onInternetEnabled();
                }
                onload.apply(this, arguments);
            }

            var handler = {
                set: function(target, name, value) {
                    if(name === "onerror"){
                        onerror = value;
                        return true;
                    }
                    if(name === 'onload'){
                        onload = value;
                        return true;
                    }
                    target[name] = value;
                    return true;
                },
                get: function(target, name) {
                    if(name === "onerror"){
                        return function() { return onerror.apply(target, arguments); };
                    } else if(name === 'onload'){
                        return function() { return onload.apply(target, arguments); };
                    }
                    if(typeof target[name] === 'function') {
                        return function() { return target[name].apply(target, arguments); };
                    }
                    return target[name];
                },

                apply: function(target, thisArg, argumentsList) {//does not seem to be used by most browsers... see above by get.
                    return object[target].apply(object, argumentsList);
                }
            };
            return new Proxy(object, handler);
        };
        return result;
    })(XMLHttpRequest);
}