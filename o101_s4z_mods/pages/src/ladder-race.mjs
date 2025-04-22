import * as sauce from '/pages/src/../../shared/sauce/index.mjs';
import * as common from '/pages/src/common.mjs';
import * as o101Common from './o101/common.mjs';
import * as o101UiLib from './o101/ui-lib.mjs';
import * as o101Ext from './o101/extensions.mjs';

// change to rider only if gap > ...??

let settings = {};
let lastRefreshDate = Date.now() - 99999;

const defaultTeamName = 'DON\'T CLICK ME';
const maxPoints = 10;
const state = {
    initialized: 0,
    watchingId: 0,
    eventSubgroupId: 0,
    eventStart: Date.now() - 1,
    eventCourse: '',
    registeredRiders: [],
    nearbyRiders: [],
    finishedRiders: [],
    lastRiderId: 0,
    data: []
};

const powerUpsState = o101Common.initPowerUpsState();

common.settingsStore.setDefault({
    refreshInterval: 2,
    fontScale: 1,
    myTeamHeader: 'TFC Firebirds',
    myTeamBadge: 'TFC',
    myTeamRiders: '0',
    opponentTeamHeader: 'The Enemy',
    opponentTeamBadge: 'Enemy',
    opponentTeamRiders: '0',
    maxGroups: 8,
    showRegisteredRidersOnly: false,
    showWbal: true,
    showRacingScore: false,
    useNearbyData: false,
    scoringCalculation: 'position',
    showFooter: true,
    manualMode: false,
    riderOverviewMinutes: 5,
    autoSwitchRider: false,
    autoSwitchRiderInterval: 5,
    teamMaxChars: 15,
    raceEndsMinutes: 15,
    showNearbyRiders: false
});

export async function main() {
    common.initInteractionListeners();
    common.subscribe('groups', handleGroupsData);
    common.subscribe('nearby', handleNearbyData);
    common.settingsStore.addEventListener('changed', render);
    o101Common.initTeamColors();
    o101Common.initNationFlags();
    document.querySelector('#ridersList').addEventListener('click', clickNearbyRider);

    render();
}

function render() {
    updateSettings();
    initializeLadderData();
    document.documentElement.style.setProperty('--font-scale', settings.fontScale || 1);
}

function updateSettings() {
    settings.refreshInterval = common.settingsStore.get('refreshInterval') * 1000;
    settings.fontScale = common.settingsStore.get('fontScale');
    settings.ladder = {
        manualMode: common.settingsStore.get('manualMode'),
        myTeamHeader: common.settingsStore.get('myTeamHeader'),
        myTeamBadge: common.settingsStore.get('myTeamBadge'),
        myTeamRiders: common.settingsStore.get('myTeamRiders').split(','),
        opponentTeamHeader: common.settingsStore.get('opponentTeamHeader'),
        opponentTeamBadge: common.settingsStore.get('opponentTeamBadge'),
        opponentTeamRiders: common.settingsStore.get('opponentTeamRiders').split(','),
        maxGroups: common.settingsStore.get('maxGroups'),
        showRegisteredRidersOnly: common.settingsStore.get('showRegisteredRidersOnly'),
        showWbal: common.settingsStore.get('showWbal'),
        showRacingScore: common.settingsStore.get('showRacingScore'),
        useNearbyData: common.settingsStore.get('useNearbyData'),
        scoringCalculation: common.settingsStore.get('scoringCalculation'),
        showFooter: common.settingsStore.get('showFooter'),
        riderOverviewMinutes: common.settingsStore.get('riderOverviewMinutes'),
        autoSwitchRider: common.settingsStore.get('autoSwitchRider'),
        autoSwitchRiderInterval: common.settingsStore.get('autoSwitchRiderInterval'),
        teamMaxChars: common.settingsStore.get('teamMaxChars'),
        raceEndsMinutes: common.settingsStore.get('raceEndsMinutes'),
        watchingIdOverride: common.settingsStore.get('watchingIdOverride'),
        showNearbyRiders: common.settingsStore.get('showNearbyRiders')        
    }
}

