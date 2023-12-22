import { debounce } from "../../utils.js";
import { extension_settings, modules } from "../../extensions.js";
import { writeSecret } from "../../secrets.js";
import { proxy_info } from "../shared.js";
import { eventSource, event_types, callPopup, getRequestHeaders, saveSettingsDebounced, saveSettings, substituteParams  } from "../../../script.js";
import { oai_settings } from "../../openai.js";



export { MODULE_NAME };

const MODULE_NAME = 'ProxyManager';


let presets = [];
let selected_preset = '';
let defaultPrompt = '';


const defaultSettings = {
    
    selectedPreset: '',
    ProxyURL: '',
    ProxyPassword: '',
    ProxyPrior: false,
    Useinsteadkey: false,
};


function loadSettings() {
    if (Object.keys(extension_settings.ProxyManager).length === 0) {
        Object.assign(extension_settings.ProxyManager, defaultSettings);
    }

    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings.ProxyManager[key] === undefined) {
            extension_settings.ProxyManager[key] = defaultSettings[key];
        }
    }

    updatePresetList()   

    $('#ProxyURL').val(extension_settings.ProxyManager.ProxyURL).trigger('input');
    $('#ProxyPassword').val(extension_settings.ProxyManager.ProxyPassword).trigger('input');
    $('#ProxyPrior').prop('checked', extension_settings.ProxyManager.ProxyPrior).trigger('input');
    $('#Useinsteadkey').prop('checked', extension_settings.ProxyManager.Useinsteadkey).trigger('input');

}



function onProxyURLInput() {
    const value = $(this).val();
    extension_settings.ProxyManager.ProxyURL = value;
    saveSettingsDebounced();
}

function onProxyPasswordInput() {
    const value = $(this).val();
    extension_settings.ProxyManager.ProxyPassword = value;
    saveSettingsDebounced();
}

function onProxyPrior() {
    const value = Boolean($(this).prop('checked'));
    extension_settings.ProxyManager.ProxyPrior = value;
    saveSettingsDebounced();
}
	
function onUseinsteadkey() {
    const value = Boolean($(this).prop('checked'));
    extension_settings.ProxyManager.Useinsteadkey = value;
    saveSettingsDebounced();
}



function onSecretWrite(){
    var array = proxy_info();
    var stype = "api_oai_proxy";
    writeSecret(stype, array);
}

//Savesets	

async function saveProxy() {
const name = await callPopup('Enter a name for Preset:', 'input');
if (!name) {
    return;
}

const ProxyPreset = {
    name: name,
    ProxyURL: extension_settings.ProxyManager.ProxyURL,
    ProxyPassword: extension_settings.ProxyManager.ProxyPassword,
    ProxyPrior: extension_settings.ProxyManager.ProxyPrior,
}

const response = await fetch('/saveProxy', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(ProxyPreset)
});

if (response.ok) {
    const PresetIndex = presets.findIndex(x => x.name == name);

    if (PresetIndex == -1) {
        presets.push(ProxyPreset);
        const option = document.createElement('option');
        option.selected = true;
        option.value = name;
        option.innerText = name;
        $('#ProxyPresets').append(option);
    }
    else {
        presets[PresetIndex] = ProxyPreset;
        $(`#ProxyPresets option[value="${name}"]`).attr('selected', true);
    }
    saveSettingsDebounced();
} else {
    toastr.warning('Failed to save  Preset.')
}
}
	
async function applyProxyPreset(name) {
    const ProxyPreset = presets.find(x => x.name == name);

    if (!ProxyPreset) {
        toastr.warning(`error, preset '${name}' not found. Confirm you are using proper case sensitivity!`)
        return;
    }

    extension_settings.ProxyManager = ProxyPreset;
    extension_settings.ProxyManager.selectedPreset = name;
    saveSettingsDebounced()
    loadFSettings()
    loadSettings()
	moduleWorker();

    $(`#ProxyPresets option[value="${name}"]`).attr('selected', true);
    console.debug('QR Preset applied: ' + name);
}


