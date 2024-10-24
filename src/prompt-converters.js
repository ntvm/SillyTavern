require('./polyfill.js');

/**
 * Convert a prompt from the ChatML objects to the format used by Claude.
 * @param {object[]} messages Array of messages
 * @param {boolean}  addAssistantPostfix Add Assistant postfix.
 * @param {string}   addAssistantPrefill Add Assistant prefill after the assistant postfix.
 * @param {boolean}  withSysPromptSupport Indicates if the Claude model supports the system prompt format.
 * @param {boolean}  useSystemPrompt Indicates if the system prompt format should be used.
 * @param {boolean}  excludePrefixes Exlude Human/Assistant prefixes.
 * @param {string}   addSysHumanMsg Add Human message between system prompt and assistant.
 * @returns {string} Prompt for Claude
 * @copyright Prompt Conversion script taken from RisuAI by kwaroran (GPLv3).
 */
function convertClaudePrompt(messages, addAssistantPostfix, addAssistantPrefill, withSysPromptSupport, useSystemPrompt, addSysHumanMsg, HumAssistOff, SystemFul, excludePrefixes) {

    //Prepare messages for claude.
    //When 'Exclude Human/Assistant prefixes' checked, setting messages role to the 'system'(last message is exception).
    if (messages.length > 0) {
        if (excludePrefixes) {
            messages.slice(0, -1).forEach(message => message.role = 'system');
        } else {
            messages[0].role = 'system';
        }
        //Add the assistant's message to the end of messages.
        if (addAssistantPostfix) {
            messages.push({
                role: 'assistant',
                content: addAssistantPrefill || '',
            });
        }
        // Find the index of the first message with an assistant role and check for a "'user' role/Human:" before it.
        let hasUser = false;
        const firstAssistantIndex = messages.findIndex((message, i) => {
            if (i >= 0 && (message.role === 'user' || message.content.includes('\n\nHuman: '))) {
                hasUser = true;
            }
            return message.role === 'assistant' && i > 0;
        });
        // When 2.1+ and 'Use system prompt' checked, switches to the system prompt format by setting the first message's role to the 'system'.
        // Inserts the human's message before the first the assistant one, if there are no such message or prefix found.
        if (withSysPromptSupport && useSystemPrompt) {
            messages[0].role = 'system';
            if (firstAssistantIndex > 0 && addSysHumanMsg && !hasUser) {
                messages.splice(firstAssistantIndex, 0, {
                    role: 'user',
                    content: addSysHumanMsg,
                });
            }
        } else {
            // Otherwise, use the default message format by setting the first message's role to 'user'(compatible with all claude models including 2.1.)
            messages[0].role = 'user';
            // Fix messages order for default message format when(messages > Context Size) by merging two messages with "\n\nHuman: " prefixes into one, before the first Assistant's message.
            if (firstAssistantIndex > 0 && !excludePrefixes) {
                messages[firstAssistantIndex - 1].role = firstAssistantIndex - 1 !== 0 && messages[firstAssistantIndex - 1].role === 'user' ? 'FixHumMsg' : messages[firstAssistantIndex - 1].role;
            }
        }
    }


    /*//=======
    let requestPrompt = messages.map((v, i) => {
        // Set prefix according to the role. Also, when "Exclude Human/Assistant prefixes" is checked, names are added via the system prefix.
        let prefix = {
            'assistant': '\n\nAssistant: ',
            'user': '\n\nHuman: ',
            'system': i === 0 ? '' : v.name === 'example_assistant' ? '\n\nA: ' : v.name === 'example_user' ? '\n\nH: ' : excludePrefixes && v.name ? `\n\n${v.name}: ` : (SystemFul ? '\n\nSystem: ' : '\n\n'),
            'FixHumMsg': '\n\nFirst message: ',
        }[v.role] ?? '';
        // Claude doesn't support message names, so we'll just add them to the message content.
        return `${prefix}${v.name && v.role !== 'system' ? `${v.name}: ` : ''}${v.content}`;
    }).join('');
//>>>>>>> staging
//<<<<<<< HEA*///D

    // Convert messages to the prompt.
    switch (HumAssistOff) {
        default:
            var requestPrompt = messages.map((v, i) => {
                // Set prefix according to the role. Also, when "Exclude Human/Assistant prefixes" is checked, names are added via the system prefix.																																												//Nv note. Please. Do NOT take changes from me without ask first.
                let prefix = {
                    'assistant': '\n\nAssistant: ',
                    'user': '\n\nHuman: ',
                    'system': i === 0 ? '' : v.name === 'example_assistant' ? '\n\nA: ' : v.name === 'example_user' ? '\n\nH: ' : excludePrefixes && v.name ? `\n\n${v.name}: ` : (SystemFul ? '\n\nSystem: ' : '\n\n'),
                    'FixHumMsg': '\n\nFirst message: ',
                }[v.role] ?? '';
                // Claude doesn't support message names, so we'll just add them to the message content.
                return `${prefix}${v.name && v.role !== 'system' ? `${v.name}: ` : ''}${v.content}`;
            }).join('');
            return requestPrompt;
        case true:
            requestPrompt = '';
            messages.pop();

            if (withSysPromptSupport && useSystemPrompt == true) {
                var combinedMessage = '';
                while (messages.length > 0 && messages[0].role === 'system') {
                    combinedMessage += messages[0].content;
                    messages.shift();
                }

                requestPrompt = requestPrompt + combinedMessage + '\n\nHuman: ' + addSysHumanMsg;

            } else {requestPrompt = '\n\nHuman:';}

            requestPrompt = requestPrompt + messages.map((v) => {
                return v.content + '\n\n';
            }).join('');

            if (addAssistantPostfix) {
                requestPrompt = requestPrompt + '\n\nAssistant: ';
            }

            if (addAssistantPrefill) {
                requestPrompt = requestPrompt + addAssistantPrefill;
            }

            return requestPrompt;
    }
//    I guess, this stuff is working
}


