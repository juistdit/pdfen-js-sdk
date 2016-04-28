module.exports = function(page){
    log("Uploading file");
    page.uploadFile('input[name=file]', '../assets/LargeImageFile.docx');
}