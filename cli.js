#!/usr/bin/env node
'use strict';

// cli include
const meow = require('meow');
// filesystem access
const fs = require('fs');
const currentDir = process.cwd();
// beautiful colors
const chalk = require('chalk');
// node-jquery
const cheerio = require('cheerio');
// recursive folder copy
const ncp = require('ncp');
// urlparser
const { URL } = require('url');
// traverse the .js file
const falafel = require('falafel');
// download stuff
const request = require('request');
// tty input
const prompt = require('prompt');
// message prefix
prompt.message = chalk.cyanBright("Lige et hurtigt spørgsmål!");
// contains instructions for CLI.
const cli = meow(`
    Usage
      $ aniwd --- use inside directory with animate project
 
    Output
      puts processed files into ./processed
`, {
    flags: {
        rainbow: {
            type: 'boolean',
            alias: 'r'
        }
    }
});



// error throwy
const throwError = (err) => {
  //throw err;
  console.log(chalk.cyanBright('Did you run this in the right directory?'));
  throw err;
  process.exit();
}

// function to turn relative paths into absolute remote paths
const remotify = (filename, endpoint) => {
  fs.readFile(filename, 'utf-8', (err, data) => {
    var output = falafel(data, function (node) {

        // finds "sounds" array - not working on this yet.
        // if (node.type === 'ArrayExpression') {
        //     if(node.elements.length > 0 && typeof node.parent.id !== "undefined")
        //       console.log(node.parent.id.name);
        //     // console.log(node.elements)
        //     // console.log()
        //     // process.exit();

        // }
        if (node.type === 'ObjectExpression') {
          try {
            if(node.parent.left.object.name == "lib"){
              // console.log(Object.keys(node.parent.right.properties))
              // console.log(node.parent.right.properties)
              for (var i = 0; i < node.parent.right.properties.length; i++) {
                if(node.parent.right.properties[i].key.name == "manifest")
                  //console.log(Object.keys(node.parent.right.properties[i]))
                  // console.log(node.parent.right.properties[i].key)
                  for(var x in node.parent.right.properties[i].value.elements){
                    // console.log(Object.keys(node.parent.right.properties[i].value.elements[x]));
                    // node.parent.right.properties[i].value.elements[x].update()
                    var text = node.parent.right.properties[i].value.elements[x].source().trim();
                    node.parent.right.properties[i].value.elements[x].update( text.replace('src:"', 'src:"'+endpoint))
                  }
                  // console.log(node.parent.right.properties[i].source()))
                  // for(var x in node.parent.right.properties[i])
              }
            }
          } catch(e){
            // bad bad bad
          }
        }
    });
    process.nextTick(function(){
      fs.writeFile('./processed/'+filename, output, (err) => {
        if (err) throw err;
        // file has been saved
      });
    })
    // console.log(output);
  })
}



// read index.html and extract tags.
// saves stuff into ./processed.
fs.readFile('./index.html', 'utf-8', (err, data) => {
  if (err) throwError(err);
  // example.js

  const $ = cheerio.load(data);
  // $('h2').addClass('welcome')
  prompt.get({
    properties: {
      endpoint: {
        description: chalk.red("Hvor ligger filerne på nettet? e.g. https://www.dr.dk/nysgerrig/sex-robot/")
      }
    }
  }, function (err, result) {
    if (err) { return onErr(err); }
    // 

    let endpoint = new URL(result.endpoint);
    if(endpoint.pathname.slice(-1) !== '/')
      endpoint.pathname += '/';
    // console.log(endpoint)
    try {
      fs.mkdirSync("./processed");
    } catch(e){
      // already exists
    }

    let cdnDone = null;
    let animateScript = null;
    var mainScript = "";
    var mainStyle = "";
    var newDoc = cheerio.load("");
    $("style").each( function(index, element){
      if(element.children.length > 0){
        if(element.children[0].type == "text"){
          mainStyle += element.children[0].data + '\n';
          // newDoc('body').append(element);
          var animStyle = $("#animation_container").attr("style");
          $("#animation_container").attr("style", "");
          animStyle.find
          newDoc('body').append(`<style>
            #animation_container, #_preload_div_ {
            position:relative;
            margin:auto;
            }
          </style>`)
        }
      }
    });
    newDoc("body").append($("#animation_container"));

    var scriptsToLoad = 0;
    var scriptLoaderTag = "";
    function createScriptLoader(script){
      scriptsToLoad++;
      script = script.match(/\/(.*)/)[1];
      if(scriptsToLoad > 1){
        scriptLoaderTag += `
          var script${scriptsToLoad} = document.createElement('script');
          script${scriptsToLoad-1}.onload = function () {
             script${scriptsToLoad}.src = '${endpoint}${script}';
             document.head.appendChild(script${scriptsToLoad});
          }
        `;
      } else {
        scriptLoaderTag += `var script${scriptsToLoad} = document.createElement('script');
            script${scriptsToLoad}.src = '${endpoint}${script}';
            document.head.appendChild(script${scriptsToLoad});
        `;
      }
    }
    $("script").each( function(index, element){
      if(element.attribs.src){
        
        // attempt to localize the animate dependencies - fight the power of centralized cdn's
        try {
          const cdnURL = new URL(element.attribs.src);
          const filename = cdnURL.pathname.substring(1,cdnURL.pathname.length);
          request(element.attribs.src).pipe(fs.createWriteStream("./processed/" + filename))
          element.attribs.src = filename;
          cdnDone = filename;
        } catch (e){
          // could not download dependency... (probably already local include)
        }

        // we're gonna assume that the animate .js always comes first...
        if(element.attribs.src.indexOf(cdnDone) < 0 && cdnDone.length > 0 && animateScript == null){
          animateScript = element.attribs.src
          console.log(animateScript)
          remotify(element.attribs.src, endpoint);
        } else if(element.attribs.src.indexOf(cdnDone) < 0) {
          createScriptLoader(element.attribs.src);
        }
      }
      if(element.children.length > 0){
        if(element.children[0].type == "text"){
          newDoc('body').append(element);
        }
      }
    })
    process.nextTick(function(){
      let HTMLdata = $.html();




      var vendorLoader;
      if(scriptsToLoad > 0){
        vendorLoader = `
        ${scriptLoaderTag}
        var vendor_script = document.createElement('script');
        script${scriptsToLoad}.onload = function () {
          vendor_script.src = '${endpoint}${cdnDone}';
          document.head.appendChild(vendor_script);
        }`;
      } else {
        vendorLoader = `var vendor_script = document.createElement('script');
        vendor_script.src = '${endpoint}${cdnDone}';
        document.head.appendChild(vendor_script);`;
      }
      newDoc("body").append(`
      <script>
        ${vendorLoader}
        var animateScript = document.createElement('script');
        vendor_script.onload = function () {
            animateScript.src = '${endpoint}${animateScript}';
            document.head.appendChild(animateScript);
        }
        animateScript.onload = function(){
            init();
        }
      </script>
      `);
      let webdokData = newDoc.html();
      fs.writeFile('./processed/webdok.html', webdokData, (err) => {
        if (err) throw err;
        // console.log('The file has been saved!');
        // file has been saved
      });
      fs.writeFile('./processed/index.html', HTMLdata, (err) => {
        if (err) throw err;
        // console.log('The file has been saved!');
        // file has been saved
        ncp('./images/', './processed/images', function (err) {
           if (err) {
             return console.error(err);
           }
           console.log('done!');
          });
      });
    })
  });
});


// /:([0-9]+)px/gi


