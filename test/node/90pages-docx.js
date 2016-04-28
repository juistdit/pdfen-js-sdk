var settings = require (__dirname + '/settings.js');

var username = settings.username;
var password = settings.password;

var pdfen = require(__dirname + '/../../lib/pdfen.js');
var Sequence = require('sequence').Sequence;
var sequence = Sequence.create();
var session = new pdfen.Session();
var file = new session.File();
//file.content = __dirname + '/../assets/My document.docx';//Some uploaded file that is given somewhere
file.content = __dirname + '/../assets/My document.docx';//Some uploaded file that is given somewhere
//file.data will allow passing of raw data... not yet supported
file.extension = 'docx';
file.title = 'My document';

var progress = function (line){
	console.log(line);
}

var completed = function (result){
  console.log("--------------------------------");
  console.log("PDF generated!");
  console.log("URL is:");
	console.log(result.url);
}



console.log("--------------------------------------------------------------------");
console.log("| Testcase:                                                        |");
console.log("--------------------------------------------------------------------");
console.log("|  Converting a 90 page docx file into a 90 page PDF file.         |");
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
     file.create({success : next, progress : function(){}});
  })
  .then(function(next, d) {
    console.log("File uploaded. File created: id="+file.id)
    console.log("Generating pdf...");
    console.log("--------------------------------");
    console.log("Progress:");
    console.log("--------------------------------");
	  session.generatePdf({}, {progress: progress, success: completed});
  });
