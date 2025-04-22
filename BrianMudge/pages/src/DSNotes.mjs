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
if (debug) console.log("notesArray:", notesArray);

let showNotesRiderList = common.settingsStore.get('showNotesRiderList');
let showNotesSegments = common.settingsStore.get('showNotesSegments');
let distanceCalculation = common.settingsStore.get('distanceCalculation');
let showHR = common.settingsStore.get('showHR');
let show20MinPower = common.settingsStore.get('show20MinPower');
let showMarkedRiders = common.settingsStore.get('showMarkedRiders');
let showTeamRiders = common.settingsStore.get('showTeamRiders');
let riderRefreshRate = common.settingsStore.get('riderRefreshRate') * 1000;
let autoHideSegments = common.settingsStore.get('autoHideSegments');
let autoHideDistance = common.settingsStore.get('autoHideDistance') || 10;
//if (debug) console.log("autoHideDistance:", autoHideDistance);
let forceSegmentUpdate=false;
let lastRefreshDate = Date.now() - 99999;
let routeRefreshInterval = 120000;
let eventRefreshInterval = 180000;
let watchingRider  = [];
let markedRiders = [];
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


/* const defaultOverviewDataSegments = {
    routeSegments: null,
    previousSegmentIdx: -1,
    activeSegmentIdx: -1,
    nextSegmentIdx: -1,
    activeSegmentEntered: null,
    etaCalculator: null
};

let segments = common.storage.get(storageKey_OverviewDataSegments) ?? defaultOverviewDataSegments;
console.log("segments:", segments);
 */
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
    show20MinPower: true,
    showHR: true,
    showMarkedRiders: true,
    showTeamRiders: true,
    riderRefreshRate: 5,
    includeFinishMinutes: true,
    includeCurrentSpeed: true
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
                document.getElementById("dsRouteName").innerHTML = route.name;
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
            document.getElementById("dsRouteName").innerHTML = routeLookup.name;
            if (routeLookup.name != route.name) {
                route.name = routeLookup.name;
                segmentData.routeName = route.name;
                route.world = routeLookup.worldId;
                forceSegmentUpdate=true;
                route.externalData = false;
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
//            console.log("Update updateEventInfo");
            forceSegmentUpdate=true;
            if (route.externalData) activeEvent.routeDistance = (routeLookup.distance * 1000) + (routeLookup.leadIn * 1000);
;
            if (state.remainingType == "event") {
                event.totalDistance =  activeEvent.routeDistance;
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
    common.settingsStore.addEventListener('changed', render);
    document.querySelector('#ridersList').addEventListener('click', clickNearbyRider);

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
//    console.log("Start render");
    doc.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
    show20MinPower = common.settingsStore.get('show20MinPower');
    showHR = common.settingsStore.get('showHR');
    showMarkedRiders = common.settingsStore.get('showMarkedRiders');
    showTeamRiders = common.settingsStore.get('showTeamRiders');
    if (showNotesSegments != common.settingsStore.get('showNotesSegments')) {
        showNotesSegments = common.settingsStore.get('showNotesSegments');
        forceSegmentUpdate=true;
    }
    distanceCalculation = common.settingsStore.get('distanceCalculation');
    showNotesRiderList = common.settingsStore.get('showNotesRiderList');
    autoHideSegments = common.settingsStore.get('autoHideSegments');
    autoHideDistance = common.settingsStore.get('autoHideDistance');
    console.log("autoHideSegments:", autoHideSegments);
    console.log("autoHideDistance:", autoHideDistance);
    riderRefreshRate = common.settingsStore.get('riderRefreshRate') * 1000;
//    console.log("riderRefreshRate:", riderRefreshRate);

}

let refresh;
function updateMetrics(info) {
//    if (debug) console.log("Start updateMetrics");
    refresh = false;
    
    let refreshDelta = Date.now() - segmentData.refreshDate;
//    if (debug) console.log("refreshDelta :", refreshDelta);
    if ((Date.now() - segmentData.loadRefreshDate) >= 100000 || forceSegmentUpdate) {
        loadSegments(info.segmentData.routeSegments);
        segmentData.loadRefreshDate = Date.now();
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

//        updateRouteInfo();
//        updateEventInfo();
//        loadSegments(info.segmentData.routeSegments);
        displaySegmentData(segmentData);
        setNearbySegments(info);
    }

//    if (showSegmentInfo) loadSegmentInfo(info);
}

function displaySegmentData(segmentData) {
    if (debug) console.log("Start displaySegmentData");
let routeSegments = segmentData.segments.routeSegments;
//console.log("routeSegments:", routeSegments);
    routeSegments.sort(function(a, b) {return a.start - b.start});
//console.log("routeSegments (Sort):", routeSegments);

    let element = document.getElementById("routeSegments");
    let innerHTML="<table border=1 STYLE='margin-bottom: 30px;'><thead><tr>";
    innerHTML = innerHTML + "<th data-id='segmentName' title='Segment Name' class>Segment</td>"; 
    innerHTML = innerHTML + "<th data-id='segmentStart' title='Start' class>Start</td>"; 
    innerHTML = innerHTML + "<th data-id='segmentLength' title='Length' class>Length</td>"; 
    innerHTML = innerHTML + "<th data-id='segmentFinish' title='Finish' class>Finish</td>"; 
    innerHTML = innerHTML + "<th data-id='segmentAvgGrade' title='avgGrade' class>avgGrade</td>"; 
    innerHTML = innerHTML + "<th data-id='segmentMaxGrade' title='maxGrade' class>maxGrade</td>"; 
    if (showNotesSegments) innerHTML = innerHTML + "<th data-id='segmentNotes' title='Notes' class>Notes</td>"; 

    innerHTML = innerHTML + "</tr></thead><tbody><tr>"; 
    for (let i=0; i<routeSegments.length; i++) {
        const segment = routeSegments[i];
        let segStart = segment.start / 1000;
        let segEnd = segment.end / 1000;
        let segLength = (segment.end - segment.start) / 1000;
        let segAvgGrade = segment.avgGrade ?? "";
        if (segAvgGrade == "0%" ) segAvgGrade = "";
        let segMaxGrade = segment.maxGrade ?? "";
        if (segMaxGrade == "0.00%" ) segMaxGrade = "";
        let segNotes = segment.comments ?? "";
//console.log("segmentIDX:", i);
//console.log("segment:", segment);
//console.log("segmentStart:", segment.start);
//<td data-id="pwr-avg">195<abbr class="unit">w</abbr></td>
//console.log("segmentEnd :", segment.end);
//console.log("minDistance :", segmentData.minDistance);
//        if (segment.end > (segmentData.minDistanc - 5000)) {
            if (autoHideSegments && segment.end < segmentData.minDistance) {
                let rowStyle = "style='text-decoration:line-through;' "
                if (segment.end < (segmentData.minDistance -(autoHideDistance * 1000))) rowStyle = "style='display:none;' ";
                innerHTML = innerHTML + "<tr " + rowStyle + "data-id='" + i + "' class>";
            } else {
                innerHTML = innerHTML + "<tr style='text-decoration:none;' data-id='" + i + "' class>";
            }
            if (segment.name == "Finish Line") {
                innerHTML = innerHTML + "<td data-id='segName'><img src='./images/checker_640.png'>" + segment.name + "</td>";
            } else {
                innerHTML = innerHTML + "<td data-id='segName'>" + segment.name + "</td>";
            }
            innerHTML = innerHTML + "<td data-id='segStart' align='right'>" + segStart.toFixed(2) + "<abbr>km</abbr></td>";
            innerHTML = innerHTML + "<td data-id='segLength' align='right'>" + segLength.toFixed(2) + "<abbr>km</abbr></td>";
            innerHTML = innerHTML + "<td data-id='segEnd' align='right'>" + segEnd.toFixed(2) + "<abbr>km</abbr></td>";
            innerHTML = innerHTML + "<td data-id='segAvgGrade' align='right'>" + segAvgGrade + "</td>";
            innerHTML = innerHTML + "<td data-id='segMaxGrade' align='right'>" + segMaxGrade + "</td>";
            if (showNotesSegments) innerHTML = innerHTML + "<td data-id='segMNotes' align='left'>" + segNotes + "</td>";
        }
//    }
    innerHTML = innerHTML + "</tr></tbody></table>"; 
    element.innerHTML = innerHTML;
}

//function loadSegmentData(info) {
//    console.log("run loadSegmentData");
//    if (segmentData.segments.routeSegments == null) {
//        loadSegments(info.segmentData.routeSegments);
//    }
//}

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
        if (activeEvent == null) {
            eventLaps = 1;
        } else {
            eventLaps = activeEvent.laps;
        }
    console.log("eventLaps:", eventLaps);
        let routeDistance = route.distanceInMeters;
//    console.log("routeDistance:", routeDistance);
//    console.log("segmentData.routeName:", segmentData.routeName);
//    console.log("route.name:", route.name);
        if (customSegmentsData != null){
            let calcStart=0;
            for (let i=0; i<customSegmentsData.length; i++) {  // For each custome segment do
                const segment = customSegmentsData[i];
//                console.log("segment:", segment);
                let otherClimbData = otherClimbsArray.filter(n => n.Name==segment.Segment);
                let notesData = notesArray.filter(n => n.Name==segment.Segment.toLowerCase());
                //                console.log("otherClimbData:", otherClimbData);
//                console.log("otherClimbData.Length:", otherClimbData[0].Length);
                for (let j=1; j<=eventLaps;j++){
//                    console.log("Process lap '" + j + "'");
                    if (j==1) {
                        calcStart = BMcommon.kmStringToNumber(segment.Start);
                    } else {
                        calcStart = BMcommon.kmStringToNumber(segment.Start) + (routeDistance * (j -1));
                    }
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
        console.log("event :", event);
        console.log("activeEvent :", activeEvent);
        console.log("segmentData : ", segmentData);
    }
}

function handleNearbyInfo(info) {
//    console.log("Info:", info);
    updateWatchRiderInfo(info);
    updateMarkedRiderInfo(info);    
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
        
async function updateMarkedRiderInfo(nearby) {
//    if (debug) console.log("Start updateMarkedRiderInfo");
//    console.log("nearby :", nearby);
//    console.log(Date.now() - segmentData.riderRefreshDate);
//    console.log("state.watchRiderTeam :", state.watchRiderTeam);
    if ((Date.now() - segmentData.riderRefreshDate) < riderRefreshRate) return;

    if (state.gameConnectionCheck > 0) gameConnectionStatus();

//    if (debug) console.log("Run updateMarkedRiderInfo");
    segmentData.riderRefreshDate = Date.now();
    segmentData.minDistance = event.totalDistance;
    let segmentMessage = "";
    let routeSegments = segmentData.segments.routeSegments;
//console.log("routeSegments:", routeSegments);
//    if (routeSegments == null) return;

    if (routeSegments != null) routeSegments.sort(function(a, b) {return a.start - b.start});
//console.log("routeSegments (Sort):", routeSegments);
    
    let element = document.getElementById("ridersList");
    markedRiders = nearby.filter(n => n.watching);
    if (showMarkedRiders) markedRiders = nearby.filter(n => n.watching || n.athlete.marked);
    if (showTeamRiders && state.watchRiderTeam !== undefined && state.watchRiderTeam != null) markedRiders = nearby.filter(n => n.watching || n.athlete.team == state.watchRiderTeam);
    if (showMarkedRiders && (showTeamRiders && state.watchRiderTeam !== undefined && state.watchRiderTeam != null)) markedRiders = nearby.filter(n => n.watching || n.athlete.marked || n.athlete.team == state.watchRiderTeam);
    if (debug) console.log("markedRiders:", markedRiders);
                
    if (markedRiders == null || markedRiders.length == 0) {
//        element.innerHTML = "No Marked riders viewable"; 
        return;
    }            
    let innerHTML="<table border=1 STYLE='margin-bottom: 30px;'><thead><tr>";
    innerHTML = innerHTML + "<th data-id='riderName' title='Rider' class>Rider</td>"; 
    innerHTML = innerHTML + "<th data-id='riderDistance' title='Distance' class>Distance</td>"; 
    if (show20MinPower) innerHTML = innerHTML + "<th id='riderPeak20MinWkgHeader' data-id='riderPeak20MinWkg' title='20M Power' class>20M Power</td>"; 
    if (showHR) innerHTML = innerHTML + "<th id='riderHRHeader' data-id='riderHR' title='HeartRate' class>HR</td>"; 
    if (routeSegments != null) innerHTML = innerHTML + "<th data-id='riderNextSegment' title='Next Segment' class>Next Segment</td>";
    if (showNotesRiderList && routeSegments != null) innerHTML = innerHTML + "<th data-id='riderNextSegment' title='Notes' class>Notes</td>";

    innerHTML = innerHTML + "</tr></thead><tbody><tr>"; 
    for (let i=0; i<markedRiders.length; i++) {
        const rider = markedRiders[i];
        if (debug) console.log("rider :", rider);
        let rider20MinWkgValue = 0;
        let rider20MinWkgColour = " style='color: white;'";
        let riderHrColour=" style='color: white;'";
        let riderHrTitle = "HeartRate";
        let riderWatchedColour = " style='color: white;'";
        let rider20MinWkgTitle = "Peak 20 Minutes";
        let riderSegmentNote = "";
        let riderDistance = 0;
        if (rider.watching) {
            riderWatchedColour = " style='color: lime;'";
        }
        if (distanceCalculation == "routePosition" && rider.segmentData !== undefined) {
            let riderDistanceCheck = rider.state.distance - rider.segmentData.currentPosition;
            if (debug) console.log("riderDistanceCheck: '", rider.athlete.sanitizedFullname, "' ",riderDistanceCheck);
            if (riderDistanceCheck > 400 && rider.remainingType == "event"){
                riderDistance = rider.state.distance;
            } else {
                riderDistance = rider.segmentData.currentPosition;
            }
        } else {
            riderDistance = rider.state.distance;
        }

        if (riderDistance < segmentData.minDistance) segmentData.minDistance = riderDistance
//        if (debug) console.log("minDistance:", segmentData.minDistance);

        if (routeSegments != null) {
            let onSegment = routeSegments.filter(n => riderDistance > n.start && riderDistance < n.end);
            if (onSegment.length > 0){
                console.log("onSegment:", onSegment[0]);
                let endDist = onSegment[0].end /1000;
                segmentMessage="'" + onSegment[0].name + "' ends at " + endDist.toFixed(2) + "km";
                riderSegmentNote=onSegment[0].comments;
            } else {
                let nextSegment = routeSegments.filter(n => riderDistance < n.start && riderDistance < n.end);
                if (nextSegment.length > 0) {
                    console.log("nextSegment:", nextSegment[0]);
                    let startDist = nextSegment[0].start /1000;
                    segmentMessage ="'" + nextSegment[0].name + "' starts at " + startDist.toFixed(2) + "km";
                    riderSegmentNote = nextSegment[0].comments;
                }
            }
        }
        let displayRiderDistance = riderDistance / 1000;
//        if (distanceCalculation == "routePosition" && rider.segmentData !== undefined) {
//            displayRiderDistance = rider.segmentData.currentPosition / 1000;
//        }
        innerHTML = innerHTML + "<tr data-id='" + rider.athleteId + "' class>";
        innerHTML = innerHTML + "<td data-id='" + rider.athleteId + "'" + riderWatchedColour + ">" + rider.athlete.sanitizedFullname + "</td>";
        innerHTML = innerHTML + "<td data-id='" + rider.athleteId + "' align='right'>" + displayRiderDistance.toFixed(2) + "<abbr>km</abbr></td>";
        if (show20MinPower) {
            if (rider.stats.power.peaks[1200].avg != null ) {
                rider20MinWkgValue = rider.stats.power.peaks[1200].avg / rider.athlete.weight;
                rider20MinWkgColour = " style='color: lime;'";
            } else {
                rider20MinWkgValue = rider.stats.power.smooth[1200] / rider.athlete.weight;
                rider20MinWkgColour = " style='color: yellow;'";
                rider20MinWkgTitle = "Smooth 20 Minutes";
            }
            innerHTML = innerHTML + "<td data-id='" + rider.athleteId + "' title='" + rider20MinWkgTitle + "' align='right'" + rider20MinWkgColour + ">" + rider20MinWkgValue.toFixed(2) + "<abbr>wkg</abbr></td>";
        }
        if (showHR) {
            if (rider.state.heartrate != null) {
                if (debug) console.log("rider-Name", rider.athlete.sanitizedFullname);
                if (debug) console.log("rider-HR", rider.state.heartrate);
                if (rider.athlete.age != null) {
//                    console.log("rider-Age", rider.athlete.age);
                    let riderMaxHr = 208 - (0.7 * rider.athlete.age);
//                    console.log("rider-MaxHr", riderMaxHr);
                    let riderHr1Percent = riderMaxHr / 110;
//                    console.log("rider-Hr1Percent", riderHr1Percent);
                    // Determine what HR zone they are in
                    if (rider.state.heartrate > 0 && rider.state.heartrate <= (riderHr1Percent * 80)) { // Z1	Recovery		0 - 80%		0 - 121		Blue
                        if (debug) console.log("rider-Z1	Recovery		0 - 80%		0 - 121		Blue");
                        riderHrColour=" style='color: DeepSkyBlue;'";
                        riderHrTitle = "Z1 HR - Recovery";
                    } else if (rider.state.heartrate > (riderHr1Percent * 80) && rider.state.heartrate <= (riderHr1Percent * 89)) { // Z2	Aerobic			81% - 89%	122 - 134	Green
                        if (debug) console.log("rider-Z2	Aerobic			81% - 89%	122 - 134	Green");
                        riderHrColour=" style='color: Lime;'";
                        riderHrTitle = "Z2 HR - Aerobic";
                    } else if (rider.state.heartrate > (riderHr1Percent * 89) && rider.state.heartrate <= (riderHr1Percent * 93)) { // Z3	Tempo			89% - 93%	135 - 140	Yellow
                        if (debug) console.log("rider-Z3	Tempo			89% - 93%	135 - 140	Yellow");
                        riderHrColour=" style='color: Yellow;'";
                        riderHrTitle = "Z3 HR - Tempo";
                    } else if (rider.state.heartrate > (riderHr1Percent * 93) && rider.state.heartrate <= (riderHr1Percent * 99)) { // Z4	SubThreshold		93% - 99%	141 - 150	Orange
                        if (debug) console.log("rider-Z4	SubThreshold		93% - 99%	141 - 150	Orange");
                        riderHrColour=" style='color: Orange;'";
                        riderHrTitle = "Z4 HR - SubThreshold";
                    } else if (rider.state.heartrate > (riderHr1Percent * 99) && rider.state.heartrate <= (riderHr1Percent * 102)) { // Z5	SuperThreshold		100% - 102%	151 - 154	Red
                        if (debug) console.log("rider-Z5	SuperThreshold		100% - 102%	151 - 154	Red");
                        riderHrColour=" style='color: Red;'";
                        riderHrTitle = "Z5 HR - SuperThreshold";
                    } else if (rider.state.heartrate > (riderHr1Percent * 102) && rider.state.heartrate <= (riderHr1Percent * 105)) { // Z6	Aerobic Capacity	103% - 105%	155 - 159	Purple
                        if (debug) console.log("rider-Z6	Aerobic Capacity	103% - 105%	155 - 159	Purple");
                        riderHrColour=" style='color: white; background-color:Purple;'";
                        riderHrTitle = "Z6 HR - Aerobic Capacity";
                    } else if (rider.state.heartrate > (riderHr1Percent * 105)) { // Z7	Anaerobic		106%+		160 - 166	Red (Flash)
                        if (debug) console.log("rider-Z7	Anaerobic		106%+		160 - 166	Red (Flash)");
                        riderHrColour=" style='color: white; background-color:red;'";
                        riderHrTitle = "Z7 HR - Anaerobic";
                    }
                }
            }
            innerHTML = innerHTML + "<td data-id='" + rider.athleteId + "' title='" + riderHrTitle + "' align='right'" + riderHrColour + ">" + rider.state.heartrate + "<abbr>bpm</abbr></td>";
        }
        if (routeSegments != null) innerHTML = innerHTML + "<td data-id='" + rider.athleteId + "' align='left'>" + segmentMessage + "</td>";
        if (showNotesRiderList && routeSegments != null) innerHTML = innerHTML + "<td data-id='" + rider.athleteId + "' align='left'>" + riderSegmentNote + "</td>";
    }
    innerHTML = innerHTML + "</tr></tbody></table>"; 
    element.innerHTML = innerHTML;
}

async function updateWatchRiderInfo(nearby) {
//    console.log("Start updateRiderInfo");
    watchingRider = nearby.filter(n => n.watching)[0];
            
    if (watchingRider == null) return;
            
    if (debug) console.log("watchingRider:", watchingRider);
    updateSegmentInfo(watchingRider);
                    
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
