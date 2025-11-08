import * as common from '/pages/src/common.mjs';
import * as JSONobj from './BM/dataLookup.mjs';
import * as JSONnotes from './BM/notesLookup.mjs';
import * as BMcommon from './BM/common.mjs';

let debug = false;
if (window.isElectron) {
    debug = false;
} else {
    debug = true;
}
console.log("debug:", debug);

//let zraRouteArray = JSON.parse(JSONobj.jsonTerrain);
let komArray = JSON.parse(JSONobj.jsonZwiftSegments);
let customSegmentsArray = JSON.parse(JSONobj.jsonCustomRouteSegments);
let otherClimbsArray = JSON.parse(JSONobj.jsonOtherClimbs);
let notesArray = JSON.parse(JSONnotes.jsonNotes);
//if (debug) console.log("notesArray:", notesArray);

let showHR = common.settingsStore.get('showHR');
let showWKG = common.settingsStore.get('showWKG');
let showWatts = common.settingsStore.get('showWatts');
let showWBal = common.settingsStore.get('showWBal');
let showDraftCurrent = common.settingsStore.get('showDraftCurrent');
if (showDraftCurrent === undefined) showDraftCurrent = true;
let showDraftAverage = common.settingsStore.get('showDraftAverage');
if (showDraftAverage === undefined) showDraftAverage = true;
let showWattsCurrent = common.settingsStore.get('showWattsCurrent');
if (showWattsCurrent === undefined) showWattsCurrent = true;
let showWattsAverage = common.settingsStore.get('showWattsAverage');
if (showWattsAverage === undefined) showWattsAverage = true;

let riderRefreshRate = common.settingsStore.get('riderRefreshRate') * 1000;
let forceSegmentUpdate=false;
let lastRefreshDate = Date.now() - 99999;
let routeRefreshInterval = 120000;
let eventRefreshInterval = 180000;
let watchingRider  = [];
let field  = [];
//let markedRiders = [];
let activeEvent = null;
let watchRiderName = null;
let unique = null;
let countOfEventSubgroup = 0;
let watchAvgSpeed = 0;
let watchRiderCategory = null;
let externalDataMaxRetries = 5;

//const storageKey_OverviewDataSegments = 'overview-data-segments';
const doc = document.documentElement;
const page = location.pathname;

const defaultOverviewDataSegments = {
    routeSegments: null,
    previousSegmentIdx: -1,
    activeSegmentIdx: -1,
    nextSegmentIdx: -1
};

const segmentData = {
    refreshDate: Date.now() - 210000,
    riderRefreshDate: Date.now(),
    eventSubgroupId: 0,
    event: {
        eventSubgroupId: 0,
        activeEvent: null,
        distance: 0,
        laps: 1,
        customEvent: true,
        elapsedTime: 0
    },
    segments: defaultOverviewDataSegments,
    route: {
        id: null,
        distance: 0,
        time: null
    }
}

var date = new Date();
//console.log("date:", date);

const segment = {
    nextSegmentName: ''
};

const state = {
    gameConnectionCheck: 5,
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
    leadinDistanceInMeters: 0,
    externalDataRetries: 0,
    externalData: false
};

const event = {
    refreshDate: Date.now() - (eventRefreshInterval - 2000),
    laps: 1,
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
    field1: 'showHR',
    field2: 'showWKG',
    field3: 'showDraft',
    field4: 'showWBal',
    field5: 'showPosition',
    field6: 'showEFT',
    field7: 'showRemaining',
    field8: 'showSpeed',
    field9: 'showCadence',
    field10: 'showRouteName',
    field11: 'showEventType',
    showHR: true,
    showWKG: true,
    showWatts: true,
    showDraft: true,
    showDraftKey: true,
    showDraftCurrent: true,
    showDraftAverage: true,
    showWattsCurrent: true,
    showWattsAverage: true,
    showWBal: true,
    showPosition: true,
    showEFT: true,
    showRemaining: true,
    percentCalculation: "Remaining",
    showSpeed: true,
    showCadence: true,
    showRouteName: true,
    showEventType: true
});

async function externalRouteLookup(routeNumber){
    let url = "https://www.brianmudge.com/php/ro/routeData.php?routeNumber=" + routeNumber;
    if (debug) console.log("url :", url);
    const resp = await fetch(url);
    if (debug) console.log("resp :", resp);
    const responseData = resp.json();
    return responseData;

}

