import * as common from '/pages/src/common.mjs';
// import * as JSONobj from './BM/dataLookup.mjs';
import * as BMcommon from './BM/common.mjs';

let debug = false;
if (window.isElectron) {
    debug = false;
} else {
    debug = true;
}
console.log("debug:", debug);

let lastRefreshDate = Date.now() - 99999;
let routeRefreshInterval = 120000;
let eventRefreshInterval = 180000;
let watchingRider  = [];
let activeEvent = null;
let watchRiderName = null;
let unique = null;
let countOfEventSubgroup = 0;
let watchAvgSpeed = 0;
let watchRiderCategory = null;

const doc = document.documentElement;
const page = location.pathname;

var date = new Date();
console.log("date:", date);

const state = {
    routeID: 0,
    watchId: 0,
    watchRemainingDistance: 0,
    watchDistance: 0,
    watchPercentDistance: 0,
    watchPercentAscent: 0,
    maxSubGroups: 1,
    remainingType : '',
    remainingMetric : '',
    eventSubgroupId: 0
};

const route = {
    refreshDate: Date.now() - routeRefreshInterval,
    routeID: 0,
    name: '',
    terrain: '',
    ascentInMeters: 0,
    distanceInMeters: 0,
    leadinDistanceInMeters: 0
};

const event = {
    refreshDate: Date.now() - (eventRefreshInterval - 2000),
    totalDistance: 0,
    calcLaps: 0,
    totalAscent: 0
};

const getAthleteCategory = (athlete) => {
    const sgid = athlete.state.eventSubgroupId;
    if (sgid) {
        const sg = BMcommon.lazyGetSubgroup(sgid);
        if (sg) {
            return sg.subgroupLabel;
        }
    }
    return '';
}

common.settingsStore.setDefault({
    fontScale: 1,
    solidBackground: false,
    backgroundColor: '#00ff00',
    includeDistance: true,
    includeAvgSpeed: true,
    includeFinishMinutes: true,
    includeCurrentSpeed: true
});

async function updateRouteInfo(){
    lastRefreshDate = Date.now();
    let routeDateDiff = lastRefreshDate - route.refreshDate;
    if (routeDateDiff > routeRefreshInterval){
        const routeLookup = await common.rpc.getRoute(watchingRider.state.routeId);
        if (routeLookup == null) {
            console.log("No routeLookup found");
            let segments = watchingRider.segmentData.routeSegments;
            let lastSegment = segments[segments.length - 1];
    console.log("lastSegment = ", lastSegment);
            route.distanceInMeters = lastSegment.markLine;
            route.leadinDistanceInMeters = 0;
            if (event.totalDistance == null) event.totalDistance = route.distanceInMeters;
        } else {
            console.log("routeLookup found");
            console.log("routeLookup :", routeLookup);
            state.routeId = watchingRider.state.routeId;
            route.routeID = state.routeId;
            route.name = routeLookup.name;
            route.ascentInMeters = routeLookup.ascentInMeters;
            route.distanceInMeters = routeLookup.distanceInMeters;
            route.leadinDistanceInMeters = routeLookup.leadinDistanceInMeters;
        }
        route.refreshDate = lastRefreshDate;
    }
}

async function updateEventInfo(){
//    console.log("Start updateEventInfo");
    lastRefreshDate = Date.now();
    //    console.log("lastRefreshDate :", lastRefreshDate);
    let eventDateDiff = lastRefreshDate - event.refreshDate;
    if (eventDateDiff > eventRefreshInterval){
        event.refreshDate = lastRefreshDate;
        console.log("watchRiderSubgroupId :", state.eventSubgroupId);
        activeEvent = BMcommon.lazyGetSubgroup(state.eventSubgroupId);
//        let activeEvent = await common.rpc.getEventSubgroup(state.eventSubgroupId);
        console.log("activeEvent :", activeEvent);
        if (activeEvent === undefined) {
            if (event.totalDistance == 0) event.totalDistance = route.distanceInMeters;
        } else {
            console.log("Update updateEventInfo");
            if (state.remainingType == "event") {
                event.totalDistance = activeEvent.routeDistance;
                event.totalAscent = activeEvent.routeClimbing;
                event.laps = activeEvent.laps;
            } else if (state.remainingType == "route") {
                event.laps = watchingRider.lapCount;
            }
        }
    }
}

