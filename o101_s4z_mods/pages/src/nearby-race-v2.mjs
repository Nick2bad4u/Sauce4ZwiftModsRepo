import * as common from '/pages/src/common.mjs';
import * as o101Common from './o101/common.mjs';
import * as o101UiLib from './o101/ui-lib.mjs';
import * as o101Ext from './o101/extensions.mjs';

let settings = {};
let lastRefreshDate = Date.now() - 99999;

const powerUpsState = o101Common.initPowerUpsState();
const state = {
    position: 0,
    participants: 0,
    positionInfo: '',
    ridersInfo: '',
    distanceToGo: '',
    header: '',
    footer: '',
    watchingId: null,
    eventSubgroupId: 0
};

const getAthleteCategory = (athlete) => {
    const sgid = athlete.state.eventSubgroupId;
    if (sgid) {
        const sg = o101Common.lazyGetSubgroup(sgid);
        if (sg) {
            return sg.subgroupLabel;
        }
    }
    return '';
}

const somePowerUpIsActive = (powerUps) => {
    return powerUps.some(x => x.expiration - Date.now()/1000 > 0);
}

const showPosition = (rider) => { return rider.position>0 && settings.nearby.showPosition; }
const showCategory = (rider) => { return rider.category!='' && settings.nearby.showCategory; }
const activeAttack = (info) => { return info.filter(x => x.gap>-2 && x.gap<2 && o101Common.fmtWkg(x)>settings.nearby.updateOnAttackMinWkg).length>0; }
const markedIndicator = '<span>&star;</span>';

const createRider = (athlete) => {
    let rider = {
        id: o101Common.getAthleteId(athlete),
        watching: false,
        name: 'N.Valid',
        team: '',
        flag: '',
        type: '',
        racingScore: '',
        power: o101Common.fmtWkg(athlete),
        position: o101Common.getEventPosition(athlete),
        gap: athlete.gap,
        gapTime: o101Common.fmtGapTime(athlete),
        gapDistance: o101Common.fmtGapDistance(athlete),
        speed: o101Common.formatNumber(athlete.state.speed, 0),
        wBal: o101Common.getWbal(athlete),
        draft: o101Common.fmtDraft(athlete),
        hr: o101Common.fmtHeartrate(athlete),
        category: getAthleteCategory(athlete),
        eventSubGroupId: athlete.state.eventSubgroupId,
        powerUp: o101Common.getPowerUp(athlete, powerUpsState)
    }
    
    if (athlete.athlete == null) return rider;

    const overrider = o101Common.getOverRider(rider.id);

    let teamBadgeOverride = (overrider!= null) ? overrider.team : '';
    let teamColorsOverride = null;
    if (settings.nearby.frrMode.enabled) {
        rider.fhrc = o101Common.frrCategory(athlete);
        teamBadgeOverride = settings.nearby.frrMode.myFhrcBadgeAsClass ? rider.fhrc.class : rider.fhrc.code;

        if (rider.fhrc.code == settings.nearby.frrMode.myFhrc) {
            teamColorsOverride = {
                textColor: settings.nearby.frrMode.myFhrcTextColor,
                backgroundColor: settings.nearby.frrMode.myFhrcBackgroundColor
            };
        }
    }

    rider.watching = athlete.watching;
    rider.team = o101Common.fmtTeamBadgeV2(athlete, true, teamBadgeOverride, teamColorsOverride);
    rider.flag = o101Common.fmtFlag(athlete);
    rider.type = o101Common.getAthleteType(athlete);
    rider.distance = o101Common.formatNumber(athlete.state.distance/1000, 1) + '<abbr>km</abbr>';
    rider.racingScore = o101Common.fmtRacingScore(athlete);

    if (overrider!= null) {
        rider.name = overrider.alias;
    } else {
        rider.name = settings.nearby.showFullName ? o101Common.fmtFullName(athlete) : o101Common.fmtName(athlete);
    }

    if (settings.nearby.tttMode.enabled) {
        const tttRider = settings.nearby.tttMode.riders.find(r => r.id == rider.id);
        if (tttRider != null) {
            rider.team = o101Common.fmtTeamBadgeV2(athlete, true, settings.nearby.tttMode.teamName);
            rider.name = tttRider.name;
        }
    }
 
    return rider;
}

