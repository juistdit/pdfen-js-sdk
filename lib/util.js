var pdfenPost = function(path, data, callback){
	var json = JSON.stringify(data);
	var post_options = {
		hostname: settings.api_host,
		path: settings.api_root_path + path,
		method: 'POST',
		headers: {
			'Content-Type' : 'application/json',
			'Content-Length' : json.length
			}
	};
	
	var registerResponseHandlers = function(response) {
		var data = '';
		
  		response.on('data', function (chunk) {
    		data += chunk;
  		});
		  
  		response.on('end', function () {
    		callback(JSON.parse(data));
  		});
	};
	
	var post_req = https.request(post_options, registerResponseHandlers);
	post_req.write(json);
	post_req.end();
};

var settings = {
	api_host : 'www.pdfen.com',
	api_root_path : "/api/v1"
};
