module.exports = function (pdfenApi, pdfenSession, url){
	
	this.download = function (callbacks, target){
		var rUrl = pdfenApi.stripUrl(url);
		if(typeof target == "undefined"){
			target = null;
		}
		if(typeof callbacks == "undefined"){
			callbacks = {error: pdfenSession.onError, success : function(){}};
		}
		if(typeof callbacks.error == "undefined"){
			callbacks.error = pdfenSession.onError;
		}
		if(typeof callbacks.success == "undefined"){
			callbacks.success = function() {};
		}
		var head_cb = function (data, statusCode){
			if(!(statusCode >= 200 && statusCode < 300)){
          		//error
				var error_cb = function(data, statusCode){
					callbacks.error(data);
				};
				pdfenApi.GET(rUrl, error_cb, pdfenSession.language);
            	return;
            } else {
				var target = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/g.exec(data['content-disposition'])[1];
				pdfenApi.download(rUrl, target, function() { callbacks.success()}, pdfenSession.language);
			}
		};
		pdfenApi.HEAD(rUrl, head_cb, pdfenSession.language);
	};
	
	Object.defineProperties(this, {
        "url": {
             "get": function(){return url;}
        }
    });
};