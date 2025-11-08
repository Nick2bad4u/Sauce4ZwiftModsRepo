import * as common from '/pages/src/common.mjs';
import * as o101Common from './o101/common.mjs';
import * as o101UiLib from './o101/ui-lib.mjs';
import * as o101Ext from './o101/extensions.mjs';

const doc = document.documentElement;
let showVirtualGear;
let showSpeed;
let showPower;
let showPowerWkg;
let powerSmooth5s;
let showDraft;
let showDraftAsWkg;
let showCadence;
let showHeartrate;
let showGrade;
let zoom;

common.settingsStore.setDefault({
    zoom: 1,
    solidBackground: false,
    backgroundColor: '#00ff00',
    showVirtualGear: false,
    showSpeed: true,
    showPower: true,
    showPowerWkg: false,
    powerSmooth5s: false,
    showDraft: true,
    showDraftAsWkg: false,
    showCadence: true,
    showHeartrate: true,
    showGrade: false
});

export async function main() {
    common.initInteractionListeners();
    common.subscribe('athlete/watching', updateMetrics);
    
    showVirtualGear = common.settingsStore.get('showVirtualGear');
    showSpeed = common.settingsStore.get('showSpeed');
    showPower = common.settingsStore.get('showPower');
    showPowerWkg = common.settingsStore.get('showPowerWkg');
    powerSmooth5s = common.settingsStore.get('powerSmooth5s');    
    showDraft = common.settingsStore.get('showDraft');
    showDraftAsWkg = common.settingsStore.get('showDraftAsWkg');
    showCadence = common.settingsStore.get('showCadence');
    showHeartrate = common.settingsStore.get('showHeartrate');
    showGrade = common.settingsStore.get('showGrade');
    zoom = common.settingsStore.get('zoom');

    common.settingsStore.addEventListener('changed', ev => {
        if (ev.data.changed.has('showVirtualGear')) {
            showVirtualGear = common.settingsStore.get('showVirtualGear');
        } else if (ev.data.changed.has('showSpeed')) {
            showSpeed = common.settingsStore.get('showSpeed');
        } else if (ev.data.changed.has('showPower')) {
            showPower = common.settingsStore.get('showPower');
        } else if (ev.data.changed.has('showPowerWkg')) {
            showPowerWkg = common.settingsStore.get('showPowerWkg');
        } else if (ev.data.changed.has('powerSmooth5s')) {
            powerSmooth5s = common.settingsStore.get('powerSmooth5s');
        } else if (ev.data.changed.has('showDraft')) {
            showDraft = common.settingsStore.get('showDraft');
        } else if (ev.data.changed.has('showDraftAsWkg')) {
            showDraftAsWkg = common.settingsStore.get('showDraftAsWkg');
        } else if (ev.data.changed.has('showCadence')) {
            showCadence = common.settingsStore.get('showCadence');
        } else if (ev.data.changed.has('showHeartrate')) {
            showHeartrate = common.settingsStore.get('showHeartrate');
        } else if (ev.data.changed.has('showGrade')) {
            showGrade = common.settingsStore.get('showGrade');
        } else if (ev.data.changed.has('zoom')) {
            zoom = common.settingsStore.get('zoom');
        }

        render();    
    });

    render();
}

function render() {
    document.documentElement.style.setProperty('--zoom', zoom || 1);
    document.documentElement.style.setProperty('--radius', getRadius(zoom));
    common.setBackground(common.settingsStore.get());
  
    const divLiveData = document.querySelector('#liveData');
    const divDataGroup = o101UiLib.createDiv(['livedata-group']);

    if (showVirtualGear) {
        divDataGroup.appendChild(createLiveDataItem('gear'));
    }
    if (showSpeed) {
        divDataGroup.appendChild(createLiveDataItem('speed'));
    }
    if (showPower) {
        divDataGroup.appendChild(createLiveDataItem('power'));
    }
    if (showPowerWkg) {
        divDataGroup.appendChild(createLiveDataItem('powerwkg'));
    }    
    if (showDraft) {
        divDataGroup.appendChild(createLiveDataItem('draft'));
    }
    if (showCadence) {
        divDataGroup.appendChild(createLiveDataItem('cadence'));
    }
    if (showHeartrate) {
        divDataGroup.appendChild(createLiveDataItem('heartrate'));
    }
    if (showGrade) {
        divDataGroup.appendChild(createLiveDataItem('grade'));
    }

    divLiveData.innerHTML = '';
    divLiveData.appendChild(divDataGroup);
}

function createLiveDataItem(id) {
    let divDataWrapper = o101UiLib.createDiv(['livedata-wrapper']);
    let divItem = o101UiLib.createDiv(['livedata']);

    divItem.appendChild(o101UiLib.createDivWithId(id, ['value']));
    divDataWrapper.appendChild(divItem);

    return divDataWrapper;
}

function updateMetrics(info) {
    if (showVirtualGear) {
        setValue('#gear', '14<abbr class="gear">&#9881;</abbr>');
    }
    if (showSpeed) {
        setValue('#speed', o101Common.formatNumber(info.state.speed, 0) + '<abbr class="speed">kph</abbr>');
    }
    if (showPower) {
        const power = Math.round(powerSmooth5s?info.stats.power.smooth['5']:info.state.power);
        setValue('#power', power + '<abbr class="power">W</abbr>', null, o101Common.fmtWkg(info));
    }
    if (showPowerWkg) {
        const power = powerSmooth5s?o101Common.fmtWkgSmooth(info,'5'):o101Common.fmtWkg(info);
        setValue('#powerwkg', power + '<abbr class="power">Wkg</abbr>', null, o101Common.fmtWkg(info));
    }    
    if (showDraft) {
        setValue('#draft', o101Common.fmtDraft(info, showDraftAsWkg) + '<abbr class="draft">&Xi;</abbr>');
    }
    if (showCadence) {
        setValue('#cadence', info.state.cadence + '<abbr class="cadence">&#12295;</abbr>');
    }
    if (showHeartrate) {
        setValue('#heartrate', info.state.heartrate + '<abbr class="heartrate">&#10084;</abbr>');
    }
    if (showGrade) {
        setValue('#grade', formatGrade(info.state.grade) + '<abbr class="grade">%</abbr>');
    }
}

function setValue(id, value, img, wkg = 0) {
    const div = doc.querySelector(id);
        
    if (div == null || value == null) return '&nbsp';
    
    if (img != null){
        div.innerHTML = value + img;
    } else {
        div.innerHTML = value;
        div.withWkgColor(wkg);
    }
}

function formatGrade(value) {
    const grade = o101Common.formatNumber(value*100, 1);

    return grade == '-0.0' ? '0.0' : grade;
}

function getRadius(zoom) {
    if (zoom < 1 ) return '7px';
    if (zoom < 2 ) return '6px';
    if (zoom < 3 ) return '5px';
    if (zoom < 4 ) return '4px';
    if (zoom < 5 ) return '4.5px';
    if (zoom < 6 ) return '3px';

    return '2px';
}