module.exports = function (data, pdfen_secretToken){
	var name = data['name'];
	var field_id = data['field_id'];
	var type = data['type'];
	var description = data['description'];
	var optional = data['optional'];
	var min_license_level = data['min_license_level'];
	
	this.__update = function(data, secretToken){
		if(secretToken !== pdfen_secretToken){
			throw "Not allowed";
		}
		name = data['name'];
		field_id = data['field_id'];
		type = data['type'];
		description = data['description'];
		optional = data['optional'];
		min_license_level = data['min_license_level'];
	};
	
	this.isCorrectValue = function (val){
		if(optional && val === null){
			return true;
		}
		var match, year, month, day, hour;
		if(typeof type !== 'string'){
			if(typeof type.values.indexOf === "undefined"){
			    return type.values.hasOwnProperty(val);
			} else if(type.values.indexOf(val) === -1){
				return false;
			}
		} else if(type === 'integer') {
			if(val !== parseInt(val)){
				return false;
			}
		} else if(type === 'number'){
			if(val !== parseFloat(val)){
				return false;
			}
		} else if(type === "single_line"){
			if(typeof val !== "string" || /\r|\n/.exec(val) !== null) {
				return false;
			}
		} else if(type === 'datetime') {
			match = /^(\d{4})-([0,1]\d)-([0-3]\d)T([0-2]\d):([0-5]\d):([0-5]\d)$/.exec(val);
			if (match === null) {
				return false;
			}
			year = parseInt(match[1]);
			month = parseInt(match[2]);
			day = parseInt(match[3]);
			hour = parseInt(match[4]);
			if (month < 1 || month > 12 || day > (new Date(year, month + 1, 0)).getDate() || hour > 23) {
				return false;
			}
		} else if(type === 'time') {
			match = /^([0-2]\d):([0-5]\d):([0-5]\d)$/.exec(val);
			if (match === null) {
				return false;
			}
			year = parseInt(match[1]);
			month = parseInt(match[2]);
			day = parseInt(match[3]);
			hour = parseInt(match[4]);
			if (month < 1 || month > 12 || day > (new Date(year, month + 1, 0)).getDate() || hour > 23) {
				return false;
			}
		} else if(type === 'date'){
			match = /^(\d{4})-([0,1]\d)-([0-3]\d{2})$/.exec(val);
			if(match === null){
				return false;
			}
			year = parseInt(match[1]);
			month = parseInt(match[2]);
			day = parseInt(match[3]);
			if(month < 1 || month > 12 || day > (new Date(year, month + 1, 0)).getDate()){
				return false;
			}
		} else if(type === 'boolean'){
			if(val !== true && val !== false){
				return false;
			}
		}
		return true;
	};
	
	Object.defineProperties(this, {
        "id": {
             "get": function() { return field_id;}
        },
		"name" : {
			"get" : function() { return name;}
		},
		"description" : {
			"get" : function () { return description;}
		},
		"type" : {
			"get" : function() { // if array then slice
				if(Array.isArray(type)){
					return type.slice();
				}
				return type;
			}
		},
		"min_license_level" : {
			"get" : function(){
				return min_license_level;
			}
		}
    });
};