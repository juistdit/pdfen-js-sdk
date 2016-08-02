var PdfenTemplate = require('./pdfenTemplate.js');

module.exports = function (pdfenApi, pdfenSession, data, pdfen_secretToken){
	var id = data['template_id'];
	var name = data['name'];
	var type = data['type'];
	var user_defined = data['user_defined'];
	
	this.__update = function(data, secretToken){
		if(secretToken !== pdfen_secretToken){
			throw "Not allowed";
		}
		id = data['template_id'];
	    name = data['name'];
	    type = data['type'];
	    user_defined = data['user_defined'];
	}
	
	this.fetchTemplate = function(callback){
		var fetch_cb = function(data, statusCode, error){
            if(!(statusCode >= 200 && statusCode < 300) || error){
				callback(null, data);
				return;
			}
			var template = new PdfenTemplate(pdfenApi, pdfenSession, data, pdfen_secretToken);
			callback(template, null);
		}
		pdfenApi.GET('/sessions/' + pdfenSession.id + '/templates/' + id, fetch_cb,
			pdfenSession.language);
	}
	
	this.select = function(callbacks) {
		pdfenSession.options.loadTemplate(this, callbacks);
	}
	
	Object.defineProperties(this, {
        "id": {
             "get": function() { return id;},
        },
		"name" : {
			"get" : function() { return name;}
		},
		"type" : {
			"get" : function() { return type;}
		},
		"isUserDefined" : { 
			"get" : function() { return user_defined;}
		},
		"isSelected" : {
			"get" : function(){
				return pdfenSession.options.currentTemplate.id === id;
			}
		}
    });
}