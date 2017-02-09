//Some monkey fixes...
Uint8Array.prototype.toArrayBuffer = function () {return this.buffer;};

//this part is really ugly... but we need this to fix edge head behavior.
window.fetch_old = window.fetch
window.fetch = function () {
    var result = window.fetch_old.apply(null, arguments);
    result.then_old = result.then;
    result.then = function (callback) {
        return result.then_old(function(response) {
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
};
window.pdfen = require('./pdfen.js');