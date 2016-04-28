var page = require('webpage').create(),
    system = require('system'),
    origin, dest, steps;

var log = function(msg) {console.log("Client: " + msg);};
page.open("./" + system.args[1] + '/index.html',
  
  function (status){
    var func = require("./" + system.args[1] + "/client.js");
    func(page);
  });

page.onConsoleMessage = function(msg, lineNum, sourceId) {
  if(msg === "PHANTOM_STOP"){
    setTimeout(function(){
      phantom.exit();
    }, 0);
    return;
  }
  console.log("Server: " + msg);
};