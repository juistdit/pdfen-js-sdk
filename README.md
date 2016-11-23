# Pdfen JavaScript SDK (library)

This repository contains the code for the SDK for working with the PDFen API.
Using browserify, this code is written for browsers and for use in node.js.

## Using node
TODO

## Using the browser
You can use dist/pdfen-browser.js


## Updating dist/pdfen-browser
This code can not natively run in a browser.
To make it run in a browser you have to convert it using a tool called
browserify. You can update it as follows
* Install browserify
  ~ npm install -g browserify
* Make a javascript file for the browser
  ~ browserify lib/pdfen-browser.js > dist/pdfen-browser.js


