'use strict'

const express = require('express')
const path = require('path');
const fs = require('fs'); 
const chokidar = require('chokidar');

const Config = JSON.parse(fs.readFileSync('config.json'));


let app = express();
app.set('view engine', 'ejs');
let expressWs = require('express-ws')(app);
let WsClients = [];

let RenameIgnorList = []
let watchSettings = {
  ignoreInitial: true,
}

chokidar.watch(Config.fileWatcher.directory,watchSettings).on('all', (event, filePath) => {
  //console.log(event, filePath);  
  let fileName = path.basename(filePath);
  if(event == 'add')
  {
    if(!RenameIgnorList.includes(fileName))
    {
      console.log(`New file - ${fileName}`);
      SendMessage('newfile', `New file - ${fileName}`, {'newFile' : fileName });
    }
  }
});

app.use('/input', express.static(Config.fileWatcher.directory));

app.ws('/', function(ws, req) {

  let getUniqueID = ()=> {
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return s4() + s4() + '-' + s4();
  };

  let userID = getUniqueID();
  WsClients[userID] = ws;

  let regMsg = `Connection registered - ${userID}`;
  console.log(regMsg);
  SendMessage('newconnection', regMsg);
  
  ws.on('message', function(msg) {
    const obj = JSON.parse(msg);

    if(obj.event == 'rename')
    {
      let oldFileName = obj.oldFileName;
      let newFileName = `${obj.newFileName}${path.extname(oldFileName)}`;

      let oldFile = `${Config.fileWatcher.directory}/${oldFileName}`
      let newFile = `${Config.fileWatcher.directory}/${newFileName}`;

      RenameIgnorList.push(newFileName);
       
      console.log('Rename = ' + oldFile + ' - ' + newFile);
      fs.renameSync(oldFile, newFile, function(err) {
          if ( err ) console.log('ERROR: ' + err);
      });

      SendMessage('renameDone',`rename done - ${newFile}`);
    }
  });
});

function getFileList()
{
  return fs.readdirSync(Config.fileWatcher.directory, { withFileTypes: true })
           .filter(fileObj => fileObj.isFile())
           .map(fileObj => fileObj.name);
}

function SendMessage(event, message , extraData = null, sendFiles = true)
{
    let messageOb = {
      'event' : event,
      'message' : message,  
      ... extraData,
    };
  
    if(sendFiles)
      messageOb.files = getFileList();
  
    let messageJson = JSON.stringify(messageOb);
    Object.keys(WsClients).map((client) => {
      WsClients[client].send(messageJson);
    });
}

// about page
app.get('/', function(req, res) {
  res.render("index", {serverPortNumber: Config.server.portNumber});
});

app.listen(Config.server.portNumber);

console.clear()
console.log('ScannerWatcher - ' + 'localhost' + ':' + Config.server.portNumber)
