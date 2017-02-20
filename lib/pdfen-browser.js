//Some monkey fixes...
Uint8Array.prototype.toArrayBuffer = function () {return this.buffer;};


if(typeof Proxy !== "undefined" ) {
//this part is really ugly... but we need this to fix edge/ie head behavior.
    window.fetch = (function (fetch_old) {
        return function () {
        var result = fetch_old.apply(null, arguments);
        result.then_old = result.then;
        result.then = function (callback, error) {
            if(typeof callback === 'undefined') {
                return result.then_old(callback, error);
            }
            return result.then_old(function(response, error) {
                if(response.body === null){
                    var body = { "getReader" : function () {
                    return {
                        "read" : function (){
                            return {
                                "then" : function (callback){
                                    callback({"done":true});
                                    return {"catch" : function(){}};
                                }
                            }
                        }
                    }   
                    }};
                    //override body....
                    var handler = {
                        get: function(target, name) {
                            if(name === "body"){
                                return body;
                            }
                            return target[name];
                        }
                    };
                    var response_new = new Proxy(response, handler);
                    return callback(response_new);
                }
                return callback(response);
            });
        }
        return result;
    }}) (window.fetch);
} else {
    //disable it, so we use xmlhttprequest.
    window.fetch = null;
}


window.pdfen = require('./pdfen.js');
var internetDectector = require('./pdfenInternetDetection.js');
internetDectector(window, window.pdfen);