async function initializeLadderData() {
    state.watchingId = settings.ladder.watchingIdOverride;

    if (state.watchingId == null || state.watchingId == 0) {
        const nearbyData = await common.rpc.getNearbyData();
        const watchedRider = nearbyData.find(r => r.watching);
        state.watchingId = watchedRider ? watchedRider.athleteId : 0;
    }
    
    if (!settings.ladder.manualMode && state.watchingId > 0) {
        state.eventSubgroupId = 0;
        state.eventStart = null;
        state.registeredRiders = state.nearbyRiders;

        const ladderResponse = await fetch('https://ladder.cycleracing.club/whatFixtureShouldIBeIn/' + state.watchingId).then(response=>response.json());
        if (ladderResponse == null || ladderResponse.length<1) return;
        const eventData = ladderResponse[0];
        console.log(eventData);

        const zwiftEvent = await common.rpc.getEvent(eventData.zwiftEventId);
        if (zwiftEvent == null) return;
        console.log(zwiftEvent);

        state.eventSubgroupId = zwiftEvent.eventSubgroups[0].id;
        state.eventStart = zwiftEvent.eventStart;
        state.eventCourse = eventData.route;

        settings.ladder.myTeamHeader = eventData.homeTeamName;
        settings.ladder.myTeamBadge = eventData.homeClub.name;
        settings.ladder.myTeamRiders = getRiderIds(eventData.homeSignups);
        state.registeredRiders.push(...settings.ladder.myTeamRiders);

        settings.ladder.opponentTeamHeader = eventData.awayTeamName;
        settings.ladder.opponentTeamBadge = eventData.awayClub.name;
        settings.ladder.opponentTeamRiders = getRiderIds(eventData.awaySignups);
        state.registeredRiders.push(...settings.ladder.opponentTeamRiders);

        settings.ladder.showRegisteredRidersOnly = true;

        state.initialized = true;
    }
}

async function handleNearbyData(data) {
    if (!settings.ladder.useNearbyData) return;
    if (!refreshData(data)) return;
    //if (!state.initialized) initializeLadderData();

    const nearbyData = data.sort(function(a, b) { return a.gap - b.gap; });
    let groupsData = [];
    let group =  {
        athletes: [],
        speed: 0
    };
    let previousRider;

    for (let athlete of nearbyData) {
        if (previousRider == null) {
            group.athletes.push(athlete);
            group.speed = athlete.state.speed ?? 0;
        } else if (isSeparation(previousRider, athlete)) {
            groupsData.push(group);
            group = {
                athletes: [],
                speed: athlete.state.speed ?? 0
            };
            group.athletes.push(athlete);
        } else {
            group.athletes.push(athlete);
        }

        previousRider = athlete;
    }

    groupsData.push(group);

    handleLadderData(await createLadderData(groupsData));
}

async function handleGroupsData(data) {
    if (settings.ladder.useNearbyData) return;
    if (!refreshData(data)) return;
    //if (!state.initialized) initializeLadderData();

    handleLadderData(await createLadderData(data));
}

