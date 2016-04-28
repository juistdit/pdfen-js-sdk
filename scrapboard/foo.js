var processor = require('browsify').processor,
    opts = {}; // ex: {namespae: "foo"} 
 
processor.compile(["file.js", "file2.js"], opts,  function (str) {
    process.stdout.write(str);
});
