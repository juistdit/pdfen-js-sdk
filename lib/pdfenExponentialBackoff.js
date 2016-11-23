
module.exports = function (settings){
	var last_interval = settings.min_polling_interval;
	var interval_function = function(speed_up){
		if(last_interval <= settings.max_fast_polling_interval){
			if(!speed_up){
				var new_interval = last_interval * settings.fast_exponent;
				//Lets be honest and just use the fast_exponent until we reach the boundary.
				if(new_interval > settings.max_fast_polling_interval){
					if(last_interval === settings.max_fast_polling_interval) {
						new_interval = last_interval * settings.slow_exponent;
					} else {
						var e = Math.log(settings.max_fast_polling_interval/last_interval)/Math.log(settings.fast_exponent);
						if(!isFinite(e) || 0 < e || e > 1){
							//Handle cases where the log does not exist.
							new_interval = last_interval * settings.slow_exponent;
						} else {
							new_interval = last_interval * Math.pow(settings.fast_exponent, e);
							new_interval = new_interval * Math.pow(settings.slow_exponent, 1-e);
						}
					}
				}
				last_interval = new_interval;
			} else {
				last_interval = last_interval / settings.fast_exponent;
			}
		}else {
			if(!speed_up){
				last_interval = last_interval * settings.slow_exponent;
			} else {
				last_interval = settings.max_fast_polling_interval;
			}
		}
		if(last_interval < settings.min_polling_interval){
			last_interval = settings.min_polling_interval;
		} else if (last_interval > settings.max_slow_polling_interval){
			last_interval = settings.max_slow_polling_interval;
		}
		last_interval = Math.round(last_interval);
		return last_interval;
	};
	return interval_function;
};

			