common.settingsStore.setDefault({
    fontScale: 1,
    solidBackground: false,
    backgroundColor: '#00ff00',
    refreshInterval: 2,
    nearbyRidersView: 'noob',
    nearbyRidersHeader: '',
    nearbyRidersHeaderText: '',
    nearbyRidersFooter: '',
    nearbyRidersFooterText: '',
    showNearbyRidersFullName: false,
    showNearbyRidersMarked: 'marked',
    maxNearbyRiders: 6,
    nearbyUpdateOnAttack: false,
    updateOnAttackMinWkg: 5,
    nearbyHidePosition: false,
    nearbyHideCategory: false,
    nearbyShowGapDistance: false,
    nearbyShowSpeed: false,
    nearbyShowWbal: false,
    nearbyShowDraft: true,
    nearbyShowHr: true,
    nearbyShowRacingScore: false,
    stickyRoboPacers: true,
    stickyLeadersSweepers: true,
    tttMode: false,
    frrMode: false
});

export async function main() {
    common.initInteractionListeners();
    common.subscribe('nearby', onNearbyInfo);
    common.settingsStore.addEventListener('changed', render);
    o101Common.initTeamColors();
    o101Common.initOverRiders();    
    document.querySelector('#ridersList').addEventListener('click', clickNearbyRider);
    o101Common.initNationFlags();

    render();
}

function render() {
    updateSettings();
    common.setBackground(common.settingsStore.get());
   
    document.documentElement.style.setProperty('--font-scale', settings.fontScale || 1);

    o101UiLib.toggleClassByElements(settings.nearby.nearbyRidersHeader=='hidden', 'hidden', ['#header']);
    o101UiLib.toggleClassByElements(settings.nearby.nearbyRidersFooter=='hidden', 'hidden', ['#footer']);
}

function updateSettings() {
    settings.refreshInterval = common.settingsStore.get('refreshInterval') * 1000;
    settings.fontScale = common.settingsStore.get('fontScale');

    settings.nearby = {
        enabled: common.settingsStore.get('showNearbyRiders'),
        maxRiders: common.settingsStore.get('maxNearbyRiders'),
        view: common.settingsStore.get('nearbyRidersView'),
        markedRiders: common.settingsStore.get('showNearbyRidersMarked'),
        myCategoryOnly: common.settingsStore.get('showNearbyRidersCategoryOnly'),
        nearbyRidersHeader: common.settingsStore.get('nearbyRidersHeader'),
        nearbyRidersHeaderText: common.settingsStore.get('nearbyRidersHeaderText'),
        nearbyRidersFooter: common.settingsStore.get('nearbyRidersFooter'),
        nearbyRidersFooterText: common.settingsStore.get('nearbyRidersFooterText'),
        updateOnAttack: common.settingsStore.get('nearbyUpdateOnAttack'),
        updateOnAttackMinWkg: common.settingsStore.get('updateOnAttackMinWkg'),
        showPosition: common.settingsStore.get('nearbyShowPosition'),
        showCategory: common.settingsStore.get('nearbyShowCategory'),
        showTeam: common.settingsStore.get('nearbyShowTeam'),
        showGapDistance: common.settingsStore.get('nearbyShowGapDistance'),
        showSpeed: common.settingsStore.get('nearbyShowSpeed'),
        showWbal: common.settingsStore.get('nearbyShowWbal'),
        showDraft: common.settingsStore.get('nearbyShowDraft'),
        showHr: common.settingsStore.get('nearbyShowHr'),
        showFullName: common.settingsStore.get('showNearbyRidersFullName'),
        showRacingScore: common.settingsStore.get('nearbyShowRacingScore'),
        stickyRoboPacers: common.settingsStore.get('stickyRoboPacers'),
        stickyLeadersSweepers: common.settingsStore.get('stickyLeadersSweepers'),
        tttMode: {
            enabled: common.settingsStore.get('tttMode'),
            teamName: common.settingsStore.get('tttTeamName'),
            prefix: common.settingsStore.get('tttPrefix'),
            riders: []
        },
        frrMode: {
            enabled: common.settingsStore.get('frrMode'),
            myFhrc: common.settingsStore.get('frrMyFhrc'),
            myFhrcOnly: common.settingsStore.get('frrMyFhrcOnly'),
            myFhrcTextColor: common.settingsStore.get('frrTextColor'),
            myFhrcBackgroundColor: common.settingsStore.get('frrBackgroundColor'),
            myFhrcFooter: common.settingsStore.get('frrMyFhrcFooter'),
            myFhrcBadgeAsClass: common.settingsStore.get('frrMyFhrcBadgeAsClass')
        }        
    }

    for (let i=1; i<=8; i++) {
        const id = common.settingsStore.get('tttRider'+i+'Id');
        if (id != null) {
            const prefix = settings.nearby.tttMode.prefix ? i + ' ' : '';
            settings.nearby.tttMode.riders.push({
                id,
                name: prefix + common.settingsStore.get('tttRider'+i+'Name')
            });
        }
    }
}

