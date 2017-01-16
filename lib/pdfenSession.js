var PdfenFile = require('./pdfenFile.js');
var PdfenOptions = require('./pdfenOptions.js');
var PdfenTemplateDescription = require('./pdfenTemplateDescription.js');
var PdfenGeneratedFile = require('./pdfenGeneratedFile.js');
var pdfenExponentialBackoff = require('./pdfenExponentialBackoff.js');
var pdfenSmartInterval = require('./pdfenSmartInterval.js');
var pdfen = require('./pdfen.js');
var interval_settings = {
	min_polling_interval: 800,
	fast_exponent : 2.2,
	max_fast_polling_interval : 1000,
	max_slow_polling_interval : 2000,
	slow_exponent : 1.1
};
var max_long_pull_timeout = 10000;

module.exports = function (pdfenApi){
	//constructor for pdfenSession
	var pdfenSession = this;
	var id = null;
	var files = [];
	var deleted_files = [];
	var self = this;
	var remote_ordering = [];
	var local_ordering = [];
	var onOrderingChanged = [];
	var disableUpdates = 0;
	var onErrorCallback = function(){};
	var onProcessCallback = null;
	var language = "en-US";
	var templates = [];
	var template_map = {};
	var license = null;
	var configuration = null;
	
	var options = new PdfenOptions(pdfenApi, this);
	
	var triggerOnOrderingChange = function (){
		//check if the current options is correctly synced
		if(options.currentTemplate === null){
			//retry later
			setTimeout(triggerOnOrderingChange, 10);
			return;
		}
        if(typeof onOrderingChanged === "function"){
            onOrderingChanged(local_ordering);
        } else {
            for(var i = 0; i < onOrderingChanged.length; i++){
                onOrderingChanged[i](local_ordering);
            }
        }
    };
	
	var makeRawOrdering = function (ordering){
		if (Array.isArray(ordering)) {
			var new_ordering = [];
			for(var i = 0; i < ordering.length; i++){
				new_ordering.push(makeRawOrdering(ordering[i]));
			}	
			return new_ordering;
		} else if (Array.isArray(ordering.children)) {
			var new_ordering = {};
			new_ordering.title = ordering.title;
			new_ordering.children = makeRawOrdering(ordering.children);
			return new_ordering;
		} else {
			return ordering.id;
		}
	};
	
	var setOrdering = function(ordering, callbacks){
		//todo... is this needed?
		ordering = makeRawOrdering(ordering.slice());
		var ordering_cb = function (data, statusCode){
			//update is mandatory in this case (otherwise the ordering is not uptodate).
			disableUpdates--;
            if(statusCode >= 200 && statusCode < 300){
                self.update(callbacks);
            } else {
				if(typeof callbacks !== 'undefined' && 'error' in callbacks){
					callbacks.error(data)
				} else {
					onErrorCallback(data);
				}
            }
		};
		pdfenApi.PUTdata('/sessions/' + id + '/ordering', ordering, ordering_cb, language);
		//local_ordering = ordering; The update will callback will take care of this.
		disableUpdates++; 
	};
	this.setOrdering = setOrdering;
	
	//subclasses, bound to this session
	//use emptyObject instead of null, to support polyfill bind
	//A fix for browsers that do not support bind
	var emptyObject = {};
	var secretToken = Math.random();
	this.File = PdfenFile.bind(emptyObject, pdfenApi, this, secretToken, files, deleted_files, []);
	
	
	//log in by loading an existing session
	this.load = function (id_in, callbacks) {
		if(id !== null){
			throw "This session is already logged in."
		}
		id = id_in;
		var success = 0;
		var cb = {};
		cb.success = function (){
			success += 1;
			if(success === 4 && typeof callbacks !== 'undefined' && 'success' in callbacks){
				callbacks.success();
			}
		};
		cb.error = function (data) {
			if(typeof callbacks !== 'undefined' && 'error' in callbacks){
				callbacks.error(data)
			} else {
				onErrorCallback(data);
			}
		};
		this.update(cb);
		options.pull(cb);
		loadSessionSettings(cb);
		loadConfiguration(cb);
	};
	
	var loadSessionSettings = function (callbacks) {
		var session_cb = function(data, statusCode, error){
            if(!(statusCode >= 200 && statusCode < 300) || error){
				callbacks.error(data);
				return;
			}
			license = data['license'];
			callbacks.success();
		};
		pdfenApi.GET('/sessions/' + id, session_cb, language);
	};

	var loadConfiguration = function (callbacks) {
		var session_cb = function(data, statusCode, error){
            if(!(statusCode >= 200 && statusCode < 300) || error){
				callbacks.error(data);
				return;
			}
			configuration = Object.seal(data);
			callbacks.success();
		};
		pdfenApi.GET('/configuration', session_cb, language);
	}
	
	
	// callbacks is an object containing
	// success (optional)
	// error (optional)
	this.login = function(username, password, callbacks){
		if(id !== null){
			throw "This session is already logged in.";
		}
		var post_cb = function(data, statusCode){
            if(!(statusCode >= 200 && statusCode < 300)){
                callbacks.error(data);
                return;
            }
			
			this.load(data.session_id, callbacks);
		};
		pdfenApi.POST('/sessions', {username: username, password: password}, post_cb, language);
	};
	
	this.update = function (callbacks){
		if(typeof callbacks == "undefined"){
			callbacks = {error: onErrorCallback};
		}
		if(typeof callbacks.error == "undefined"){
			callbacks.error = onErrorCallback;
		}

		if(typeof skipUpdateTemplates === "undefined") {
			skipUpdateTemplates = false;
		}


		var ordering_done = false;
		var files_done = false;
		var raw_ordering = null;
		var raw_files = null;
		var templates_done = false;
		var session_done = false;
		if(disableUpdates > 0){
			return;
		}
		var transformOrdering = function(ordering){
			if(Array.isArray(ordering.children)){
                ordering.children = transformOrdering(ordering.children);
                return ordering;
            } else if(Array.isArray(ordering)) {
				var result = [];
				var transform = null;
				for(var i = 0; i < ordering.length; i++){
					transform = transformOrdering(ordering[i]);
					if(transform !== null){
						result.push(transform);
					}
				}
                ordering = result;
				return ordering;
			} else {
				for (var j = 0; j < files.length; j++){
					if(files[j].id === ordering){
						return files[j];
					}
				}
				return null;
			}
		};
		
		var compareAndTriggerOrdering = function (old_ordering, new_ordering, trigger){
			if(Array.isArray(old_ordering) !== Array.isArray(new_ordering)){
				trigger();
				return true;
			}
			
			if(Array.isArray(old_ordering)){
				if(old_ordering.length !== new_ordering.length){
					trigger();
					return true;
				}
				for(var i = 0; i < old_ordering.length; i++){
					if(compareAndTriggerOrdering(old_ordering[i], new_ordering[i], trigger)){
						return true;
					}
				}
			} else if(old_ordering.id !== new_ordering.id){
				trigger();
				return true; 
			}
			     
            if(Array.isArray(old_ordering.children) !== Array.isArray(new_ordering.children)){
                trigger();
                return true;
			} else if (Array.isArray(old_ordering.children)) {
				if(old_ordering.title !== new_ordering.title) {
					trigger();
					return true;
				}
                if (compareAndTriggerOrdering(old_ordering.children, new_ordering.children, trigger)) {
                    return true;
                }
            }
           
			return false;
		};
		
		var update_cb = function(){
			//update the files and set the properties correctly.
			//and set the changed values to false.
			for(var i = 0; i < raw_files.length; i++){
				var file_exists = false;
				for (var j = 0; j < files.length; j++){
					if(files[j].id === raw_files[i].file_id){
						file_exists = true;
						//update
						var warnings_is_same = (files[j].warnings.length == raw_files[i].warnings.length) && files[j].warnings.every(function(element, index) {
    						return element === raw_files[i].warnings[index]; 
						});
						if(files[j].title !== raw_files[i].title ||
							files[j].extension !== raw_files[i].extension || !warnings_is_same){
							files[j].__pushServerUpdate(secretToken, raw_files[i].file_settings.title, raw_files[i].file_settings.extension, raw_files[i].warnings);
						}
					}
				}
                //We do not show any partial files that we did not create, they will only show up when the files are
                //completely uploaded.
                //This hides the two step upload of the API from the user
               if(!file_exists && !raw_files[i].partial && deleted_files.indexOf(raw_files[i].file_id) == -1){
					var f = new PdfenFile(pdfenApi, self, secretToken, files, deleted_files, raw_files[i].warnings, raw_files[i].file_id);
					files[j].__pushServerUpdate(secretToken, raw_files[i].file_settings.title, raw_files[i].file_settings.extension, raw_files[i].warnings);
				}
			}
			for(var j = 0; j < files.length; j++) {
				var found = false;
				for (var i = 0; i < raw_files.length; i++){
					found = found || files[j].id === raw_files[i].file_id;
				}
				//bug the files callback does not know about files that were created while this callback was processed...
				//so we should detect these problems.
				if(!found && files[j].id !== null && files[j].__creationTime(secretToken) < request_time){
					files[j].__pushDeletion(secretToken);
				}
			}
			var new_ordering = transformOrdering(raw_ordering.slice());
			var old_ordering = remote_ordering;
			remote_ordering = new_ordering;
			local_ordering = new_ordering;
			compareAndTriggerOrdering(old_ordering, new_ordering, triggerOnOrderingChange);
			session_done = true;
			if(typeof callbacks !== 'undefined' && 'success' in callbacks && templates_done){
				callbacks.success();
			}
		};
		
		var ordering_cb = function(data, statusCode){
            if(!(statusCode >= 200 && statusCode < 300)){
				callbacks.error(data);
				return;
			}
			raw_ordering = data;
			ordering_done = true;
			if(files_done){
				update_cb();
			}
		};
		
		var files_cb = function(data, statusCode, error){
            if(!(statusCode >= 200 && statusCode < 300) || error){
				callbacks.error(data);
				return;
			}
			raw_files = data;
			files_done = true;
			if(ordering_done){
				update_cb();
			}
		};
		var request_time = new Date().valueOf();
		pdfenApi.GET('/sessions/' + id + '/ordering', ordering_cb, language);
		pdfenApi.GET('/sessions/' + id + '/files', files_cb, language);
		var cb  = {};
		cb.error = callbacks.error;
		cb.success = function () {
			templates_done = true;
			if (session_done && typeof callbacks !== 'undefined' && 'success' in callbacks) {
				callbacks.success();
			}
		};
		updateTemplates(cb);
	};
	//callbacks is an object containing:
	//  completed (optional)
	//  progress (optional)
	//  error (optional)
	this.generatePdf = function(options, callbacks) {
		if(id === null){
			throw "Please login to generate a pdf.";
		}
		//check everything is uploaded.
		var validFiles = this.validFiles;
		for(var i = 0; i < validFiles.length; i++){
			if(validFiles[i].isUploading){
				//TODO make some kind of locale for the sdk.
				if(language === 'nl-NL'){
					if(typeof callbacks === 'undefined' || typeof callbacks.error === 'undefined'){
						onErrorCallback({ message : "Alle bestanden zijn nog niet correct geüpload."});
					} else {
						callbacks.error({ message : "Alle bestanden zijn nog niet correct geüpload."});
					}
				} else {
					if(typeof callbacks === 'undefined' || typeof callbacks.error === 'undefined'){
						onErrorCallback({ message : "Not all files were correctly uploaded yet."});
					} else {
						callbacks.error({ message : "Not all files were correctly uploaded yet."});
					}
				}
				return;
			}
		}
		var triggerOnProcessCallback = function(type, data){
			if(onProcessCallback !== null && typeof onProcessCallback !== "undefined"){
				onProcessCallback(type, data);
			}
		}
		var generate_cb;
		if (typeof callbacks == 'undefined'){
			callbacks = {};
		}
		if(typeof callbacks.success === 'undefined') {
			callbacks.success = function () {};
		}
		if(typeof callbacks.progress === 'undefined'){
			callbacks.progress = function () {};
		}
		var update_counter = 0;
		//we will handle all event handling ourselves
		updateProcess_blocked_by_gen_PDF = true;
		
		if(typeof callbacks.updatePreviousLine === 'undefined') {
			callbacks.updatePreviousLine = function() {};
		}
		
		if(typeof callbacks.error === 'undefined'){
			callbacks.error = onErrorCallback;
		}
		if(typeof callbacks.progressError === 'undefined'){
			callbacks.progressError = onErrorCallback;
		}
		var generate_cb = null;
		var fetchUpdates = function (proc_id) {
			pdfenApi.GET("/sessions/"+id+"/processes/" + proc_id + "?noredirect&" +
							"long_pull_timeout=" + max_long_pull_timeout + 
							"&update_counter=" + update_counter, generate_cb, language);
		};
		var process_created = false;
		generate_cb = function (data, statusCode) {
			if(!(statusCode >= 200 && statusCode < 300) ||
				(data !== null && 'process_result' in data && data.process_result.status === "ERROR")){
				if(data !== null && 'process_result' in data){
					if(data.process_result.messages.length > 1) {
						var msg = "<ul><li>" + data.process_result.messages.join("</li><li>") + "</li></ul>";
						callbacks.error({ message: msg });
					} else {
						callbacks.error({ message: data.process_result.messages[0] });
					}
					updateProcess_blocked_by_gen_PDF = false;
					return;
				} else if(!process_created) {
					callbacks.error(data);
				} else {
					callbacks.progressError(data);
				}
			} else {
				process_created = true;
				//an update
				if ('process_progress' in data) {
					if ('previous_line' in data.process_progress) {
						callbacks.updatePreviousLine(data.process_progress.previous_line);
						triggerOnProcessCallback("update_previous_line", data.process_progress.previous_line);
					}
					if(data.process_progress.lines.length > 0){
						callbacks.progress(data.process_progress.lines);
						triggerOnProcessCallback("progress", data.process_progress.lines);
					}
					update_counter = data.process_progress.update_counter;
				}
				
				if ('process_result' in data) {
					//enable the updateProcess routines again.
					updateProcess_blocked_by_gen_PDF = false;
					var file = new PdfenGeneratedFile(pdfenApi, pdfenSession, data.process_result.url)	
					if ('success' in callbacks) {
						callbacks.success(file);
					}
					triggerOnProcessCallback("done", file);
				} else {
					setTimeout(function(){
						fetchUpdates(data['process_id']);
					}, interval_settings.min_polling_interval);
				}
			}
		};
		pdfenApi.POST('/sessions/'+id+'/processes?update_counter=0', {process_settings: {process_synchronous : false, immediate : true, title : "My document"}}, generate_cb, language);
	};
	
	var updateHandle;
	this.getFileById = function (id_in){
		var filtered = files.filter(function(value){return value.id === id_in;});
		if(filtered.length > 0){
			return filtered[0];
		}
		return null;
	};
	
	var up_process_done = true;
	var up_process_id = null;
	var up_progress_counter = 0;
	var up_updateProcess_blocked = false;
	var update_process_timeouts = 0;
	var updateProcess_blocked_by_gen_PDF = false;
	var updateProcess = function(input_data, input_status_code) {
		if(onProcessCallback === null || typeof onProcessCallback === "undefined" ||
		 up_updateProcess_blocked || updateProcess_blocked_by_gen_PDF){
			return;
		}
		var cb = function (data, statusCode) {
			var fetch_prev_process = function(){
				up_updateProcess_blocked = true;
				var int_cb = function (data, statusCode){
					up_process_done = true;
					up_updateProcess_blocked = false;
					up_progress_counter = 0;
					if (!(statusCode >= 200 && statusCode < 300)) {
						onProcessCallback("error", {code : statusCode, message : data.process_result.messages.join("\n")});
					}
					if(!('process_result' in data)){
						throw "The old process had no error but also wasn't done, this cannot happen.";
					}
					if(onProcessCallback === null){
						return;
					}
					if('process_progress' in data){
						if('previous_line' in data.process_progress){
							onProcessCallback("update_previous_line", data.process_progress.previous_line);
						}
						if(data.process_progress.lines.length > 0){
							onProcessCallback("progress", data.process_progress.lines);
						}
					}
					if('process_result' in data){
						onProcessCallback("done", new PdfenGeneratedFile(pdfenApi, pdfenSession, data.process_result.url));
					}
				};
				pdfenApi.GET("/sessions/"+id+"/processes/" + up_process_id +
								"?update_counter=" + up_progress_counter,int_cb, language);
			};
			up_updateProcess_blocked = false;
			if (!(statusCode >= 200 && statusCode < 300)) {
				if(data !== null && 'process_result' in data) {
					up_process_id = null;
					up_progress_counter = 0;
					onErrorCallback(data);
					return;
				}
				if(statusCode === 404){
					//No active process exists.
					if(!up_process_done && up_process_id !== null){
						fetch_prev_process();
					}
					return;
				}
				//else a normal error we just ignore this for now
				return;
			}
			if (up_process_id !== data['process_id']) {
				//handle change
				if(!up_process_done){
					fetch_prev_process();
					return;
				} else {
					up_process_id = data['process_id'];
					up_process_done = false;
					onProcessCallback("new", up_process_id);
					if(up_progress_counter !== 0){
						up_progress_counter = 0;
						updateProcess();
						return;
					}
				}
			}
			if('process_progress' in data){
				if('previous_line' in data.process_progress){
					onProcessCallback("update_previous_line", data.process_progress.previous_line);
				}
				if(data.process_progress.lines.length > 0){
					onProcessCallback("progress", data.process_progress.lines);
				}
				up_progress_counter = data.process_progress.update_counter;
			}
			if('process_result' in data){
				up_process_done = true;
				up_progress_counter = 0;
				onProcessCallback("done", new PdfenGeneratedFile(pdfenApi, pdfenSession, data.process_result.url));
			} else {
				if(update_process_timeouts > 0){
					return;//a timeout is already set.
				}
				update_process_timeouts++;
				setTimeout(function(){
					update_process_timeouts--;
					updateProcess();
				}, interval_settings.min_polling_interval);
			}
		};
		if(typeof input_data === "undefined"){
			up_updateProcess_blocked = true;
			pdfenApi.GET("/sessions/"+id+"/current-process?noredirect&" +
								"long_pull_timeout=" + max_long_pull_timeout + 
								"&update_counter=" + up_progress_counter, cb, language);
		} else {
			cb(input_data, input_status_code)
		}
	};
	
	this.enableExternalEvents = function (){
		//STUB
		var handler = function ()
		{
			pdfenSession.update({success: function(){pdfenSession.options.pull();} });
			if(update_process_timeouts == 0){// no timeouts are running
				updateProcess();	
			}
		};
		setTimeout(handler, 0);
		updateHandle = pdfenSmartInterval(handler, 5000, 10000, 30);
	};
	
	this.disableExternalEvents = function () {
		clearInterval(updateHandle);
	};
	
	this.getTemplateDescriptionById = function (id){
		if(template_map.hasOwnProperty(id)){
			return template_map[id];
		}
		return null;
	};
	
	this.clone = function (callbacks) {
		if(id === null){
			throw "The session has not yet been created.";
		}
		if(typeof callbacks === 'undefined'){
			cb.error = function (data) {
				if(typeof callbacks !== 'undefined' && 'error' in callbacks){
					callbacks.error(data)
				} else {
					onErrorCallback(data);
				}
			};
		}
		var post_cb = function(data, statusCode){
            if(!(statusCode >= 200 && statusCode < 300) || !('session_id' in data)) {
                if(typeof callbacks !== 'undefined' && 'error' in callbacks){
					callbacks.error(data)
				} else {
					onErrorCallback(data);
				}
                return;
            }
			var clone = new module.exports(pdfenApi);
			var cb = {};
			cb.success = function (){
				if(typeof callbacks !== 'undefined' && 'success' in callbacks){
					callbacks.success(clone);
				}
			};
			cb.error = function (data) {
				if(typeof callbacks !== 'undefined' && 'error' in callbacks){
					callbacks.error(data)
				} else {
					onErrorCallback(data);
				}
			};
			clone.load(data['session_id'], cb)
		};
		
		pdfenApi.POST('/sessions', {source_id: id}, post_cb, language);
	}
	
	this._canUploadFileType = function (type){
		type = type.toLowerCase();
		var file;
		var extension;
		for(var i = 0; i < files.length; i++){
			file = files[i];
			if(!file.isUploading && !file.isUpdating && file.id === null){
				continue;
			}
			extension = file.extension.toLowerCase();
			if(extension === 'pst' && type !== 'pst'){
				return false;
			} else if (extension === 'zip' && type !== 'zip'){
				return false;
			} else if ((extension !== 'zip'  && extension !== 'pst') && (type === 'zip' || type === 'pst')){
				return false;
			}
		}
		return true;
	};
	
	var updateTemplates = function(callback){
		if (typeof callbacks == 'undefined'){
			callbacks = {};
		}
		if(typeof callbacks.success === 'undefined') {
			callbacks.success = function () {};
		}
		if(typeof callbacks.error === 'undefined'){
			callbacks.error = onErrorCallback;
		}
		var templates_cb = function(data, statusCode){
            if(!(statusCode >= 200 && statusCode < 300)){
				callbacks.error(data);
				return;
			}
			// do something with the templates
			//array('template_id' => $template_id, 'name' => $name, 'type' => $type,
            //       'user_defined' => $userDefined);
			var new_templates = [];
			var new_template_map = {};
			var temp_data;
			var temp;
			for(var i = 0; i < data.length; i++){
				temp_data = data[i];
				if(template_map.hasOwnProperty(temp_data['template_id'])){
					temp = template_map[temp_data['template_id']];
					temp.__update(temp_data, secretToken);
				} else {
					temp = new PdfenTemplateDescription(pdfenApi, pdfenSession, temp_data, secretToken);
				}
				new_templates.push(temp);
				new_template_map[temp_data['template_id']] = temp;
				if(options.currentTemplate !== null && options.currentTemplate.id === temp_data['template_id']){
					options.currentTemplate.__update(temp_data, secretToken);
				}
			}
			template_map = new_template_map;
			templates = new_templates;
			callback.success();
		};
		pdfenApi.GET('/sessions/' + id + '/templates', templates_cb, language);
	};
	
	//Lets define the special properties (readonly, etc..)
	Object.defineProperties(this, {
        "id": {
             "get": function() { return id;}
        },
		"files" : {
			"get" : function () { return files.slice(); }
		},
		"validFiles" : {
			"get" : function () { return files.filter(function(file) { return file.exists;});}
		},
		"options" : {
			"get" : function () { return options;}
		},
		"configuration" : {
			"get" : function () { return configuration;/*Is sealed, no slice needed.*/}
		},
		"templateDescriptions" : {
			"get" : function () { return templates.slice();}
		},
		"ordering" :{
			"get" : function() { return local_ordering.slice(); },
			"set" : function(val) { return setOrdering(val, {success : function(){}})}
		},
		"language" : {
			"get" : function(){ return language;},
			"set" : function(val) { language = val;}
		},
		"onOrderingChanged" : {
			"get" : function() { return onOrderingChanged;},
			"set" : function(val) { onOrderingChanged = val;}
		},
		"onProcessUpdate" : {
			"get" : function() { return onProcessCallback; },
			"set" : function(val) { onProcessCallback = val;}
		},
		"onError" : {
			"set" : function(val){ onErrorCallback = val;},
			"get" : function(){ return onErrorCallback;}
		},
		"license" : {
			"get" : function() { return license; }
		}
    });
};