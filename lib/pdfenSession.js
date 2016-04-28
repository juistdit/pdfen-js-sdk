var PdfenFile = require('./pdfenFile.js');

var pdfenExponentialBackoff = require('./pdfenExponentialBackoff.js');
var pdfenSmartInterval = require('./pdfenSmartInterval.js');

var interval_settings = {
	min_polling_interval: 100,
	fast_exponent : 2.2,
	max_fast_polling_interval : 1000,
	max_slow_polling_interval : 5000,
	slow_exponent : 1.1
}

module.exports = function (pdfenApi){
	//constructor for pdfenSession
	var id = null;
	var files = [];
	var self = this;
	var remote_ordering = [];
	var local_ordering = [];
	var onOrderingChanged = [];
	var disableUpdates = 0;
	var onErrorCallback = function(){};
	var language = "en-US";
	var triggerOnOrderingChange = function (){
        if(typeof onOrderingChanged === "function"){
            onOrderingChanged(local_ordering);
        } else {
            for(var i = 0; i < onOrderingChanged.length; i++){
                onOrderingChanged[i](local_ordering);
            }
        }
    }
	
	var makeRawOrdering = function (ordering){
		if (Array.isArray(ordering)) {
			for(var i = 0; i < ordering.length; i++){
				ordering[i] = makeRawOrdering(ordering[i]);
			}	
			return ordering;
		} else if (Array.isArray(ordering.children)) {
			ordering.children = makeRawOrdering(ordering.children);
			return ordering;
		} else {
			return ordering.id;
		}
	}
	
	var setOrdering = function(ordering, callbacks){
		//todo... is this needed?
		ordering = makeRawOrdering(ordering.slice());
		var ordering_cb = function (data, statusCode){
			//update is mandatory in this case (otherwise the ordering is not uptodate).
			disableUpdates--;
            if(statusCode >= 200 && statusCode < 300){
                self.update(callbacks);
            } else {
                //error
                callbacks.error(data);
            }
		}
		pdfenApi.PUTdata('/sessions/' + id + '/ordering', ordering, ordering_cb, language);
		//local_ordering = ordering; The update will callback will take care of this.
		disableUpdates++; 
	}
	
	//subclasses, bound to this session
	//use emptyObject instead of null, to support polyfill bind
	//A fix for browsers that do not support bind
	var emptyObject = {};
	var secretToken = Math.random();
	this.File = PdfenFile.bind(emptyObject, pdfenApi, this, secretToken, files);
	
	
	//log in by loading an existing session
	this.load = function (id_in, callbacks) {
		if(id !== null){
			throw "This session is already logged in."
		}
		id = id_in;
		this.update(callbacks);
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
			if('session_id' in data){
				id = data.session_id;
			}
			if (typeof callbacks !== 'undefined' && 'success' in callbacks && 'session_id' in data){
				callbacks.success();
			}
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
		var ordering_done = false;
		var files_done = false;
		var raw_ordering = null;
		var raw_files = null;
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
		}
		
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
                if (compareAndTriggerOrdering(old_ordering.children, new_ordering.children, trigger)) {
                    return true;
                }
            }
           
			return false;
		}
		
		var update_cb = function(){
			//update the files and set the properties correctly.
			//and set the changed values to false.
			for(var i = 0; i < raw_files.length; i++){
				var file_exists = false;
				for (var j = 0; j < files.length; j++){
					if(files[j].id === raw_files[i].file_id){
						file_exists = true;
						//update
						if(files[j].title !== raw_files[i].title ||
							files[j].extension !== raw_files[i].extension){
							files[j].__pushServerUpdate(secretToken, raw_files[i].title, raw_files[i].extension);
						}
					}
				}
                //We do not show any partial files that we did not create, they will only show up when the files are
                //completely uploaded.
                //This hides the two step upload of the API from the user
               if(!file_exists && !raw_files[i].partial){
					var f = new PdfenFile(pdfenApi, self, secretToken, files, raw_files[i].file_id);
					f.title = raw_files[i].title;
					f.extension = raw_files[i].extension;
				}
			}
			var new_ordering = transformOrdering(raw_ordering.slice());
			var old_ordering = remote_ordering;
			remote_ordering = new_ordering;
			local_ordering = new_ordering;
			compareAndTriggerOrdering(old_ordering, new_ordering, triggerOnOrderingChange);
		}
		
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
		}
		
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
		}
		
		pdfenApi.GET('/sessions/' + id + '/ordering', ordering_cb, language);
		pdfenApi.GET('/sessions/' + id + '/files', files_cb, language);
	}
	//callbacks is an object containing:
	//  completed (optional)
	//  progress (optional)
	//  error (optional)
	this.generatePdf = function(options, callbacks){
		if(id === null){
			throw "Please login to generate a pdf.";
		}
		var generate_cb;
		if(typeof callbacks !== 'undefined' && 'progress' in callbacks){
			//In this mode we need to poll the progress so we can update the progress callbacks
			var process_id;
			var progress_line = 0;
			var interval_function = pdfenExponentialBackoff(interval_settings);
			//This is called after a poll result is given by the API.
			var request_cb = function(data, statusCode){
                if(!(statusCode >= 200 && statusCode < 300)){
                    if(data !== null && 'process_result' in data){
						if(data.process_result.messages.length > 1) {
							callbacks.error("<ul><li>" + data.process_result.messages.join("</li><li>") + "</li></ul>");
						} else {
							callbacks.error(data.process_result.messages[0]);
						}
                        return;
                    } else {
                        callbacks.progressError(data);
                        //just continue here... maybe just a simple timeout.
                    }
                } else {
					for(var i = 0; i < data.process_progress.length; i++){
						callbacks.progress(data.process_progress[i]);
						progress_line++;
					}
				}
				if('process_result' in data){
					if('success' in callbacks){
						callbacks.success({url: data.process_result.url});
					}
				} else {
					//Continue polling the request
					var delay = interval_function(data.process_progress.length !== 0)
					setTimeout(request_progress, delay);	
				}
			}
			var request_progress = function (){
				//Poll a new progress update and send the data to request_cb
				pdfenApi.GET('/sessions/'+id+'/processes/'+process_id + '?start='+progress_line, request_cb, language);
			}
			//This is called after the process is started.
			generate_cb = function (data, statusCode) {
                if(!(statusCode >= 200 && statusCode < 300)){
                    callbacks.error(data);
                    return;
                }
				if('process_id' in data){
					process_id = data.process_id;
				}
				//Initiate polling. If the server gives a progress output directly: just process it directly
				//Otherwise request the progress without any delay.
				if('process_progress' in data && data.process_progress.length > 0){
					request_cb(data);	
				} else {
					request_progress();
				}
			}
			pdfenApi.POST('/sessions/'+id+'/processes', {process_settings: {process_synchronous : false, immediate : true, title : "My document"}}, generate_cb, language);
		} else {
			generate_cb = function (data, statusCode) {
                if(!(statusCode >= 200 && statusCode < 300)){
                    callbacks.error(data);
                    return;
                }
				if (typeof callbacks !== 'undefined' && 'success' in callbacks && 'process_result' in data && 'url' in data.process_result){
					callbacks.success(data.process_result.url);
				}
			}
			pdfenApi.POST('/sessions/'+id+'/processes', {process_settings : {title : "My document", process_synchronous : true}}, generate_cb, language);
		}
	};
	
	var updateHandle;
	this.getFileById = function (id_in){
		var filtered = files.filter(function(value){return value.id === id_in;});
		if(filtered.length > 0){
			return filtered[0];
		}
		return null;
	};
	
	this.enableExternalEvents = function (){
		//STUB
		updateHandle = pdfenSmartInterval(this.update, 5000, 10000, 30);
	};
	
	this.disableExternalEvents = function () {
		clearInterval(updateHandle);
	};
	
	//Lets define the special properties (readonly, etc..)
	Object.defineProperties(this, {
        "id": {
             "get": function() { return id;},
        },
		"files" : {
			"get" : function () { return files.slice(); },
		},
		"validFiles" : {
			"get" : function () { return files.filter(function(file) { return file.id !== null;});}
		},
		"ordering" :{
			"get" : function() { return local_ordering.slice(); },
			"set" : function(val) { return setOrdering(val, {success : function(){}})}
		},
		"language" : {
			"get" : function(){ return language;},
			"set" : function(val) { language = val;}
		},
		"onOrderingChanged" :{
			"get" : function() { return onOrderingChanged;},
			"set" : function(val) { onOrderingChanged = val;}
		},
		"onError" : {
			"set" : function(val){ onErrorCallback = val;}
		}
    });
}