export async function main() {
    console.log("Sauce Version:", await common.rpc.getVersion());
    common.initInteractionListeners();

//    window.addEventListener('resize',resize);
    common.settingsStore.addEventListener('changed', async ev => {

        const changed = ev.data.changed;
        console.log("changed:", changed);
    
        if (changed.has('solidBackground') || changed.has('backgroundColor')) {
            setBackground();
        }
        if (window.isElectron && changed.has('overlayMode')) {
            await common.rpc.updateWindow(window.electron.context.id,
                {overlay: changed.get('overlayMode')});
            await common.rpc.reopenWindow(window.electron.context.id);
        }
        render();
    })

    common.subscribe('nearby', onNearbyInfo);
    render();
}

function render() {
    console.log("Start render");
    doc.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
}

function onNearbyInfo(info) {
    unique = [...new Set(info.map(item => item.state.eventSubgroupId))];
console.log("unique :", unique);
    countOfEventSubgroup = unique.length;
console.log("countOfEventSubgroup :", countOfEventSubgroup);
    if (state.maxSubGroups < countOfEventSubgroup) {state.maxSubGroups = countOfEventSubgroup};

    handleNearbyInfo(info);
    if (countOfEventSubgroup > 1) updateOtherCatInfo(info,unique);
    updateEventInfo();
    if (debug) {
        console.log("state :", state);
        console.log("route :", route);
        console.log("event :", event);
        console.log("activeEvent :", activeEvent);
    }
}

function handleNearbyInfo(info) {
//    console.log("Info:", info);
    updateWatchRiderInfo(info);

}

async function updateOtherCatInfo(nearby,categories) {
    console.log("Start updateOtherCatInfo");
//console.log("nearby :", nearby);
console.log("categories :", categories);

//For each sub category do...
    for (const element of categories) {
        console.log("element :", element);
        // find rider in category
        let firstRiderInCat = nearby.filter(n => n.state.eventSubgroupId==element)[0];
        console.log("firstRiderInCat :", firstRiderInCat);
        console.log("firstRiderInCatId :", firstRiderInCat.athleteId);
        let firstRiderInCatCategory = getAthleteCategory(firstRiderInCat);
        if (debug) console.log("firstRiderInCatCategory :", firstRiderInCatCategory);
        let catDistance = firstRiderInCat.state.distance;
        console.log("catDistance :", catDistance);
        console.log("watchDistance :", state.watchDistance);
        let gapToCategory = state.watchDistance - catDistance;
        if (debug) console.log("gapToCategory :", gapToCategory);
    }
//    watchingRider = nearby.filter(n => n.watching)[0];
    
//    if (watchingRider == null) return;
    
//    console.log("watchingRider:", watchingRider);
}

async function updateWatchRiderInfo(nearby) {
//    console.log("Start updateRiderInfo");
//console.log("nearby :", nearby);
    watchingRider = nearby.filter(n => n.watching)[0];
            
    if (watchingRider == null) return;
            
    console.log("watchingRider:", watchingRider);
                    
    watchRiderCategory = getAthleteCategory(watchingRider);
    console.log("watchRiderCategory :", watchRiderCategory);
    
    if (state.watchId != watchingRider.athleteId) {
        route.refreshDate = Date.now() - routeRefreshInterval;
        event.refreshDate = Date.now() - eventRefreshInterval;
    }
    state.watchId = watchingRider.athleteId;
    state.eventSubgroupId = watchingRider.state.eventSubgroupId;
    watchRiderName = watchingRider.athlete.sanitizedFullname;
    state.watchDistance = watchingRider.state.distance;
    state.remainingType = watchingRider.remainingType;
    state.remainingMetric = watchingRider.remainingMetric;
//    console.log("remainingType :", state.remainingType, " - remainingMetric :", state.remainingMetric);
    if (watchAvgSpeed == null) {
//        document.getElementsByName("watchAvgSpeed")[0].innerHTML = "Not moving";
        updateRouteInfo();
        updateEventInfo();
        return;
    }

    // Check if the routeID has changed - If so update route details and Terraindata
    if (watchingRider.state.routeId != state.routeId || event.calcLaps < 0) {
        updateRouteInfo();
    }
    let watchElapsedMinutes = watchingRider.state.time / 60;
    let watchEventDistance = watchingRider.state.eventDistance;
    event.totalAscent = route.ascentInMeters * event.calcLaps;
    let watchMinutesRemaining = ((state.watchRemainingDistance/1000)/watchAvgSpeed) * 60;
    var watchRemainingMMSS = BMcommon.minsToHHMMSS(watchMinutesRemaining);
}