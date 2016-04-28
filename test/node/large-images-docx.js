var settings = require (__dirname + '/settings.js');

var username = settings.username;
var password = settings.password;

var pdfen = require(__dirname + '/../../lib/pdfen.js');
var Sequence = require('sequence').Sequence;
var sequence = Sequence.create();
var session = new pdfen.Session();
var file = new session.File();
//file.content = __dirname + '/../assets/My document.docx';//Some uploaded file that is given somewhere
file.content = __dirname + '/../assets/LargeImageFile.docx';//Some uploaded file that is given somewhere
//file.data will allow passing of raw data... not yet supported
file.extension = 'docx';
file.title = 'Large Image Document';

var spinner = function (){
  var chars = ["|", "/", "-", "\\"]
  var idx = 0;
  return function (){
    idx = (idx + 1) % 4;
    process.stdout.write("\b" + chars[idx]);
  }
}()

var interval;

var progress = function (line){
  process.stdout.write("\b");//Remove spinning cursor
	console.log(line);
}

var upload_progress = function(){
  var dashes = 0;
  return function(progress){
    var ratio = progress.send/progress.total;
    var line = "";
    for(var i = 0; i < 100; i++){
      line += "\b";
    }
    line += "[";
    for(var i = 0; i < 25; i++){
      if(i <= ratio * 24){
        line += "-";
      } else if (i-1 < ratio*24){
        line += ">";
      } else {
        line += " ";
      }
    }
    line += "]";
    if(ratio === 1){
      line += " (average: " + Math.floor(progress.average_speed / 1024) + " kB/s)";
    } else {
      line += " (" + Math.floor(progress.current_speed / 1024) + " kB/s)";
    }
    process.stdout.write(line);
  };
}();

var completed = function (result){
  clearInterval(interval);
  process.stdout.write("\b");
  console.log("--------------------------------");
  console.log("PDF generated!");
  console.log("URL is:");
	console.log(result.url);
}

console.log("--------------------------------------------------------------------");
console.log("| Testcase:                                                        |");
console.log("--------------------------------------------------------------------");
console.log("| Converting a large (40MB) docx file with images into a PDF file. |");
console.log("--------------------------------------------------------------------");
console.log("");

sequence
  .then(function(next) {
    console.log("Logging in...");
    session.login(username, password, {success : next});
  })
  .then(function(next, result) {
     console.log("Logged in.  Session created: id="+session.id)
     console.log("Uploading file...");
     file.create({success : next, progress : upload_progress});
  })
  .then(function(next, d) {
    console.log("");
    console.log("File uploaded. File created: id="+file.id)
    console.log("Generating pdf...");
    console.log("--------------------------------");
    console.log("Progress:");
    console.log("--------------------------------");
	  var options = {};
    interval = setInterval(spinner, 100);
	  session.generatePdf(options, {progress: progress, success: completed});
  });