async function updateRouteInfo(){
    lastRefreshDate = Date.now();
    let routeDateDiff = lastRefreshDate - route.refreshDate;
    if (routeDateDiff > routeRefreshInterval){
        console.log("routeDateDiff :", routeDateDiff);
        const routeLookup = await common.rpc.getRoute(watchingRider.state.routeId);
        if (routeLookup == null) {
            console.log("No routeLookup found");
            if (!route.externalData && watchingRider.state.routeId != null && watchingRider.state.routeId != 0 && route.externalDataRetries < externalDataMaxRetries) {
                route.externalDataRetries ++;
//                console.log("externalDataRetries :", route.externalDataRetries);
                route.refreshDate = lastRefreshDate - (routeRefreshInterval - 20000);
                const routeLookup = await externalRouteLookup(watchingRider.state.routeId);
                console.log("routeLookup (Ext) :", routeLookup);
                route.routeID = routeLookup.zpRT;
                route.name = routeLookup.zpRouteName;
                routeLookup.name = routeLookup.zpRouteName;
                route.ascentInMeters = routeLookup.elevation;
                route.distanceInMeters = routeLookup.distance * 1000;
                route.leadinDistanceInMeters = routeLookup.leadIn * 1000;
                event.totalDistance = route.distanceInMeters + route.leadinDistanceInMeters;
                event.totalAscent = route.ascentInMeters;
                route.externalData = true;
                if (field.includes("showRouteName") && showRouteName) document.getElementById("routeName").innerHTML = route.name;
                if (routeLookup.name != route.name) {
                    route.name = routeLookup.name;
                    segmentData.routeName = route.name;
                    route.world = routeLookup.worldId;
                    forceSegmentUpdate=true;
                }
            } else {
                let segments = watchingRider.segmentData.routeSegments;
                let lastSegment = segments[segments.length - 1];
//    console.log("lastSegment = ", lastSegment);
                route.distanceInMeters = lastSegment.markLine;
                route.leadinDistanceInMeters = 0;
                if (event.totalDistance == null) event.totalDistance = route.distanceInMeters;
                route.refreshDate = lastRefreshDate;
            }
        } else {
            console.log("routeLookup found");
//            console.log("routeLookup :", routeLookup);
            state.routeId = watchingRider.state.routeId;
            route.routeID = state.routeId;
            segmentData.route.id = watchingRider.state.routeId;
            if (field.includes("showRouteName") && showRouteName) document.getElementById("routeName").innerHTML = routeLookup.name;
            if (routeLookup.name != route.name) {
                route.name = routeLookup.name;
                segmentData.routeName = route.name;
                route.world = routeLookup.worldId;
                forceSegmentUpdate=true;
                route.externalData = false;
                if (activeEvent !== undefined && activeEvent.distanceInMeters > event.totalDistance) {
                    event.totalDistance = activeEvent.distanceInMeters;
                }
            }
            route.ascentInMeters = routeLookup.ascentInMeters;
            route.distanceInMeters = routeLookup.distanceInMeters;
            route.leadinDistanceInMeters = routeLookup.leadinDistanceInMeters;
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
        event.refreshDate = lastRefreshDate;
        console.log("watchRiderSubgroupId :", state.eventSubgroupId);
        activeEvent = BMcommon.lazyGetSubgroup(state.eventSubgroupId);
//        let activeEvent = await common.rpc.getEventSubgroup(state.eventSubgroupId);
        if (debug) console.log("activeEvent :", activeEvent);
        if (activeEvent === undefined) {
            if (event.totalDistance == 0) event.totalDistance = route.distanceInMeters;
        } else {
            if (debug) console.log("Update updateEventInfo");
            if (debug) console.log("remainingMetric :", state.remainingMetric);
            forceSegmentUpdate=true;
            if (route.externalData) activeEvent.routeDistance = (routeLookup.distance * 1000) + (routeLookup.leadIn * 1000);

            if (state.remainingType == "event" && state.remainingMetric != 'distance') {
                event.totalDistance =  activeEvent.routeDistance;
                event.totalAscent = activeEvent.routeClimbing;
                if (state.remainingMetric == "time") {
                    event.laps = 1;
                } else {
                    event.laps = activeEvent.laps;
                }
            } else if ( state.remainingMetric == "distance") {
                if (debug) console.log("Update based on 'distance'");
                if (activeEvent.distanceInMeters > event.totalDistance) {
                    if (debug) console.log("Update based on 'distance'");
                    event.totalDistance = activeEvent.distanceInMeters;

                    if (route.distanceInMeters > 0) {
                        let numberOfLaps = (event.totalDistance - route.leadinDistanceInMeters) / route.distanceInMeters;
                        if (debug) console.log("numberOfLaps :", numberOfLaps);
                        event.calcLaps = numberOfLaps;
                    }
                }
            } else if (state.remainingType == "route") {
                event.laps = watchingRider.lapCount;
            }
        }
    }
}

export async function main() {
    console.log("Sauce Version:", await common.rpc.getVersion());
    common.initInteractionListeners();
    common.settingsStore.addEventListener('changed', render);
//    document.querySelector('#ridersList').addEventListener('click', clickNearbyRider);

//    window.addEventListener('resize',resize);
    common.subscribe('athlete/watching', updateMetrics);
    common.settingsStore.addEventListener('changed', async ev => {
        const changed = ev.data.changed;
//        console.log("changed:", changed);
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

    showDraftCurrent = common.settingsStore.get('showDraftCurrent');
    if (showDraftCurrent === undefined) showDraftCurrent = true;
    showDraftAverage = common.settingsStore.get('showDraftAverage');
    if (showDraftAverage === undefined) showDraftAverage = true;
    if (debug) console.log("showDraftAverage:", showDraftAverage);

    field[1] = common.settingsStore.get('field1');
    field[2] = common.settingsStore.get('field2');
    field[3] = common.settingsStore.get('field3');
    field[4] = common.settingsStore.get('field4');
    field[5] = common.settingsStore.get('field5');
    field[6] = common.settingsStore.get('field6');
    field[7] = common.settingsStore.get('field7');
    field[8] = common.settingsStore.get('field8');
    field[9] = common.settingsStore.get('field9');
    field[10] = common.settingsStore.get('field10');
    field[11] = common.settingsStore.get('field11');
    let totalFields = field.length;
//    if (debug) console.log("totalFields:", totalFields);
    let tableInner = "<table>";
    for (var i = 1; i < totalFields; i++) {
        if (debug) console.log(field[i]);
        switch(field[i]) {
            case "showHR":
                tableInner = tableInner + "<tr id='showHR' style='font-weight: bold;'><td style='text-align: center;padding-right: 20px;' title='Heart'>&#128147;</td><td style='padding-right: 20px;' id='watchedHeart'>bpm</td></tr>";
                break;
            case "showWKG":
                tableInner = tableInner + "<tr id='showWKG' style='font-weight: bold;'><td style='text-align: center;padding-right: 20px;' title='WKG'>&#9889;</td><td style='padding-right: 20px;' id='watchedAvgPower'>(5) / (20)</td></tr>";
                break;
            case "showWatts":
                tableInner = tableInner + "<tr id='showWatts' style='font-weight: bold;'><td style='text-align: center;padding-right: 20px;' title='Watts'>&#x23fb;</td><td style='padding-right: 20px;' id='watchedAvgWatts'></td></tr>";
                break;
            case "showDraft":
                tableInner = tableInner + "<tr id='showDraft' style='font-weight: bold;'><td style='text-align: center;padding-right: 20px;' title='Draft'>&#128692;</td><td style='padding-right: 20px;' id='watchedDraft'></td></tr>";
                break;
            case "showWBal":
                tableInner = tableInner + "<tr id='showWBal' style='font-weight: bold;'><td style='text-align: center;padding-right: 20px;' title='WBal'>&#128267;</td><td style='padding-right: 20px;' id='watchedBattery'></td></tr>";
                break;
            case "showPosition":
                tableInner = tableInner + "<tr id='showPosition' style='font-weight: bold;'><td style='text-align: center;padding-right: 20px;' title='Position'>&#127942;</td><td style='padding-right: 20px;' id='watchedPosition'></td></tr>";
                break;
            case "showEFT":
                tableInner = tableInner + "<tr id='showEFT' style='font-weight: bold;'><td style='text-align: center;padding-right: 20px;' title='EFT'>&#127937;</td><td style='padding-right: 20px;' id='watchedEFT'></td></tr>";
                break;
            case "showRemaining":
                tableInner = tableInner + "<tr id='showRemaining' style='font-weight: bold;'><td style='text-align: center;padding-right: 20px;' title='Distance Remaining'>&#128207;</td><td style='padding-right: 20px;' id='watchedDistanceRemaining'></td></tr>";
                break;
            case "showSpeed":
                tableInner = tableInner + "<tr id='showSpeed' style='font-weight: bold;'><td style='text-align: center;padding-right: 20px;' title='Speed'>&#128359;</td><td style='padding-right: 20px;' id='watchedSpeed'>kph</td></tr>";
                break;
            case "showCadence":
                tableInner = tableInner + "<tr id='showCadence' style='font-weight: bold;'><td style='text-align: center;padding-right: 20px;' title='Cadence'>&#8635;</td><td style='padding-right: 20px;' id='watchedCadence'>rpm</td></tr>";
                break;
            case "showRouteName":
                tableInner = tableInner + "<tr id='showRouteName' style='font-weight: bold;'><td style='text-align: center;padding-right: 20px;' title='Route Name'>&#9936;</td><td style='padding-right: 20px;' id='routeName'></td></tr>";
                break;
            case "showEventType":
                tableInner = tableInner + "<tr id='showEventType' style='font-weight: bold;'><td style='text-align: center;padding-right: 20px;' title='Event Type'>&#127919;</td><td style='padding-right: 20px;' id='watchedEventType'></td></tr>";
                break;
        }
    }
    tableInner = tableInner + " </table>";
    document.getElementById("watching").innerHTML = tableInner;

    showHR = common.settingsStore.get('showHR');
    if (showHR) {
        document.getElementById("showHR").style.display = "";
    } else {
        document.getElementById("showHR").style.display = "none";
    }
    showWKG = common.settingsStore.get('showWKG');
    if (showWKG) {
        document.getElementById("showWKG").style.display = "";
    } else {
        document.getElementById("showWKG").style.display = "none";
    }
    showWatts = common.settingsStore.get('showWatts');
    if (showWatts) {
        document.getElementById("showWatts").style.display = "";
    } else {
        document.getElementById("showWatts").style.display = "none";
    }
    let showDraft = common.settingsStore.get('showDraft');
    if (showDraft) {
        document.getElementById("showDraft").style.display = "";
    } else {
        document.getElementById("showDraft").style.display = "none";
    }
    let showWBal = common.settingsStore.get('showWBal');
    if (showWBal) {
        document.getElementById("showWBal").style.display = "";
    } else {
        document.getElementById("showWBal").style.display = "none";
    }
    let showPosition = common.settingsStore.get('showPosition');
    if (showPosition) {
        document.getElementById("showPosition").style.display = "";
    } else {
        document.getElementById("showPosition").style.display = "none";
    }
    let showEFT = common.settingsStore.get('showEFT');
    if (showEFT) {
        document.getElementById("showEFT").style.display = "";
    } else {
        document.getElementById("showEFT").style.display = "none";
    }
    let showRemaining = common.settingsStore.get('showRemaining');
    if (showRemaining) {
        document.getElementById("showRemaining").style.display = "";
    } else {
        document.getElementById("showRemaining").style.display = "none";
    }
    let showSpeed = common.settingsStore.get('showSpeed');
    if (showSpeed) {
        document.getElementById("showSpeed").style.display = "";
    } else {
        document.getElementById("showSpeed").style.display = "none";
    }
    let showCadence = common.settingsStore.get('showCadence');
    if (showCadence) {
        document.getElementById("showCadence").style.display = "";
    } else {
        document.getElementById("showCadence").style.display = "none";
    }
    let showRouteName = common.settingsStore.get('showRouteName');
    if (showRouteName) {
        document.getElementById("showRouteName").style.display = "";
    } else {
        document.getElementById("showRouteName").style.display = "none";
    }
    let showEventType = common.settingsStore.get('showEventType');
    if (showEventType) {
        document.getElementById("showEventType").style.display = "";
    } else {
        document.getElementById("showEventType").style.display = "none";
    }
    console.log("showDraft:", showDraft);
    riderRefreshRate = common.settingsStore.get('riderRefreshRate') * 1000;

}

let refresh;
function updateMetrics(info) {
//    if (debug) console.log("Start updateMetrics");
    refresh = false;
    
    let refreshDelta = Date.now() - segmentData.refreshDate;
//    if (debug) console.log("refreshDelta :", refreshDelta);
    if (info.segmentData !== undefined) {
        if ((Date.now() - segmentData.loadRefreshDate) >= 100000 || forceSegmentUpdate) {
            loadSegments(info.segmentData.routeSegments);
            segmentData.loadRefreshDate = Date.now();
        }
    }
    if ((Date.now() - segmentData.refreshDate) >= 10000) {
        refresh = true;
    }

    if (refresh || forceSegmentUpdate) {
        forceSegmentUpdate=false;
        segmentData.refreshDate = Date.now();
//        segmentData.segments.routeSegments = null;
//        segmentData.eventSubgroupId = getEventSubgroupId(info);
        segmentData.eventSubgroupId = state.eventSubgroupId;

        updateRouteInfo();
//        updateEventInfo();
//        loadSegments(info.segmentData.routeSegments);
//        displaySegmentData(segmentData);
//        setNearbySegments(info);
    }

//    if (showSegmentInfo) loadSegmentInfo(info);
}

function loadSegments(routeSegments) {
//    console.log("run loadSegments");
    segmentData.segments.routeSegments = [];
    let newSegment;
    let newSegmentIdx = 0;
    let eventLaps = 1;

//
// Process customSegments
//
    if (route.name != "" && activeEvent !== undefined) {
//        console.log("customSegmentsArray:", customSegmentsArray);
        let customSegmentsData = customSegmentsArray.filter(n => n.Route==route.name.toLowerCase());
//        console.log("customSegmentsData:", customSegmentsData);
        if (activeEvent == null && state.remainingMetric != "distance") {
            eventLaps = 1;
        } else if (state.remainingMetric == "distance") {
            //numberOfLaps = Math.ceil(numberOfLaps);
            //numberOfLaps = Math.floor(numberOfLaps);
            if (activeEvent == null) {
            } else if (activeEvent.laps > 0) {
                eventLaps = activeEvent.laps;
            } else {
                eventLaps = Math.ceil(event.calcLaps);
            }
        } else {
            eventLaps = activeEvent.laps;
        }
        if (eventLaps == 0) eventLaps = 1;
        if (debug) console.log("eventLaps:", eventLaps);
        let routeDistance = route.distanceInMeters;
//    console.log("routeDistance:", routeDistance);
//    console.log("segmentData.routeName:", segmentData.routeName);
//    console.log("route.name:", route.name);
//    console.log("customSegmentsData:", customSegmentsData);
        if (customSegmentsData != null){
            let calcStart=0;
            if (activeEvent != null && activeEvent.routeDistance > event.totalDistance) event.totalDistance = activeEvent.routeDistance;
            for (let i=0; i<customSegmentsData.length; i++) {  // For each custome segment do
                const segment = customSegmentsData[i];
//                console.log("segment:", segment);
                let otherClimbData = otherClimbsArray.filter(n => n.Name==segment.Segment);
                let notesData = notesArray.filter(n => n.Name==segment.Segment.toLowerCase());
//                console.log("otherClimbData:", otherClimbData);
//                console.log("otherClimbData.Length:", otherClimbData[0].Length);
//                if (debug) console.log("otherClimb eventLaps:", eventLaps);
                for (let j=1; j<=eventLaps;j++){
//                    console.log("otherClimb Process lap '" + j + "'");
                    if (j==1) {
                        calcStart = BMcommon.kmStringToNumber(segment.Start);
                    } else if (state.remainingMetric == "distance") {
                        calcStart = BMcommon.kmStringToNumber(segment.Start) + (routeDistance * (j -1));
                        if (calcStart > event.totalDistance) { break; }
                    } else {
                        calcStart = BMcommon.kmStringToNumber(segment.Start) + (routeDistance * (j -1));
                    }
//                    console.log("otherClimb calcStart:", calcStart);
                    newSegment = {
                        idx: 0,
                        id: segment.id,
                        name: segment.Segment,
                        avgGrade: otherClimbData[0].avgGrade ?? "",
                        maxGrade: otherClimbData[0].maxGrade ?? "",
                        comments: notesData[0].comments ?? "",
                        start: calcStart,
                        end: calcStart + BMcommon.kmStringToNumber(otherClimbData[0].Length)
                    }
                    newSegment.idx = newSegmentIdx++;
                    segmentData.segments.routeSegments.push(newSegment);
//                    if (debug) console.log("newSegment:", newSegment);
                }
            }
        }
    }
    if (routeSegments == null || routeSegments.length == 0) {
        console.log("Test No Segments");
        let newSegment = {
            idx: 0,
            id: "Finish",
            name: "Finish Line",
            avgGrade: "",
            maxGrade: "",
            comments: "",
            start: event.totalDistance,
            end: event.totalDistance
        }
        if (debug) console.log("newSegment:", newSegment);
        segmentData.segments.routeSegments.push(newSegment);
        return segmentData.segments.routeSegments;
    }

//
// Process routeSegments
//
    for (let i=0; i<routeSegments.length; i++) {
        const segment = routeSegments[i];
        if (debug) console.log("segment :", segment);
        const isFinish = (segment.name.indexOf('Finish') > 0)
        if (isFinish) {
            continue;
        }
        let komName = "";
        if (segment.name == "KOM" || segment.name == "KOM Reverse") {
            komName = BMcommon.correctZwiftSegmentNames(route,segment.name);
            segment.displayName = komName;
        } else {
            komName = segment.name + " KOM";
        }
//        if (debug) console.log("komName :", komName);
//        if (debug) console.log("segment.name :", segment.name);
        let komData = komArray.filter(n => n.Name==segment.name.toLowerCase() || n.Name==komName.toLowerCase())[0];
        let notesData = notesArray.filter(n => n.Name==segment.name.toLowerCase() || n.Name==komName.toLowerCase())[0];
        let avgGrade = "";
        let maxGrade = "";
        let segNotes = "";
        if (komData != null) {
//            if (debug) console.log("komData :", komData);
            avgGrade = komData.avgGrade;
            maxGrade = komData.maxGrade;
            if (notesData != null) {
                segNotes = notesData.comments;
            } else {
                segNotes = komData.comments;
            }
        }
    
        newSegment = {
            idx: 0,
            id: segment.id,
            name: segment.displayName ?? segment.name,
            avgGrade: avgGrade ?? "",
            maxGrade: maxGrade ?? "",
            comments: segNotes ?? "",
            start: segment.markLine,
            end: getMatchingFinishSegmentEnd(i, segment, routeSegments)
        }
        if (debug) console.log("newSegment:", newSegment);
        
        if (newSegment.end - newSegment.start > 0) {
            newSegment.idx = newSegmentIdx++;
            segmentData.segments.routeSegments.push(newSegment);
        }
    }
    
    // Sort on "Start" & Reindex the idx numbers in segmentData.segments.routeSegments
    let maxSegmentDistance = 0;
    routeSegments = segmentData.segments.routeSegments.sort(function(a, b) {return a.start - b.start});
    for (let i=0; i<routeSegments.length; i++) {
        maxSegmentDistance = routeSegments[i].end;
        segmentData.segments.routeSegments[i].idx = i;
    }
    //console.log("segmentData.segments.routeSegments :", segmentData.segments.routeSegments);
    //console.log("maxSegmentDistance :", maxSegmentDistance);
    
    // Add Finish Line segment
    let nextIdx = segmentData.segments.routeSegments.length;
    let finishDistance = 0;
//    if (debug) console.log("event.totalDistance:", event.totalDistance);
//    if (debug) console.log("maxSegmentDistance:", maxSegmentDistance);
//    if (debug) console.log("nextIdx:", nextIdx);
    if (event.totalDistance > 0 && maxSegmentDistance < event.totalDistance || event.totalDistance > 0 && nextIdx == 0) {
        newSegment = {
            idx: nextIdx,
            id: "Finish",
            name: "Finish Line",
            avgGrade: "",
            maxGrade: "",
            comments: "",
            start: event.totalDistance,
            end: event.totalDistance
        }
        if (debug) console.log("newSegment:", newSegment);
        segmentData.segments.routeSegments.push(newSegment);
    }
}

function setNearbySegments(info) {
//    console.log("run setNearbySegments");
    if (!Object.hasOwn(info, 'segmentData')) {
        segmentData.segments.routeSegments = [];
        return;
    }

    if (segmentData.segments.routeSegments == null) {
        loadSegments(info.segmentData.routeSegments);
    }

    const xCoord = info.segmentData.currentPosition;
    const segments = segmentData.segments;

    segments.previousSegmentIdx = -1;
    segments.activeSegmentIdx = -1;
    segments.nextSegmentIdx = -1;

    if (segments.routeSegments == null || segments.routeSegments.length == 0) {
        return;
    }

    segments.activeSegmentIdx = segments.routeSegments.findIndex(s => xCoord >= s.start && xCoord <= s.end);
    if (segmentData.segments.activeSegmentIdx >= 0) {
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

function onNearbyInfo(info) {
    unique = [...new Set(info.map(item => item.state.eventSubgroupId))];
//if (debug) console.log("unique :", unique);
    countOfEventSubgroup = unique.length;
//if (debug) console.log("countOfEventSubgroup :", countOfEventSubgroup);
    if (state.maxSubGroups < countOfEventSubgroup) {state.maxSubGroups = countOfEventSubgroup};

    handleNearbyInfo(info);
    updateEventInfo();
    if (debug) {
        console.log("state :", state);
        console.log("route :", route);
//        console.log("event :", event);
//        console.log("activeEvent :", activeEvent);
//        console.log("segmentData : ", segmentData);
    }
}

function handleNearbyInfo(info) {
//    console.log("Info:", info);
    updateWatchRiderInfo(info);
}
    
function updateSegmentInfo(info) {
//    console.log("Info:", info);
    if (info.segmentData != null) {
        var allSegmentsData=info.segmentData;
        if (debug) console.log("allSegmentsData:", allSegmentsData);
        segment.nextSegmentName = allSegmentsData.nextSegment.name;
        if (debug) console.log("segment :", segment);
        var routeSegments = allSegmentsData.routeSegments;
        if (debug) console.log("routeSegments :", routeSegments);
    } else {
        console.log("No Segment Data");
        if (event.totalDistance > 0 && segmentData.segments.routeSegments == null) {
            let newSegment = {
                idx: 0,
                id: "Finish",
                name: "Finish Line",
                avgGrade: "",
                maxGrade: "",
                comments: "",
                start: event.totalDistance,
                end: event.totalDistance
            }
        if (debug) console.log("newSegment:", newSegment);
        if (segmentData.segments.routeSegments == null) segmentData.segments.routeSegments = newSegment;
//        segmentData.segments.routeSegments.push(newSegment);
        }
    }
}
        
async function updateWatchRiderInfo(nearby) {
//    console.log("Start updateRiderInfo");
    watchingRider = nearby.filter(n => n.watching)[0];
            
    if (watchingRider == null) return;
            
    if (debug) console.log("watchingRider:", watchingRider);
//    updateSegmentInfo(watchingRider);
                    
    if (state.watchId != watchingRider.athleteId) {
        route.refreshDate = Date.now() - routeRefreshInterval;
        event.refreshDate = Date.now() - eventRefreshInterval;
    }
    state.watchId = watchingRider.athleteId;
    state.eventSubgroupId = watchingRider.state.eventSubgroupId;
//    if (debug) console.log("state.eventSubgroupId:", state.eventSubgroupId);
    watchRiderName = watchingRider.athlete.sanitizedFullname;
    state.watchRiderTeam = watchingRider.athlete.team;
    state.watchDistance = watchingRider.state.distance;
    state.remainingType = watchingRider.remainingType;
    state.remainingMetric = watchingRider.remainingMetric;

    if (field.includes("showEventType") && showEventType) document.getElementById("watchedEventType").innerHTML = "" + BMcommon.getEventType(watchingRider) + "";
//    if (debug) console.log("getEventType:", BMcommon.getEventType(watchingRider));
    if (field.includes("showPosition") && showPosition) document.getElementById("watchedPosition").innerHTML = "" + BMcommon.getPositionHTML(watchingRider) + "";
    if (field.includes("showDraft") && showDraft) document.getElementById("watchedDraft").innerHTML = "" + BMcommon.getDraftHTML(watchingRider) + "";
    if (field.includes("showEFT") && showEFT) document.getElementById("watchedEFT").innerHTML = "" + BMcommon.getEFTHTML(watchingRider) + "";
    if (field.includes("showRemaining") && showRemaining) document.getElementById("watchedDistanceRemaining").innerHTML = "" + BMcommon.getRemainingHTML(watchingRider,route) + "";
    if (field.includes("showSpeed") && showSpeed) document.getElementById("watchedSpeed").innerHTML = "" + BMcommon.getSpeedHTML(watchingRider) + "";
    if (field.includes("showWBal") && showWBal) document.getElementById("watchedBattery").innerHTML = "" + BMcommon.getWBalHTML(watchingRider) + "";
    if (field.includes("showCadence") && showCadence) document.getElementById("watchedCadence").innerHTML = "" + BMcommon.getCadenceHTML(watchingRider) + "";
    if (field.includes("showHR") && showHR) document.getElementById("watchedHeart").innerHTML = "" + BMcommon.getHRHTML(watchingRider) + "";
    if (field.includes("showWKG") && showWKG) document.getElementById("watchedAvgPower").innerHTML = "" + BMcommon.get5minPowerHTML(watchingRider) + " / " + BMcommon.get20minPowerHTML(watchingRider) + "";
    if (field.includes("showWatts") && showWatts) document.getElementById("watchedAvgWatts").innerHTML = "" + BMcommon.getWattsHTML(watchingRider) + "";

    if (watchAvgSpeed == null) {
        updateRouteInfo();
        updateEventInfo();
        return;
    }

    // Check if the routeID has changed - If so update route details and Terraindata
    if (watchingRider.state.routeId != state.routeId || event.calcLaps < 0) {
        updateRouteInfo();
    }
//    let watchElapsedMinutes = watchingRider.state.time / 60;
//    let watchEventDistance = watchingRider.state.eventDistance;
    event.totalAscent = route.ascentInMeters * event.calcLaps;
//    let watchMinutesRemaining = ((state.watchRemainingDistance/1000)/watchAvgSpeed) * 60;
//    var watchRemainingMMSS = BMcommon.minsToHHMMSS(watchMinutesRemaining);
}

export function sortByStart( a, b ) {
    if ( a.start < b.start ){
        return -1;
    }
    if ( a.start > b.start){
        return 1;
    }
    return 0;
}

async function clickNearbyRider(ev) {
//    if (debug) console.log("clickNearbyRider ev :", ev);
//    if (debug) console.log("clickNearbyRider id :", ev.target.dataset.id);
    if (ev.target.dataset.id == null || ev.target.dataset.id == '') return;
    
    let gameConnStatus = await common.rpc.getGameConnectionStatus();
     console.log("gameConnStatus :", gameConnStatus);
    if (gameConnStatus === undefined) return;
    if (gameConnStatus.state == "waiting") return;
    
    if (gameConnStatus.connected) await common.rpc.watch(ev.target.dataset.id);
    
    //state.watchingId = ev.target.dataset.id;
}

async function gameConnectionStatus() {
//    console.log("Start gameConnectionStatus");
    let gameConnStatus = await common.rpc.getGameConnectionStatus();
    console.log("gameConnStatus :", gameConnStatus);
    if (gameConnStatus === undefined) {
        document.getElementById("dsGameConnStatus").innerHTML = "<img title='Game Connection - Disabled' src='./images/whiteConnect.png'>";
        state.gameConnectionCheck=0;
        state.gameConnectionLastCheck = Date.now();
        return;
    }
    if (gameConnStatus.state == "waiting") {
        document.getElementById("dsGameConnStatus").innerHTML = "<img  title='Game Connection - Waiting' src='./images/orangeConnect.png'>";
        state.gameConnectionCheck=2;
        state.gameConnectionLastCheck = Date.now();
        return;
    }
    if (gameConnStatus.connected) {
        document.getElementById("dsGameConnStatus").innerHTML = "<img title='Game Connection - Connected' src='./images/greenConnect.png'>";
        state.gameConnectionCheck=30;
        state.gameConnectionLastCheck = Date.now();
        return;
    }
    document.getElementById("dsGameConnStatus").innerHTML = "<img title='Game Connection - Unknown' src='./images/redConnect.png'>";
    state.gameConnectionCheck=30;
}
