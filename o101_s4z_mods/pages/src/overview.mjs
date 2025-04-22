import * as common from '/pages/src/common.mjs';
import * as o101EtaCalculator from './o101/etaCalculator.mjs';
import * as o101Common from './o101/common.mjs';
import * as o101UiLib from './o101/ui-lib.mjs';
import * as o101Ext from './o101/extensions.mjs';

const doc = document.documentElement;
let showRiderInfo;
let showEventInfo;
let hideEventLapInfo;
let showSegmentOverview;
let showSegmentInfo;
let showSegmentPB;
let showLeaderboard;
let showLeaderboardAlways;
let showLeaderboardByTime;
let showLeaderboardByTimeApproaching;
let showLeaderboardByTimeLeaving;
let showSessionInfo;
let eventHeaderInitialized = false;

const defaultOverviewDataSegments = {
    routeSegments: null,
    previousSegmentIdx: -1,
    activeSegmentIdx: -1,
    nextSegmentIdx: -1,
    activeSegmentEntered: null,
    etaCalculator: null
};

const defaultOverviewEvent = {
    eventSubgroupId: 0,
    activeEvent: null,
    distance: 0,
    laps: 1,
    elapsedTime: 0,
    lastSegment: null,
    eventEntered: null,
    etaCalculator: null
};

const defaultOverviewRoute = {
    id: null,
    distance: 0,
    time: null,
    routeEntered: null,
    etaCalculator: null
};

const overviewData = {
    refreshDate: Date.now() - 2100,
    eventSubgroupId: 0,
    event: defaultOverviewEvent,
    segments: defaultOverviewDataSegments,
    route: defaultOverviewRoute 
}

common.settingsStore.setDefault({
    fontScale: 1,
    solidBackground: false,
    backgroundColor: '#00ff00',
    showRiderInfo: true,
    showEventInfo: true,
    hideEventLapInfo: true,
    showEventInfoPosition: true,
    showEventInfoProgress: true,
    showEventInfoElapsedTime: true,
    showEventInfoElapsedDistance: true,
    showEventElevationToGo: true,
    showEventEta: false,
    showEventInfoFinish: true,
    showSegmentOverview: false,
    showSegmentOverviewHideCompleted: false,
    showSegmentOverviewMaxSegments: true,
    showSegmentOverviewDistance: 'mark',
    showSegmentInfo: true,
    showSegmentPB: true,
    showSegmentInfoDistanceToGo: true,
    showSegmentInfoProgress: true,
    showSegmentInfoElapsed: true,
    showSegmentInfoEta: true,
    showLeaderboard: true,
    showLeaderboardAlways: false,
    showLeaderboardByTime: false,
    showLeaderboardAlways: false,
    showLeaderboardByTimeApproaching: 60,
    showLeaderboardMaxRiders: 30,
    showLeaderboardMarkedRidersOnly: false,
    showSessionInfo: false
});

const getEventSubgroupId = (athlete) => {
    // if (Object.hasOwn(athlete, 'o101')) {
    //     return athlete.o101.eventSubgroupId;
    // }

    return athlete.state.eventSubgroupId;
}

