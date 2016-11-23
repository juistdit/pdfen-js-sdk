var PdfenTemplateField = require('./pdfenTemplateField.js');

module.exports = function (pdfenApi, pdfenSession, data, pdfen_secretToken){
	var id = data['template_id'];
	var name = data['name'];
	var type = data['type'];
	var user_defined = data['user_defined'];
	var fields = [];
	var field_map = {};
	var field;
	var pdfenTemplate = this;
	for(var i = 0; i < data['fields'].length; i++){
		field = data['fields'][i];
		field_map[field['field_id']] = new PdfenTemplateField(field, pdfen_secretToken);
		fields.push(field_map[field['field_id']]);
	}
	
	this.__update = function(data, secretToken){
		if(secretToken !== pdfen_secretToken){
			throw "Not allowed";
		}
		id = data['template_id'];
	    name = data['name'];
	    type = data['type'];
	    user_defined = data['user_defined'];
		if(typeof data['fields'] !== 'undefined'){	
			var new_fields = [];
			var new_field_map = {};
			var field;
			for(var i = 0; i < data['fields'].length; i++){
				field = data['fields'][i];
				if(fields.hasOwnProperty(field['field_id'])){
					new_field_map[field['field_id']] = fields[field['field_id']];
					new_field_map[field['field_id']].__update(field, secretToken); 
				} else{
					new_field_map[field['field_id']] = new PdfenTemplateField(field, secretToken);
				}
				new_fields.push(new_field_map[field['field_id']]);
			}
			fields = new_fields;
			field_map = new_field_map;
		}
	};
	
	this.update = function (callbacks){
		var fetch_cb = function(data, statusCode, error){
            if(!(statusCode >= 200 && statusCode < 300) || error){
				callbacks.error(data);
				return;
			}
			pdfenTemplate.__update(data, pdfen_secretToken);
			callbacks.success();
		};
		pdfenApi.GET('/sessions/' + pdfenSession.id + '/templates/' + id, fetch_cb,
			pdfenSession.language);
	};
	
	this.fetchTemplate = function(callback){
		var PdfenTemplate = module.exports;
		var fetch_cb = function(data, statusCode, error){
            if(!(statusCode >= 200 && statusCode < 300) || error){
				callback(null, data);
				return;
			}
			var template = new PdfenTemplate(pdfenApi, pdfenSession, data, pdfen_secretToken);
			callback(template, null);
		};
		pdfenApi.GET('/sessions/' + pdfenSession.id + '/templates/' + id, fetch_cb,
			pdfenSession.language);
	};
	
	this.select = function(callbacks) {
		pdfenSession.options.loadTemplate(this, callbacks);
	};
	
	this.getFieldById = function (id) {
		if(field_map.hasOwnProperty(id)){
			return field_map[id];
		}
		return null;
	};
	
	this.hasField = function(id){
		return field_map.hasOwnProperty(id);
	};
	
	Object.defineProperties(this, {
        "id": {
             "get": function() { return id;}
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
		"fields" : {
			"get" : function() { return fields.slice();}
		},
		"isSelected" : {
			"get" : function(){
				return pdfenSession.options.currentTemplate.id === id;
			}
		}
    });
};