async function createLadderData(data) {
    handleAutoSwitchRider(data);
    handleFinishedRiders(await common.rpc.getEventSubgroupResults(state.eventSubgroupId));

    const ladderData = {
        riders: [],
        groups: [],
        hasFinishedGroup: false,  
        scoring: {
            position: { my: 0, opponent: 0 },
            optimistic: { my: 0, opponent: 0 }
        }
    }

    let groupIndex = 1;
    let points = maxPoints - state.finishedRiders.length;

    if (state.finishedRiders.length>0) {
        const finishedGroup = createLadderGroup(0, 0);
        finishedGroup.finished = true;
        finishedGroup.header = 'Finished';
        finishedGroup.riders = state.finishedRiders;
        ladderData.groups.push(finishedGroup);
        ladderData.hasFinishedGroup = true;
    }

    let nearbyRiders = createLadderGroup(99, 0, 'Nearby riders');
    
    for (let group of data) {
        if (points == 0) continue;

        const ladderGroup = createLadderGroup(groupIndex, group.speed);

        for (let athlete of group.athletes) {
            if (points == 0
                || state.finishedRiders.some(r => r.id === athlete.athleteId)
                || !isRegisteredRider(athlete.athleteId)) {
                
                if (settings.ladder.showNearbyRiders) {
                    const nearbyRider = createRider(athlete);
                    nearbyRider.team = o101Common.fmtTeamBadgeV2(athlete, true, defaultTeamName);;
                    nearbyRider.points = 0;
                    nearbyRiders.riders.push(nearbyRider);
                }

                continue;
            }
            
            const ladderRider = createRider(athlete);
            let teamName = defaultTeamName;
            if (isMyTeamRider(ladderRider.id)) teamName = settings.ladder.myTeamBadge;
            if (isOpponentTeamRider(ladderRider.id)) teamName = settings.ladder.opponentTeamBadge;

            ladderRider.team = o101Common.fmtTeamBadgeV2(athlete, true, teamName);
            ladderRider.points = points--;

            ladderData.riders.push(ladderRider);

            ladderGroup.myGroup |= ladderRider.watching;

            if (settings.ladder.showRegisteredRidersOnly && teamName == defaultTeamName) {
                continue;
            }

            ladderGroup.riders.push(ladderRider);
        }

        if (ladderGroup.riders.length > 0) {
            ladderGroup.header = getLadderGroupHeader(ladderGroup.riders.length, groupIndex);         

            const points = scoringCalculationOptimistic(ladderGroup.riders);

            ladderData.scoring.optimistic.my += points.myGroupPoints;
            ladderData.scoring.optimistic.opponent += points.opponentGroupPoints;
            ladderData.groups.push(ladderGroup);

            groupIndex++;
        }
    }

    if (minutesFromWinner() >= settings.ladder.raceEndsMinutes) return ladderData;

    let scoringByPosition = scoringcalculationByPosition(ladderData.riders);
    ladderData.scoring.position.my += scoringByPosition.myGroupPoints;
    ladderData.scoring.position.opponent += scoringByPosition.opponentGroupPoints;

    for (let group of ladderData.groups) {
        const myGroup = ladderData.groups.find(g => g.myGroup);

        if (group.myGroup || myGroup == null) continue;
        
        group.speedDeltaPercentage = ((group.speed-myGroup.speed) / myGroup.speed) * 100; 
    }

    let previousGroupGap = 0;
    for (let g=0; g<ladderData.groups.length;g++) {
        const group = ladderData.groups[g];
        
        if (g > 0 && ladderData.groups[g-1].riders.length>0) {
            previousGroupGap = ladderData.groups[g-1].riders[0].gap
            group.gap = o101Common.fmtGapTimeByGap(Math.abs(previousGroupGap) - Math.abs(group.riders[0].gap), false);
        }

        for (let rider of group.riders) {
            rider.gapTime = '&nbsp';
        }
    }

    if (settings.ladder.showNearbyRiders) {
        ladderData.groups.push(nearbyRiders);
    }

    return ladderData;
}

async function handleLadderData(ladderData) {
    const eventInfo = getEventInfo();

    let scoring = {
        myPoints: 0,
        opponentPoints: 0
    }

    let hideEventInfo = true;
    if (eventInfo.notStarted) {
        hideEventInfo = false;
        o101UiLib.setValue('#eventInfo', 'Race start at ' + eventInfo.countdown + '<br/>' + eventInfo.course);
    } else {
        scoring = getScoring(ladderData);

        const mfw = minutesFromWinner()

        if (mfw > 0) {
            hideEventInfo = false;

            if (mfw < settings.ladder.raceEndsMinutes && state.finishedRiders.length<state.registeredRiders.length) {
                o101UiLib.setValue('#eventInfo', 'Awaiting riders: ' + (settings.ladder.raceEndsMinutes-mfw) + 'm');            
            } else {
                o101UiLib.setValue('#eventInfo', 'Race ended');
            }
        }
    }

    o101UiLib.setValue('#myTeam', '<span>' + getTeamHeader(settings.ladder.myTeamHeader) + '</span><span>' + scoring.myPoints + '</span>');
    o101UiLib.setValue('#opponentTeam', '<span>' + getTeamHeader(settings.ladder.opponentTeamHeader) + '</span><span>' + scoring.opponentPoints + '</span>');
    o101UiLib.toggleClassByElements(hideEventInfo, 'hidden', ['#eventInfo']);
 
    if (eventInfo.showRiderOverview) {
        await renderRiderStats();
    } else {
        renderGroupsAndRiders(ladderData)
    }

    lastRefreshDate = Date.now();
}