export async function main() {
    common.initInteractionListeners();
    common.subscribe('athlete/watching', updateMetrics);
    o101Common.initNationFlags();
    o101Common.initTeamColors();

    showRiderInfo = common.settingsStore.get('showRiderInfo');
    showEventInfo = common.settingsStore.get('showEventInfo');
    hideEventLapInfo = common.settingsStore.get('hideEventLapInfo');
    showSegmentOverview = common.settingsStore.get('showSegmentOverview');
    showSegmentInfo = common.settingsStore.get('showSegmentInfo');
    showSegmentPB = common.settingsStore.get('showSegmentPB');
    showLeaderboard = common.settingsStore.get('showLeaderboard');
    showLeaderboardAlways = common.settingsStore.get('showLeaderboardAlways');
    showLeaderboardByTime = common.settingsStore.get('showLeaderboardByTime');
    showLeaderboardByTimeApproaching = common.settingsStore.get('showLeaderboardByTimeApproaching');
    showLeaderboardByTimeLeaving = common.settingsStore.get('showLeaderboardByTimeLeaving');
    showSessionInfo = common.settingsStore.get('showSessionInfo');
    
    common.settingsStore.addEventListener('changed', ev => {
        if (ev.data.changed.has('showRiderInfo')) {
            showRiderInfo = common.settingsStore.get('showRiderInfo');
        } else if (ev.data.changed.has('showEventInfo')) {
            showEventInfo = common.settingsStore.get('showEventInfo');
        } else if (ev.data.changed.has('hideEventLapInfo')) {
            hideEventLapInfo = common.settingsStore.get('hideEventLapInfo');
        } else if (ev.data.changed.has('showSegmentOverview')) {
            showSegmentOverview = common.settingsStore.get('showSegmentOverview');
        } else if (ev.data.changed.has('showSegmentInfo')) {
            showSegmentInfo = common.settingsStore.get('showSegmentInfo');
        } else if (ev.data.changed.has('showSegmentPB')) {
            showSegmentPB = common.settingsStore.get('showSegmentPB');
        } else if (ev.data.changed.has('showLeaderboard')) {
            showLeaderboard = common.settingsStore.get('showLeaderboard');
        } else if (ev.data.changed.has('showLeaderboardAlways')) {
            showLeaderboardAlways = common.settingsStore.get('showLeaderboardAlways');
        } else if (ev.data.changed.has('showLeaderboardByTime')) {
            showLeaderboardByTime = common.settingsStore.get('showLeaderboardByTime');
        } else if (ev.data.changed.has('showLeaderboardByTimeApproaching')) {
            showLeaderboardByTimeApproaching = common.settingsStore.get('showLeaderboardByTimeApproaching');
        } else if (ev.data.changed.has('showLeaderboardByTimeLeaving')) {
            showLeaderboardByTimeLeaving = common.settingsStore.get('showLeaderboardByTimeLeaving');
        } else if (ev.data.changed.has('showSessionInfo')) {
            showSessionInfo = common.settingsStore.get('showSessionInfo');
        }

        render();
    });
   
    o101UiLib.createInfoSection('#totalInfo', 'total-', ['elapsed-time','distance','elevation']);    
    o101UiLib.createInfoSection('#eventInfo', 'event-', ['title', 'course', 'total-distance', 'total-elevation', 'lap-distance', 'lap-elevation', 'lap', 'position', 'progress', 'elapsed-time', 'distance', 'elevation-remaining', 'expected-time', 'finish']);    
    o101UiLib.createInfoSection('#segmentInfo', 'segment-', ['title', 'name', 'personal-best', 'length', 'distance-to-go', 'progress', 'elapsed-time', 'expected-time']);
    
    o101UiLib.convertToHeader(['#event-title', '#segment-title']);
    o101UiLib.convertToSubHeader(['#event-course', '#segment-name']);
    o101UiLib.addInfoItemDivider(['event-lap-distance', 'event-position', 'event-elevation-remaining', 'segment-length', 'route-progress', 'route-finish']);
    
    render();
}

function render() {
    common.setBackground(common.settingsStore.get());
    doc.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);

    o101UiLib.toggleClassByElements(!showRiderInfo, 'hidden', ['#riderInfo']);
    o101UiLib.toggleClassByElements(!showSessionInfo, 'hidden', ['#sessionInfo']);
    o101UiLib.toggleClassByElements(!showEventInfo, 'hidden', ['#eventInfo']);
    o101UiLib.toggleClassByElements(!showSegmentOverview, 'hidden', ['#segmentOverview']);
    o101UiLib.toggleClassByElements(!showSegmentInfo, 'hidden', ['#segmentInfo']);
    o101UiLib.toggleClassByElements(!showSegmentPB, 'hidden', ['#segment-personal-best', '#segment-length-divider']);

    o101UiLib.toggleClassByElements(!showLeaderboard, 'hidden', ['#leaderBoardInfo']);
    o101UiLib.toggleClassByElements(!common.settingsStore.get('showEventInfoProgress'), 'hidden', ['#event-progress']);
    o101UiLib.toggleClassByElements(!common.settingsStore.get('showEventInfoElapsedTime'), 'hidden', ['#event-elapsed-time']);
    o101UiLib.toggleClassByElements(!common.settingsStore.get('showEventInfoElapsedDistance'), 'hidden', ['#event-distance']);
    o101UiLib.toggleClassByElements(!common.settingsStore.get('showEventInfoFinish'), 'hidden', ['#event-finish']);
    o101UiLib.toggleClassByElements(!common.settingsStore.get('showEventEta'), 'hidden', ['#event-expected-time']);
    o101UiLib.toggleClassByElements(!common.settingsStore.get('showEventElevationToGo'), 'hidden', ['#event-elevation-remaining']);
}

