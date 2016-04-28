EXEC = node
RUNTEST = cd test/webkit; ./runtest.sh


install-dependencies: install-lib-dependencies install-test-dependencies

install-lib-dependencies:
	npm install

install-test-dependencies:
	cd test; npm install; cd ..

test: test-node test-webkit
  
test-node: test-node-90pages-docx test-node-large-images-docx

test-node-90pages-docx:
	$(EXEC) test/node/90pages-docx.js
	
test-node-large-images-docx:
	$(EXEC) test/node/large-images-docx.js

test-webkit:
	$(RUNTEST) 90pages-docx
	$(RUNTEST) large-images-docx