const isRegisteredRider = (id) => {
    if (id==null) return false;
    return state.registeredRiders.includes(id.toString());
}

const isMyTeamRider = (id) => {
    if (id==null) return false;
    return settings.ladder.myTeamRiders.includes(id.toString());
}

const isOpponentTeamRider = (id) => {
    return settings.ladder.opponentTeamRiders.includes(id.toString());
}

const isSeparation = (athlete1, athlete2) => {
    const gapTimeAbs = Math.abs(athlete1.gap - athlete2.gap);
        
    return (gapTimeAbs > 1) && athlete2.state.draft == 0;
}

const getRiderIds = (teamRiders) => {  
    return teamRiders.replace('[', '').replace(']', '').split(',');
}

const getTeamHeader = (name, max) => {
    if (max == null) max = settings.ladder.teamMaxChars;
    if (name.length>=max) {
        return name.substring(0, max)
    }
    
    return name;
}

const getLastRiderId = (data) => {
    if (data.length<=0) return null;

    for(let d=data.length-1; d>=0;d--) {
        const group = data[d];
        for(let i=group.athletes.length-1; i>=0;i--) {
            const athleteId = group.athletes[i].athleteId;
            if (isMyTeamRider(athleteId)) {
                return athleteId;
            } 
        }
    }
    for(let d=data.length-1; d>=0;d--) {
        const group = data[d];
        for(let i=group.athletes.length-1; i>=0;i--) {
            const athleteId = group.athletes[i].athleteId;
            if (isRegisteredRider(athleteId)) {
                return athleteId;
            } 
        }
    }

    return 0;
}

const getEventInfo = () => {
    let secondsToStart = (state.eventStart - new Date().getTime())/1000;
    let minutesFromStart = (new Date().getTime() - state.eventStart)/1000/60;
    let hours = Math.floor(secondsToStart/3600);
    let minutes = Math.floor(secondsToStart/60%60);
    let seconds = Math.floor(secondsToStart%60);

    if (minutes<10) minutes = '0' + minutes;
    if (seconds<10) seconds = '0' + seconds;

    return {
        course: state.eventCourse,
        countdown: hours + ':' + minutes + ':' + seconds,
        notStarted: secondsToStart > 0,
        showRiderOverview: secondsToStart/60 >= settings.ladder.riderOverviewMinutes,
        minutesFromStart
    }
}

const watchingRiderHasFinished = () => {
    for(let i=0; i<state.finishedRiders.length;i++) {
        if (state.finishedRiders[i].id==state.watchingId) return true;
    }
    
    return false;
}

const minutesFromWinner = () => {
    if (state.finishedRiders.length == 0) return 0;

    return Math.round((new Date().getTime() - new Date(state.finishedRiders[0].endDate).getTime())/1000/60);
}

