module.exports = function (pdfenApi, pdfenSession, secretToken, files, id){
	files.push(this);
    if (typeof id === 'undefined') { 
		id = null; 
	}
    
    var content = null;
    var title = null;
    var content_changed = false;
    var properties_changed = false;
    var extension = null;
    
    var upload_handle = null;
    
    this.__pushServerUpdate = function(token, title_in, extension_in){
        if(token !== secretToken){
            throw "Not allowed";
        }
        title = title_in;
        extension = extension_in;
        
        triggerOnChange();
    };
    
    var uploadProgress = null;   
    this.create = function(callbacks){
        if(title === null || content === null || extension === null){
            throw "Not all required properties are set.";
        }
        if(id !== null){
            throw "This file is already created.";
        }
        var params = {};
        if(typeof content === "string" && content.indexOf('http') === 0){
            params.url = content;
        }
        params.file_settings = {};
        params.file_settings.extension = extension;
        params.file_settings.title = title;
        
        var upload_cb = function(success, data){
            upload_handle = null;
            if(success && 'success' in callbacks) {
                uploadProgress = null;
                callbacks.success();
            } else {
                callbacks.error(data);
            }
        };
        
        var uploadFile = function(){
            if(upload_handle !== null){
                pdfenApi.stopRequest(upload_handle);
                upload_handle = null;
            }
            upload_handle = pdfenApi.PUT('/sessions/' + pdfenSession.id + '/files/' + id + '/data', content, upload_cb, function(report){
                    uploadProgress = report;
                    callbacks.progress(report);
                }, pdfenSession.language);
        };
        
        var post_cb = function (data, statusCode) {
            pdfenSession.update();
            if(!(statusCode >= 200 && statusCode < 300)){
                //error
                callbacks.error(data);
                return;
            }
            if('file_id' in data){
                id = data.file_id;
                if('success' in callbacks &&!('url' in params)){
                    uploadFile();
                } else if(typeof callbacks !== 'undefined' && 'success' in callbacks){
                    callbacks.success();
                }
            }
        };
        
        pdfenApi.POST('/sessions/' + pdfenSession.id + '/files', params, post_cb, pdfenSession.language);
	};
    
    this.update = function (callbacks){
        if(title === null || (content === null && content_changed) || extension === null){
            throw "Not all required properties are set.";
        }
        if(id === null){
            throw "This file is not yet created.";
        }
        var params = {};
        if(typeof content === "string" && content_changed){
            params.url = content;
        }
        params.file_settings = {};
        params.file_settings.extension = extension;
        params.file_settings.title = title;
        var updateChangedParams = function (){
            //take care of async race conditions... TODO
            content_changed = false;
            properties_changed = false;
        };
        
        var upload_cb = function(success){
            if(upload_handle !== null){
                pdfenApi.stopRequest(upload_handle);
                upload_handle = null;
            }
            if(success) {
                updateChangedParams();
                uploadProgress = null;
                if('success' in callbacks){
                    callbacks.success();
                }
            }
            //todo error
        };
        
        var uploadFile = function(){
            upload_handle = pdfenApi.PUT('/sessions/' + pdfenSession.id + '/files/' + id, content, upload_cb, 
                function(report){
                    uploadProgress = report;
                    callbacks.progress(report);
                }, pdfenSession.language);
        };
        
        
        var patch_cb = function (data, statusCode) {
            if(!(statusCode >= 200 && statusCode < 300)){
                //error
                callbacks.error(data);
                return;
            }
            if('file_id' in data){
                id = data.file_id;
                if('success' in callbacks &&!('url' in params) && content_changed){
                    uploadFile();
                } else if(typeof callbacks !== 'undefined' && 'success' in callbacks){
                    updateChangedParams();
                    callbacks.success();
                }
            }
        };
        if(properties_changed || (content_changed && typeof content === "string")){
            pdfenApi.PATCH('/sessions/' + pdfenSession.id + '/files/' + id, params, patch_cb, pdfenSession.language);
        } else if(content_changed){
            uploadFile();
        }
	};
    
    this.delete = function(callbacks){
        if(upload_handle !== null){
            pdfenApi.stopRequest(upload_handle);
            upload_handle = null;
        }
        var delete_cb = function(data, statusCode){
            if(statusCode >= 200 && statusCode < 300) {
                pdfenSession.update(callbacks);
            } else {
                //error
                callbacks.error(data);
                return;
            }
        }
        pdfenApi.DELETE('/sessions/' + pdfenSession.id + '/files/' + id, delete_cb, pdfenSession.language);
    };
    
    
    //TODO how to handle these onChange (next sprint?)
    //onChange can be an array or a function
    //multiple functions can be specified by using 'onChange' as an array.
    var onChange = [];
    
    var triggerOnChange = function (){
        if(typeof onChange === "function"){
            onChange(this);
        } else {
            for(var i = 0; i < onChange.length; i++){
                onChange[i](this);
            }
        }
    }
    
	//Lets define the special properties (readonly, etc..)
	Object.defineProperties(this, {
        "id": {
             "get": function() { return id;},
             "set": function() {}
        },
        "title" : {
            "get": function () { return title; },
            "set": function(val) { title = val; properties_changed = true;}
        },
        "content" : {
            "get": function () { throw "Not supported."; },
            "set": function(val) {content = val; content_changed = true;}
        },
        "extension" : {
            "get": function () { return extension; },
            "set": function(val) { extension = val; properties_changed = true;}
        },
        "onChange" : {
            "get" : function () { 
                return onChange;
            },
            "set" : function (val){
                onChange = val;
                //start the onChange loops?
            }
        },
        "isUploading" : {
            "get" : function (){
                return uploadProgress !== null;
            }
        },
        "uploadProgress" : {
            "get" : function () {
                return JSON.parse(JSON.stringify(uploadProgress));
            }
        }
    });
}