/**
 * Convert ChatML objects into working with Anthropic's new Messaging API.
 * @param {object[]} messages Array of messages
 * @param {string}   prefillString User determined prefill string
 * @param {boolean}  useSysPrompt See if we want to use a system prompt
 * @param {string}   humanMsgFix Add Human message between system prompt and assistant.
 * @param {string}   charName Character name
 * @param {string}   userName User name
 */
function convertClaudeMessages(messages, prefillString, useSysPrompt, humanMsgFix, charName = '', userName = '') {
    let systemPrompt = '';
    if (useSysPrompt) {
        // Collect all the system messages up until the first instance of a non-system message, and then remove them from the messages array.
        let i;
        for (i = 0; i < messages.length; i++) {
            if (messages[i].role !== 'system') {
                break;
            }
            // Append example names if not already done by the frontend (e.g. for group chats).
            if (userName && messages[i].name === 'example_user') {
                if (!messages[i].content.startsWith(`${userName}: `)) {
                    messages[i].content = `${userName}: ${messages[i].content}`;
                }
            }
            if (charName && messages[i].name === 'example_assistant') {
                if (!messages[i].content.startsWith(`${charName}: `)) {
                    messages[i].content = `${charName}: ${messages[i].content}`;
                }
            }
            systemPrompt += `${messages[i].content}\n\n`;
        }

        messages.splice(0, i);

        // Check if the first message in the array is of type user, if not, interject with humanMsgFix or a blank message.
        // Also prevents erroring out if the messages array is empty.
        if (messages.length === 0 || (messages.length > 0 && messages[0].role !== 'user')) {
            messages.unshift({
                role: 'user',
                content: humanMsgFix || '[Start a new chat]',
            });
        }
    }
    // Now replace all further messages that have the role 'system' with the role 'user'. (or all if we're not using one)
    messages.forEach((message) => {
        if (message.role === 'system') {
            if (userName && message.name === 'example_user') {
                message.content = `${userName}: ${message.content}`;
            }
            if (charName && message.name === 'example_assistant') {
                message.content = `${charName}: ${message.content}`;
            }
            message.role = 'user';
        }
    });

    // Shouldn't be conditional anymore, messages api expects the last role to be user unless we're explicitly prefilling
    if (prefillString) {
        messages.push({
            role: 'assistant',
            content: prefillString.trimEnd(),
        });
    }

    // Since the messaging endpoint only supports user assistant roles in turns, we have to merge messages with the same role if they follow eachother
    // Also handle multi-modality, holy slop.
    let mergedMessages = [];
    messages.forEach((message) => {
        const imageEntry = message.content?.[1]?.image_url;
        const imageData = imageEntry?.url;
        const mimeType = imageData?.split(';')?.[0].split(':')?.[1];
        const base64Data = imageData?.split(',')?.[1];

        // Take care of name properties since claude messages don't support them
        if (message.name) {
            if (Array.isArray(message.content)) {
                message.content[0].text = `${message.name}: ${message.content[0].text}`;
            } else {
                message.content = `${message.name}: ${message.content}`;
            }
            delete message.name;
        }

        if (mergedMessages.length > 0 && mergedMessages[mergedMessages.length - 1].role === message.role) {
            if (Array.isArray(message.content)) {
                if (Array.isArray(mergedMessages[mergedMessages.length - 1].content)) {
                    mergedMessages[mergedMessages.length - 1].content[0].text += '\n\n' + message.content[0].text;
                } else {
                    mergedMessages[mergedMessages.length - 1].content += '\n\n' + message.content[0].text;
                }
            } else {
                if (Array.isArray(mergedMessages[mergedMessages.length - 1].content)) {
                    mergedMessages[mergedMessages.length - 1].content[0].text += '\n\n' + message.content;
                } else {
                    mergedMessages[mergedMessages.length - 1].content += '\n\n' + message.content;
                }
            }
        } else {
            mergedMessages.push(message);
        }
        if (imageData) {
            mergedMessages[mergedMessages.length - 1].content = [
                { type: 'text', text: mergedMessages[mergedMessages.length - 1].content[0]?.text || mergedMessages[mergedMessages.length - 1].content },
                {
                    type: 'image', source: {
                        type: 'base64',
                        media_type: mimeType,
                        data: base64Data,
                    },
                },
            ];
        }
    });

    return { messages: mergedMessages, systemPrompt: systemPrompt.trim() };
}

