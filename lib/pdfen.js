if (!Object.assign) {
  Object.defineProperty(Object, 'assign', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function(target) {
      'use strict';
      if (target === undefined || target === null) {
        throw new TypeError('Cannot convert first argument to object');
      }

      var to = Object(target);
      for (var i = 1; i < arguments.length; i++) {
        var nextSource = arguments[i];
        if (nextSource === undefined || nextSource === null) {
          continue;
        }
        nextSource = Object(nextSource);

        var keysArray = Object.keys(nextSource);
        for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
          var nextKey = keysArray[nextIndex];
          var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
          if (desc !== undefined && desc.enumerable) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
      return to;
    }
  });
}

var https = require( "https" );

var settings = {
	api_host : 'www.pdfen.com',
	api_root_path : "/api/v1",
	upload_buffer_size : 4096,
	smoothing_factor : 0.01
}

var pdfenSession = require('./pdfenSession.js');

var PUTfile = function (path, content, callback, progress, language){
		var content_length = content.size;
		//Implementation using XMLHttpRequest: browser only!
		var request = new XMLHttpRequest();
		var url = 'https://' + settings.api_host + settings.api_root_path + path;
		request.open("PUT", url, true);
		request.setRequestHeader('Content-Type', 'application/octet-stream; charset=binary');
		request.setRequestHeader('accept-language', language);
		var starttime = new Date().getTime();
		var last_time = starttime;
		var last_send = 0;
		var upload_speed = 0;
		var state = 0;
		var smoothing_factor = 0.25;
		var evt_send = null;
		var evt_total = null;
		var maxstate = 0;
		var upload_progress_interval = setInterval(
				function(){
					if(evt_send !== null && evt_total !== null){
						var send = evt_send
						if(send > content_length - 100){
							send = content_length - 100;
						}
						var current_time = new Date().getTime();
						var speed = (send - last_send) / (current_time - last_time) * 1000;
						upload_speed = smoothing_factor * speed + (1- smoothing_factor) * upload_speed;
						smoothing_factor = (smoothing_factor + settings.smoothing_factor) / 2; 
						if(state === 4){
							progress({
								send : send,
								total : content_length,
								average_speed : send / (current_time - starttime) * 1000,  
								current_speed : upload_speed
							});
						}
						state = (state + 1) % (maxstate + 1);
            			if(maxstate < 4){
              				maxstate++;
            			}
						last_send = send;
						last_time = current_time;
						}
				}, 50);
		request.upload.onprogress = function (e){
			evt_send = e.loaded;
			evt_total = e.total;
		}
		request.onreadystatechange = function (oEvent) {  
    		if (request.readyState === 4) {
				var current_time = new Date().getTime();
				clearInterval(upload_progress_interval);
				progress({send : evt_total,
					total : evt_total,
					average_speed : content_length / (current_time - starttime) * 1000,  
					current_speed : 0});
				var data = null;
				try {
        			data = JSON.parse(request.response);
    			} catch (e) {
        			data = null;
   				}
				callback(request.status >= 200 && request.status < 300, data);
			}
    	};
		request.send(content);
		return {request_type : "XmlHttpRequest", request : request};
}; 

var request_buffer = [];
	