let refresh;
function updateMetrics(info) {
    refresh = false;

    if ((Date.now() - overviewData.refreshDate) >= 1000) {
        refresh = true;
    }

    if (refresh) {
        overviewData.refreshDate = Date.now();
        overviewData.segments.routeSegments = null;
        overviewData.eventSubgroupId = getEventSubgroupId(info);

        if (showRiderInfo) loadRiderInfo(info);
        if (showSessionInfo) loadSessionInfo(info);
        if (showEventInfo) loadEventInfo(info);
        if (showSegmentInfo || showSegmentOverview || showLeaderboard) setNearbySegments(info);
        if (showSegmentOverview) loadSegmentOverview(info);
        if (showLeaderboard) loadLeaderboard(info);
    }

    if (showSegmentInfo) loadSegmentInfo(info);
}

function loadRiderInfo(info) {
    setValue('#rider-flag', o101Common.fmtFlag(info));
    setValue('#rider-fullname', o101Common.fmtFirstName(info) + ' ' + o101Common.fmtLastName(info));
    setValue('#rider-team', o101Common.fmtTeamBadgeV2(info, true));
}

function loadSessionInfo(info) {
    setValue('#session-distance-value', o101Common.formatNumber(info.state.distance/1000, 2) + '<abbr>km</abbr>');
    setValue('#session-climbing-value', o101Common.formatNumber(info.state.climbing) + '<abbr>m</abbr>');
    setValue('#session-time-value', o101Common.formatDuration(info.state.time) + '<abbr>m</abbr>');
}