function convertClaudeExperementalMesIntoSys(messages, addAssistantPostfix, addAssistantPrefill, withSysPromptSupport, useSystemPrompt, addSysHumanMsg, HumAssistOff, SystemFul, excludePrefixes){

    //Prepare messages for claude.
    //When 'Exclude Human/Assistant prefixes' checked, setting messages role to the 'system'(last message is exception).
    if (messages.length > 0) {
        if (excludePrefixes) {
            messages.slice(0, -1).forEach(message => message.role = 'system');
        } else {
            messages[0].role = 'system';
        }
    }

    let requestPrompt = '';

    requestPrompt = requestPrompt + messages.map((v) => {
        return v.content + '\n-----\n\n';
    }).join('');

    if (!addAssistantPrefill) {
        addAssistantPrefill = '';
    }


    // eslint-disable-next-line quotes
    let Twosteps = [{ role: 'user', content: HumAssistOff },{ role: 'assistant', content: addAssistantPrefill.trimEnd() }];
    return { messages: Twosteps, systemPrompt: requestPrompt.trim() };
}

function postconvertClaudeIntoPrefill(messages, userName, charName){
    var withreturn = [];
    let newstroke = '';
    let Userchecknaming = userName.length - 2;
    let Charchecknaming = charName.length - 2;
    //use function also for extra variant of convertion
    if (messages.length > 1) {
        const chatHistory = // Собираем из истории чата огромный префил
        messages[1].content + // Первое сообщение ассистента от роли ассистента, "\n\n{{char}}:" в начало не добавляем
        messages.slice(2).map(message => {
            switch (message.role) {
                case 'user':
                    if (('\n\n' + message.content.substring(0, Userchecknaming)) == userName){
                        return '\n\n' + message.content;
                    }
                    //if (userName == '\n\n') newstroke = '\n\n';
                    (userName == '\n\n') ? (newstroke = '\n\n') : (newstroke = '');
                    return `${newstroke}${userName}: ${message.content}`;
                case 'assistant':
                    if (('\n\n' + message.content.substring(0, Charchecknaming)) == charName){
                        return '\n\n' + message.content;
                    }
                    (charName == '\n\n') ? (newstroke = '\n\n') : (newstroke = '');
                    return `${newstroke}${charName}: ${message.content}`;
                case'system':
                    return `${message.content}`;
                default:
                    return `${message.content}`;
            }
            /*const prefix = message.role === 'user' ? userName : charName;
            if (prefix == '\n\n') {
                return `${prefix}${message.content}`;
            } else if (prefix == userName) {
                return `\n\n${prefix} ${message.content}`;
            } else {
                return `${prefix} ${message.content}`;
            }*/
        }).join('') +
        (messages[messages.length - 1].role === 'assistant' ? '' : charName); // Если префила нет пихаем "\n\n{{char}}:" в конец
        withreturn = [
            messages[0], // Оставляем первую мессагу хумана как есть
            {
                role: 'assistant',
                content: chatHistory,
            },
        ];
    }
    console.log('converted into prefilled');
    return withreturn;
}


