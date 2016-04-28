module.exports = function(page){
    log("Uploading file");
    page.uploadFile('input[name=file]', '../assets/My document.docx');
}