/*
TODO:
- Security
- Features
    - curve choice etc.
*/

import { saveSettingsDebounced, event_types, eventSource, getRequestHeaders, hideSwipeButtons, showSwipeButtons, scrollChatToBottom, messageFormatting, isOdd, countOccurrences } from "../../../../script.js";
import { getContext, extension_settings, ModuleWorkerWrapper } from "../../../extensions.js";
import { autoModeOptions, translate } from "../../translate/index.js";
export { MODULE_NAME };

import { pitchShiftFile } from "./pitch_shift.js";

const extensionFolderPath = `scripts/extensions/third-party/Extension-Blip`;

const MODULE_NAME = 'Blip';
const DEBUG_PREFIX = "<Blip extension> ";
const UPDATE_INTERVAL = 100;

let characters_list = [] // Updated with module worker
let blip_assets = null; // Initialized only once with module workers

let is_in_text_animation = false;
let is_animation_pause = false;

let current_multiplier = 1.0;

let chat_queue = [];

let abort_animation = false;

// Define a context for the Web Audio API
let audioContext = new (window.AudioContext || window.webkitAudioContext)();

let user_message_to_render = -1;

let is_text_to_blip = true;

let is_continue = false;
let last_message = null;

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    enabled: false,
    enableUser: false,
    onlyQuote: false,
    ignoreAsterisk: false,
    autoScrollChatToAnimation: false,

    showAllCharacters: false,

    audioMuted: true,
    audioVolume: 50,

    minSpeedMultiplier: 1.0,
    maxSpeedMultiplier: 1.0,
    commaDelay: 0,
    phraseDelay: 0,

    textSpeed: 10,

    audioVolumeMultiplier: 100,
    audioSpeed: 80,
    audioMinPitch: 1,
    audioMaxPitch: 1,
    audioPlayFull: false,

    generatedMinFrequency: 440,
    generatedMaxFrequency: 440,
    
    voiceMap: {},
}

const presets = {
    "default": {
        minSpeedMultiplier: 1.0,
        maxSpeedMultiplier: 1.0,
        commaDelay: 0,
        phraseDelay: 0,
    
        textSpeed: 10,
    
        audioVolumeMultiplier: 100,
        audioSpeed: 80,
        audioMinPitch: 1,
        audioMaxPitch: 1,
        audioPlayFull: false,
    
        generatedMinFrequency: 440,
        generatedMaxFrequency: 440, 
    },
    "dynamic speed / static frequency (low pitch)": {
        minSpeedMultiplier: 0.5,
        maxSpeedMultiplier: 1.5,
        commaDelay: 250,
        phraseDelay: 500,
    
        textSpeed: 10,
    
        audioVolumeMultiplier: 100,
        audioSpeed: 80,
        audioMinPitch: 1,
        audioMaxPitch: 1,
        audioPlayFull: false,
    
        generatedMinFrequency: 300,
        generatedMaxFrequency: 300, 
    },
    "dynamic speed / static frequency (medium pitch)": {
        minSpeedMultiplier: 0.5,
        maxSpeedMultiplier: 1.5,
        commaDelay: 250,
        phraseDelay: 500,
    
        textSpeed: 10,
    
        audioVolumeMultiplier: 100,
        audioSpeed: 80,
        audioMinPitch: 1,
        audioMaxPitch: 1,
        audioPlayFull: false,
    
        generatedMinFrequency: 600,
        generatedMaxFrequency: 600, 
    },
    "dynamic speed / static frequency (high pitch)": {
        minSpeedMultiplier: 0.5,
        maxSpeedMultiplier: 1.5,
        commaDelay: 250,
        phraseDelay: 500,
    
        textSpeed: 10,
    
        audioVolumeMultiplier: 100,
        audioSpeed: 80,
        audioMinPitch: 1,
        audioMaxPitch: 1,
        audioPlayFull: false,
    
        generatedMinFrequency: 1200,
        generatedMaxFrequency: 1200, 
    },
    "dynamic speed / random frequency (low pitch)": {
        minSpeedMultiplier: 0.5,
        maxSpeedMultiplier: 1.5,
        commaDelay: 250,
        phraseDelay: 500,
    
        textSpeed: 10,
    
        audioVolumeMultiplier: 100,
        audioSpeed: 80,
        audioMinPitch: 1,
        audioMaxPitch: 1,
        audioPlayFull: false,
    
        generatedMinFrequency: 300,
        generatedMaxFrequency: 600, 
    },
    "dynamic speed / random frequency (med pitch)": {
        minSpeedMultiplier: 0.5,
        maxSpeedMultiplier: 1.5,
        commaDelay: 250,
        phraseDelay: 500,
    
        textSpeed: 10,
    
        audioVolumeMultiplier: 100,
        audioSpeed: 80,
        audioMinPitch: 1,
        audioMaxPitch: 1,
        audioPlayFull: false,
    
        generatedMinFrequency: 600,
        generatedMaxFrequency: 1200, 
    },
    "dynamic speed / random frequency (high pitch)": {
        minSpeedMultiplier: 0.5,
        maxSpeedMultiplier: 1.5,
        commaDelay: 250,
        phraseDelay: 500,
    
        textSpeed: 10,
    
        audioVolumeMultiplier: 100,
        audioSpeed: 80,
        audioMinPitch: 1,
        audioMaxPitch: 1,
        audioPlayFull: false,
    
        generatedMinFrequency: 1200,
        generatedMaxFrequency: 1600, 
    },
    "Sans style (better use with the blip file)": {
        minSpeedMultiplier: 0.9,
        maxSpeedMultiplier: 1.1,
        commaDelay: 150,
        phraseDelay: 300,
    
        textSpeed: 10,
    
        audioVolumeMultiplier: 100,
        audioSpeed: 60,
        audioMinPitch: 1,
        audioMaxPitch: 1,
        audioPlayFull: false,
    
        generatedMinFrequency: 650,
        generatedMaxFrequency: 650,
    }
}