/**
 * Convert a prompt from the ChatML objects to the format used by Cohere.
 * @param {object[]} messages Array of messages
 * @param {string}   charName Character name
 * @param {string}   userName User name
 * @returns {{systemPrompt: string, chatHistory: object[], userPrompt: string}} Prompt for Cohere
 */
function convertCohereMessages(messages, charName = '', userName = '') {
    const roleMap = {
        'system': 'SYSTEM',
        'user': 'USER',
        'assistant': 'CHATBOT',
    };
    const placeholder = '[Start a new chat]';
    let systemPrompt = '';

    // Collect all the system messages up until the first instance of a non-system message, and then remove them from the messages array.
    let i;
    for (i = 0; i < messages.length; i++) {
        if (messages[i].role !== 'system') {
            break;
        }
        // Append example names if not already done by the frontend (e.g. for group chats).
        if (userName && messages[i].name === 'example_user') {
            if (!messages[i].content.startsWith(`${userName}: `)) {
                messages[i].content = `${userName}: ${messages[i].content}`;
            }
        }
        if (charName && messages[i].name === 'example_assistant') {
            if (!messages[i].content.startsWith(`${charName}: `)) {
                messages[i].content = `${charName}: ${messages[i].content}`;
            }
        }
        systemPrompt += `${messages[i].content}\n\n`;
    }

    messages.splice(0, i);

    if (messages.length === 0) {
        messages.unshift({
            role: 'user',
            content: placeholder,
        });
    }

    const lastNonSystemMessageIndex = messages.findLastIndex(msg => msg.role === 'user' || msg.role === 'assistant');
    const userPrompt = messages.slice(lastNonSystemMessageIndex).map(msg => msg.content).join('\n\n') || placeholder;

    const chatHistory = messages.slice(0, lastNonSystemMessageIndex).map(msg => {
        return {
            role: roleMap[msg.role] || 'USER',
            message: msg.content,
        };
    });

    return { systemPrompt: systemPrompt.trim(), chatHistory, userPrompt };
}

/**
 * Convert a prompt from the ChatML objects to the format used by Google MakerSuite models.
 * @param {object[]} messages Array of messages
 * @param {string} model Model name
 * @param {boolean} useSysPrompt Use system prompt
 * @param {string} charName Character name
 * @param {string} userName User name
 * @returns {{contents: *[], system_instruction: {parts: {text: string}}}} Prompt for Google MakerSuite models
 */
