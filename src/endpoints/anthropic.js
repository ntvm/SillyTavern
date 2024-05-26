const { readSecret, SECRET_KEYS, getBaseproxy } = require('./secrets');
const fetch = require('node-fetch').default;
const express = require('express');
const { jsonParser } = require('../express-common');

const router = express.Router();

function Proxystuff(Uscase, dir){
    var array = readSecret(dir, SECRET_KEYS.OAIPROXY);
    if (array == undefined) { allowProxy = false; return allowProxy;}
    var passw = array.pop();
    var url = array.pop();
    var allowProxy = array.pop();

    switch (Uscase){
        case 'useproxy':
            if (passw == false) { allowProxy = false; return allowProxy;}
            return allowProxy;
        case 'getkey':
            return passw;
        case 'getURL':
            url = getBaseproxy(url);
            return url;
    }

}

router.post('/caption-image', jsonParser, async (request, response) => {
    try {
        const mimeType = request.body.image.split(';')[0].split(':')[1];
        const base64Data = request.body.image.split(',')[1];
        var rn = 'useproxy';
        const dir = request.user.directories;
        var allowProxy = Proxystuff(rn, dir);

        var url;
        var apikey;

        if (allowProxy == false && request.body.reverse_proxy && request.body.proxy_password !== undefined) {
            url = `${request.body.reverse_proxy}/v1/messages`;
            apikey = request.body.proxy_password;
        } else {
            url = 'https://api.anthropic.com/v1/messages';
            apikey = readSecret(request.user.directories, SECRET_KEYS.CLAUDE);
        }
        if (allowProxy == true) {
            rn = 'getURL';
            url = Proxystuff(rn);
            url = url + '/anthropic/v1/messages';
            rn = 'getkey';
            apikey = Proxystuff(rn);
        }


        const body = {
            model: request.body.model,
            messages: [
                {
                    'role': 'user', 'content': [
                        {
                            'type': 'image',
                            'source': {
                                'type': 'base64',
                                'media_type': mimeType,
                                'data': base64Data,
                            },
                        },
                        { 'type': 'text', 'text': request.body.prompt },
                    ],
                },
            ],
            max_tokens: 800,
        };

        console.log('Multimodal captioning request', body);

        const result = await fetch(url, {
            body: JSON.stringify(body),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': apikey,
            },
            timeout: 0,
        });

        if (!result.ok) {
            console.log(`Claude API returned error: ${result.status} ${result.statusText}`);
            return response.status(result.status).send({ error: true });
        }

        const generateResponseJson = await result.json();
        const caption = generateResponseJson.content[0].text;
        console.log('Claude response:', generateResponseJson);

        if (!caption) {
            return response.status(500).send('No caption found');
        }

        return response.json({ caption });
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal server error');
    }
});

module.exports = { router };