var PUTpath = function (path, content, callback, progress, language){
		var fs = require('fs');
		var request_id = request_buffer.length;
		request_buffer.push(null);
		var result = {request_type : "node", request : request_id};
		fs.stat(content, function (stat_err, stat) {
			if(request_buffer[request_id] === false){//aborted
				return;
			}
			if(stat_err){
				throw "The given file could not be found";
			}
			var content_length = stat.size;
			var put_options = {
				hostname: settings.api_host,
				path: settings.api_root_path + path,
				method: 'PUT',
				protocol: 'https:',//Seems to be required for browserify
				headers: {
					'Content-Type' : 'application/octet-stream; charset=binary',
					'Content-Length' : content_length,
					'accept-language' : language
					}
			};
			var upload_progress_interval;
			var starttime = new Date().getTime();
			var registerResponseHandlers = function(response) {
				var data = '';

  				response.on('data', function (chunk) {
    				data += chunk;
  				});
		  		response.on('end', function () {
					clearInterval(upload_progress_interval);
					var current_time = new Date().getTime();
					progress({send : content_length,
						total : content_length,
						average_speed : content_length / (current_time - starttime) * 1000,  
						current_speed : 0});
		    		callback(response.statusCode >= 200 && response.statusCode < 300);
		  		});
			};
			var put_req = https.request(put_options, registerResponseHandlers);
			var last_time = starttime;
			var last_send = 0;
			var upload_speed = 0;
			var state = 0;
			var maxstate = 0;
			var smoothing_factor = 0.25;
			upload_progress_interval = setInterval(
				function(){
					if(typeof put_req.connection !== "undefined" && 
						typeof put_req.connection._bytesDispatched === "number"){
						var send = put_req.connection._bytesDispatched;
						if(send > content_length - 100){
							send = content_length - 100;
						}
						var current_time = new Date().getTime();
						var speed = (send - last_send) / (current_time - last_time) * 1000;
						upload_speed = smoothing_factor * speed + (1- smoothing_factor) * upload_speed;
						smoothing_factor = (smoothing_factor + settings.smoothing_factor) / 2; 
						if(state === 4){
							progress({
								send : send,
								total : content_length,
								average_speed : send / (current_time - starttime) * 1000,  
								current_speed : upload_speed
							});
						}
						state = (state + 1) % (maxstate + 1);
            			if(maxstate < 4){
              				maxstate++;
            			}
						last_send = send;
						last_time = current_time;
					}
				}, 50);
			fs.createReadStream(content, { bufferSize: settings.upload_buffer_size })
					.pipe(put_req);
			request_buffer[request_id] = put_req;
		});
		return result;
	}
	
	
var downloadBrowser = function () {
	
}
	
var downloadPath = function () {
	
}