const createRider = (athlete) => {
    const id = o101Common.getAthleteId(athlete);

    let rider = {
        id: id,
        watching: false,
        name: 'N.Valid',
        team: '',
        flag: '',
        racingScore: '',
        power: o101Common.fmtWkg(athlete),
        points: 0,
        gap: athlete.gap,
        gapTime: o101Common.fmtGapTime(athlete),
        gapDistance: athlete.gapDistance,
        wBal: o101Common.getWbal(athlete),
        draft: o101Common.fmtDraft(athlete),
        hr: o101Common.fmtHeartrate(athlete),
        myTeam: isMyTeamRider(id),
        powerUp: o101Common.getPowerUp(athlete, powerUpsState, false),
        updates: 0,
        finished: false,
        canSteer: o101Common.canSteer(athlete)
    }

    if (athlete.athlete == null) return rider;

    rider.watching = athlete.watching;
    rider.name = o101Common.fmtName(athlete);
    rider.flag = o101Common.fmtFlag(athlete);
    rider.eventSubgroupId = athlete.state.eventSubgroupId;
    rider.racingScore = o101Common.fmtRacingScore(athlete);
    rider.category = o101Common.fmtRacingCategory(athlete);
    rider.weight = o101Common.fmtWeight(athlete);
    rider.height = o101Common.fmtHeight(athlete);

    return rider;
}

const refreshData = (data) => {
    const refresh = (Date.now() - lastRefreshDate) > settings.refreshInterval;
    const attackWkg = 5;
    let attack = false

    if (data.length>0) {
        if (Object.hasOwn(data[0], 'athletes')) {
            attack = data.some(g => g.athletes.some(a => o101Common.fmtWkg(a) >= attackWkg))
        } else {
            attack = data.some(a => o101Common.fmtWkg(a) >= attackWkg);
        }
    }

    return attack || refresh;
}

function createSimpleGroupHeaderItem(group) {
    return o101UiLib
        .createDiv(['info-item', 'ladder'])
        .withChildDiv(['info-item-ladder-title'], group.header)
}

function createGroupHeaderItem(group) {
    return o101UiLib
        .createDiv(['info-item', 'ladder'])
        .withChildDiv(['info-item-ladder-title'], group.header)
        .withChildDiv(['info-item-ladder-gap'], group.gap)
        .withChildDiv(['info-item-speed-delta'], fmtSpeedDelta(group.speedDeltaPercentage))
        .withChildDiv(['info-item-ladder-speed'], o101Common.formatNumber(group.speed, 0) + '<img src="././images/speed.png"/>')
}

function createRacerDataItem(rider) {
    return o101UiLib
        .createDiv(rider.finished ? ['info-item', 'advanced', 'divider'] : ['info-item', 'advanced'])
        .withOptionalCssClass(rider.watching, ['watching'])
        .withOptionalCssClass(rider.powerUp.image!='', ['powerUpRemaining'], rider.powerUp)
        .withChildDiv(['info-item-index'], '<span>' + rider.points + '</span>', null, 'Race result points')
        .withOptionalChildDiv(rider.powerUp.image!='', ['info-item-powerup'], '<img src="././images/pu-' + rider.powerUp.image + '.png"/>')
        .withChildDivWithDataAttribute(['info-item-name-detailed'], rider.name, 'id', rider.id)
        .withChildDivWithDataAttribute([''], rider.team, 'id', rider.id)
        .withChildDiv(['info-item-flag'], rider.flag)
        .withWkgColor(rider.power);
}

function createRacerSubDataItem(rider) {
    return o101UiLib
        .createDiv(['info-item', 'sub', 'divider'])
        .withOptionalCssClass(rider.watching, ['watching'])
        .withOptionalCssClass(rider.powerUp.image!='', ['powerUpRemaining'], rider.powerUp)
        .withChildDiv(['info-item-steering'], !rider.canSteer ? '<img src="././images/handlebar.png"/>' : '&nbsp', null, 'NO steering device connected')
        .withChildDiv(['info-item-racingscore'], settings.ladder.showRacingScore ? rider.racingScore : '')
        .withChildDiv(['info-item-draft'], rider.draft > 0 ? rider.draft + '<img src="././images/xi.png"/>' : '&nbsp')
        .withChildDiv(['info-item-hr'], rider.hr != '' ? rider.hr + '<img src="././images/heart.png"/>' : '&nbsp')
        .withChildDiv(['info-item-power-detailed'], rider.power)
        .withChildDiv(['info-item-wkgunit'], '&#9889')
        .withWkgColor(rider.power);
}

