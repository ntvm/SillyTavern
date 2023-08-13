import { getStringHash, debounce, waitUntilCondition, extractAllWords } from "../../utils.js";
import { getContext, getApiUrl, extension_settings, doExtrasFetch, modules } from "../../extensions.js";
import { eventSource, event_types, extension_prompt_types, generateQuietPrompt, callPopup, getRequestHeaders, is_send_press, saveSettingsDebounced, saveSettings, substituteParams } from "../../../script.js";
import { is_group_generating, selected_group } from "../../group-chats.js";
import { oai_settings } from "../../openai.js";



export { MODULE_NAME };

const MODULE_NAME = 'Nvkun';

let lastCharacterId = null;
let lastGroupId = null;
let lastChatId = null;
let lastMessageHash = null;
let lastMessageId = null;
let inApiCall = false;




const saveChatDebounced = debounce(() => getContext().saveChat(), 2000);




let presets = [];
let selected_preset = '';
let defaultPrompt = '';


const defaultSettings = {
    
    Inputer_frozen: false,
    Inputer_prompt: defaultPrompt,
    position: extension_prompt_types.AFTER_SCENARIO,
    depth: 2,
	AlwaysCharnames: true,
    selectedPreset: ''
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

    updatePresetList()   

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

//Savesets	

async function savePreset() {
const name = await callPopup('Enter a name for Preset:', 'input');
if (!name) {
    return;
}

const NvPreset = {
    name: name,
    Inputer_frozen: extension_settings.Nvkun.Inputer_frozen,
    Inputer_prompt: extension_settings.Nvkun.Inputer_prompt,
    position: extension_settings.Nvkun.position,
    depth: extension_settings.Nvkun.depth,
	AlwaysCharnames: extension_settings.Nvkun.AlwaysCharnames,
}

const response = await fetch('/saveNv', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(NvPreset)
});

if (response.ok) {
    const PresetIndex = presets.findIndex(x => x.name == name);

    if (PresetIndex == -1) {
        presets.push(NvPreset);
        const option = document.createElement('option');
        option.selected = true;
        option.value = name;
        option.innerText = name;
        $('#NvPresets').append(option);
    }
    else {
        presets[PresetIndex] = NvPreset;
        $(`#NvPresets option[value="${name}"]`).attr('selected', true);
    }
    saveSettingsDebounced();
} else {
    toastr.warning('Failed to save  Preset.')
}
}
	
async function applyNvPreset(name) {
    const NvPreset = presets.find(x => x.name == name);

    if (!NvPreset) {
        toastr.warning(`error, preset '${name}' not found. Confirm you are using proper case sensitivity!`)
        return;
    }

    extension_settings.Nvkun = NvPreset;
    extension_settings.Nvkun.selectedPreset = name;
    saveSettingsDebounced()
    loadFSettings()
    loadSettings()
	moduleWorker();

    $(`#NvPresets option[value="${name}"]`).attr('selected', true);
    console.debug('QR Preset applied: ' + name);
}


async function loadFSettings(type) {
await updatePresetList()
}

async function moduleWorker() {
selected_preset = extension_settings.Nvkun.selectedPreset;
}	

//method from worldinfo
async function updatePresetList() {
    var result = await fetch("/getsettings", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });

    if (result.ok) {
        var data = await result.json();
        presets = data.NvPresets?.length ? data.NvPresets : [];
        console.log(presets)
        $("#NvPresets").find('option[value!=""]').remove();


        if (presets !== undefined) {
            presets.forEach((item, i) => {
                $("#NvPresets").append(`<option value='${item.name}'${selected_preset.includes(item.name) ? ' selected' : ''}>${item.name}</option>`);
            });
        }
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
                    </div>
                    <div>
                        <label for="Inputer_frozen"><input id="Inputer_frozen" type="checkbox" />activate insertion</label>
                    </div>
                    <div>
                        <select id="NvPresets" name="preset">
                        </select>
                        <i id="PresetSaveButton" class="fa-solid fa-save"></i>
                    </div>
                </div>
            </div>
        </div>
        `;
        $('#extensions_settings2').append(settingsHtml);
        $('#Inputer_frozen').on('input', onInputerFrozenInput);
        $('#AlwaysCharnames').on('change', onAlwaysCharnamesChange);
        $('#Inputer_prompt').on('input', onInputerPromptInput);
        $("#PresetSaveButton").on('click', savePreset);
        $("#NvPresets").on('change', async function () {
            const NvPresetSelected = $(this).find(':selected').val();
            extension_settings.NvPreset = NvPresetSelected;
            applyNvPreset(NvPresetSelected);
            saveSettingsDebounced();
		});
    }

    addExtensionControls();
    loadSettings();
});

