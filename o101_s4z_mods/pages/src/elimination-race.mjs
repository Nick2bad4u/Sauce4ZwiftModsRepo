import * as common from '/pages/src/common.mjs';


const state = {
    ridersInitialized: false,
    segmentsInitialized: false,
    segments: [],
    handledSegments: [],
    //eventSubgroupId: 0,
    //eventStart: Date.now() - 1,
    //eventCourse: '',
    //eventPowerUps: [],
    //registeredRiders: [],
    //eliminatedRiders: [],
    //data: []
};

common.settingsStore.setDefault({
    someSetting: 'value'
});

export async function main() {
    common.initInteractionListeners();
    common.settingsStore.addEventListener('changed', render);
    common.subscribe('athlete/watching', initializeSegments);
    common.subscribe('nearby', handleEliminationRace);

    render();
}

function render() {
    //let div = document.querySelector('#emptyPanel');

    //if (div == null) return;

    //div.className = common.settingsStore.get('panelColor');
}

function initializeSegments(info) {
    if (state.segmentsInitialized || info.segmentData == null || info.segmentData.routeSegments == null) {
        return null;
    }

    state.segments = info.segmentData.routeSegments.filter(s => s.name.toUpperCase().indexOf('FINISH') >= 0) || [];
    state.segmentsInitialized = true;
}

async function handleEliminationRace(info) {
    initializeRegisteredRiders(info);

    //console.log(info);
    console.log(state.segments);
    //console.log(state.handledSegments);

    for (let i=0; i< state.segments.length; i++) {
        const segment = state.segments[i];

        if (state.handledSegments.find(s => s.id == segment.id)){
            continue;
        };

        handleLeaderboard(segment.id);
        state.handledSegments.push(segment);
    }

}

async function handleLeaderboard(segmentId) {
    // let segmentLeaderboard = await common.rpc.getSegmentResults(segment.id, {live:true})
    
    // console.log(segmentLeaderboard);
    console.log(segmentId);
}

function initializeRegisteredRiders(info) {

    // persist all riders ONCE when race has started

    state.ridersInitialized = true;
}

function handleEliminatedRiders() {
    
}