function onNearbyInfo(info) {
    //|| somePowerUpIsActive(powerUpsState.powerUps, should only do with visible riders but needs cpu power all the time
    if (!settings.nearby.updateOnAttack && activeAttack(info)) {
        handleNearbyInfo(info);
        return;
    }

    if ((Date.now() - lastRefreshDate) < settings.refreshInterval) return;

    handleNearbyInfo(info);
    
    o101Common.findAndMoveExpiredPowerUps(powerUpsState);

    lastRefreshDate = Date.now();    
}

function handleNearbyInfo(info) {
    const nearby = info.sortAndFixEventPosition();

    updateRiderInfo(nearby);

    let nearbyRiderTypes = ['normal'];
    let specialRiderTypes = [];

    if (settings.nearby.markedRiders == 'only' || settings.nearby.markedRiders == 'marked') nearbyRiderTypes.push('marked');
    if (settings.nearby.markedRiders == 'sticky') specialRiderTypes.push('marked');
    
    if (settings.nearby.stickyRoboPacers) {
        specialRiderTypes.push('pacer');
    } else {
        nearbyRiderTypes.push('pacer');
    }

    if (settings.nearby.stickyLeadersSweepers) {
        specialRiderTypes.push('leader');
        specialRiderTypes.push('sweeper');
    } else {
        nearbyRiderTypes.push('leader');
        nearbyRiderTypes.push('sweeper');  
    }

    if (settings.nearby.frrMode.enabled && settings.nearby.frrMode.myFhrcFooter) {
        const myFhrcNearbyRiders = nearby.filter(x => o101Common.frrCategory(x).code==settings.nearby.frrMode.myFhrc)

        state.footer = myFhrcNearbyRiders.length + ' riders in ' + settings.nearby.frrMode.myFhrc
    }

    const nearbyRiders = nearby
        .filter(x => x.watching || nearbyRiderTypes.includes(o101Common.getAthleteType(x)))
        .optionalFilter(settings.nearby.frrMode.enabled && settings.nearby.frrMode.myFhrcOnly, x => o101Common.frrCategory(x).code==settings.nearby.frrMode.myFhrc)
        .optionalFilter(settings.nearby.markedRiders=='only', x => (x.athlete!=null && x.athlete.marked))
        .optionalFilter(settings.nearby.myCategoryOnly, x => state.eventSubgroupId==x.state.eventSubgroupId)
        .sortAndFixEventPositionRiders(settings.nearby.myCategoryOnly, state.eventSubgroupId != 0)
        // remove backmarkers, higher positions than you in front of position 1

        //when almost finishes, don't show riders not participating in the event
        //.optionalFilter(info.state.speed>0 && state.eventSubgroupId>0, x => (x.eventPosition ?? 0)>0)
        
        .toListWithWatchingCentered(x => x.watching, settings.nearby.maxRiders)
        .map((a) => createRider(a));

    o101UiLib.setInfoSection('#ridersList', createRidersList(nearbyRiders), []);
    o101UiLib.scrollIntoView('info-item advanced watching');

    const specialRiders = nearby
        .filter(x => !x.watching && specialRiderTypes.includes(o101Common.getAthleteType(x)))
        .map((a) => createRider(a));

    const specialRidersFront = specialRiders
        .filter(x => x.gap <= 0);
    o101UiLib.setInfoSection('#ridersFront', createRidersList(specialRidersFront), ['sticky']);

    const specialRidersRear = specialRiders
        .filter(x => x.gap > 0 && !specialRidersFront.includes(x.id));
    o101UiLib.setInfoSection('#ridersRear', createRidersList(specialRidersRear), ['sticky']);
    
    o101UiLib.setValue('#headerText', '<span>' + state.header + '</span>');
    o101UiLib.setValue('#footerText', '<span>' + state.footer + '</span>');

    persistRiderData(nearbyRiders);
}

