/**
  * The setSmartTimeout(eventHandler, activeInt, fallbackInt) method 
  * calls a function or evaluates an expression periodical.
  * If the window is 'active', eventHandler will be called every activeInt ms. 
  * If the window is 'inactive', the eventHandler will be called every fallbackMultiplier * activeInt ms. 
  * The window is 'active' if it has focus and the last mouse or key event has not occurred more than timeoutTime ms ago.
  * In case no browser is present (node), eventHandler will be called every activeInt ms.
  */
module.exports = (function(){
	if(typeof window === "undefined"){
		//basic browser interval
		return function(eventHandler, activeInt, fallbackInt){
			return setInterval(eventHandler, activeInt);
		}
	}
	var latestActionTime = new Date().getTime();
	var focus = true;
	//Called when a user-events occurs
	function handleAction(){
		focus = true;
		latestActionTime = new Date().getTime();
	}
	//Bind eventhandler
	window.document.addEventListener("mousemove", handleAction);
	window.document.addEventListener("mousedown", handleAction);
	window.document.addEventListener("keydown", handleAction);
	window.document.addEventListener("keypress", handleAction);
	window.document.addEventListener("focus", handleAction);
	//Take care of focus variable focus on focusout
	window.document.addEventListener("blur", function(){focus = false;});
	//Determines if the document is active, given the currentTime
	function isActive(currentTime, timeoutTime){
		return focus && (latestActionTime + timeoutTime) > currentTime;
	}
	//The function that attaches an eventHandler to a timeout
	// function with as argument a function and two integers
	return function(eventHandler, activeInt, timeoutTime, fallbackMultiplier){
		var not_active_counter = 0;
		var handleEvent = function (){
			var currentTime = new Date().getTime();
			if(isActive(currentTime, timeoutTime)){
				eventHandler();
			} else if (not_active_counter > fallbackMultiplier){
				not_active_counter = 0;
				eventHandler();
			} else {
				not_active_counter++;
			}
		}
		return setInterval(handleEvent, activeInt);
	}
})();