const { readSecret, SECRET_KEYS, getBaseproxy } = require('./secrets');
const fetch = require('node-fetch').default;
const express = require('express');
const FormData = require('form-data');
const fs = require('fs');
const { jsonParser, urlencodedParser } = require('../express-common');
const { getConfigValue, mergeObjectWithYaml, excludeKeysByYaml, trimV1 } = require('../util');
const { setAdditionalHeaders } = require('../additional-headers');

var Uscase;
var apiURL;
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

const router = express.Router();

router.post('/caption-image', jsonParser, async (request, response) => {
    try {
        var proxy;
        let key = '';
        let headers = {};
        let bodyParams = {};
        var rn = 'useproxy';
        const dir = request.user.directories;
        var allowProxy = Proxystuff(rn, dir);

        if (allowProxy == true) {proxy = true;}

        if (request.body.api === 'openai' && !request.body.reverse_proxy && (proxy !== true) ) {
            key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);
        }

        if (request.body.api === 'openrouter' && !request.body.reverse_proxy && (proxy !== true)) {
            key = readSecret(request.user.directories, SECRET_KEYS.OPENROUTER);
        }

        if (request.body.reverse_proxy && request.body.proxy_password) {
            key = request.body.proxy_password;
        }

        if (request.body.api === 'custom') {
            key = readSecret(request.user.directories, SECRET_KEYS.CUSTOM);
            mergeObjectWithYaml(bodyParams, request.body.custom_include_body);
            mergeObjectWithYaml(headers, request.body.custom_include_headers);
        }

        if (proxy == true) {
            rn = 'getkey';
            key = Proxystuff(rn, dir);
        }

        if (request.body.api === 'ooba') {
            key = readSecret(request.user.directories, SECRET_KEYS.OOBA);
            bodyParams.temperature = 0.1;
        }

        if (request.body.api === 'koboldcpp') {
            key = readSecret(request.user.directories, SECRET_KEYS.KOBOLDCPP);
        }

        if (!key && !request.body.reverse_proxy && ['custom', 'ooba', 'koboldcpp'].includes(request.body.api) === false) {
            console.log('No key found for API', request.body.api);
            return response.sendStatus(400);
        }

        const body = {
            model: request.body.model,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: request.body.prompt },
                        { type: 'image_url', image_url: { 'url': request.body.image } },
                    ],
                },
            ],
            max_tokens: 1000,
            ...bodyParams,
        };

        const captionSystemPrompt = getConfigValue('openai.captionSystemPrompt');
        if (captionSystemPrompt) {
            body.messages.unshift({
                role: 'system',
                content: captionSystemPrompt,
            });
        }

        if (request.body.api === 'custom') {
            excludeKeysByYaml(body, request.body.custom_exclude_body);
        }

        console.log('Multimodal captioning request', body);

        var apiUrl = '';


        if (request.body.api === 'openrouter' && (proxy !== true)) {
            apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            headers['HTTP-Referer'] = request.headers.referer;
        }

        if (request.body.api === 'openai' && (proxy !== true)) {
            apiUrl = 'https://api.openai.com/v1/chat/completions';
        }

        if (request.body.reverse_proxy) {
            apiUrl = `${request.body.reverse_proxy}/chat/completions`;
        }

        if (proxy == true) {
            rn = 'getURL';
            apiUrl = Proxystuff(rn, dir);
            apiUrl = apiUrl + '/openai/chat/completions';
        }

        if (request.body.api === 'custom') {
            apiUrl = `${request.body.server_url}/chat/completions`;
        }

        if (request.body.api === 'ooba') {
            apiUrl = `${trimV1(request.body.server_url)}/v1/chat/completions`;
            const imgMessage = body.messages.pop();
            body.messages.push({
                role: 'user',
                content: imgMessage?.content?.[0]?.text,
            });
            body.messages.push({
                role: 'user',
                content: [],
                image_url: imgMessage?.content?.[1]?.image_url?.url,
            });
        }

        if (request.body.api === 'koboldcpp') {
            apiUrl = `${trimV1(request.body.server_url)}/v1/chat/completions`;
        }

        setAdditionalHeaders(request, { headers }, apiUrl);

        const result = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
                ...headers,
            },
            body: JSON.stringify(body),
            timeout: 0,
        });

        if (!result.ok) {
            const text = await result.text();
            console.log('Multimodal captioning request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const data = await result.json();
        console.log('Multimodal captioning response', data);
        const caption = data?.choices[0]?.message?.content;

        if (!caption) {
            return response.status(500).send('No caption found');
        }

        return response.json({ caption });
    }
    catch (error) {
        console.error(error);
        response.status(500).send('Internal server error');
    }
});

router.post('/transcribe-audio', urlencodedParser, async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);

        if (!key) {
            console.log('No OpenAI key found');
            return response.sendStatus(400);
        }

        if (!request.file) {
            console.log('No audio file found');
            return response.sendStatus(400);
        }

        const formData = new FormData();
        console.log('Processing audio file', request.file.path);
        formData.append('file', fs.createReadStream(request.file.path), { filename: 'audio.wav', contentType: 'audio/wav' });
        formData.append('model', request.body.model);

        if (request.body.language) {
            formData.append('language', request.body.language);
        }

        const result = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                ...formData.getHeaders(),
            },
            body: formData,
        });

        if (!result.ok) {
            const text = await result.text();
            console.log('OpenAI request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        fs.rmSync(request.file.path);
        const data = await result.json();
        console.log('OpenAI transcription response', data);
        return response.json(data);
    } catch (error) {
        console.error('OpenAI transcription failed', error);
        response.status(500).send('Internal server error');
    }
});

router.post('/generate-voice', jsonParser, async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);

        if (!key) {
            console.log('No OpenAI key found');
            return response.sendStatus(400);
        }

        const result = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
                input: request.body.text,
                response_format: 'mp3',
                voice: request.body.voice ?? 'alloy',
                speed: request.body.speed ?? 1,
                model: request.body.model ?? 'tts-1',
            }),
        });

        if (!result.ok) {
            const text = await result.text();
            console.log('OpenAI request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const buffer = await result.arrayBuffer();
        response.setHeader('Content-Type', 'audio/mpeg');
        return response.send(Buffer.from(buffer));
    } catch (error) {
        console.error('OpenAI TTS generation failed', error);
        response.status(500).send('Internal server error');
    }
});

router.post('/generate-image', jsonParser, async (request, response) => {
    try {
        var rn = 'useproxy';
        const dir = request.user.directories;
        var allowProxy = Proxystuff(rn, dir);
        var proxy;
        if (allowProxy == true) {proxy = true;}
        if (proxy !== true) {var key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);}
        switch (allowProxy) {
            case false:
                key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);
                break;
            case true:
                rn = 'getkey';
                key = Proxystuff(rn, dir);
                break;
        }

        if (!key) {
            console.log('No OpenAI key found');
            return response.sendStatus(400);
        }

        console.log('OpenAI request', request.body);

        switch (allowProxy) {
            case true:
                rn = 'getURL';
                apiURL = Proxystuff(rn, dir);
                apiURL = apiURL + '/openai-image/images/generations';
                break;
            default:
                apiURL = 'https://api.openai.com/v1/images/generations';
                break;
        }

        const result = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(request.body),
            timeout: 0,
        });

        if (!result.ok) {
            const text = await result.text();
            console.log('OpenAI request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const data = await result.json();
        return response.json(data);
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal server error');
    }
});

module.exports = { router };
