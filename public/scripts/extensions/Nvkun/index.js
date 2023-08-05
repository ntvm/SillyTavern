import { getStringHash, debounce, waitUntilCondition, extractAllWords } from "../../utils.js";
import { getContext, getApiUrl, extension_settings, doExtrasFetch, modules } from "../../extensions.js";
import { eventSource, event_types, extension_prompt_types, generateQuietPrompt, is_send_press, saveSettingsDebounced, saveSettings, substituteParams } from "../../../script.js";
import { is_group_generating, selected_group } from "../../group-chats.js";



export { MODULE_NAME };

const MODULE_NAME = 'Nvkun';

let lastCharacterId = null;
let lastGroupId = null;
let lastChatId = null;
let lastMessageHash = null;
let lastMessageId = null;
let inApiCall = false;




const saveChatDebounced = debounce(() => getContext().saveChat(), 2000);





const defaultPrompt = '';


const defaultSettings = {
    
    Inputer_frozen: false,
    Inputer_prompt: defaultPrompt,
    position: extension_prompt_types.AFTER_SCENARIO,
    depth: 2,
	AlwaysCharnames: true,
};

function loadSettings() {
    if (Object.keys(extension_settings.Nvkun).length === 0) {
        Object.assign(extension_settings.Nvkun, defaultSettings);
    }

    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings.Nvkun[key] === undefined) {
            extension_settings.Nvkun[key] = defaultSettings[key];
        }
    }

    
    $('#AlwaysCharnames').val(extension_settings.Nvkun.AlwaysCharnames).trigger('change');
    $('#Inputer_frozen').prop('checked', extension_settings.Nvkun.Inputer_frozen).trigger('input');
    $('#Inputer_prompt').val(extension_settings.Nvkun.Inputer_prompt).trigger('input');
}



function onAlwaysCharnamesChange(event) {
    const value = event.target.value;
    extension_settings.Nvkun.AlwaysCharnames = value;
    $('#Nvkun_settings [AlwaysCharnames]').each((_, element) => {
        const source = $(element).data('source');
    });    
    saveSettingsDebounced();
}



function onInputerFrozenInput() {
    const value = Boolean($(this).prop('checked'));
    extension_settings.Nvkun.Inputer_frozen = value;
    saveSettingsDebounced();
}


function onInputerPromptInput() {
    const value = $(this).val();
    extension_settings.Nvkun.Inputer_prompt = value;
    saveSettingsDebounced();
	setInputerContext(value, true);
}



function setInputerContext(value, saveToMessage) {
	switch (Inputer_frozen) {
		case true:
			break
		default:
			var formatMemoryValue = (value) => value ? `\n${value.trim()}` : '';
			var context = getContext();
			context.setExtensionPrompt(MODULE_NAME, formatMemoryValue(value), extension_prompt_types.AFTER_SCENARIO, extension_settings.Nvkun.depth);
			$('#Inputer_prompt').val(value);
			console.log('Summary set to: ' + value);
			console.debug('Position: ' + extension_settings.Nvkun.position);
			console.debug('Depth: ' + extension_settings.Nvkun.depth);

			if (saveToMessage && context.chat.length) {
				const idx = context.chat.length - 2;
				const mes = context.chat[idx < 0 ? 0 : idx];

				if (!mes.extra) {
				mes.extra = {};
				}

			    mes.extra.Nvkun = value;
			    saveSettingsDebounced();
			}
			break
		}
}
	


	


jQuery(function () {
    function addExtensionControls() {
        const settingsHtml = `
        <div id="Nvkun_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Nv-Kun Settings</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label for="AlwaysCharnames">Charnames included:</label>
                    <select id="AlwaysCharnames">
                        <option value="true">true</option>
                        <option value="false">false</option>
                    </select>
                	<label for="Inputer_prompt">Current XMLK AfterScenario: </label>
                    <textarea id="Inputer_prompt" class="text_pole textarea_compact" rows="6" placeholder="Put there things, what supposed be in author's notes here..."></textarea>
                    <div class="Inputer_contents_controls">
                        <label for="Inputer_frozen"><input id="Inputer_frozen" type="checkbox" />acticate insertion</label>
                    </div>
                </div>
            </div>
        </div>
        `;
        $('#extensions_settings2').append(settingsHtml);
        $('#Inputer_frozen').on('input', onInputerFrozenInput);
        $('#AlwaysCharnames').on('change', onAlwaysCharnamesChange);
        $('#Inputer_prompt').on('input', onInputerPromptInput);
    }

    addExtensionControls();
    loadSettings();

});