function createRacerSubDataItemFinished(rider) {
    return o101UiLib
        .createDiv(['info-item', 'sub', 'divider'])
        .withChildDiv(['info-item-gaptime-detailed-index'], o101Common.fmtGapTimeByGap(rider.gap, true, 3), null, 'Timegap to race winner')
        .withChildDiv(['info-item-racingscore'], rider.zrs > 0 ? rider.zrs : '&nbsp', null, 'Zwift Racing Score')
        .withChildDiv(['info-item-hr'], rider.hr != '' ? rider.hr + '<img src="././images/heart.png"/>' : '&nbsp', null, 'Average HR')
        .withChildDiv(['info-item-power-detailed'], rider.power, null, 'Average Wkg')
        .withChildDiv(['info-item-wkgunit'], '&#9889');
}

async function renderRiderStats() {
    let ladderEventInfo = o101UiLib.createDiv(['info-group']);

    await addTeamStats(ladderEventInfo, settings.ladder.myTeamHeader, settings.ladder.myTeamRiders);
    await addTeamStats(ladderEventInfo, settings.ladder.opponentTeamHeader, settings.ladder.opponentTeamRiders);

    o101UiLib.setInfoSection('#ridersList', ladderEventInfo, []);
}

async function addTeamStats(div, header, riders) {
    div.appendChild(o101UiLib.createDivWithSpan(['info-item', 'sub'], '&nbsp;'));
    div.appendChild(createSimpleGroupHeaderItem({header: getTeamHeader(header, 29)}));

    for (let id of riders) {
        const rider = await getRiderData(id);

        if (rider == null) continue;

        div.appendChild(createRacerStatsDataItem(rider));
        div.appendChild(createRacerStatsDataSubItem(rider));
    }
}

async function getRiderData(id) {
    if (id==null || id=='' || id==0 || id=='0') return null;
    let rider = state.data.length>0 ? state.data.find(r => r.id == id) : null;
    if (rider!=null) return rider;

    let athlete = await common.rpc.getAthlete(id);
    if (athlete == null) {
        athlete = await common.rpc.getAthlete(id, {refresh:true});            
    };

    if (athlete != null) {
        rider = createRider(athlete);
        rider.id = id;
        rider.name = o101Common.fmtName({athlete});
        rider.category = athlete.racingCategory ?? '&nbsp;';
        rider.racingScore = o101Common.formatNumber(athlete.racingScore, 0);
        rider.height = o101Common.formatNumber( athlete.height, 0);
        rider.weight = o101Common.formatNumber(athlete.weight, 0);
        rider.flag = o101Common.fmtFlagByCountryCode(athlete.countryCode);
    }

    state.data.push(rider);

    return rider;
}

function createRacerStatsDataItem(rider) {
    return o101UiLib
        .createDiv(['info-item', 'advanced'])
        .withChildDiv(['info-item-category', 'cat', 'cat-'+rider.category], '<span>' + rider.category + '</span>', null, 'Zwift Power category')
        .withChildDivWithDataAttribute(['info-item-name-detailed'], rider.name, 'id', rider.id)
        .withChildDiv(['info-item-team'], rider.team)
        .withChildDiv(['info-item-flag'], rider.flag);
}

function createRacerStatsDataSubItem(rider) {
    return o101UiLib
        .createDiv(['info-item', 'sub', 'divider'])
        .withChildDiv(['info-item-gaptime-detailed-index'], rider.racingScore>0 ? rider.racingScore : '&nbsp;', null, 'Zwift Racing Score')
        .withOptionalChildDiv(rider.height != null, ['info-item-draft'], rider.height + ' cm')
        .withOptionalChildDiv(rider.weight != null, ['info-item-hr'], rider.weight + ' kg');
}