async function loadEventInfo(info) {
    const elapsedDistance = info.state.eventDistance;
    const event = overviewData.event;
   
    if (event.activeEvent == null) {
        event.activeEvent = o101Common.lazyGetSubgroup(overviewData.eventSubgroupId);
    }

    if (event.activeEvent) {
        event.distance = event.activeEvent.distanceInMeters ?? event.activeEvent.routeDistance;
        event.laps = event.activeEvent.laps;

        //if (!eventHeaderInitialized) {
        //    convertToScrollContainer('event-title');
        //}
        // setValue('#event-title-scroll', event.activeEvent.name);
        setValue('#event-total-distance-value', o101Common.formatNumber(event.distance/1000, 2) + '<abbr>km</abbr>');
        setValue('#event-total-elevation-value', o101Common.formatDistanceInMeters(event.activeEvent.routeClimbing) + '<abbr>m</abbr>');

        const zwiftRoute = o101Common.lazyGetRoute(event.activeEvent.routeId);
        if (zwiftRoute) {
            setValue('#event-title', '<span>' + zwiftRoute.name + '</span>');
            setValue('#event-lap-distance-value', o101Common.formatNumber(zwiftRoute.distanceInMeters/1000, 2) + '<abbr>km</abbr>');
            setValue('#event-lap-elevation-value', o101Common.formatDistanceInMeters(zwiftRoute.ascentInMeters) + '<abbr>m</abbr>');    
        }

        setValue('#event-course', '<span>zwiftRoute name zwiftRoute name</span>');

        o101UiLib.toggleClassByElements(event.laps <= 1 || hideEventLapInfo, 'hidden', ['#event-lap-distance-divider', '#event-lap-distance', '#event-lap-elevation', '#event-lap']);

        const distanceToGo = event.distance-elapsedDistance;
        const progress = (distanceToGo > 0) ? o101Common.formatNumber(info.state.progress * 100) : '100';
        const distanceToFinish = (distanceToGo > 0) ? o101Common.formatNumber((distanceToGo)/1000, 2) : 0;
        const currentLap = info.state.laps < event.laps ? (info.state.laps+1) : event.laps;
        const eventPosition = info.eventPosition ?? 0;
        const eventDistance = distanceToFinish > 0 ? o101Common.formatNumber((elapsedDistance)/1000, 2) : o101Common.formatNumber(event.distance/1000, 2);

        if (distanceToGo > 0) {
            overviewData.event.elapsedTime = info.state.time;
            overviewData.event.distanceToGo = distanceToGo;

            let elapsedTime = null;

            if (overviewData.event.eventEntered == null || info.state.routeProgress == 0) {
                overviewData.event.eventEntered = Date.now();

            }
            elapsedTime = Math.abs(overviewData.route.routeEntered - Date.now()) / 1000;

            if (elapsedTime != null) {
                const eta = o101EtaCalculator.create({
                    distance: event.distance,
                    distanceToGo: event.distance-elapsedDistance,
                    elapsedTime,
                    speed: info.state.speed,
                    startTime: overviewData.event.eventEntered,
                    dataStore: overviewData.event.etaCalculator
                });

                setValue('#event-expected-time-value', o101Common.formatLeaderboardTime(eta));
            }
        }
        
        setValue('#event-position-value', eventPosition + ' <abbr>of</abbr> ' + info.eventParticipants);
        setValue('#event-progress-value', progress + '<abbr>%</abbr>');
        setValue('#event-lap-value', currentLap + '<abbr>of</abbr> ' + event.laps);
        setValue('#event-elapsed-time-value', o101Common.formatDuration(overviewData.event.elapsedTime));
        setValue('#event-distance-value', eventDistance + '<abbr>km</abbr>');
        setValue('#event-elevation-remaining-value', o101Common.formatDistanceInMeters(event.activeEvent.routeClimbing-info.state.climbing) + '<abbr>m</abbr>');
        setValue('#event-finish-value', distanceToFinish + '<abbr>km</abbr>');

        o101UiLib.toggleClassByElements(!common.settingsStore.get('showEventInfoPosition') || eventPosition==0, 'hidden', ['#event-position']);
        o101UiLib.toggleClassByElements(event.activeEvent.distanceInMeters, 'hidden', ['#event-total-elevation', '#event-elevation-remaining']);
    } else {
        if (overviewData.route.id != info.state.routeId) {
            const route = await common.rpc.getRoute(info.state.routeId);
            const routeDistance = overviewData.route.distance = route.distanceInMeters;// - leadInDistance;
            const routeAscentInMeters = route.ascentInMeters;// - leadInAscent;

            overviewData.route.id = info.state.routeId;
            overviewData.route.leadIn = info.state.routeId;
            
            setValue('#event-title', '<span>' + route.name + '</span>');
            setValue('#event-total-distance-value', o101Common.formatNumber(routeDistance/1000, 2) + '<abbr>km</abbr>');
            setValue('#event-total-elevation-value', o101Common.formatDistanceInMeters(routeAscentInMeters) + '<abbr>m</abbr>');        
        }

        let distance = overviewData.route.distance * info.state.routeProgress * 0.01;
        let distanceToGo = overviewData.route.distance-distance;
        if (distance<0) distance = 0.00000001;

        let elapsedTime = null;
        if (overviewData.route.routeEntered == null || info.state.routeProgress == 0) {
            overviewData.route.routeEntered = Date.now();
        }
        elapsedTime = Math.abs(overviewData.route.routeEntered - Date.now()) / 1000;

        if (elapsedTime != null) {
            const eta = o101EtaCalculator.create({
                distance,
                distanceToGo,
                elapsedTime,
                speed: info.state.speed,
                startTime: overviewData.route.routeEntered,
                dataStore: overviewData.route.etaCalculator
            });

            setValue('#event-expected-time-value', o101Common.formatLeaderboardTime(eta));
        }

        setValue('#event-progress-value', o101Common.formatNumber(info.state.routeProgress) + '<abbr>%</abbr>');
        setValue('#event-distance-value', o101Common.formatNumber(distance/1000, 2) + '<abbr>km</abbr>');
        setValue('#event-finish-value', o101Common.formatNumber(distanceToGo/1000, 2) + '<abbr>km</abbr>');

        o101UiLib.toggleClassByElements(true, 'hidden', ['#event-course', '#event-lap-distance-divider', '#event-lap-distance', '#event-lap-elevation', '#event-lap', '#event-position', '#event-elapsed-time', '#event-elevation-remaining']);
    }
}