function loadSettings() {
    if (extension_settings.blip === undefined)
        extension_settings.blip = {};

    // Ensure good format
    if (Object.keys(extension_settings.blip).length === 0) {
        Object.assign(extension_settings.blip, defaultSettings)
    }

    $("#blip_enabled").prop('checked', extension_settings.blip.enabled);
    $("#blip_enable_user").prop('checked', extension_settings.blip.enableUser);
    $("#blip_only_quoted").prop('checked', extension_settings.blip.onlyQuote);
    $("#blip_ignore_asterisks").prop('checked', extension_settings.blip.ignoreAsterisk);
    $("#blip_auto_scroll_to_animation").prop('checked', extension_settings.blip.autoScrollChatToAnimation);

    $("#blip_show_all_characters").prop('checked', extension_settings.blip.showAllCharacters);

    if (extension_settings.blip.audioMuted) {
        $("#blip_audio_mute_icon").removeClass("fa-volume-high");
        $("#blip_audio_mute_icon").addClass("fa-volume-mute");
        $("#blip_audio_mute").addClass("redOverlayGlow");
    }
    else {
        $("#blip_audio_mute_icon").addClass("fa-volume-high");
        $("#blip_audio_mute_icon").removeClass("fa-volume-mute");
        $("#blip_audio_mute").removeClass("redOverlayGlow");
    }

    $("#blip_audio_volume").text(extension_settings.blip.audioVolume);
    $("#blip_audio_volume_slider").val(extension_settings.blip.audioVolume);
    
    $("#blip_preset_select").find('option')
            .remove()
            .end()
            .append('<option value="none">Select Preset</option>')
            .val('none')
    for (const i in presets) {
        $("#blip_preset_select").append(`<option value="${i}">${i}</option>`);
    }

    $('#blip_min_speed_multiplier').val(extension_settings.blip.minSpeedMultiplier);
    $('#blip_min_speed_multiplier_value').text(extension_settings.blip.minSpeedMultiplier);

    $('#blip_max_speed_multiplier').val(extension_settings.blip.maxSpeedMultiplier);
    $('#blip_max_speed_multiplier_value').text(extension_settings.blip.maxSpeedMultiplier);

    $('#blip_comma_delay').val(extension_settings.blip.commaDelay);
    $('#blip_comma_delay_value').text(extension_settings.blip.commaDelay);

    $('#blip_phrase_delay').val(extension_settings.blip.phraseDelay);
    $('#blip_phrase_delay_value').text(extension_settings.blip.phraseDelay);

    $('#blip_text_speed').val(extension_settings.blip.textSpeed);
    $('#blip_text_speed_value').text(extension_settings.blip.textSpeed);
    
    $('#blip_audio_volume_multiplier').val(extension_settings.blip.audioVolumeMultiplier);
    $('#blip_audio_volume_multiplier_value').text(extension_settings.blip.audioVolumeMultiplier);

    $('#blip_audio_speed').val(extension_settings.blip.audioSpeed);
    $('#blip_audio_speed_value').text(extension_settings.blip.audioSpeed);

    $('#blip_audio_min_pitch').val(extension_settings.blip.audioMinPitch);
    $('#blip_audio_min_pitch_value').text(extension_settings.blip.audioMinPitch);

    $('#blip_audio_max_pitch').val(extension_settings.blip.audioMaxPitch);
    $('#blip_audio_max_pitch_value').text(extension_settings.blip.audioMaxPitch);

    $("#blip_audio_play_full").prop('checked', extension_settings.blip.audioPlayFull);

    $('#blip_generated_min_frequency').val(extension_settings.blip.generatedMinFrequency);
    $('#blip_generated_min_frequency_value').text(extension_settings.blip.generatedMinFrequency);

    $('#blip_generated_max_frequency').val(extension_settings.blip.generatedMaxFrequency);
    $('#blip_generated_max_frequency_value').text(extension_settings.blip.generatedMaxFrequency);

    updateVoiceMapText();
}