async function loadFSettings(type) {
await updatePresetList()
}

async function moduleWorker() {
selected_preset = extension_settings.ProxyManager.selectedPreset;
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
        presets = data.ProxyManager?.length ? data.ProxyManager : [];
        console.log(presets)
        $("#ProxyPresets").find('option[value!=""]').remove();


        if (presets !== undefined) {
            presets.forEach((item, i) => {
                $("#ProxyPresets").append(`<option value='${item.name}'${selected_preset.includes(item.name) ? ' selected' : ''}>${item.name}</option>`);
            });
        }
    }
}

async function deleteProxyPreset() {
    const selectedPresetName = extension_settings.ProxyManager.selectedPreset;
    if (!selectedPresetName || selectedPresetName === '') {
        toastr.warning('No preset selected for deletion. Select a preset first.');
        return;
    }

    const confirmation = await callPopup(`Are you sure you want to DELETE the selected proxy preset? This action cannot be undone. Make sure You wanna delete '${selectedPresetName}' `, 'confirm');
    if (!confirmation){
        toastr.info('Deletion cancelled.');
        return;
    }

    const response = await fetch('/deleteProxy', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: selectedPresetName })
    });

    if(response.ok){
        presets = presets.filter(preset => preset.name !== selectedPresetName);
        $(`#ProxyPresets option[value="${selectedPresetName}"]`).remove();
        toastr.success(`The preset '${selectedPresetName}' has been deleted.`);
        saveSettingsDebounced();
    } else {
        toastr.error('Failed to delete the preset. Something borked.');
    }
}


jQuery(function () {
    function addExtensionControls() {
        const settingsHtml = `
        <div id="ProxyManager_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Proxy Manager</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                        <select id="ProxyPresets" name="preset">
                        </select>
                    <div>
                    <label for="ProxyURL">Current proxy URL: </label>
                    <textarea id="ProxyURL" class="text_pole textarea_compact" rows="2" placeholder="Put proxy URL here..."></textarea>
                    <div>
                    <label for="ProxyPassword">Current proxy password: </label>
                    <textarea id="ProxyPassword" class="text_pole textarea_compact" rows="2" placeholder="Put proxy password here..."></textarea>
                    <div>
                        <label class="checkbox_label for="ProxyPrior"><input id="ProxyPrior" type="checkbox" />Activate proxy manager</label>
                    </div>
                    <div>
                        <label class="checkbox_label for="Useinsteadkey"><input id="Useinsteadkey" type="checkbox" />Use instead OAI key</label>
                    </div>
                    <br>
                    <div>
                        <i id="ProxySaveButton" class="fa-solid fa-save" style="margin-left: 5px;"></i>
                        <i id="ProxyDeleteButton" class="fa-solid fa-trash" style="float: right;"></i>
                        <i id="SaveInSecretButton" class="fa-solid fa-cog" title="Save in secrets" style="margin-left: 1px; span="Save in secrets"></i>
                    </div>
                </div>
            </div>
        </div>
        `;
        $('#extensions_settings2').append(settingsHtml);
        $("#ProxySaveButton").on('click', saveProxy);
        $('#ProxyPrior').on('input', onProxyPrior);
        $('#SaveInSecretButton').on('click', onSecretWrite);
        $('#Useinsteadkey').on('input', onUseinsteadkey);
        $('#ProxyURL').on('input', onProxyURLInput);
        $('#ProxyPassword').on('input', onProxyPasswordInput);
        $("#ProxyDeleteButton").on('click', deleteProxyPreset);
        $("#ProxyPresets").on('change', async function () {
            const ProxyPresetSelected = $(this).find(':selected').val();
            extension_settings.ProxyPreset = ProxyPresetSelected;
            applyProxyPreset(ProxyPresetSelected);
            saveSettingsDebounced();
		});
    }
	
    addExtensionControls();
    loadSettings();
});