async function loadSegmentInfo(info) {
    let activeSegment = null;
    let nextSegment = null;
    let segment = null;
    let distanceToGo = 0;
    let elapsedTime = null;

    if (overviewData.segments.routeSegments != null) {
        activeSegment = overviewData.segments.routeSegments[overviewData.segments.activeSegmentIdx];
        nextSegment = overviewData.segments.routeSegments[overviewData.segments.nextSegmentIdx];
    }

    if (activeSegment != null) {
        segment = activeSegment;
        distanceToGo = Math.abs(info.segmentData.currentPosition - activeSegment.end);

        if (overviewData.segments.activeSegmentEntered == null) {
            overviewData.segments.activeSegmentEntered = Date.now();
        }
        elapsedTime = Math.abs(overviewData.segments.activeSegmentEntered - Date.now()) / 1000;

        if (distanceToGo <= 0) segment = null;
        setValue('#segment-distance-to-go-label', 'Distance to finish');
    } else if (nextSegment != null) {
        segment = nextSegment;
        distanceToGo = Math.abs(info.segmentData.currentPosition - nextSegment.start);
        setValue('#segment-distance-to-go-label', 'Distance to start');
    }

    if (activeSegment == null && overviewData.segments.activeSegmentEntered != null) {
        overviewData.segments.activeSegmentEntered = null;
        overviewData.segments.etaCalculator = null;
    }

    if (segment != null) {
        const distance = segment.end - segment.start;
        const progress = 100 - ((distanceToGo / distance) * 100);

        if (refresh) setValue('#segment-name', '<span>' + segment.name + '</span>');
        if (refresh) setValue('#segment-length-value', o101Common.formatDistance(distance, false) + (distance < 1000 ? '<abbr>m</abbr>' : ''));
        setValue('#segment-distance-to-go-value', o101Common.formatDistance(distanceToGo, false) + (distanceToGo < 1000 ? '<abbr>m</abbr>' : ''));
        
        if (elapsedTime != null) {
            const eta = o101EtaCalculator.create({
                distance,
                distanceToGo,
                elapsedTime,
                speed: info.state.speed,
                startTime: overviewData.segments.activeSegmentEntered,
                dataStore: overviewData.segments.etaCalculator
            });

            if (refresh) setValue('#segment-title', '<span>Current segment</span>');
            setValue('#segment-elapsed-time-value', o101Common.formatLeaderboardTime(elapsedTime));
            setValue('#segment-expected-time-value', o101Common.formatLeaderboardTime(eta));
            setValue('#segment-progress-value', o101Common.formatNumber(progress) + '<abbr>%</abbr>');
        } else {
            if (refresh) setValue('#segment-title', '<span>Next segment</span>');
        }

        loadSegmentPersonalBest(segment.id, info.athleteId);
    }

    o101UiLib.toggleClassByElements(!common.settingsStore.get('showSegmentInfoDistanceToGo'), 'hidden', ['#segment-distance-to-go']);
    o101UiLib.toggleClassByElements(!common.settingsStore.get('showSegmentInfoProgress') || elapsedTime == null, 'hidden', ['#segment-progress']);
    o101UiLib.toggleClassByElements(!common.settingsStore.get('showSegmentInfoElapsed') || elapsedTime == null, 'hidden', ['#segment-elapsed-time']);
    o101UiLib.toggleClassByElements(!common.settingsStore.get('showSegmentInfoEta') || elapsedTime == null || info.state.speed <= 0, 'hidden', ['#segment-expected-time']);
    o101UiLib.toggleClassByElements(segment == null, 'hidden', ['#segmentInfo']);
}

async function loadSegmentPersonalBest(segmentId, athleteId) {
    if (!showSegmentInfo || !showSegmentPB) return;

    const segmentBests = await common.rpc.getSegmentResults(segmentId, {athleteId, from: Date.now() - 86400000 * 90})
    const sorted = segmentBests.sort(function(a, b) {return a.elapsed - b.elapsed});
    
    if (sorted.length>0 && sorted[0].elapsed>0) {
        setValue('#segment-personal-best-value', o101Common.formatLeaderboardTime(sorted[0].elapsed));
    }
}