function warningCharacterNotSelected() {
    toastr.warning("Character not selected.", DEBUG_PREFIX + " cannot apply change", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
}

async function onEnabledClick() {
    extension_settings.blip.enabled = $('#blip_enabled').is(':checked');
    saveSettingsDebounced();
    showLastMessage();
}

async function onEnableUserClick() {
    extension_settings.blip.enableUser = $('#blip_enable_user').is(':checked');
    saveSettingsDebounced();
}

async function onOnlyQuotedClick() {
    extension_settings.blip.onlyQuote = $('#blip_only_quoted').is(':checked');
    saveSettingsDebounced();
}

async function onIgnoreAsteriskClick() {
    extension_settings.blip.ignoreAsterisk = $('#blip_ignore_asterisks').is(':checked');
    saveSettingsDebounced();
}

async function onAutoScrollChatToAnimationClick() {
    extension_settings.blip.autoScrollChatToAnimation = $('#blip_auto_scroll_to_animation').is(':checked');
    saveSettingsDebounced();
}

async function onAudioMuteClick() {
    extension_settings.blip.audioMuted = !extension_settings.blip.audioMuted;
    $("#blip_audio_mute_icon").toggleClass("fa-volume-high");
    $("#blip_audio_mute_icon").toggleClass("fa-volume-mute");
    $("#blip_audio_mute").toggleClass("redOverlayGlow");
    saveSettingsDebounced();
}

async function onAudioVolumeChange() {
    extension_settings.blip.audioVolume = ~~($("#blip_audio_volume_slider").val());
    $("#blip_audio_volume").text(extension_settings.blip.audioVolume);
    saveSettingsDebounced();
}

async function onCharacterChange() {
    const character = $("#blip_character_select").val();
    $("#blip_preset_select").val("none");

    if (character == "none") {
        loadSettings();
        return;
    }

    if (extension_settings.blip.voiceMap[character] === undefined) {
        applySetting();
        return;
    }

    const character_settings = extension_settings.blip.voiceMap[character]
    
    $('#blip_text_speed').val(character_settings.textSpeed);
    $('#blip_text_speed_value').text(character_settings.textSpeed);

    $('#blip_min_speed_multiplier').val(character_settings.minSpeedMultiplier);
    $('#blip_min_speed_multiplier_value').text(character_settings.minSpeedMultiplier);

    $('#blip_max_speed_multiplier').val(character_settings.maxSpeedMultiplier);
    $('#blip_max_speed_multiplier_value').text(character_settings.maxSpeedMultiplier);

    $('#blip_comma_delay').val(character_settings.commaDelay);
    $('#blip_comma_delay_value').text(character_settings.commaDelay);

    $('#blip_phrase_delay').val(character_settings.phraseDelay);
    $('#blip_phrase_delay_value').text(character_settings.phraseDelay);

    $('#blip_audio_volume_multiplier').val(character_settings.audioVolume);
    $('#blip_audio_volume_multiplier_value').text(character_settings.audioVolume);

    $('#blip_audio_speed').val(character_settings.audioSpeed);
    $('#blip_audio_speed_value').text(character_settings.audioSpeed);

    if (character_settings.audioOrigin == "file") {
        $("#blip_audio_origin").val("file");
        $("#blip_file_settings").show();
        $("#blip_generated_settings").hide();

        $("#blip_file_asset_select").val(character_settings.audioSettings.asset);

        $('#blip_audio_min_pitch').val(character_settings.audioSettings.minPitch);
        $('#blip_audio_min_pitch_value').text(character_settings.audioSettings.minPitch);
        $('#blip_audio_max_pitch').val(character_settings.audioSettings.maxPitch);
        $('#blip_audio_max_pitch_value').text(character_settings.audioSettings.maxPitch);
        $("#blip_audio_play_full").prop('checked', character_settings.audioSettings.wait);
    }

    if (character_settings.audioOrigin == "generated") {
        $("#blip_audio_origin").val("generated");
        $("#blip_file_settings").hide();
        $("#blip_generated_settings").show();

        $('#blip_generated_min_frequency').val(character_settings.audioSettings.minFrequency);
        $('#blip_generated_min_frequency_value').text(character_settings.audioSettings.minFrequency);
        $('#blip_generated_max_frequency').val(character_settings.audioSettings.maxFrequency);
        $('#blip_generated_max_frequency_value').text(character_settings.audioSettings.maxFrequency);
    }
}

async function onCharacterRefreshClick() {
    updateCharactersList();
    $("#blip_character_select").val("none");
    $("#blip_preset_select").val("none");
}

async function onShowAllCharactersClick() {
    extension_settings.blip.showAllCharacters = $('#blip_show_all_characters').is(':checked');
    saveSettingsDebounced();
    updateCharactersList();
    $("#blip_preset_select").val("none");
}

async function onPresetChange() {
    const preset_selected = $("#blip_preset_select").val()

    if (preset_selected == "None") {
        console.debug(DEBUG_PREFIX,"No preset selected nothing to do");
        return
    }

    const preset = presets[preset_selected];

    $('#blip_min_speed_multiplier').val(preset.minSpeedMultiplier);
    $('#blip_min_speed_multiplier_value').text(preset.minSpeedMultiplier);

    $('#blip_max_speed_multiplier').val(preset.maxSpeedMultiplier);
    $('#blip_max_speed_multiplier_value').text(preset.maxSpeedMultiplier);

    $('#blip_comma_delay').val(preset.commaDelay);
    $('#blip_comma_delay_value').text(preset.commaDelay);

    $('#blip_phrase_delay').val(preset.phraseDelay);
    $('#blip_phrase_delay_value').text(preset.phraseDelay);

    $('#blip_text_speed').val(preset.textSpeed);
    $('#blip_text_speed_value').text(preset.textSpeed);
    
    $('#blip_audio_volume_multiplier').val(preset.audioVolumeMultiplier);
    $('#blip_audio_volume_multiplier_value').text(preset.audioVolumeMultiplier);

    $('#blip_audio_speed').val(preset.audioSpeed);
    $('#blip_audio_speed_value').text(preset.audioSpeed);

    $('#blip_audio_min_pitch').val(preset.audioMinPitch);
    $('#blip_audio_min_pitch_value').text(preset.audioMinPitch);

    $('#blip_audio_max_pitch').val(preset.audioMaxPitch);
    $('#blip_audio_max_pitch_value').text(preset.audioMaxPitch);

    $("#blip_audio_origin").val("generated");
    $("#blip_file_settings").hide();
    $("#blip_generated_settings").show();
    $("#blip_audio_play_full").prop('checked', preset.audioPlayFull);

    $('#blip_generated_min_frequency').val(preset.generatedMinFrequency);
    $('#blip_generated_min_frequency_value').text(preset.generatedMinFrequency);

    $('#blip_generated_max_frequency').val(preset.generatedMaxFrequency);
    $('#blip_generated_max_frequency_value').text(preset.generatedMaxFrequency);

    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    saveSettingsDebounced();
}

async function onMinSpeedChange() {
    extension_settings.blip.minSpeedMultiplier = Number($('#blip_min_speed_multiplier').val());
    $("#blip_min_speed_multiplier_value").text(extension_settings.blip.minSpeedMultiplier);
    saveSettingsDebounced();

    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function onMaxSpeedChange() {
    extension_settings.blip.maxSpeedMultiplier = Number($('#blip_max_speed_multiplier').val());
    $("#blip_max_speed_multiplier_value").text(extension_settings.blip.maxSpeedMultiplier)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function onCommaDelayChange() {
    extension_settings.blip.commaDelay = Number($('#blip_comma_delay').val());
    $("#blip_comma_delay_value").text(extension_settings.blip.commaDelay)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function onPhraseDelayChange() {
    extension_settings.blip.phraseDelay = Number($('#blip_phrase_delay').val());
    $("#blip_phrase_delay_value").text(extension_settings.blip.phraseDelay)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function onTextSpeedChange() {
    extension_settings.blip.textSpeed = Number($('#blip_text_speed').val());
    $("#blip_text_speed_value").text(extension_settings.blip.textSpeed)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function onOriginChange() {
    const origin = $("#blip_audio_origin").val();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();

    if (origin == "file") {
        $("#blip_file_settings").show();
        $("#blip_generated_settings").hide();
        return;
    }

    if (origin == "generated") {
        $("#blip_file_settings").hide();
        $("#blip_generated_settings").show();
        return;
    }
    $("#blip_preset_select").val("none");
}

async function onAssetRefreshClick() {
    updateBlipAssetsList();
    $("#blip_preset_select").val("none");
}

async function onGeneratedMinFrequencyChange() {
    extension_settings.blip.generatedMinFrequency = Number($('#blip_generated_min_frequency').val());
    $("#blip_generated_min_frequency_value").text(extension_settings.blip.generatedMinFrequency);

    if (extension_settings.blip.generatedMinFrequency > extension_settings.blip.generatedMaxFrequency) {
        extension_settings.blip.generatedMaxFrequency = extension_settings.blip.generatedMinFrequency;
        $("#blip_generated_max_frequency").val(extension_settings.blip.generatedMaxFrequency);
        $("#blip_generated_max_frequency_value").text(extension_settings.blip.generatedMaxFrequency);
    }

    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function onGeneratedMaxFrequencyChange() {
    extension_settings.blip.generatedMaxFrequency = Number($('#blip_generated_max_frequency').val());
    $("#blip_generated_max_frequency_value").text(extension_settings.blip.generatedMaxFrequency);

    if (extension_settings.blip.generatedMaxFrequency < extension_settings.blip.generatedMinFrequency) {
        extension_settings.blip.generatedMinFrequency = extension_settings.blip.generatedMaxFrequency;
        $("#blip_generated_min_frequency").val(extension_settings.blip.generatedMinFrequency);
        $("#blip_generated_min_frequency_value").text(extension_settings.blip.generatedMinFrequency);
    }
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function onAudioVolumeMultiplierChange() {
    extension_settings.blip.audioVolumeMultiplier = Number($('#blip_audio_volume_multiplier').val());
    $("#blip_audio_volume_multiplier_value").text(extension_settings.blip.audioVolumeMultiplier)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function onAudioSpeedChange() {
    extension_settings.blip.audioSpeed = Number($('#blip_audio_speed').val());
    $("#blip_audio_speed_value").text(extension_settings.blip.audioSpeed)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function onAssetChange() {
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function onAudioMinPitchChange() {
    extension_settings.blip.audioMinPitch = Number($('#blip_audio_min_pitch').val());
    $("#blip_audio_min_pitch_value").text(extension_settings.blip.audioMinPitch)

    if (extension_settings.blip.audioMinPitch > extension_settings.blip.audioMaxPitch) {
        extension_settings.blip.audioMaxPitch = extension_settings.blip.audioMinPitch;
        $("#blip_audio_max_pitch").val(extension_settings.blip.audioMaxPitch);
        $("#blip_audio_max_pitch_value").text(extension_settings.blip.audioMaxPitch);
    }

    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function onAudioMaxPitchChange() {
    extension_settings.blip.audioMaxPitch = Number($('#blip_audio_max_pitch').val());
    $("#blip_audio_max_pitch_value").text(extension_settings.blip.audioMaxPitch);

    if (extension_settings.blip.audioMaxPitch < extension_settings.blip.audioMinPitch) {
        extension_settings.blip.audioMinPitch = extension_settings.blip.audioMaxPitch;
        $("#blip_audio_min_pitch").val(extension_settings.blip.audioMinPitch);
        $("#blip_audio_min_pitch_value").text(extension_settings.blip.audioMinPitch);
    }

    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function onPlayFullClick() {
    extension_settings.blip.audioPlayFull = $('#blip_audio_play_full').is(':checked');
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
    $("#blip_preset_select").val("none");
}

async function applySetting() {
    let error = false;
    const character = $("#blip_character_select").val();
    const min_speed_multiplier = $("#blip_min_speed_multiplier").val();
    const max_speed_multiplier = $("#blip_max_speed_multiplier").val();
    const comma_delay = $("#blip_comma_delay").val();
    const phrase_delay = $("#blip_phrase_delay").val();
    const text_speed = $("#blip_text_speed").val();
    const audio_volume = $("#blip_audio_volume_multiplier").val();
    const audio_speed = $("#blip_audio_speed").val();
    const audio_origin = $("#blip_audio_origin").val();

    if (character === "none") {
        toastr.error("Character not selected.", DEBUG_PREFIX + " voice mapping apply", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    if (audio_origin == "none") {
        toastr.error("Model not selected.", DEBUG_PREFIX + " voice mapping apply", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    extension_settings.blip.voiceMap[character] = {
        "minSpeedMultiplier": Number(min_speed_multiplier),
        "maxSpeedMultiplier": Number(max_speed_multiplier),
        "commaDelay": Number(comma_delay),
        "phraseDelay": Number(phrase_delay),
        "textSpeed": Number(text_speed),
        "audioVolume": Number(audio_volume),
        "audioSpeed": Number(audio_speed),
        "audioOrigin": audio_origin
    }

    if (audio_origin == "file") {
        const asset_path = $("#blip_file_asset_select").val();
        const audio_min_pitch = Number($("#blip_audio_min_pitch").val());
        const audio_max_pitch = Number($("#blip_audio_max_pitch").val());
        const audio_wait = $("#blip_audio_play_full").is(':checked');

        extension_settings.blip.voiceMap[character]["audioSettings"] = {
            "asset" : asset_path,
            "minPitch": audio_min_pitch,
            "maxPitch": audio_max_pitch,
            "wait": audio_wait
        }
    }
    
    if (audio_origin == "generated") {
        const audio_min_frequency = $("#blip_generated_min_frequency").val();
        const audio_max_frequency = $("#blip_generated_max_frequency").val();

        extension_settings.blip.voiceMap[character]["audioSettings"] = {
            "minFrequency" : Number(audio_min_frequency),
            "maxFrequency" : Number(audio_max_frequency),
        }
    }
    
    updateVoiceMapText();
    console.debug(DEBUG_PREFIX, "Updated settings of ", character, ":", extension_settings.blip.voiceMap[character])
    saveSettingsDebounced();
    toastr.info("Saved Blip settings.", DEBUG_PREFIX + " saved setting for "+character, { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
}

async function onDeleteClick() {
    const character = $("#blip_character_select").val();

    if (character === "none") {
        toastr.error("Character not selected.", DEBUG_PREFIX + " voice mapping delete", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    $("#blip_character_select").val("none");

    delete extension_settings.blip.voiceMap[character];
    console.debug(DEBUG_PREFIX, "Deleted settings of ", character);
    updateVoiceMapText();
    saveSettingsDebounced();
    toastr.info("Deleted.", DEBUG_PREFIX + " delete "+character+" from voice map.", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
    $("#blip_preset_select").val("none");
}

function updateVoiceMapText() {
    let voiceMapText = ""
    for (let i in extension_settings.blip.voiceMap) {
        const voice_settings = extension_settings.blip.voiceMap[i];
        voiceMapText += i + ": ("
            + voice_settings["textSpeed"] + ","
            + voice_settings["minSpeedMultiplier"] + ","
            + voice_settings["maxSpeedMultiplier"] + ","
            + voice_settings["commaDelay"] + ","
            + voice_settings["phraseDelay"] + ","
            + voice_settings["audioVolume"] + ","
            + voice_settings["audioSpeed"] + ","
            + voice_settings["audioOrigin"] + ",";

        if (voice_settings["audioOrigin"] == "file") {
            voiceMapText += voice_settings["audioSettings"]["asset"] + ","
            + voice_settings["audioSettings"]["minPitch"] + ","
            + voice_settings["audioSettings"]["maxPitch"] + ","
            + voice_settings["audioSettings"]["wait"]
            + "),\n"
        }

        if (voice_settings["audioOrigin"] == "generated") {
            voiceMapText += voice_settings["audioSettings"]["minFrequency"] + ","
            voiceMapText += voice_settings["audioSettings"]["maxFrequency"]
            + "),\n"
        }
    }

    extension_settings.rvc.voiceMapText = voiceMapText;
    $('#blip_voice_map').val(voiceMapText);

    console.debug(DEBUG_PREFIX, "Updated voice map debug text to\n", voiceMapText)
}

//#############################//
//  Methods                    //
//#############################//


const delay = s => new Promise(res => setTimeout(res, s*1000));

async function hyjackMessage(chat_id, is_user=false) {
    if (!extension_settings.blip.enabled) {
        showLastMessage();
        return;
    }

    // Ignore first message and system messages
    if (chat_id == 0 || getContext().chat[chat_id].is_system == true) {
        showLastMessage();
        return;
    }
        
    // Hyjack char message
    const char = getContext().chat[chat_id].name;
    const message = getContext().chat[chat_id].mes;
    console.debug(DEBUG_PREFIX,"Queuing message from",char,":", message);

    // Wait turn
    chat_queue.push(chat_id);

    while(is_in_text_animation || chat_queue[0] != chat_id) {
        console.debug(DEBUG_PREFIX,"A character is talking, waiting for turn of", chat_id, "in",chat_queue);
        await delay(1);
    }
    
    is_in_text_animation = true;
    console.debug(DEBUG_PREFIX,"Now turn of", chat_id, "in",chat_queue);
    chat_queue.shift();

    // Start rendered message invisible
    //getContext().chat[chat_id].mes = ""; // DBG legacy: start message empty
}

async function processMessage(chat_id, is_user=false) {
    if (!extension_settings.blip.enabled) {
        showLastMessage();
        return;
    }

    // Ignore first message and system messages
    if (chat_id == 0 || getContext().chat[chat_id].is_system == true)
        return;

    const chat = getContext().chat;
    const character = chat[chat_id].name
    const div_dom = $(".mes[mesid='"+chat_id+"'");
    const message_dom = $(div_dom).children(".mes_block").children(".mes_text");
    let current_message = chat[chat_id].mes;
    let starting_index = 0;
    
    //getContext().chat[chat_id].mes = current_message;

    message_dom.html("");
    showLastMessage();

    // Translation extension compatibility
    if (extension_settings.translate.auto_mode == autoModeOptions.BOTH
        || (extension_settings.translate.auto_mode == autoModeOptions.INPUT && is_user)
        || (extension_settings.translate.auto_mode == autoModeOptions.RESPONSES && !is_user)) {
        console.debug(DEBUG_PREFIX,"Translating...")
        current_message = await translate(current_message, extension_settings.translate.target_language);
        console.debug(DEBUG_PREFIX,"Translation:",current_message)
    }

    if ( (extension_settings.blip.voiceMap[character] === undefined && extension_settings.blip.voiceMap["default"] === undefined) 
    || (is_user && !extension_settings.blip.enableUser) ) {
        console.debug(DEBUG_PREFIX, "Character",character,"has no blip voice assigned in voicemap");
        message_dom.html(messageFormatting(current_message,character,false,is_user));
        is_in_text_animation = false;
        return;
    }

    // Continue case
    if (current_message.startsWith(last_message))
        is_continue = true;

    if (is_continue) {//is_continue) {
        is_continue = false;
        message_dom.html(messageFormatting(last_message,character,false,is_user));
        starting_index = last_message.length;
        console.debug(DEBUG_PREFIX,"CONTINUE detected, streaming only new part from index",starting_index);
    }
    
    last_message = current_message;

    console.debug(DEBUG_PREFIX,"Streaming message:", current_message)
    console.debug(DEBUG_PREFIX,div_dom,message_dom);
    
    const only_quote = extension_settings.blip.onlyQuote;
    const ignore_asterisk = extension_settings.blip.ignoreAsterisk;

    console.debug(DEBUG_PREFIX, "Only quote:", only_quote, "Ignore asterisk:", ignore_asterisk)

    if (only_quote || ignore_asterisk)
        is_text_to_blip = false;
    else
        is_text_to_blip = true;

    let character_settings = extension_settings.blip.voiceMap["default"];

    if (extension_settings.blip.voiceMap[character] !== undefined)
        character_settings = extension_settings.blip.voiceMap[character]

    let text_speed = character_settings["textSpeed"] / 1000;
    //is_in_text_animation = true;

    // TODO: manage different type of audio styles
    const min_speed_multiplier = character_settings["minSpeedMultiplier"];
    const max_speed_multiplier = character_settings["maxSpeedMultiplier"];
    const comma_delay = character_settings["commaDelay"] / 1000;
    const phrase_delay = character_settings["phraseDelay"] / 1000;
    const audio_volume = character_settings["audioVolume"] / 100;
    const audio_speed = character_settings["audioSpeed"] / 1000;
    const audio_origin = character_settings["audioOrigin"];

    // Audio asset mode
    if (audio_origin == "file") {
        const audio_asset = character_settings["audioSettings"]["asset"];
        const audio_min_pitch = character_settings["audioSettings"]["minPitch"];
        const audio_max_pitch = character_settings["audioSettings"]["maxPitch"];
        const audio_wait = character_settings["audioSettings"]["wait"];
        //$("#blip_audio").attr("src", audio_asset);
        
        // Wait for audio to load
        //while (isNaN($("#blip_audio")[0].duration))
        //await delay(0.1);
        const decodedData = await loadAudioAsset(audio_asset);
        playAudioFile(decodedData, audio_volume, audio_speed, audio_min_pitch, audio_max_pitch, audio_wait);
    }
    else { // Generate blip mode
        const audio_min_frequency = character_settings["audioSettings"]["minFrequency"];
        const audio_max_frequency = character_settings["audioSettings"]["maxFrequency"];
        playGeneratedBlip(audio_volume, audio_speed, audio_min_frequency, audio_max_frequency);
    }
    let previous_char = "";
    let current_string = current_message.substring(0, starting_index);
    
    //scrollChatToBottom();
    is_animation_pause = false;
    let is_inside_asterisk =  isOdd(countOccurrences(current_string, '*'));
    let is_inside_quote =  isOdd(countOccurrences(current_string, '"'));
    abort_animation = false;
    $("#send_but").hide();
    
    for(let i = starting_index; i < current_message.length; i++) {
        $("#mes_stop").show();
        // Finish animation by user abort click
        if (abort_animation)
        {
            message_dom.html(messageFormatting(current_message,character,false,is_user));
            break;
        }
        
        hideSwipeButtons();
        message_dom.closest(".mes_block").find(".mes_buttons").hide();
        const next_char = current_message[i]

        
        // Special characters detection
        if (next_char == "*")
            is_inside_asterisk = !is_inside_asterisk;
        if (next_char == '"')
            is_inside_quote = !is_inside_quote;

        // Ignore everything in asterisk and only quote options
        is_text_to_blip = !(is_inside_asterisk && ignore_asterisk) && (!only_quote || (is_inside_quote && only_quote));

        // Change speed multiplier on end of phrase
        if (["!","?","."].includes(next_char) && previous_char != next_char) {
            current_multiplier = Math.random() * (max_speed_multiplier - min_speed_multiplier) + min_speed_multiplier;
            //console.debug(DEBUG_PREFIX,"New speed multiplier:",current_multiplier);
        }

        await delay(current_multiplier * text_speed);
        current_string += next_char;

        // Predict special character for continuous formating
        let predicted_string = current_string
        const charsToBalance = ['*', '"'];
        for (const char of charsToBalance) {
            if (isOdd(countOccurrences(current_string, char))) {
                // Add character at the end to balance it
                predicted_string = predicted_string.trimEnd() + char;
            }
        }

        message_dom.html(messageFormatting(predicted_string,character,false,is_user));
        previous_char = next_char;

        // comma pause
        if (comma_delay > 0 && [",",";"].includes(previous_char)){
            is_animation_pause = true;
            await delay(comma_delay);
            is_animation_pause = false;
        }

        // Phrase pause
        if (phrase_delay > 0 && ["!","?","."].includes(previous_char)){
            is_animation_pause = true;
            await delay(phrase_delay);
            is_animation_pause = false;
        }
        
        if (extension_settings.blip.autoScrollChatToAnimation)
            scrollChatToBottom();
    }

    message_dom.html(messageFormatting(current_message,character,false,is_user));
    abort_animation = false;

    message_dom.closest(".mes_block").find(".mes_buttons").show();
    showSwipeButtons();
    $("#mes_stop").hide();
    $("#send_but").show();
    
    is_in_text_animation = false;
}

async function loadAudioAsset(audio_asset) {
    return fetch(audio_asset)
	    .then(data => data.arrayBuffer())
	    .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then((decodedData) => {return decodedData});
}

async function playAudioFile(decodedData, audio_volume, speed, min_pitch, max_pitch, wait) {
    const volume = audio_volume * extension_settings.blip.audioVolume / 100;
    while (is_in_text_animation) {
        if (is_animation_pause || !is_text_to_blip) {
            //console.debug(DEBUG_PREFIX,"Animation pause, waiting")
            await delay(0.01);
            continue;
        }
        const pitch = Math.random() * (max_pitch - min_pitch) + min_pitch;

        let audio = null;
        if (!extension_settings.blip.audioMuted) {
            audio = pitchShiftFile(decodedData, volume, pitch); // DBG
        }
       
        let wait_time = current_multiplier * speed;
        if (wait)
            wait_time += decodedData.duration;
        await delay(wait_time);
        if (audio !== null)
            audio.stop(0);
    }
}

async function playGeneratedBlip(audio_volume, speed, min_frequency, max_frequency) {
    const volume = audio_volume * extension_settings.blip.audioVolume / 100;
    while (is_in_text_animation) {
        if (is_animation_pause || !is_text_to_blip) {
            await delay(0.01);
            continue;
        }
        const frequency = Math.random() * (max_frequency - min_frequency) + min_frequency;
        playBlip(frequency, volume);
        await delay(0.01 + current_multiplier * speed);
    }
}

// Function to play a sound with a certain frequency
function playBlip(frequency, volume) {
    // Create an oscillator node
    let oscillator = audioContext.createOscillator();
  
    // Set the oscillator wave type
    oscillator.type = 'sine';
  
    // Set the frequency of the wave
    oscillator.frequency.value = frequency;
  
    // Create a gain node to control the volume
    let gainNode = audioContext.createGain();
    
    // Connect the oscillator to the gain node
    oscillator.connect(gainNode);
  
    // Connect the gain node to the audio output
    gainNode.connect(audioContext.destination);
  
    // Set the gain to 0
    gainNode.gain.value = 0;
  
    // Start the oscillator now
    oscillator.start(audioContext.currentTime);
  
    // Create an "attack" stage (volume ramp up)
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
  
    // Create a "decay" stage (volume ramp down)
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.1);
  
    // Stop the oscillator after 100 milliseconds
    oscillator.stop(audioContext.currentTime + 0.1);
  }

//#############################//
//  API Calls                  //
//#############################//

async function getBlipAssetsList() {
    console.debug(DEBUG_PREFIX, "getting blip assets");

    try {
        const result = await fetch(`/api/assets/get`, {
            method: 'POST',
            headers: getRequestHeaders(),
        });
        const assets = result.ok ? (await result.json()) : { type: [] };
        console.debug(DEBUG_PREFIX, "Found assets:", assets);
        return assets["blip"];
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

//#############################//
//  Module Worker              //
//#############################//

function updateCharactersList() {
    let current_characters = new Set();
    const context = getContext();
    for (const i of context.characters) {
        current_characters.add(i.name);
    }

    current_characters = Array.from(current_characters);

    if (current_characters.length == 0)
        return;

    if (!extension_settings.blip.showAllCharacters) {
        let chat_members = [];

        // group mode
        if (context.name2 == "") {
            for(const i of context.groups) {
                if (i.id == context.groupId) {
                    for(const j of i.members) {
                        let char_name = j.replace(/\.[^/.]+$/, "")
                        if (char_name.includes("default_"))
                            char_name = char_name.substring("default_".length);
                        
                        chat_members.push(char_name);
                        console.debug(DEBUG_PREFIX,"New group member:",j.replace(/\.[^/.]+$/, ""))
                    }
                }
            }
        }
        else
            chat_members = [context.name2];
        
        chat_members.sort();

        console.debug(DEBUG_PREFIX,"Chat members",chat_members)

        // Sort group character on top
        for (const i of chat_members) {
            let index = current_characters.indexOf(i);
            if (index != -1) {
                console.debug(DEBUG_PREFIX,"Moving to top",i)
                current_characters.splice(index, 1);
            }
        }
        
        current_characters = chat_members;
    }

    // Put user on top
    current_characters.unshift(context.name1);

    if (JSON.stringify(characters_list) !== JSON.stringify(current_characters)) {
        characters_list = current_characters

        $('#blip_character_select')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select Character</option>')
            .val('none')

        // Special default blip
        $("#blip_character_select").append(new Option("default", "default"));

        for (const charName of characters_list) {
            $("#blip_character_select").append(new Option(charName, charName));
        }

        console.debug(DEBUG_PREFIX, "Updated character list to:", characters_list);
    }
}

async function updateBlipAssetsList() {
    blip_assets = await getBlipAssetsList();

    $("#blip_file_asset_select")
        .find('option')
        .remove()
        .append('<option value="none">Select asset</option>')
        .val('none');

    for (const file of blip_assets) {
        $('#blip_file_asset_select').append(new Option("asset: " + file.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, ""), file));
    }

    console.debug(DEBUG_PREFIX,"updated blip assets to",blip_assets)
}

async function moduleWorker() {
    const moduleEnabled = extension_settings.blip.enabled;

    //console.debug(DEBUG_PREFIX,"DEBUG:",getContext());

    // Avoid hiding system chat
    //console.debug(DEBUG_PREFIX,"DEBUG",getContext().chat[getContext().chat.length-1])
    //if (getContext().characterId === undefined
    //|| getContext().chat[getContext().chat.length-1].is_system == true)
    //    showLastMessage();

    if (moduleEnabled) {
        if (blip_assets === null)
            updateBlipAssetsList();

        if (user_message_to_render != -1) {
            if (extension_settings.blip.enableUser)
                processMessage(user_message_to_render, true);
            user_message_to_render = -1;
        }
    }
}

//#############################//
//  Extension load             //
//#############################//

// This function is called when the extension is loaded
jQuery(async () => {
    const windowHtml = $(await $.get(`${extensionFolderPath}/window.html`));

    $('#extensions_settings').append(windowHtml);
    loadSettings();

    $("#blip_enabled").on("click", onEnabledClick);
    $("#blip_enable_user").on("click", onEnableUserClick);
    $("#blip_only_quoted").on("click", onOnlyQuotedClick);
    $("#blip_ignore_asterisks").on("click", onIgnoreAsteriskClick);
    $("#blip_auto_scroll_to_animation").on("click", onAutoScrollChatToAnimationClick);

    //$("#blip_audio").hide();
    
    $("#blip_audio_mute").on("click", onAudioMuteClick);
    $("#blip_audio_volume_slider").on("input", onAudioVolumeChange);

    $("#blip_character_select").on("change", onCharacterChange);
    $("#blip_character_refresh_button").on("click", onCharacterRefreshClick);
    $("#blip_show_all_characters").on("click", onShowAllCharactersClick);

    $("#blip_preset_select").on("change", onPresetChange);

    $("#blip_text_speed").on("input", onTextSpeedChange);

    $("#blip_min_speed_multiplier").on("input", onMinSpeedChange);
    $("#blip_max_speed_multiplier").on("input", onMaxSpeedChange);

    $("#blip_comma_delay").on("input", onCommaDelayChange);
    $("#blip_phrase_delay").on("input", onPhraseDelayChange);

    $("#blip_audio_volume_multiplier").on("input", onAudioVolumeMultiplierChange);
    $("#blip_audio_speed").on("input", onAudioSpeedChange);

    $("#blip_file_asset_select").on("change", onAssetChange);

    $("#blip_audio_min_pitch").on("input", onAudioMinPitchChange);
    $("#blip_audio_max_pitch").on("input", onAudioMaxPitchChange);
    $("#blip_audio_play_full").on("click", onPlayFullClick);
    
    $("#blip_audio_origin").on("change", onOriginChange);

    $("#blip_file_asset_refresh_button").on("click", onAssetRefreshClick);

    $("#blip_file_settings").hide();
    $("#blip_generated_min_frequency").on("input", onGeneratedMinFrequencyChange);
    $("#blip_generated_max_frequency").on("input", onGeneratedMaxFrequencyChange);
    
    //$("#blip_apply").on("click", onApplyClick);
    $("#blip_delete").on("click", onDeleteClick);

    //$("#blip_audio").attr("src", "assets/blip/sfx-blipfemale.wav"); // DBG
    //$("#blip_audio").prop("volume",1); // DBG

    /*/ DBG
    $("#blip_debug").on("click", function () {
        if ($("#blip_debug").is(':checked')) {
            $("#blip_audio").show();
        }
        else {
            $("#blip_audio").hide();
        }
    });
    /*/

    $("#mes_stop").on("click", function() {abort_animation = true; is_continue = false;});
    $("#option_continue").on("click", function() {is_continue = true; last_message = getContext().chat[getContext().chat.length-1].mes});

    eventSource.on(event_types.MESSAGE_RECEIVED, (chat_id) => hyjackMessage(chat_id));
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (chat_id) => processMessage(chat_id));

    eventSource.on(event_types.MESSAGE_SENT, (chat_id) => hyjackMessage(chat_id, true));
    eventSource.on(event_types.USER_MESSAGE_RENDERED, (chat_id) => processMessage(chat_id, true));// {user_message_to_render = chat_id;});
    
    eventSource.on(event_types.CHAT_CHANGED, updateCharactersList);
    eventSource.on(event_types.GROUP_UPDATED, updateCharactersList);
    
    eventSource.on(event_types.CHAT_CHANGED, showLastMessage);
    eventSource.on(event_types.MESSAGE_DELETED, showLastMessage);

    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();

    updateCharactersListOnce();

    console.debug(DEBUG_PREFIX,"Finish loaded.");
});

async function updateCharactersListOnce() {
    console.debug(DEBUG_PREFIX,"UDPATING char list", characters_list)
    while (characters_list.length == 0) {
        console.debug(DEBUG_PREFIX,"UDPATING char list")
        updateCharactersList();
        await delay(1);
    }
}

function showLastMessage() {
    $(".last_mes .mes_block").show();
}