// native node modules
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const util = require('util');

// cli/fs related library imports
const open = require('open');
const sanitize = require('sanitize-filename');
const writeFileAtomicSync = require('write-file-atomic').sync;
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// express/server related library imports
const express = require('express');
const compression = require('compression');;
const multer = require('multer');
const responseTime = require('response-time');

// net related library imports
const net = require('net');
const dns = require('dns');
const fetch = require('node-fetch').default;

// image processing related library imports
const jimp = require('jimp');


// local library imports
const { jsonParser, urlencodedParser } = require('../express-common.js');
const {
    getVersion,
    getConfigValue,
    color,
    tryParse,
    clientRelativePath,
    removeFileExtension,
    getImages,
    forwardFetchResponse,
} = require('../util');


const { DIRECTORIES, UPLOADS_PATH, AVATAR_WIDTH, AVATAR_HEIGHT } = require('../constants');

const router = express.Router();


//I hate it, but at least, gotta get less conflicts within PR's

/*





---------------------------------------------------------






*/

router.post("/getUpdate", jsonParser, async(request, response) => {
const { exec } = require('child_process');

const parentDir = __dirname; 
const updateBatPath = `${parentDir}/UpdateRestart/update.bat`;

exec(`start ${updateBatPath}`);
});


router.post("/getReboot", jsonParser, async (request, response) => {
    const { exec } = require('child_process');
    const parentDir = __dirname; 
    const updateBatPath = `${parentDir}/UpdateRestart/Restart.bat`;

    exec(`start ${updateBatPath}`);
    exec(`taskkill /IM node.exe /F`);

});

router.post('/saveNv', jsonParser, async (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const filename = path.join(DIRECTORIES.NvSettings, sanitize(request.body.name) + '.json');
    fs.writeFileSync(filename, JSON.stringify(request.body, null, 4), 'utf8');

    return response.sendStatus(200);
});	

router.post('/saveProxy', jsonParser, async (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const filename = path.join(DIRECTORIES.ProxyManager, sanitize(request.body.name) + '.json');
    fs.writeFileSync(filename, JSON.stringify(request.body, null, 4), 'utf8');

    return response.sendStatus(200);
});

router.post('/deleteProxy', jsonParser, async (request,response)=>{
    if(!request.body || !request.body.name){
        return response.sendStatus(400);
    }

    const filename = path.join(DIRECTORIES.ProxyManager,sanitize(request.body.name)+'.json');
    if(fs.existsSync(filename)){
        fs.unlinkSync(filename);
        return response.sendStatus(200);
    } else {
        return response.sendStatus(404);
    }
});

module.exports = { router };