function renderGroupsAndRiders(ladderData) {
    let infoGroup = o101UiLib.createDiv(['info-group']);
    infoGroup.appendChild(o101UiLib.createDivWithSpan(['info-item', 'sub'], '&nbsp;'));
    
    let groupCount = 0;
    for (let group of ladderData.groups) {
        if (groupCount<settings.ladder.maxGroups) {
            const groupHeaderItem = (group.finished || (ladderData.hasFinishedGroup && group.id==1))
                ? createSimpleGroupHeaderItem(group)
                : createGroupHeaderItem(group);

            infoGroup.appendChild(groupHeaderItem);
        }

        for (let rider of group.riders) {
            if (settings.ladder.showWbal) infoGroup.appendChild(createWbal(rider.wBal));
            infoGroup.appendChild(createRacerDataItem(rider));
            if (rider.finished) {
                infoGroup.appendChild(createRacerSubDataItemFinished(rider));
            } else {
                infoGroup.appendChild(createRacerSubDataItem(rider));
            }
        }

        groupCount++;
    }

    o101UiLib.setInfoSection('#ridersList', infoGroup, []);
    for (let div of document.querySelectorAll('.info-item-team')) {
        div.addEventListener('click', toggleLadderTeam);
    }
   
    o101Common.findAndMoveExpiredPowerUps(powerUpsState);
}

function createLadderGroup(id, speed, header = '') {
    return {
        id: id,
        riders: [],
        speed: speed,
        header: header,
        myGroup: false,
        speedDeltaPercentage: 0,
        gap: '',
        finished: false
    }
}

let finishPoints = maxPoints;
function handleFinishedRiders(finishedRiders) {
    if (finishedRiders.length == 0) return;

    const sortedFinishedRiders = finishedRiders.sort(function(a, b) { return a.rank - b.rank; });
    const winnerEventDuration = sortedFinishedRiders[0].activityData.durationInMilliseconds;

    for(let fr of sortedFinishedRiders) {
        if (state.finishedRiders.some(r => r.id === fr.athlete.id) || finishPoints == 0) continue;

        let rider = {
            id: fr.athlete.id,
            name: o101Common.fmtName(fr),
            team: '',
            flag: o101Common.fmtFlag(fr),
            power: '0',
            points: finishPoints--,
            myTeam: isMyTeamRider(fr.athlete.id),
            finished: true,
            endDate: fr.activityData.endDate,
            gap: (fr.activityData.durationInMilliseconds - winnerEventDuration) / 1000,
            wBal: 100,
            draft: '0',
            hr: '',
            zrs: 0,
            powerUp: {
                image:'',
                remaining: 0,
                togo: 0
            }
        }

        let wkg = fr.sensorData.avgWatts / fr.athlete.weight;
        rider.power = sauce.locale.human.number(wkg, {precision: 1, fixed: true});
        rider.hr = fr.sensorData.heartRateData.avgHeartRate;
        rider.zrs = sauce.locale.human.number(fr.scoreHistory.previousScore, {precision: 0, fixed: true});

        if (!isMyTeamRider(rider.id) && ! isOpponentTeamRider(rider.id)) continue;

        let teamName = defaultTeamName;
        if (isMyTeamRider(rider.id)) teamName = settings.ladder.myTeamBadge;
        if (isOpponentTeamRider(rider.id)) teamName = settings.ladder.opponentTeamBadge;
        rider.team = o101Common.fmtTeamBadgeV2(fr, true, teamName);

        state.finishedRiders.push(rider);
    }
}

let lockWatchSwitch = false;
function handleAutoSwitchRider(data) {
    if (!settings.ladder.autoSwitchRider) return;
    
    state.lastRiderId = getLastRiderId(data);
    
    if (watchingRiderHasFinished() && state.lastRiderId > 0 && state.watchingId != state.lastRiderId) {        
        if (!lockWatchSwitch) {
            lockWatchSwitch = true;
            setTimeout( function() { changeWatchedRider(state.lastRiderId); lockWatchSwitch = false;}, settings.ladder.autoSwitchRiderInterval*1000);
        }
    }
}

function getLadderGroupHeader(riders, groupIndex) {
    if (state.finishedRiders.length>0) return (riders==1) ? 'Rider' : 'Group'; 
    if (groupIndex==1) return riders>1 ? 'Leading group' : 'Leader';
    if (groupIndex==2) return riders>1 ? 'Chasing group' : 'Chaser';
    if (riders==1) return 'Rider';

    return 'Group ' + groupIndex;
}

