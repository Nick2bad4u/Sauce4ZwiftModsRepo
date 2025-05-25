import * as common from '/pages/src/common.mjs';
import * as JSONobj from './BM/dataLookup.mjs';
import * as BMcommon from './BM/common.mjs';

let debug = false;
if (window.isElectron) {
    debug = false;
} else {
    debug = true;
}
console.log("debug:", debug);

//console.log(JSONobj["JSONstr"]);
var jsonTerrain = JSONobj["jsonTerrain"];
//var jsonCutTimes = JSONobj["jsonCutTimes"];

// Convert to array.
var terrainArray = JSON.parse(jsonTerrain);
let cutTimesArray = JSON.parse(JSONobj.cutTimesFlat);

let showFirstRiderInfo = common.settingsStore.get('showFirstRiderInfo');
let showCutTime = common.settingsStore.get('showCutTime');
const showEstimatedCalories = common.settingsStore.get('showEstimatedCalories');
let lastRefreshDate = Date.now() - 99999;
let routeRefreshInterval = 120000;
let eventRefreshInterval = 180000;
let firstRiderTimeout = 10000;
let watchingRider  = [];
let activeEvent = null;
let watchRiderName = null;
let includeDistance = true;
let includeAvgSpeed = true;
let includeFinishMinutes = true;
let includeCurrentSpeed = true;
let watchEventDistance = 0;
let prevWatchEventDistance = 0;
let saltAvgSpeed = 0;
let saltQueueMax = 50;
let saltArray = [0];
let watchAvgSpeed  = 0;
let watchEstimatedMinutesAtFinish  = 0;
let watchRiderSubgroupId = 0;
let watchCurrentSpeed =0;
let firstEstimatedMinutesAtFinish = 0;
let firstRider = null;
let firstEventPosition = 0;
let cutOffLine = '';
let firstElapsedMinutes  = 0;
let firstEstimatedFinishTime =0;
let firstEventDistance = 0;
let firstMinutesRemaining = 0;
let firstRemainingMMSS = 0;
let unique = null;
let countOfEventSubgroup = 0;
let targetTimeValue = '';
let targetTimeGroup = 0;
let externalDataMaxRetries = 5;

const doc = document.documentElement;
const page = location.pathname;

var date = new Date();
if (debug) console.log("date:", date);
const state = {
    routeID: 0,
    watchId: 0,
    firstID: 0,
    hideFirst: false,
    hideCut: false,
    hideWatch: false,
    watchRemainingDistance: 0,
    watchDistance: 0,
    watchPercentDistance: 0,
    watchPercentAscent: 0,
    maxSubGroups: 1,
    remainingType : '',
    remainingMetric : '',
    firstUpdatingData: true,
    firstUpdatingCut: true,
    firstEstimatedMinutesAtFinish: 0,
    firstAvgSpeed: 0,
    firstEventPosition: 0,
    firstLowestPosition: 99,
    firstRemainingDistance: 0,
    firstLastSeen: Date.now(),
    eventSubgroupId: 0
};

const windowSizing = {
    currentHeight: window.innerHeight,
    currentWidth: window.innerWidth,
    thresholdHeadings: 312,
    thresholdTitles: 260,
    thresholdFirst: 535,
    thresholdCut: 410,
    thresholdWatch: 240
};

const elementTitles = {
    watchRiderKey: 'Watching:',
    watchAvgSpeedKey: 'Average Speed:',
    watchRemainingKey: 'Remaining Minutes:',
    watchFinishTimeKey: 'Estimated Finish Time:',
    watchTargetTimeKey: 'Target Finish Time:'
};

const route = {
    refreshDate: Date.now() - routeRefreshInterval,
    routeID: 0,
    name: '',
    terrain: '',
    ascentInMeters: 0,
    distanceInMeters: 0,
    leadinDistanceInMeters: 0,
    externalDataRetries: 0,
    externalData: false
};

const event = {
    refreshDate: Date.now() - (eventRefreshInterval - 2000),
    totalDistance: 0,
    calcLaps: 0,
    totalAscent: 0
};

let targetTime = document.getElementsByName("watchTargetHHMMSS")[0].value;
if (debug) console.log("targetTime:", targetTime);
if (targetTime == "") {
    targetTimeValue = common.settingsStore.get('targetTimeValue');
    targetTimeGroup = common.settingsStore.get('targetTimeGroup');
    if (debug) console.log("targetTimeValue :", targetTimeValue, " - targetTimeGroup :", targetTimeGroup);
    document.getElementsByName("watchTargetHHMMSS")[0].value = targetTimeValue;
    state.eventSubgroupId = targetTimeGroup;
}