function loadLeaderboard(info) {
    if (info.segmentData == null || info.segmentData.routeSegments == null) {
        return null;
    }

    const xCoord = info.segmentData.currentPosition;
    const distanceInXSeconds = (info, seconds) => { return ((info.state.speed>3?info.state.speed:50) / 3.6) * seconds; };

    let activeSegment = null;
    let previousSegment = null;
    let nextSegment = null;
    
    if (overviewData.segments.routeSegments != null) {
        activeSegment = overviewData.segments.routeSegments[overviewData.segments.activeSegmentIdx];
        previousSegment = overviewData.segments.routeSegments[overviewData.segments.previousSegmentIdx];
        nextSegment = overviewData.segments.routeSegments[overviewData.segments.nextSegmentIdx];
    }

    // if shown, don't hide again until past segment
    // same for hidden after segment

    if (activeSegment != null) {
        loadSegmentLeaderboard(activeSegment, info);
        //console.log('leaderboard: active, use current segment');
        
        if (overviewData.event.distanceToGo < 100) {
            overviewData.event.lastSegment = activeSegment;
        }
    } else if (nextSegment != null && xCoord + distanceInXSeconds(info, 60) > nextSegment.start) {
        loadSegmentLeaderboard(nextSegment, info);
        // TODO timer, so can't change state within?
        //console.log('leaderboard: approching segment within range, ' + Math.round(distanceInXSeconds(info, 60)));
    } else if (previousSegment != null && xCoord < previousSegment.end + distanceInXSeconds(info, 30)) {
        loadSegmentLeaderboard(previousSegment, info);
        //console.log('leaderboard: just left a segment within range, ' + Math.round(distanceInXSeconds(info, 30)));
        // TODO show last segment result on bottom
        // TODO highlight my results in leaderboard is applicable
    } else {
        if (showLeaderboardAlways) {
            const segment = overviewData.event.lastSegment!=null ? overviewData.event.lastSegment : nextSegment
            loadSegmentLeaderboard(segment, info);
            //console.log('leaderboard: always enabled, show last event segment or next segment');
        } else {
            // TODO when timer inactive
            clearLeaderboard();
            //console.log('leaderboard: dont show');
        }
    }
}

function loadSegments(routeSegments) {
    overviewData.segments.routeSegments = [];

    if (routeSegments == null || routeSegments.length == 0) {
        return overviewData.segments.routeSegments;
    }
    
    let newSegment;
    let newSegmentIdx = 0;
    for (let i=0; i<routeSegments.length; i++) {
        const segment = routeSegments[i];
        const isFinish = (segment.name.indexOf('Finish') > 0)
        if (isFinish) {
            continue;
        }

        newSegment = {
            idx: 0,
            id: segment.id,
            name: o101Common.fmtSegmentName(segment.displayName ?? segment.name),
            start: segment.markLine,
            end: getMatchingFinishSegmentEnd(i, segment, routeSegments)
        }
        
        if (newSegment.end - newSegment.start > 0) {
            newSegment.idx = newSegmentIdx++;
            overviewData.segments.routeSegments.push(newSegment);
        }
    }
}

