import * as common from '/pages/src/common.mjs';
import * as o101Common from './o101/common.mjs';
import * as o101UiLib from './o101/ui-lib.mjs';

const doc = document.documentElement;
const defaultChaseChallenge = {
    highest: 0,
    lowest: 0,
    pb: {
        chased: 0,
        percentage: 0
    }
};

let lastRefreshDate = Date.now() - 1100;
let refreshInterval;
let chaseChallenge = null;
let challengeActive;
let resetCurrent;
let resetPB;

common.settingsStore.setDefault({
    fontScale: 1,
    solidBackground: false,
    backgroundColor: '#00ff00',
    refreshInterval: 2,
    challengeActive: false,
    resetCurrent: false,
    resetPB: false
});

export async function main() {
    common.initInteractionListeners();
    common.setBackground(common.settingsStore.get());
    common.subscribe('nearby', updateMetrics);

    refreshInterval = (common.settingsStore.get('refreshInterval') || 0) * 1000 - 100;
    challengeActive = common.settingsStore.get('challengeActive');
    resetCurrent = common.settingsStore.get('resetCurrent');
    resetPB = common.settingsStore.get('resetPB');

    common.settingsStore.addEventListener('changed', ev => {
        if (ev.data.changed.has('refreshInterval')) {
            refreshInterval = common.settingsStore.get('refreshInterval') * 1000 - 100;
        } else if (ev.data.changed.has('challengeActive')) {
            challengeActive = common.settingsStore.get('challengeActive');;
        } else if (ev.data.changed.has('resetCurrent')) {
            resetCurrent = common.settingsStore.get('resetCurrent');;
        } else if (ev.data.changed.has('resetPB')) {
            resetPB = common.settingsStore.get('resetPB');;
        }

        doc.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
    });

    o101UiLib.createInfoSection('#chaseChallengeInfo', 'chase-', ['title', 'position', 'riders-chased', 'highest-position', 'lowest-position', 'personal-best-chased', 'personal-best-percentage']);    
    o101UiLib.addInfoItemDivider(['chase-position', 'chase-personal-best-chased']);
    o101UiLib.convertToHeader(['#chase-title']);

    doc.querySelector('#chase-title-label').innerHTML = '<span>TdZ Chase Challenge</span>';
    doc.querySelector('#chase-personal-best-chased-label').innerHTML = 'PB chased';
    doc.querySelector('#chase-personal-best-percentage-label').innerHTML = 'PB percentage';
}

function updateMetrics(data) {
    if (!challengeActive || (Date.now() - lastRefreshDate) < refreshInterval) return;

    const watched = data.filter(x => x.watching);

    if (watched.length > 0) {
        if (watched[0].eventPosition == null) {
            setValue('#chase-position', 'not in an event');
            return;
        }

        const storageKey = init(watched[0].id);
        const eventPosition = watched[0].eventPosition;
        const eventParticipants = watched[0].eventParticipants
        const actual = process(eventPosition, eventParticipants);

        setValue('#chase-position', eventPosition + ' <abbr>of</abbr> ' + eventParticipants);
        setValue('#chase-riders-chased', actual.chased + ' <abbr>(</abbr>' + o101Common.formatNumber(actual.percentage, 1) + '<abbr>%)</abbr>');
        setValue('#chase-highest-position', chaseChallenge.highest);
        setValue('#chase-lowest-position', chaseChallenge.lowest);
        setValue('#chase-personal-best-chased', chaseChallenge.pb.chased);
        setValue('#chase-personal-best-percentage', o101Common.formatNumber(chaseChallenge.pb.percentage, 1) + '<abbr>%</abbr>');
        
        o101UiLib.toggleElementClass(doc.querySelector('#chase-position-value'), 'green', eventPosition==chaseChallenge.highest);

        common.storage.set(storageKey, chaseChallenge);
    }

    lastRefreshDate = Date.now();
}

function init(id) {
    const storageKey = 'chase-challenge-'+id;

    if (chaseChallenge == null) {
        chaseChallenge = common.storage.get(storageKey) ?? defaultChaseChallenge;
    }

    if (resetCurrent) {
        chaseChallenge.highest = 0;
        chaseChallenge.lowest = 0;
    }

    if (resetPB) {
        chaseChallenge.pb.chased = 0;
        chaseChallenge.pb.percentage = 0;
    }

    return storageKey;
}

function process(position, participants) {
    if (chaseChallenge.highest == null || chaseChallenge.highest == 0) chaseChallenge.highest = position;
    if (position < chaseChallenge.highest) chaseChallenge.highest = position;
    
    if (chaseChallenge.lowest == null || chaseChallenge.lowest == 0) chaseChallenge.lowest = position;
    if (position > chaseChallenge.lowest) chaseChallenge.lowest = position;

    const chased = chaseChallenge.lowest - position;
    const percentage = (chased / participants) * 100;

    if (chased > chaseChallenge.pb.chased) chaseChallenge.pb.chased = chased;
    if (percentage > chaseChallenge.pb.percentage) chaseChallenge.pb.percentage = percentage;

    return { chased, percentage };
}

function setValue(id, value, unit, img, cssClass) {
    const div = doc.querySelector(id + '-value');
        
    if (div == null || value == null) return '&nbsp';
    
    if (unit != null) {
        div.innerHTML = value + '<abbr class="unit">' + unit + '</abbr>';
    } else if (img != null){
        div.innerHTML = value + img;
    } else {
        div.innerHTML = value;
    }
}