common.settingsStore.setDefault({
    fontScale: 1,
    solidBackground: false,
    backgroundColor: '#00ff00'
});

async function externalRouteLookup(routeNumber){
    let url = "https://www.brianmudge.com/php/ro/routeData.php?routeNumber=" + routeNumber;
    if (debug) console.log("url :", url);
    const resp = await fetch(url);
    const responseData = resp.json();
    return responseData;

}

async function updateRouteInfo(){
    lastRefreshDate = Date.now();
    let routeDateDiff = lastRefreshDate - route.refreshDate;
    if (routeDateDiff > routeRefreshInterval){
        console.log("Start updateRouteInfo");
        const routeLookup = await common.rpc.getRoute(watchingRider.state.routeId);
        if (routeLookup == null) {
            console.log("No routeLookup found");
            if (!route.externalData && watchingRider.state.routeId != null && watchingRider.state.routeId != 0 && route.externalDataRetries < externalDataMaxRetries) {
                route.externalDataRetries ++;
                route.refreshDate = lastRefreshDate - (routeRefreshInterval - 20000);
                const routeLookup = await externalRouteLookup(watchingRider.state.routeId);
                console.log("routeLookup (Ext) :", routeLookup);
                route.routeID = routeLookup.zpRT;
                route.name = routeLookup.zpRouteName;
                route.ascentInMeters = routeLookup.elevation;
                route.distanceInMeters = routeLookup.distance * 1000;
                route.leadinDistanceInMeters = routeLookup.leadIn * 1000;
                event.totalDistance = route.distanceInMeters + route.leadinDistanceInMeters;
                event.totalAscent = route.ascentInMeters;
                route.externalData = true;
            } else {
                let segments = watchingRider.segmentData.routeSegments;
                console.log("segments = ", segments);
                let lastSegment = segments[segments.length - 1];
                if (lastSegment != null) {
                    console.log("lastSegment = ", lastSegment);
                    route.distanceInMeters = lastSegment.markLine;
                    route.leadinDistanceInMeters = 0;
                } else {
                    route.distanceInMeters = 0;
                    route.leadinDistanceInMeters = 0;
                }
                route.refreshDate = lastRefreshDate;
            }
            if (event.totalDistance == null) event.totalDistance = route.distanceInMeters;
        } else {
            console.log("routeLookup found");
            console.log("routeLookup (Int) :", routeLookup);
            route.externalData = false;
            state.routeId = watchingRider.state.routeId;
            route.routeID = state.routeId;
            route.name = routeLookup.name;
            route.ascentInMeters = routeLookup.ascentInMeters;
            route.distanceInMeters = routeLookup.distanceInMeters;
            route.leadinDistanceInMeters = routeLookup.leadinDistanceInMeters;
            event.calcLaps = calcNumberLaps();
    //    console.log("calcLaps = ", event.calcLaps);
            let routeData = terrainArray.filter(n => n.Name==route.name.toLowerCase())[0];
    //    console.log("routeData :", routeData);
            route.terrain = routeData.Terrain;
    //    console.log("terrain :", route.terrain);
            route.refreshDate = lastRefreshDate;
        }
    }
}

async function updateEventInfo(){
//    console.log("Start updateEventInfo");
    lastRefreshDate = Date.now();
    //    console.log("lastRefreshDate :", lastRefreshDate);
    let eventDateDiff = lastRefreshDate - event.refreshDate;
    if (eventDateDiff > eventRefreshInterval || activeEvent === undefined){
        console.log("Start updateEventInfo");
        event.refreshDate = lastRefreshDate;
        if (debug) console.log("watchRiderSubgroupId :", watchRiderSubgroupId);
        let activeEvent = await common.rpc.getEventSubgroup(watchRiderSubgroupId);
        if (debug) console.log("activeEvent :", activeEvent);
        if (debug) console.log("routeDistance :", activeEvent.routeDistance);
        if (activeEvent.routeDistance === undefined) {
            if (event.totalDistance == 0) event.totalDistance = route.distanceInMeters;
        } else {
            if (state.remainingType == "event") {
                event.totalDistance = activeEvent.routeDistance;
                event.totalAscent = activeEvent.routeClimbing;
                event.laps = activeEvent.laps;
            } else if (state.remainingType == "route") {
                event.laps = watchingRider.lapCount;
            }
            console.log("event :", event);
        }
    }
}