async function persistRiderData(riders) {
    for(let rider of riders) {
        const athlete = await common.rpc.getAthleteData(rider.id)

        if (!Object.hasOwn(athlete, 'o101')) {
            await common.rpc.updateAthleteData(rider.id, { 
                o101: {
                    teamBadge: rider.team
                }
            });
        } else if (athlete.state.eventSubgroupId> 0 && athlete.state.eventSubgroupId != athlete.o101.eventSubgroupId) {
            await common.rpc.updateAthleteData(rider.id, { 
                o101: {
                    teamBadge: rider.team
                    // for ladder racing only?
                    //eventSubgroupId: athlete.state.eventSubgroupId
                }
            });
        }
    }
}

function updateRiderInfo(nearby) {
    let watchingRider = nearby.filter(n => n.watching)[0];

    if (watchingRider == null) return;

    state.watchingId = watchingRider.athleteId;
    state.eventSubgroupId = watchingRider.state.eventSubgroupId;

    setState({
        position: watchingRider.eventPosition ?? 0,
        participants: watchingRider.eventParticipants ?? 0,
        nearby: nearby.filter(x => x.gap>-3 && x.gap<3).length
    });

    if (settings.nearby.nearbyRidersFooter == 'togo') {
        const activeEvent = o101Common.lazyGetSubgroup(watchingRider.state.eventSubgroupId);

        if (activeEvent != null) {
            let distance = activeEvent.routeDistance-watchingRider.state.distance;

            // TODO check in normal event
            if (activeEvent.distanceInMeters != null && activeEvent.distanceInMeters > 0) {
                distance = activeEvent.distanceInMeters-watchingRider.state.distance;
            }

            const distanceTogo = (distance > 0) ? o101Common.formatNumber((distance)/1000, 2) : 0;
            state.distanceToGo = distanceTogo + ' km to finish';
        }

    }
}

function createRidersList(riders) {
    if (riders.length <= 0) return;
    
    let infoGroup = o101UiLib.createDiv(['info-group']);
    const view = settings.nearby.view;

    for(let rider of riders) {   
        if (view == 'racer') {
            if (settings.nearby.showWbal) infoGroup.appendChild(createWbal(rider.wBal));
            infoGroup.appendChild(createRacerDataItem(rider));
            infoGroup.appendChild(createRacerSubDataItem(rider));
        } else if (view == 'zwift') {
            infoGroup.appendChild(createZwiftDataItem(rider));
            infoGroup.appendChild(createZwiftSubDataItem(rider));  
        } else if (view == 'sandbagger') {
            rider.name = '╭∩╮(◣_◢)╭∩╮';
            rider.power = '99.6';
            rider.flag = '<img src="/pages/deps/flags/fm.png" title="France"/>';            
            infoGroup.appendChild(createSimpleDataItem(rider));
        } else {
            infoGroup.appendChild(createSimpleDataItem(rider));
        }
    }

    return infoGroup;
}