function loadSegmentOverview(info) {
    if (overviewData.segments.routeSegments == null || overviewData.segments.routeSegments.length == 0) {
        return;
    }

    const showSegmentOverviewHideCompleted = common.settingsStore.get('showSegmentOverviewHideCompleted');
    const showSegmentOverviewMaxSegments = common.settingsStore.get('showSegmentOverviewMaxSegments') ? 5 : 128;
    const showSegmentOverviewDistance = common.settingsStore.get('showSegmentOverviewDistance');

    const dataGroup = o101UiLib.createDiv(['info-group']);
    const header = o101UiLib.createDiv(['info-item', 'header']);

    header.appendChild(o101UiLib.createDiv(['info-item-label'], '<span>Route segments</span>'));
    dataGroup.appendChild(header);

    if (showSegmentOverviewHideCompleted) {
        let dataItem = o101UiLib.createDiv(['info-item', 'divider']);
        const completed = overviewData.segments.routeSegments.filter(s => info.segmentData.currentPosition > s.end);
        
        dataItem.classList.add('striked');
        dataItem.appendChild(o101UiLib.createDiv(['info-item-label'], 'Segments completed'));
        dataItem.appendChild(o101UiLib.createDiv(['info-item-value'], completed.length));

        if (completed.length>0) {
            dataGroup.appendChild(dataItem);
        }
    }

    let iVisible = 0;
    for(let i=0; i<overviewData.segments.routeSegments.length && iVisible<showSegmentOverviewMaxSegments; i++) {
        const segment = overviewData.segments.routeSegments[i];
        const segmentCompleted = info.segmentData.currentPosition > segment.end;
        if (!segmentCompleted) iVisible++;
        if (showSegmentOverviewHideCompleted && segmentCompleted) continue;

        const dataItem = o101UiLib.createDiv(['info-item', 'divider']);
        let distance = showSegmentOverviewDistance=='togo' ? segment.start - info.segmentData.currentPosition : segment.start;
        
        if (overviewData.eventSubgroupId > 0 && segmentCompleted) {
            dataItem.classList.add('striked');
        }

        if (showSegmentOverviewDistance=='togo' && segmentCompleted) {
            distance = 0;
        }

        dataItem.appendChild(o101UiLib.createDiv(['info-item-label'], segment.name));
        dataItem.appendChild(o101UiLib.createDiv(['info-item-value'], o101Common.formatDistance(distance, false)));

        dataGroup.appendChild(dataItem);
    }

    const hiddenNextSegments = overviewData.segments.routeSegments.length - showSegmentOverviewMaxSegments;
    if (hiddenNextSegments > 0){
        let dataItem = o101UiLib.createDiv(['info-item', 'divider']);
        
        dataItem.appendChild(o101UiLib.createDiv(['info-item-label'], 'More segments'));
        dataItem.appendChild(o101UiLib.createDiv(['info-item-value'], hiddenNextSegments));

        dataGroup.appendChild(dataItem);
    }

    o101UiLib.setInfoSection('#segmentOverview', dataGroup);
}

function setNearbySegments(info) {
    if (!Object.hasOwn(info, 'segmentData')) {
        overviewData.segments.routeSegments = [];
        return;
    }

    if (overviewData.segments.routeSegments == null) {
        loadSegments(info.segmentData.routeSegments);
    }

    const xCoord = info.segmentData.currentPosition;
    const segments = overviewData.segments;

    segments.previousSegmentIdx = -1;
    segments.activeSegmentIdx = -1;
    segments.nextSegmentIdx = -1;

    if (segments.routeSegments == null || segments.routeSegments.length == 0) {
        return;
    }

    segments.activeSegmentIdx = segments.routeSegments.findIndex(s => xCoord >= s.start && xCoord <= s.end);
    if (overviewData.segments.activeSegmentIdx >= 0) {
        if (segments.activeSegmentIdx>0) {
            segments.previousSegmentIdx = segments.activeSegmentIdx-1;
        }
        if (segments.activeSegmentIdx < segments.routeSegments.length-1) {
            segments.nextSegmentIdx = segments.activeSegmentIdx+1;
        }

        return;
    }

    segments.nextSegmentIdx = segments.routeSegments.findIndex(s => xCoord <= s.start);
    if (segments.nextSegmentIdx >= 0) {
        if (segments.nextSegmentIdx > 0) {
            segments.previousSegmentIdx = segments.nextSegmentIdx-1;
        }

        return;
    }

    segments.previousSegmentIdx = segments.routeSegments.length-1;
}

function getMatchingFinishSegmentEnd(startIndex, segment, routeSegments) {
    for (let i=startIndex; i<routeSegments.length; i++) {
        const isMatchingSegmentByName = routeSegments[i].name.indexOf(segment.name + ' Finish') >= 0;
        const hasMinimalLength = true; //routeSegments[i].markLine - segment.markLine > 0;
        
        if (isMatchingSegmentByName && hasMinimalLength) return routeSegments[i].markLine;
        
    }

    // should not be possible
    return segment.markLine - 1;
}

function setValue(id, value, unit, img) {
    const div = doc.querySelector(id);
        
    if (div == null || value == null) return '&nbsp';
    
    if (unit != null) {
        div.innerHTML = value + '<abbr class="unit">' + unit + '</abbr>';
    } else if (img != null){
        div.innerHTML = value + img;
    } else {
        div.innerHTML = value;
    }
}