function calcNumberLaps(){
    let rideLessLeadIn = event.totalDistance - route.leadinDistanceInMeters;
    event.calcLaps = Math.floor(rideLessLeadIn / route.distanceInMeters);
    return event.calcLaps;
}

// --- Calories calculation utility ---
function calculateCalories(avgWatts, seconds) {
    // 1 watt = 3.6 kJ/hour, 1 kcal = 4.184 kJ
    // Calories = (power * seconds / 1000) / 4.184
    return Math.round((avgWatts * seconds / 1000) / 4.184);
}

function updateFirstDisplay(){
    //    console.log("Start updateFirstDisplay");
}

function updateCutTimeDisplay(){
    if (state.firstAvgSpeed > 0 ){
        cutOffLine = cutTimesArray.filter(n => n.min < state.firstAvgSpeed && n.max > state.firstAvgSpeed)[0];
//    console.log("cutOffLine :", cutOffLine);
        var cutOffDecimal = cutOffLine.cut;
        var cutOffPercent = Math.round(cutOffDecimal * 100);
    } else {
        cutOffDecimal = 0.06;
        cutOffPercent = 6;
    }
//    console.log("cutOffPercent :", cutOffPercent);
    document.getElementsByName("cutTitle")[0].innerHTML = "ZRA Cut Time - 1st to Watched (" + cutOffPercent + "% - " + route.terrain + ")";

//    console.log("firstEstimatedMinutesAtFinish :", firstEstimatedMinutesAtFinish);
//    console.log("state.firstEstimatedMinutesAtFinish :", state.firstEstimatedMinutesAtFinish);
    var cutMinutes = state.firstEstimatedMinutesAtFinish + (state.firstEstimatedMinutesAtFinish * cutOffDecimal);
    var cutHHMMSS = BMcommon.minsToHHMMSS(cutMinutes);
    var cutDelta = cutMinutes - watchEstimatedMinutesAtFinish;
    if (cutDelta > 0) {
        var backGround="Green";
    } else {
        var backGround="Red";
    }
//    console.log("cutMinutes :", cutMinutes, " - cutDelta :", cutDelta);
    document.getElementsByName("cutMinutes")[0].innerHTML = cutHHMMSS;
    var cutDeltaHHMMSS = BMcommon.minsToHHMMSS(cutDelta);
    document.getElementsByName("cutDelta")[0].innerHTML = cutDeltaHHMMSS;
    document.getElementsByName("cutDelta")[0].style.color = backGround;
    document.getElementsByName("cutDelta")[0].style.fontWeight = "bold";

}

export async function main() {
    console.log("Sauce Version:", await common.rpc.getVersion());
    common.initInteractionListeners();
    common.settingsStore.addEventListener('changed', render);
    common.subscribe('nearby', onNearbyInfo);
    setBackground();
    render();
}

function clearFirstRider(e) {
    if (e) {
        document.getElementsByName("firstRiderName")[0].innerHTML = "";
        document.getElementsByName("firstAvgSpeed")[0].innerHTML = "";
        document.getElementsByName("firstRemainingMMSS")[0].innerHTML = "";
        document.getElementsByName("firstEstimatedFinishTime")[0].innerHTML = "";
        document.getElementById("firstRider").style.visibility = 'hidden';
        document.getElementById("firstToWatched").style.visibility = 'hidden';
    } else {
        if (!state.hideFirst) document.getElementById("firstRider").style.visibility = 'visible';
        document.getElementById("firstToWatched").style.visibility = 'visible';
    }
}

function clearCutTime() {
    document.getElementsByName("cutMinutes")[0].innerHTML = "";
    document.getElementsByName("cutDelta")[0].innerHTML = "";
    document.getElementsByName("cutDelta")[0].style.color = "White";
    document.getElementById("firstToWatched").style.visibility = 'hidden';
}