function scoringcalculationByPosition(riders) {
    const myGroupPoints = riders.filter(r => r.myTeam).reduce((totalPoints, rider) => totalPoints + rider.points, 0);
    const opponentGroupPoints = riders.filter(r => !r.myTeam).reduce((totalPoints, rider) => totalPoints + rider.points, 0);

    return {
        myGroupPoints: myGroupPoints,
        opponentGroupPoints: opponentGroupPoints
    }
}

function scoringCalculationOptimistic(riders) {
    const myTeam = riders.filter(r => r.myTeam);
    
    let myPoints = riders[0].points;
    let myGroupPoints = 0;
    let opponentPoints = riders[0].points - myTeam.length;
    let opponentGroupPoints = 0;

    for(let r of riders) {
        if (r.myTeam) {
            myGroupPoints += myPoints--;
        }
        else {
            opponentGroupPoints += opponentPoints--;
        }
    }

    return {
        myGroupPoints: myGroupPoints,
        opponentGroupPoints: opponentGroupPoints
    }
}

function getScoring(ladderData) {
    const myFinishedPoints = state.finishedRiders.filter(r => r.myTeam).reduce((totalPoints, rider) => totalPoints + rider.points, 0);
    const opponentFinishedPoints = state.finishedRiders.filter(r => !r.myTeam).reduce((totalPoints, rider) => totalPoints + rider.points, 0);

    if (settings.ladder.scoringCalculation == 'position') {
        return {
            myPoints: ladderData.scoring.position.my + myFinishedPoints,
            opponentPoints: ladderData.scoring.position.opponent + opponentFinishedPoints
        }
    } else {
        return {
            myPoints: ladderData.scoring.optimistic.my + myFinishedPoints,
            opponentPoints: ladderData.scoring.optimistic.opponent + opponentFinishedPoints
        }
    }
}

function fmtSpeedDelta(percentage) {
    if (percentage > -1*2 && percentage < 15) return '';
    
    if (percentage > 2) return '<abbr class="faster">&#x25B2&#x25B2</abbr>';
    if (percentage > 0) return '<abbr class="faster">&#x25B2</abbr>';

    if (percentage < -1*15) return '<abbr class="slower">&#x25BC&#x25BC</abbr>';
    if (percentage < 0) return '<abbr class="slower">&#x25BC</abbr>';

    return '';
}

async function clickNearbyRider(ev) {
    if (ev.target.dataset.id == null || ev.target.dataset.id == '') return;

    await changeWatchedRider(ev.target.dataset.id);
}

async function changeWatchedRider(id) {
    await common.rpc.watch(id);

    state.watchingId = id;
    lastRefreshDate = Date.now() - 99999;
}

async function toggleLadderTeam(ev) {
    const id = ev.target.parentElement.parentElement.dataset.id.toString();
    
    if (id == null || id == '') return;

    if (!state.nearbyRiders.some(r => r.id === id)) {
        state.nearbyRiders.push(id);
    }

    if (!state.registeredRiders.some(r => r.id === id)) {
        state.registeredRiders.push(id);
    }

    const inMyTeamIndex = settings.ladder.myTeamRiders.indexOf(id);
    const inOpponentTeamIndex = settings.ladder.opponentTeamRiders.indexOf(id);

    if (inMyTeamIndex<0 && inOpponentTeamIndex<0) {
        settings.ladder.opponentTeamRiders.push(id);
    } else if (inMyTeamIndex>=0) {
        settings.ladder.myTeamRiders.splice(inMyTeamIndex, 1);
        settings.ladder.opponentTeamRiders.push(id);
    } else if (inOpponentTeamIndex>=0) {
        settings.ladder.opponentTeamRiders.splice(inOpponentTeamIndex, 1);
        settings.ladder.myTeamRiders.push(id);
    }

    common.settingsStore.set('myTeamRiders', settings.ladder.myTeamRiders.join(','))
    common.settingsStore.set('opponentTeamRiders', settings.ladder.opponentTeamRiders.join(','))
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