function convertToScrollContainer(id) {
    const div = document.getElementById(id);
    const scrollDiv = o101UiLib.createDivWithId(id+'-scroll');
    
    div.innerHTML = '';
    div.classList.add('scroll-container');
    div.appendChild(scrollDiv);
}

async function loadSegmentLeaderboard(segment, info) {
    if (segment == null ) return;

    const createLeaderboardEntry = (rank, entry, teamBadge, marked = false) => {
        return {
            id: entry.id,
            rank: rank,
            name: o101Common.formatLeaderboardName(entry),
            result: o101Common.formatLeaderboardTime(entry.elapsed),
            marked: marked || o101Common.getAthleteType(entry) == 'marked',
            teamBadge
        };
    };

    let leaderboardRanking = [];
    let segmentLeaderboard = await common.rpc.getSegmentResults(segment.id, {live:true})
    let leaderboard = segmentLeaderboard
        .filter(x => x.eventSubgroupId === overviewData.eventSubgroupId)
        .sort(function(a, b) {return a.elapsed - b.elapsed});
    
    if (common.settingsStore.get('showLeaderboardMarkedRidersOnly')) {
        if (markedAthletes == null) getMarkedAthletes();

        if (markedAthletes != null) {
            leaderboard = leaderboard.filter(x => markedAthletes.includes(x));
        }
    }

    const showLeaderboardMaxRiders = common.settingsStore.get('showLeaderboardMaxRiders');
    for (let i=0; i<leaderboard.length && i<showLeaderboardMaxRiders; i++) {
        common.rpc.getAthleteData(leaderboard[i].athleteId).then(athlete => {
            const o101 = athlete != null && Object.hasOwn(athlete, 'o101') ? athlete.o101 : '';
            const teamBadge = o101 != null &&  Object.hasOwn(o101, 'teamBadge') ? o101.teamBadge : '';
            
            leaderboardRanking.push(createLeaderboardEntry(i+1, leaderboard[i], teamBadge));
        });
    }

    common.rpc.getAthleteData(info.athleteId)
        .then(athlete => {
            const myRank = segmentLeaderboard.findIndex(x => x.athleteId == info.athleteId);
            const myEntry = segmentLeaderboard.filter(x => x.athleteId == info.athleteId);

            if (myRank >= showLeaderboardMaxRiders && myEntry != null && myEntry.length > 0) {
                leaderboardRanking.push(createLeaderboardEntry(myRank-1, myEntry[0], athlete.o101.teamBadge, true));
            }
        })
        .finally(() => createLeaderBoard(segment.name, leaderboardRanking));
}

function createLeaderBoard(segmentName, ranking) {
    clearLeaderboard();

    if (ranking.length <= 0) return;
    
    const dataGroup = o101UiLib.createDiv(['info-group'])
        .withChildDiv(['info-item', 'header'], '<span>Leaderboard</span>')
        .withChildDiv(['info-item', 'subheader', 'divider'], 'segment name', 'leaderboard-segment-name');

    for(const entry of ranking) {
        let dataItem = o101UiLib.createDiv(['info-item', 'divider']);
        if (entry.marked) dataItem.classList.add('marked');

        dataItem.appendChild(o101UiLib.createDivWithSpan(['info-item-index'], entry.rank));
        dataItem.appendChild(o101UiLib.createDiv(['info-item-name'], entry.name));
        dataItem.appendChild(o101UiLib.createDiv(['info-item-team'], entry.teamBadge));        
        dataItem.appendChild(o101UiLib.createDiv(['info-item-value', 'info-item-value-leaderboard'], entry.result));

        dataGroup.appendChild(dataItem);
    }

    dataGroup.lastChild.classList.remove('divider')

    o101UiLib.setInfoSection('#leaderBoardInfo', dataGroup);

    // max width
    setValue('#leaderboard-segment-name', '<span>' + segmentName.replace(' Finish', '') + '</span>');
}

function clearLeaderboard() {
    const divData = document.querySelector('#leaderBoardInfo');
    divData.innerHTML = '';
}

let markedAthletes = null;
async function getMarkedAthletes() {
    await Promise.all([
        common.rpc.getMarkedAthletes().then(async x => {
            markedAthletes = x.map((i) => { return i.id;});
        }),
    ])
}