function resize() {
//    console.log("Start resize");
    if (!showFirstRiderInfo || windowSizing.currentHeight < windowSizing.thresholdFirst) {
        state.hideFirst=true;
        document.getElementById("firstRider").style.display = 'none';
    } else {
        state.hideFirst=false;
        document.getElementById("firstRider").style.display = 'inline';
    }

    if (!showCutTime || windowSizing.currentHeight < windowSizing.thresholdCut) {
        state.hideCut=true;
        document.getElementById("firstToWatched").style.display = 'none';
    } else {
        state.hideCut=false;
        document.getElementById("firstToWatched").style.display = 'inline';
    }

    if (windowSizing.currentHeight < windowSizing.thresholdWatch || windowSizing.currentWidth < windowSizing.thresholdHeadings) {
        state.hideWatch=true;
        document.getElementById("watchRiderKey").style.display = 'none';
        document.getElementById("watchRiderTitle").style.display = 'none';
        document.getElementById("watchRiderName").style.display = 'none';
        document.getElementById("watchTargetLabel").style.display = 'none';
    } else {
        state.hideWatch=false;
        document.getElementById("watchRiderKey").style.display = 'inline';
        document.getElementById("watchRiderTitle").style.display = 'inline';
        document.getElementById("watchRiderName").style.display = 'inline';
        document.getElementById("firstRiderName").style.display = 'inline';
        document.getElementById("watchTargetLabel").style.display = 'inline';
    }

    if (windowSizing.currentWidth < windowSizing.thresholdTitles) {
        elementTitles.watchAvgSpeedKey = 'A:';
        elementTitles.watchRemainingKey = 'R:';
        elementTitles.watchFinishTimeKey = 'E:';
        document.getElementById("watchRiderTitle").style.display = 'none';
        document.getElementById("firstRiderTitle").style.display = 'none';
        document.getElementById("cutTitle").style.display = 'none';
        document.getElementById("firstNameLabel").style.display = 'none';
        document.getElementById("cutTimeKey").innerHTML = "T:";
        document.getElementById("cutDeltaKey").innerHTML = "D:";
        document.getElementById("watchAvgSpeedKey").style.minWidth = '1ch';
        document.getElementById("watchRemainingKey").style.minWidth = '1ch';
        document.getElementById("watchFinishTimeKey").style.minWidth = '1ch';
        document.getElementById("firstAvgSpeedKey").style.minWidth = '1ch';
        document.getElementById("firstRemainingKey").style.minWidth = '1ch';
        document.getElementById("firstFinishTimeKey").style.minWidth = '1ch';
        document.getElementById("cutTimeKey").style.minWidth = '1ch';
        document.getElementById("cutDeltaKey").style.minWidth = '1ch';
    } else {
        elementTitles.watchAvgSpeedKey = 'Average Speed:';
        elementTitles.watchRemainingKey = 'Remaining Minutes:';
        elementTitles.watchFinishTimeKey = 'Estimated Finish Time:';
        document.getElementById("watchRiderTitle").style.display = 'inline';
        document.getElementById("firstRiderTitle").style.display = 'inline';
        document.getElementById("cutTitle").style.display = 'inline';
        document.getElementById("firstNameLabel").style.display = 'inline';
        document.getElementById("cutTimeKey").innerHTML = "Cut Finish Time:";
        document.getElementById("cutDeltaKey").innerHTML = "Cut Delta:";
        document.getElementById("watchAvgSpeedKey").style.minWidth = '16ch';
        document.getElementById("watchRemainingKey").style.minWidth = '16ch';
        document.getElementById("watchFinishTimeKey").style.minWidth = '16ch';
        document.getElementById("firstAvgSpeedKey").style.minWidth = '16ch';
        document.getElementById("firstRemainingKey").style.minWidth = '16ch';
        document.getElementById("firstFinishTimeKey").style.minWidth = '16ch';
        document.getElementById("cutTimeKey").style.minWidth = '16ch';
        document.getElementById("cutDeltaKey").style.minWidth = '16ch';
    }
    document.getElementById("watchAvgSpeedKey").innerHTML = elementTitles.watchAvgSpeedKey;
    document.getElementById("watchRemainingKey").innerHTML = elementTitles.watchRemainingKey;
    document.getElementById("watchFinishTimeKey").innerHTML = elementTitles.watchFinishTimeKey;
    document.getElementById("firstAvgSpeedKey").innerHTML = elementTitles.watchAvgSpeedKey;
    document.getElementById("firstRemainingKey").innerHTML = elementTitles.watchRemainingKey;
    document.getElementById("firstFinishTimeKey").innerHTML = elementTitles.watchFinishTimeKey;
}

function setBackground() {
    const {solidBackground, backgroundColor} = common.settingsStore.get();
    doc.classList.toggle('solid-background', !!solidBackground);
    if (solidBackground) {
        doc.style.setProperty('--background-color', backgroundColor);
    } else {
        doc.style.removeProperty('--background-color');
    }
}