function createSimpleDataItem(rider) {
    return o101UiLib
        .createDiv(['info-item', 'simple', 'divider'])
        .withCssClass([getCss(rider)])
        .withOptionalCssClass(rider.watching, ['watching'])
        .withOptionalChildDiv(showPosition(rider), ['info-item-index'], '<span>' + rider.position + '</span>')
        .withOptionalChildDiv(showCategory(rider), ['info-item-category', 'cat', 'cat-'+rider.category], '<span>' + rider.category + '</span>')
        .withChildDivWithDataAttribute(['info-item-name'], rider.name, 'id', rider.id)
        .withOptionalChildDiv(settings.nearby.showTeam, ['info-item-team'], rider.team)
        .withChildDiv(['info-item-power'], rider.power)
        .withChildDiv(['info-item-wkgunit'], '&#9889')
        .withChildDiv(['info-item-flag'], rider.flag)
        .withWkgColor(rider.power);
}

function createRacerDataItem(rider) {
    return o101UiLib
        .createDiv(['info-item', 'advanced'])
        .withCssClass([getCss(rider)])
        .withOptionalCssClass(rider.watching, ['watching'])
        .withOptionalCssClass(rider.powerUp.image!='', ['powerUpRemaining'], rider.powerUp)
        .withOptionalChildDiv(showPosition(rider), ['info-item-index'], '<span>' + rider.position + '</span>')
        .withOptionalChildDiv(showCategory(rider), ['info-item-category', 'cat', 'cat-'+rider.category], '<span>' + rider.category + '</span>')
        .withOptionalChildDiv(rider.powerUp.image!='', ['info-item-powerup'], '<img src="././images/pu-' + rider.powerUp.image + '.png"/>')
        .withOptionalChildDiv(rider.type=='marked' && settings.nearby.markedRiders=='marked', ['info-item-marked'], markedIndicator)
        .withChildDivWithDataAttribute(['info-item-name-detailed'], rider.name, 'id', rider.id)
        .withOptionalChildDiv(settings.nearby.showTeam, ['info-item-team'], rider.team)
        .withChildDiv(['info-item-flag'], rider.flag)
        .withWkgColor(rider.power);
}

function createRacerSubDataItem(rider) {
    return o101UiLib
        .createDiv(['info-item', 'sub', 'divider'])
        .withCssClass([getCss(rider)])
        .withOptionalCssClass(rider.watching, ['watching'])
        .withOptionalCssClass(rider.powerUp.image!='', ['powerUpRemaining'], rider.powerUp)
        .withChildDiv(showPosition(rider)?['info-item-gaptime-detailed-index']:['info-item-gaptime-detailed'], rider.gapTime)
        .withOptionalChildDiv(settings.nearby.showRacingScore, ['info-item-racingscore'], rider.racingScore)
        .withOptionalChildDiv(settings.nearby.showGapDistance, ['info-item-gapdistance'], rider.gapDistance)
        .withOptionalChildDiv(settings.nearby.showSpeed, ['info-item-speed'], rider.speed + '<img src="././images/speed.png"/>')
        .withOptionalChildDiv(settings.nearby.showDraft, ['info-item-draft'],  rider.draft > 0 ? rider.draft + '<img src="././images/xi.png"/>' : '&nbsp')
        .withOptionalChildDiv(settings.nearby.showHr, ['info-item-hr'], rider.hr != '' ? rider.hr + '<img src="././images/heart.png"/>' : '&nbsp')
        .withChildDiv(['info-item-power-detailed'], rider.power)
        .withChildDiv(['info-item-wkgunit'], '&#9889')
        .withWkgColor(rider.power);
}

function createZwiftDataItem(rider) {
    return o101UiLib
        .createDiv(['info-item', 'advanced'])
        .withCssClass([getCss(rider)])
        .withOptionalCssClass(rider.watching, ['watching'])
        .withOptionalChildDiv(rider.category!='', ['info-item-category', 'cat', 'cat-'+rider.category], '<span>' + rider.category + '</span>')
        .withChildDivWithDataAttribute(['info-item-name-zwift'], rider.name, 'id', rider.id)
        .withOptionalChildDiv(settings.nearby.showTeam, ['info-item-team'], rider.team)
        .withChildDiv(['info-item-flag'], rider.flag)
        .withWkgColor(rider.power);
}