function convertGooglePrompt(messages, model, useSysPrompt = false, charName = '', userName = '') {
    // This is a 1x1 transparent PNG
    const PNG_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    const visionSupportedModels = [
        'gemini-1.0-pro-vision-latest',
        'gemini-1.5-pro-latest',
        'gemini-pro-vision',
    ];

    const isMultimodal = visionSupportedModels.includes(model);
    let hasImage = false;

    let sys_prompt = '';
    if (useSysPrompt) {
        while (messages.length > 1 && messages[0].role === 'system') {
            // Append example names if not already done by the frontend (e.g. for group chats).
            if (userName && messages[0].name === 'example_user') {
                if (!messages[0].content.startsWith(`${userName}: `)) {
                    messages[0].content = `${userName}: ${messages[0].content}`;
                }
            }
            if (charName && messages[0].name === 'example_assistant') {
                if (!messages[0].content.startsWith(`${charName}: `)) {
                    messages[0].content = `${charName}: ${messages[0].content}`;
                }
            }
            sys_prompt += `${messages[0].content}\n\n`;
            messages.shift();
        }
    }

    const system_instruction = { parts: { text: sys_prompt.trim() } };

    const contents = [];
    messages.forEach((message, index) => {
        // fix the roles
        if (message.role === 'system') {
            message.role = 'user';
        } else if (message.role === 'assistant') {
            message.role = 'model';
        }

        // similar story as claude
        if (message.name) {
            if (Array.isArray(message.content)) {
                message.content[0].text = `${message.name}: ${message.content[0].text}`;
            } else {
                message.content = `${message.name}: ${message.content}`;
            }
            delete message.name;
        }

        //create the prompt parts
        const parts = [];
        if (typeof message.content === 'string') {
            parts.push({ text: message.content });
        } else if (Array.isArray(message.content)) {
            message.content.forEach((part) => {
                if (part.type === 'text') {
                    parts.push({ text: part.text });
                } else if (part.type === 'image_url' && isMultimodal) {
                    parts.push({
                        inlineData: {
                            mimeType: 'image/png',
                            data: part.image_url.url,
                        },
                    });
                    hasImage = true;
                }
            });
        }

        // merge consecutive messages with the same role
        if (index > 0 && message.role === contents[contents.length - 1].role) {
            contents[contents.length - 1].parts[0].text += '\n\n' + parts[0].text;
        } else {
            contents.push({
                role: message.role,
                parts: parts,
            });
        }
    });

    // pro 1.5 doesn't require a dummy image to be attached, other vision models do
    if (isMultimodal && model !== 'gemini-1.5-pro-latest' && !hasImage) {
        contents[0].parts.push({
            inlineData: {
                mimeType: 'image/png',
                data: PNG_PIXEL,
            },
        });
    }

    return { contents: contents, system_instruction: system_instruction };
}

/**
 * Convert a prompt from the ChatML objects to the format used by Text Completion API.
 * @param {object[]} messages Array of messages
 * @returns {string} Prompt for Text Completion API
 */
function convertTextCompletionPrompt(messages) {
    if (typeof messages === 'string') {
        return messages;
    }

    const messageStrings = [];
    messages.forEach(m => {
        if (m.role === 'system' && m.name === undefined) {
            messageStrings.push('System: ' + m.content);
        }
        else if (m.role === 'system' && m.name !== undefined) {
            messageStrings.push(m.name + ': ' + m.content);
        }
        else {
            messageStrings.push(m.role + ': ' + m.content);
        }
    });
    return messageStrings.join('\n') + '\nassistant:';
}

module.exports = {
    convertClaudePrompt,
    convertClaudeMessages,
    convertGooglePrompt,
    convertTextCompletionPrompt,
    convertClaudeExperementalMesIntoSys,
    postconvertClaudeIntoPrefill,
    convertCohereMessages,
};