function render() {
    console.log("Start render");
    common.setBackground(common.settingsStore.get());
    if (debug) console.log("showFirstRiderInfo:", common.settingsStore.get('showFirstRiderInfo'));
    showFirstRiderInfo = common.settingsStore.get('showFirstRiderInfo');
    showCutTime = common.settingsStore.get('showCutTime');

//console.log("fontScale:", common.settingsStore.get('fontScale'));
    doc.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
//    doc.style.setProperty('--font-scale',  0.5);
//console.log("docstyle:", doc.style);
}

function onNearbyInfo(info) {
    if (debug) console.log("state :", state);
    if (debug) console.log("route :", route);
    if (debug) console.log("event :", event);
    if (debug) console.log("windowSizing :", windowSizing);
    resize();
    updateEventInfo();
    handleNearbyInfo(info);

}

function handleNearbyInfo(info) {
//    console.log("Info:", info);
    updateRiderInfo(info);

}

async function updateRiderInfo(nearby) {
//    console.log("Start updateRiderInfo");
    unique = [...new Set(nearby.map(item => item.state.eventSubgroupId))];
// console.log("unique :", unique);
    countOfEventSubgroup = unique.length;
// console.log("countOfEventSubgroup :", countOfEventSubgroup);
    windowSizing.currentHeight = window.innerHeight;
    windowSizing.currentWidth = window.innerWidth;
//    console.log ("height:", state.height, " - width :", state.width);

    if (state.maxSubGroups < countOfEventSubgroup) {state.maxSubGroups = countOfEventSubgroup};

    watchingRider = nearby.filter(n => n.watching)[0];

    if (watchingRider == null) return;

    if (debug) console.log("watchingRider:", watchingRider);

    if (state.watchId != watchingRider.athleteId) {
        route.refreshDate = Date.now() - routeRefreshInterval;
        event.refreshDate = Date.now() - eventRefreshInterval;
    }
    state.watchId = watchingRider.athleteId;

    // Do I need to set the value of watchTargetHHMMSS on a window refresh
    if (state.eventSubgroupId == 0 && watchingRider.state.eventSubgroupId > 0) {
        if (targetTimeGroup == watchingRider.state.eventSubgroupId) {
            document.getElementsByName("watchTargetHHMMSS")[0].value = targetTimeValue;
        } else {
            state.eventSubgroupId = watchingRider.state.eventSubgroupId;
            common.settingsStore.set('targetTimeGroup',state.eventSubgroupId);
        }
    }
// Look to see if the eventGroupID has changed
    if (state.eventSubgroupId != watchingRider.state.eventSubgroupId){
        document.getElementsByName("watchTargetHHMMSS")[0].value = "";
    }
    state.eventSubgroupId = watchingRider.state.eventSubgroupId;
    watchRiderSubgroupId = watchingRider.state.eventSubgroupId;

    var watchRiderAscent = watchingRider.state.climbing;
//    console.log("watchRiderAscent:", watchRiderAscent);
    var watchEventPosition = watchingRider.eventPosition;
    let watchAvgSpeed = watchingRider.stats.speed.avg;
    var watchCurrentSpeed = watchingRider.state.speed;
    if (watchCurrentSpeed > 0 ) {
        BMcommon.fifoQueue(saltArray,watchCurrentSpeed,saltQueueMax);
        saltAvgSpeed= BMcommon.arrayAverage(saltArray);
    } else {
        saltAvgSpeed = watchAvgSpeed;
    }
//    console.log("watchAvgSpeed :", watchAvgSpeed, " - saltAvgSpeed :", saltAvgSpeed);
    watchRiderName = watchingRider.athlete.sanitizedFullname;
    if (!state.hideWatch) document.getElementsByName("watchRiderName")[0].innerHTML = watchRiderName;
    state.watchDistance = watchingRider.distance;
    state.remainingType = watchingRider.remainingType;
    state.remainingMetric = watchingRider.remainingMetric;
//    console.log("remainingType :", state.remainingType, " - remainingMetric :", state.remainingMetric);
    if (watchAvgSpeed == null) {
        document.getElementsByName("watchAvgSpeed")[0].innerHTML = "Not moving";
        document.getElementsByName("watchRemainingMMSS")[0].innerHTML = "Not moving";
        document.getElementsByName("watchEstimatedFinishTime")[0].innerHTML = "Not moving";
        document.getElementsByName("watchEstimatedFinishTime")[0].style.color = "White";
        document.getElementsByName("watchEstimatedFinishTime")[0].style.fontWeight = "Normal";
        ;
        updateRouteInfo();
        updateEventInfo();
        clearFirstRider(true);
        return;
    }

    // Check if the routeID has changed - If so update route details and Terraindata
    if (watchingRider.state.routeId != state.routeId || event.calcLaps < 0) {
        updateRouteInfo();

        // Determine the appropriate terrain's cutTimes

        switch(route.terrain) {
            case "Flat":
                cutTimesArray = JSON.parse(JSONobj.cutTimesFlat);
//                console.log("switch = Flat");
                break;
            case "Rolling":
                cutTimesArray = JSON.parse(JSONobj.cutTimesRolling);
//                console.log("switch = Rolling");
                break;
            case "Hilly":
                cutTimesArray = JSON.parse(JSONobj.cutTimesHilly);
//                console.log("switch = Hilly");
                break;
            case "Mountainous":
                cutTimesArray = JSON.parse(JSONobj.cutTimesMountainous);
//                console.log("switch = Mountainous");
                break;
            default:
                cutTimesArray = JSON.parse(JSONobj.cutTimesFlat);
//                console.log("switch = Default");
                break;
        }
//        console.log("cutTimesArray:", cutTimesArray);
    }
    let watchElapsedMinutes = watchingRider.state.time / 60;
    let watchEventDistance = watchingRider.state.eventDistance;
    event.totalAscent = route.ascentInMeters * event.calcLaps;
    if (watchingRider.remaining == null) {
        state.watchRemainingDistance = event.totalDistance - watchingRider.state.eventDistance;
    } else {
        state.watchRemainingDistance = watchingRider.remaining;
    }
//    console.log("watchRemainingDistance :", state.watchRemainingDistance);
    if (state.remainingType == "route" ){
//        state.watchPercentDistance = watchEventDistance / (route.distanceInMeters + route.leadinDistanceInMeters);
        state.watchPercentDistance = watchingRider.state.routeProgress / 100;
    } else {
        state.watchPercentDistance = watchEventDistance / event.totalDistance;
    }
    state.watchPercentAscent = watchRiderAscent / event.totalAscent;
    document.getElementsByName("watchAvgSpeed")[0].innerHTML = parseFloat(watchAvgSpeed).toFixed(2);

    if (state.remainingMetric == "distance") {
        document.getElementById("watchFinishTimeKey").innerHTML = elementTitles.watchFinishTimeKey;
        if (state.remainingType == "route") {
            console.log("elapsedTime :", watchingRider.lap.elapsedTime, " - activeTime :", watchingRider.lap.activeTime, " - currentPosition :", watchingRider.segmentData.currentPosition);
        }
    } else if (state.remainingMetric == null && event.totalDistance > 0) {
        document.getElementById("watchFinishTimeKey").innerHTML = elementTitles.watchFinishTimeKey;
        if (state.remainingType == "route") {
            console.log("elapsedTime :", watchingRider.lap.elapsedTime, " - activeTime :", watchingRider.lap.activeTime, " - currentPosition :", watchingRider.segmentData.currentPosition);
        }
    } else if (state.remainingMetric == "time") {
        state.watchRemainingTime = BMcommon.minsToHHMMSS(watchingRider.remaining / 60);
        state.watchRemainingDistance = (watchAvgSpeed / 60) * (watchingRider.remaining / 60);
//        console.log("watchRemainingTime :", watchingRider.remaining, " - watchRemainingDistance :", state.watchRemainingDistance);
        document.getElementById("watchFinishTimeKey").innerHTML = "Estimated Finish Dist:";
        document.getElementsByName("watchRemainingMMSS")[0].innerHTML = state.watchRemainingTime;
        document.getElementsByName("watchRemainingMMSS")[0].style.color = "White";
        document.getElementsByName("watchRemainingMMSS")[0].style.fontWeight = "Normal";
        document.getElementsByName("watchEstimatedFinishTime")[0].innerHTML = ((watchingRider.state.distance / 1000) + state.watchRemainingDistance).toFixed(2);
        document.getElementsByName("watchEstimatedFinishTime")[0].style.color = "White";
        document.getElementsByName("watchEstimatedFinishTime")[0].style.fontWeight = "Normal";
        clearFirstRider(true);
        return;
    } else {
        document.getElementsByName("watchRemainingMMSS")[0].innerHTML = "Unknown";
        document.getElementsByName("watchRemainingMMSS")[0].style.color = "White";
        document.getElementsByName("watchRemainingMMSS")[0].style.fontWeight = "Normal";
        document.getElementsByName("watchEstimatedFinishTime")[0].innerHTML = "Unknown";
        document.getElementsByName("watchEstimatedFinishTime")[0].style.color = "White";
        document.getElementsByName("watchEstimatedFinishTime")[0].style.fontWeight = "Normal";
        clearFirstRider(true);
        return;
    }

    let watchMinutesRemaining = ((state.watchRemainingDistance/1000)/watchAvgSpeed) * 60;
    var watchRemainingMMSS = BMcommon.minsToHHMMSS(watchMinutesRemaining);
    watchEstimatedMinutesAtFinish = watchElapsedMinutes + watchMinutesRemaining;
    var watchEstimatedFinishTime = BMcommon.minsToHHMMSS(watchEstimatedMinutesAtFinish);

//    console.log("watchRemainingMMSS :", watchRemainingMMSS, " - watchEstimatedFinishTime :", watchEstimatedFinishTime);
    document.getElementsByName("watchRemainingMMSS")[0].innerHTML = watchRemainingMMSS;
    document.getElementsByName("watchEstimatedFinishTime")[0].innerHTML = watchEstimatedFinishTime;

    var targetTime= document.getElementsByName("watchTargetHHMMSS")[0].value;
//    if (targetTime == null) {
    if (!BMcommon.timeValidation(targetTime)) {
            var targetMinutes = targetTime;
            document.getElementsByName("watchTargetHHMMSS")[0].style.color = "Red";
            document.getElementsByName("watchEstimatedFinishTime")[0].style.color = "White";
            document.getElementsByName("watchEstimatedFinishTime")[0].style.fontWeight = "Normal";
    } else {
        document.getElementsByName("watchTargetHHMMSS")[0].style.color = "Black";
        common.settingsStore.set('targetTimeValue',targetTime);
        common.settingsStore.set('targetTimeGroup',watchRiderSubgroupId);
        var targetMinutes = BMcommon.hhmmssToMinutes(targetTime);
        if (targetMinutes < watchEstimatedMinutesAtFinish) {
            document.getElementsByName("watchEstimatedFinishTime")[0].style.color = "Red";
            document.getElementsByName("watchEstimatedFinishTime")[0].style.fontWeight = "bold";
        } else {
            document.getElementsByName("watchEstimatedFinishTime")[0].style.color = "Lime";
            document.getElementsByName("watchEstimatedFinishTime")[0].style.fontWeight = "bold";
        }
    }
//    console.log("watchRemainingDistance =", state.watchRemainingDistance);
    if (state.watchRemainingDistance < 100) {
        state.firstUpdatingCut = false;
    } else {
        state.firstUpdatingCut = true;
    }
//    console.log("state.firstUpdatingCut =", state.firstUpdatingCut);
//    console.log("state.firstUpdatingData =", state.firstUpdatingData);
    // The following command finds the first rider, in the Event, but ignores the Category the watched rider is in
    if (state.firstLowestPosition == 1 && state.maxSubGroups <= 1){
        firstRider = nearby.filter(n => n.eventPosition==1)[0];
        clearFirstRider(false);
    } else if (state.firstLowestPosition == 1 && state.maxSubGroups > 1){
        firstRider = nearby.filter(n => n.eventPosition==1 && n.state.eventSubgroupId==watchRiderSubgroupId)[0];
        clearFirstRider(false);
    } else if (watchRiderSubgroupId > 0) {
        // Assume the following will find the highest positioned rider in the same subgroup (IE Same Category as the watched rider)
        firstRider = nearby.filter(n => n.state.eventSubgroupId==watchRiderSubgroupId)[0];
        state.firstUpdatingData = true;
//        console.log("firstRider =", firstRider);
        clearFirstRider(false);
    } else {
        // Default to null - IE No firstRider
        firstRider = null;
        state.firstUpdatingData = false;
        clearFirstRider(true);
    }
    if (firstRider != null) {
        state.firstLastSeen = Date.now();
        // Makesure firstRider fields are default colour
        if (firstRider.remaining == null) {
            state.firstRemainingDistance = event.totalDistance - firstRider.state.eventDistance;
        } else {
            state.firstRemainingDistance = firstRider.remaining;
        }
    } else {
        if ( state.firstLastSeen < (Date.now() - firstRiderTimeout)) {
            //Change colour of firstRider fields
            if (debug) console.log("firstLastSeen =", state.firstLastSeen);
}
    }

    if (firstRider != null && state.firstRemainingDistance < 100) {
        state.firstUpdatingData = false;
    } else if (firstRider != null) {
        state.firstUpdatingData = true;
        clearFirstRider(false);
    }

    // Do we need to update the "First" rider?
    if (state.firstUpdatingData ) {
//        console.log("state.firstUpdatingData =", state.firstUpdatingData);
        if (state.firstUpdatingData ) {
            firstEstimatedMinutesAtFinish = state.firstEstimatedMinutesAtFinish;
            if (firstRider == null || firstRider.state.eventSubgroupId==0) {
                if (state.firstUpdatingCut == false || firstRider == null) {clearFirstRider(true);}
                if (state.firstEventPosition == 0) {
                    clearCutTime();
                } else {
                    updateCutTimeDisplay();
                }
                return;
            }
            if (debug) console.log("firstRider:", firstRider);
            updateFirstDisplay();

            var firstEventSubgroupId = firstRider.state.eventSubgroupId;
            state.firstEventPosition = firstRider.eventPosition;
//            console.log("firstEventPosition = ",firstRider.eventPosition);
            if (firstRider.eventPosition == null) {
                state.firstLowestPosition = 9999;
                state.firstEventPosition = 9999;
//                console.log("state.firstLowestPosition = ",state.firstLowestPosition);
            }
            if (state.firstLowestPosition > state.firstEventPosition){
                state.firstLowestPosition = state.firstEventPosition;
                if (debug) console.log("state.firstEventPosition =", state.firstEventPosition);
                if (debug) console.log("state.firstLowestPosition =", state.firstLowestPosition);
            }

            if (state.firstEventPosition == state.firstLowestPosition) {
                if (!state.hideFirst) document.getElementById("firstRider").style.visibility = 'visible';
                document.getElementById("firstToWatched").style.visibility = 'visible';
                var firstRiderName = firstRider.athlete.sanitizedFullname;
                document.getElementsByName("firstRiderName")[0].innerHTML = firstRiderName;
                state.firstAvgSpeed = firstRider.stats.speed.avg;
                document.getElementsByName("firstAvgSpeed")[0].innerHTML = parseFloat(state.firstAvgSpeed).toFixed(2);
                firstElapsedMinutes = firstRider.state.time / 60;
                firstEventDistance = firstRider.state.eventDistance;
            }
            if (firstRider.remaining == null) {
                state.firstRemainingDistance = event.totalDistance - firstRider.state.eventDistance;
            } else {
                state.firstRemainingDistance = firstRider.remaining;
            }
//                state.firstRemainingDistance = firstRider.remaining;
//            console.log("firstRemainingDistance =", state.firstRemainingDistance);
        }
    }

    if (state.firstAvgSpeed > 0) {
        firstMinutesRemaining = ((state.firstRemainingDistance/1000)/state.firstAvgSpeed) * 60;
        firstRemainingMMSS = BMcommon.minsToHHMMSS(firstMinutesRemaining);
        firstEstimatedMinutesAtFinish = firstElapsedMinutes + firstMinutesRemaining;
    } else {
        firstMinutesRemaining = 0;
        firstEstimatedMinutesAtFinish = '';
    }
    if (state.firstUpdatingCut){
        state.firstEstimatedMinutesAtFinish = firstEstimatedMinutesAtFinish;
    }
    var firstEstimatedFinishTime = BMcommon.minsToHHMMSS(state.firstEstimatedMinutesAtFinish);
    document.getElementsByName("firstRemainingMMSS")[0].innerHTML = firstRemainingMMSS;
    document.getElementsByName("firstEstimatedFinishTime")[0].innerHTML = firstEstimatedFinishTime;

    if (state.firstUpdatingCut) {updateCutTimeDisplay();}
    var prevWatchEventDistance = watchEventDistance;

    // --- Calories Calculation ---
    let avgWatts = watchingRider.stats.power && watchingRider.stats.power.avg ? watchingRider.stats.power.avg : null;
    let elapsedSeconds = watchingRider.state.time;
    let estimatedCalories = null;
    const caloriesElem = document.getElementsByName("watchCalories")[0];
    if (showEstimatedCalories) {
        if (avgWatts && elapsedSeconds) {
            estimatedCalories = calculateCalories(avgWatts, elapsedSeconds);
            caloriesElem.textContent = estimatedCalories + ' kcal';
        } else {
            caloriesElem.textContent = 'N/A';
        }
        caloriesElem.parentElement.style.display = '';
    } else {
        caloriesElem.parentElement.style.display = 'none';
    }
}