function createZwiftSubDataItem(rider) {
    return o101UiLib
        .createDiv(['info-item', 'sub', 'divider'])
        .withCssClass([getCss(rider)])
        .withOptionalCssClass(rider.watching, ['watching'])
        .withChildDiv(['info-item-gaptime-detailed'], rider.gapTime)
        .withChildDiv(['info-item-power-4'], rider.power)
        .withChildDiv(['info-item-wkgunit'], '&#9889')
        .withChildDiv(['info-item-distance'], rider.distance)
        .withWkgColor(rider.power);
}

function createWbal(wbal) {
    let hr = document.createElement('hr');
    let width = 50 + wbal / 2;
    
    if (width > 100) width = 100;
    if (width < 5) width = 5;

    hr.classList.add('wbal')
    hr.style.setProperty('--wbal-width', Math.round(width) + '%');

    if (wbal >= 50 ) hr.style.setProperty('--wbal-color', 'greenyellow');
    else if (wbal > 0 ) hr.style.setProperty('--wbal-color', 'orange');
    else if (wbal <= -50 ) hr.style.setProperty('--wbal-color', 'palevioletred');
    else if (wbal <= 0 ) hr.style.setProperty('--wbal-color', 'red');
    
    return hr;
};

function setState(args) {
    let positionInfo, ridersInfo;
    state.position = args.position;
    state.participants = args.participants;

    if (args.participants > 0) {
        positionInfo = 'Position ' + args.position + ' of ' + args.participants;
        ridersInfo = args.participants + ' riders in event';
    } else if (args.position > 0) {
        positionInfo = 'Position ' + args.position;
        ridersInfo = args.nearby + ' riders nearby';
    } else {
        positionInfo = 'Position (not in an event)';
        ridersInfo = args.nearby + ' riders nearby';
    }

    switch (settings.nearby.nearbyRidersHeader) {
        case 'position': { state.header = positionInfo; break; }
        case 'custom': { state.header = settings.nearby.nearbyRidersHeaderText; break; }
        default: state.header = 'Zwifters nearby';
    }

    switch (settings.nearby.nearbyRidersFooter) {
        case 'togo': { state.footer = state.distanceToGo; break; }
        case 'custom': { state.footer = settings.nearby.nearbyRidersFooterText; break; }
        default: state.footer = ridersInfo;
    }
}

function getCss(rider) {
    switch (rider.type) {
        case null:
        case '':
        case 'marked': //return 'sticky'; 
        case 'normal': return '';
        case 'leader': return 'leader';
        case 'sweeper': return 'sweeper';
    }

    // A, red, >= 4.1
    // B, green, >= 3.1 && <= 3.7
    // C, blue, >= 2.6 && <= 2.9
    // D, yellow, <= 2.2
    if ((rider.power >= 4.1 || rider.name == 'A.Constance') && rider.name != 'B.Genie') {
        return 'pacer-red';
    } else if ((rider.power >= 3.1 || rider.name == 'B.Jacques') && rider.name != 'C.Yumi') {
        return 'pacer-green';
    } else if ((rider.power >= 2.6 || rider.name == 'C.Coco') && rider.name != 'D.Maria') {
        return 'pacer-blue';
    } else if (rider.name != 'C.Coco') {
        return 'pacer-yellow'
    }
}

async function clickNearbyRider(ev) {
    if (ev.target.dataset.id == null || ev.target.dataset.id == '') return;

    await common.rpc.watch(ev.target.dataset.id);

    state.watchingId = ev.target.dataset.id;

    //reset eventgroupid ?
}

const getEventSubgroupId = (athlete) => {
    if (Object.hasOwn(athlete, 'o101')) {
        return athlete.o101.eventSubgroupId;
    }

    return athlete.state.eventSubgroupId;
}