var pdfenApi = {
	POST : function(path, data, callback, language){
		var json = JSON.stringify(data);
		var post_options = {
			hostname: settings.api_host,
			path: settings.api_root_path + path,
			protocol: 'https:',//Seems to be required for browserify
			method: 'POST',
			headers: {
				'Content-Type' : 'application/json',
				'Content-Length' : json.length,
				'accept-language' : language
				},
			followRedirect: false
		};

		var registerResponseHandlers = function(response) {
			var data = '';

	  		response.on('data', function (chunk) {
	    		data += chunk;
	  		});

	  		response.on('end', function () {
	    		if(data === ''){
					callback(null, response.statusCode);
				} else {
	    			callback(JSON.parse(data), response.statusCode);
				}
	  		});
		};
		var post_req = https.request(post_options, registerResponseHandlers);
		post_req.on('error', function(msg){
			callback(msg, -1);
		});
		post_req.write(json);
		post_req.end();
	},
	PATCH : function(path, data, callback, language){
		var json = JSON.stringify(data);
		var patch_options = {
			hostname: settings.api_host,
			path: settings.api_root_path + path,
			protocol: 'https:',//Seems to be required for browserify
			method: 'PATCH',
			headers: {
				'Content-Type' : 'application/json',
				'Content-Length' : json.length,
				'accept-language' : language
				},
			followRedirect: false
		};

		var registerResponseHandlers = function(response) {
			var data = '';

	  		response.on('data', function (chunk) {
	    		data += chunk;
	  		});

	  		response.on('end', function () {
	    		if(data === ''){
					callback(null, response.statusCode);
				} else {
	    			callback(JSON.parse(data), response.statusCode);
				}
	  		});
		};

		var patch_req = https.request(patch_options, registerResponseHandlers);
		patch_req.on('error', function(msg){
			callback(msg, -1);
		});
		patch_req.write(json);
		patch_req.end();
	},
	GET : function(path, callback, language){
		var get_options = {
			hostname: settings.api_host,
			path: settings.api_root_path + path,
			protocol: 'https:',//Seems to be required for browserify
			method: 'GET',
			headers: {
				'accept-language' : language
			},
			followRedirect: false
		};
		
			var err = new Error();

		var registerResponseHandlers = function(response) {
			var data = '';

	  		response.on('data', function (chunk) {
	    		data += chunk;
	  		});
			  
	  		response.on('end', function () {
				console.log(err.stack);
	    		if(data === ''){
					callback(null, response.statusCode);
				} else {
	    			callback(JSON.parse(data), response.statusCode);
				}
	  		});
		};

		var get_req = https.request(get_options, registerResponseHandlers);
		get_req.on('error', function(msg){
			callback(msg, -1);
		});
		get_req.end();
	},
	
	DELETE : function(path, callback, language){
		var get_options = {
			hostname: settings.api_host,
			path: settings.api_root_path + path,
			protocol: 'https:',//Seems to be required for browserify
			method: 'DELETE',
			headers: {
				'accept-language' : language
			},
			followRedirect: false
		};

		var registerResponseHandlers = function(response) {
			var data = '';

	  		response.on('data', function (chunk) {
	    		data += chunk;
	  		});

	  		response.on('end', function () {
	    		if(data === ''){
					callback(null, response.statusCode);
				} else {
	    			callback(JSON.parse(data), response.statusCode);
				}
	  		});
		};

		var get_req = https.request(get_options, registerResponseHandlers);
		get_req.on('error', function(msg){
			callback(msg, -1);
		});
		get_req.end();
	},
	PUTdata : function (path, data, callback, language){
		var json = JSON.stringify(data);
		var put_options = {
			hostname: settings.api_host,
			path: settings.api_root_path + path,
			protocol: 'https:',//Seems to be required for browserify
			method: 'PUT',
			headers: {
				'Content-Type' : 'application/json',
				'Content-Length' : json.length,
				'accept-language' : language
				},
			followRedirect: false
		};

		var registerResponseHandlers = function(response) {
			var data = '';

	  		response.on('data', function (chunk) {
	    		data += chunk;
	  		});

	  		response.on('end', function () {
				if(data === ''){
					callback(null, response.statusCode);
				} else {
	    			callback(JSON.parse(data), response.statusCode);
				}
	  		});
		};

		var put_req = https.request(put_options, registerResponseHandlers);
		put_req.on('error', function(msg){
			callback(msg, -1);
		});
		put_req.write(json);
		put_req.end();
	},
	PUT : function (path, content, callback, progress, language){
		if(typeof content === "string"){
			return PUTpath(path, content, callback, progress, language);
		} else {
			return PUTfile(path, content, callback, progress, language);
		}
	},
	
	HEAD : function(path, callback, language){
		var head_options = {
			hostname: settings.api_host,
			path: settings.api_root_path + path,
			protocol: 'https:',//Seems to be required for browserify
			method: 'HEAD',
			headers: {
				'accept-language' : language
			},
			followRedirect: false
		};
	
		var registerResponseHandlers = function(response) {
			var data = '';
	
			response.on('data', function (chunk) {
				data += chunk;
			});
				
			response.on('end', function () {
				if(data === ''){
					callback(response.headers, response.statusCode);
				} else {
					callback(response.headers, response.statusCode);
				}
			});
		};
	
		var get_req = https.request(head_options, registerResponseHandlers);
		get_req.on('error', function(msg){
			callback(msg, -1);
		});
		get_req.end();
	},
	
	download : function(path, target, callback, language){
		path = 'https://'  + settings.api_host + settings.api_root_path + path;
		if (typeof window !== 'undefined') {
			//Creating new link node.
			var link = document.createElement('a');
			link.href = path;

			if (link.download !== undefined){
				//Set HTML5 download attribute. This will prevent file from opening if supported.
				var fileName = path.substring(target.lastIndexOf('/') + 1, path.length);
				link.download = fileName;
			}

			//Dispatching click event.
			if (document.createEvent) {
				var e = document.createEvent('MouseEvents');
				e.initEvent('click' ,true ,true);
				link.dispatchEvent(e);
				return true;
			}
		} else {
			var fs = require('fs');
			var file = fs.createWriteStream(target);
			var request = https.get(path, function(response) {
  				response.pipe(file);
			});
		}
	},
	
	stripUrl : function (url){
		var i = url.indexOf(settings.api_root_path);
		if(i === -1){
			return url;
		} else{
			i = i + settings.api_root_path.length;
			return url.substr(i);
		}
	},
	
	stopRequest : function (request){
		if(request.request_type === "node"){
			if(request_buffer[request.request] === null || request_buffer[request.request] === false){
				//Not yet started, but indicate with false that we should not start the request.
				request_buffer[request.request] === false;
			} else {
				//retrieve the request object and abort it.
				var req = request_buffer[request.request];
				req.abort();
			}
		} else if (request.request_type === "XmlHttpRequest"){
			request.request.abort();
		}
	}
}

 //use emptyObject instead of null, to support polyfill bind
 //A fix for browsers that do not support bind
 var emptyObject = {};
 module.exports.Session = pdfenSession.bind(emptyObject, pdfenApi);
