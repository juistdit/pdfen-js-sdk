module.exports = function (pdfenApi, pdfenSession, template_key){
	
	var options = {};
	var changed_options = [];
	var template_id = null;
	var disable_pull = false;
	var onChange = function(){
		
	};
	var template = null;
	
	var triggerOnChange = function () {
		onChange();
	};
	
	var getCurrentTemplate = function(){
		if(template !== null && options['template_id'] === template.id){
			return template;
		}
		return null;
	};
	
	//Clicking loadTemplate multiple times in short succession causes a lot of race conditions
	//The way to solve this is too allow only loading one template at a times
	//Once another is clicked, that one must wait until the previous is loaded
	//If a template is already waiting, than just overwrite the waiting template;
	var waiting_load_template = null;
	var template_loading = false;
	this.loadTemplate = function (val, callbacks){
		if(typeof callbacks == "undefined"){
			callbacks = {error: pdfenSession.onError, success : function(){}};
		}
		if(typeof callbacks.error == "undefined"){
			callbacks.error = pdfenSession.onError;
		}
		if(typeof callbacks.success == "undefined"){
			callbacks.success = function() {};
		}

		if(template_loading){
			if(waiting_load_template !== null) {
				//overwrite queue loadTemplate
				//notify them that it is overwritten:
				var callbacks2 = waiting_load_template[1];
				if(typeof callbacks2 )
				var message = "";
				if(pdfenSession.language === 'nl-NL'){
					message = "Het inladen van de gespecificeerde template was in conflict met het inladen van een andere template.";
				} else {
					message = "Loading the specified template was in conflict with another loadTemplate request.";
				}
				callbacks.error({"code" : 409, //HTTP conflict status code
							"message" : message});
			}
			waiting_load_template = [val, callbacks];
			return;
		}

		template_loading = true;
		var cb = {error: callbacks.error};
		cb.success = function () {
			template_loading = false;
			try {
				callbacks.success();
			} catch (err) {
				if(waiting_load_template !== null){
					var val2 = waiting_load_template[0];
					var callbacks2 = waiting_load_template[1];
					waiting_load_template = null;
					template_loading = true;
					loadTemplateDirect(val2, callbacks2);
				}
				throw err;
			}
			if(waiting_load_template !== null){
					var val2 = waiting_load_template[0];
					var callbacks2 = waiting_load_template[1];
					waiting_load_template = null;
					template_loading = true;
					loadTemplateDirect(val2, callbacks2);
			}
		}
		loadTemplateDirect(val, cb);
	}

	var loadTemplateDirect = function(val, callbacks){
		if((typeof val) !== "string"){
			val = val.id;
		}
		var old_template_id = template_id;
		var old_template = template;
		template_id = val;
		template = null;
		disable_pull = true;
		
		if(typeof callbacks == "undefined"){
			callbacks = {error: pdfenSession.onError, success : function(){}};
		}
		if(typeof callbacks.error == "undefined"){
			callbacks.error = pdfenSession.onError;
		}
		if(typeof callbacks.success == "undefined"){
			callbacks.success = function() {};
		}
		var retry = false;
		var patch_cb = function (data, statusCode) {
			if(!(statusCode >= 200 && statusCode < 300)){
				//error
				//restore old values
				template = old_template;
				template_id = old_template_id;
				disable_pull = false;
				callbacks.error(data);
				return;
			}
			
			var success_cnt = 0;
			var template_desc = pdfenSession.getTemplateDescriptionById(template_id);
			if(template_desc === null && !retry){
				retry = true;
				pdfenSession.update({success: function(){patch_cb(data, statusCode);}});
				return;
			} else if(template_desc === null){
				callbacks.error("The template did not exist!");
			}

			options['template_id'] = template_id;
			
			disable_pull = false;
			//We force fetch template our self, because this allows 2 concurrent request instead of 2 sequential requests.
			//only set the template when everything is loaded
			var template_fetched = null;
			template_desc.fetchTemplate(function(in_template, error){
				if(in_template === null){
					callbacks.error(error);
					return;
				}
				
				template_fetched = in_template;
				
				success_cnt += 1;
				if(success_cnt === 3){
					template = template_fetched;
					triggerOnChange();
					callbacks.success();
				}
			});
			var cb = {};
			cb.success = function(){
				success_cnt += 1;
				if(success_cnt === 3){
					template = template_fetched;
					triggerOnChange();
					callbacks.success();
				}
			};
			cb.error = function () {
				callbacks.error();
			}
			pull(cb, true, true);
			pdfenSession.update(cb);
		};
		var params = { template_id : template_id};
		pdfenApi.PATCH('/sessions/' + pdfenSession.id + '/options', params, patch_cb, pdfenSession.language);
	};
	
	this.getOption = function(name){
		var temp = getCurrentTemplate();
		if(temp === null || !temp.isSelected){
			throw "This object hasn't synced properly with the server";
		}
		if(!temp.hasField(name)){
			throw "No field '" + name + "' exists using the current template.";
		}
		return options[name];
	};
	
	this.setOption = function (name, val){
		var temp = getCurrentTemplate();
		if(temp === null || !temp.isSelected){
			throw "This object hasn't synced properly with the server";
		}
		
		if(!temp.hasField(name)){
			throw "The field '" + name + "' does not exist";
		}
		if(!temp.getFieldById(name).isCorrectValue(val)){
			var type = temp.getFieldById(name).type;
			throw "The value '" + val + "' was not in the format corresponding to " + type;
		}
		
		options[name] = val;
		changed_options.push(name);
	};
	
	var pull = function(callbacks, disable_changed, disable_template){
		
		if(disable_pull){
			return;
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
		
		var template_success = false;
		var options_success = false;
		var retry = false;
		var get_cb = function (data, statusCode){
			var changed;
			var reloading_template = false;
			if(!(statusCode >= 200 && statusCode < 300)){
          		//error
            	callbacks.error(data);
            	return;
            }
			var options_cpy = Object.assign({}, options);
			for (var name in data) {
    			if (!data.hasOwnProperty(name)) {
       		 		continue;
    			}
				if (changed_options.indexOf(name) === -1 && (
					!options_cpy.hasOwnProperty(name) || options_cpy[name] !== data[name])) {
					changed = true;
					if(name === 'template_id'){
						template = null;
						var template_desc = pdfenSession.getTemplateDescriptionById(data[name]);
						if(template_desc === null && !retry){
							retry = true;
							pdfenSession.update({success: function(){get_cb(data, statusCode);}, error: callbacks.error});
							return;
						} else if(template_desc === null){
							callbacks.error({ code : 0, 'message': "The template did not exist!"});
							return;
						}
						reloading_template = true;
						template_desc.fetchTemplate(function(in_template, error){
							if(in_template === null){
								callbacks.error(error);
								return;
							}
							
							if(options['template_id'] !== in_template.id){
								template = in_template;
								template_id = data['template_id'];
								options['template_id'] = data['template_id'];
								if (changed && !disable_changed) {
									triggerOnChange();
								}
							}
							options_success = true;
							if(template_success){
								callbacks.success();
							}
						});
					} else {						
						options_cpy[name] = data[name];
					}
				}
			}
			for (var name in options_cpy) {
				if (!options_cpy.hasOwnProperty(name)) {
					continue;
				}
				if (!data.hasOwnProperty(name)){
					changed = true;
					//remove it from options
					delete options_cpy[name];
				}
			}
			options = options_cpy;
			
			if(!reloading_template){
				if (changed && !disable_changed) {
					triggerOnChange();
				}
				options_success = true;
				if(template_success){
					callbacks.success();
				}
			}
		};
		var temp_cb = { };
		temp_cb.error = callbacks.error;
		temp_cb.success = function(){
			template_success = true;
			if(options_success){
				callbacks.success();
			}
		};
		if(disable_template || template === null){
			template_success = true;
		} else {
			template.update(temp_cb);
		}
		
		pdfenApi.GET('/sessions/' + pdfenSession.id + '/options', get_cb, pdfenSession.language);
	};
	
	
	this.pull = function(callbacks){
		pull(callbacks, false, false);
	};
	
	this.update = function (callbacks){
		if(typeof callbacks == "undefined"){
			callbacks = {error: pdfenSession.onError, success : function(){}};
		}
		if(typeof callbacks.error == "undefined"){
			callbacks.error = pdfenSession.onError;
		}
		if(typeof callbacks.success == "undefined"){
			callbacks.success = function() {};
		}
		
		if (changed_options.length === 0) {
			pull(callbacks, false, false);
		} else {
			var patch_cb = function (data, statusCode) {
            	if(!(statusCode >= 200 && statusCode < 300)){
            	    //error
					changed_options = [];
            	    callbacks.error(data);
					pull({error: callbacks.error, success: function(){}}, false, false);
            	    return;
            	}
				changed_options = [];
				pull(callbacks, false, false);
        	};
			var params = {};
			for (var i = 0; i < changed_options.length; i++) {
				var name = changed_options[i];
				params[name] = options[name];
			}
			pdfenApi.PATCH('/sessions/' + pdfenSession.id + '/options', params, patch_cb, pdfenSession.language);
		}
	};
	
	Object.defineProperties(this, {
        "currentTemplate": {
             "get": getCurrentTemplate
        },
		
        "onChange" : {
            "get" : function () { 
                return onChange;
            },
            "set" : function (val){
                onChange = val;
                //start the onChange loops?
            }
        }
    });
};