/**
 * Convert a prompt from the ChatML objects to the format used by Claude.
 * @param {object[]} messages Array of messages
 * @param {boolean} addHumanPrefix Add Human prefix
 * @param {boolean} addAssistantPostfix Add Assistant postfix
 * @param {boolean} withSystemPrompt Build system prompt before "\n\nHuman: "
 * @returns {string} Prompt for Claude
 * @copyright Prompt Conversion script taken from RisuAI by kwaroran (GPLv3).
 */
function convertClaudePrompt(messages, addHumanPrefix, addAssistantPostfix, withSystemPrompt HumAssistOff, SystemFul) {
    // Claude doesn't support message names, so we'll just add them to the message content.
    let requestPrompt;


    let systemPrompt = '';
    if (withSystemPrompt) {
        let lastSystemIdx = -1;

        for (let i = 0; i < messages.length - 1; i++) {
            const message = messages[i];
            if (message.role === 'system' && !message.name) {
                systemPrompt += message.content + '\n\n';
            } else {
                lastSystemIdx = i - 1;
                break;
            }
        }
        if (lastSystemIdx >= 0) {
            messages.splice(0, lastSystemIdx + 1);
        }
    }


    switch (HumAssistOff) {
        // If it is true, Now you won't had H and A
        case true:
            var requestPrompt = ''

            if (withSystemPrompt) {
                requestPrompt = systemPrompt + requestPrompt;
            }

            requestPrompt = requestPrompt + messages.map((v) => {
                return v.content+"\n\n";
            }).join('');

            if (addHumanPrefix) {
                requestPrompt = "\n\nHuman: " + requestPrompt;
            }

            if (addAssistantPostfix) {
                requestPrompt = requestPrompt + '\n\nAssistant: ';
            }

            return requestPrompt;
            break
        // If it is false or anything else, use the RisuAI original code
        default:
            // Claude doesn't support message names, so we'll just add them to the message content.
            for (const message of messages) {
                if (message.name && message.role !== "system") {
                    message.content = message.name + ": " + message.content;
                    delete message.name;
                }
            }

            requestPrompt = messages.map((v) => {
                let prefix = '';
                switch (v.role) {
                    case "assistant":
                        prefix = "\n\nAssistant: ";
                        break
                    case "user":
                        prefix = "\n\nHuman: ";
                        break
                    case "system":
                        // According to the Claude docs, H: and A: should be used for example conversations.
                        if (v.name === "example_assistant") {
                            prefix = "\n\nA: ";
                        } else if (v.name === "example_user") {
                            prefix = "\n\nH: ";
                        } else {
                            switch (SystemFul) {
                                case true:
                                    prefix = "\n\nSystem: ";
                                    break
                                default:
                                    prefix = "\n\n";
                                    break
                            }
                        }
                        break
                }
                return prefix + v.content;
            }).join('');

            if (addHumanPrefix) {
                requestPrompt = "\n\nHuman: " + requestPrompt;
            }

            if (addAssistantPostfix) {
                requestPrompt = requestPrompt + '\n\nAssistant: ';
            }

            if (withSystemPrompt) {
                requestPrompt = systemPrompt + requestPrompt;
            }

            return requestPrompt;
    }

}

module.exports = {
    convertClaudePrompt,
};
