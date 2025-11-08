import * as common from '/pages/src/common.mjs';
import * as o101Common from './o101/common.mjs';
import * as o101UiLib from './o101/ui-lib.mjs';
import * as o101Ext from './o101/extensions.mjs'

let settings = {};
let lastRefreshDate = Date.now() - 99999;

common.settingsStore.setDefault({
    showDistance: false,
    showDistanceToFinish: false,
    showPercentage: false,
    lapNames: ''
});

const courseInfo = {
    event: {
        activeEvent: null,
        eventSubgroupId: 0
    },
    totalDistance: 0,
    progress: 0,
    distance: 0,
    lapInfo: {
        laps: 0,
        lapDistance: 0
    },
    routeId: 0,
    routeName: '',
    routeDistance: '',
    distanceToFinish: 0
}

export async function main() {
    common.initInteractionListeners();
    common.settingsStore.addEventListener('changed', updateSettings);
    common.subscribe('athlete/watching', handleData);
    
    updateSettings();
}

function updateSettings() {
    settings.showDistance = common.settingsStore.get('showDistance');
    settings.showDistanceToFinish = common.settingsStore.get('showDistanceToFinish');
    settings.showPercentage = common.settingsStore.get('showPercentage');
    settings.lapNames = common.settingsStore.get('lapNames');

    render();
}

function handleData(info) {
    if ((Date.now() - lastRefreshDate) < 2100) return;

    const event = courseInfo.event;
    const eventSubgroupId = getEventSubgroupId(info);
   
    if (event.activeEvent == null || eventSubgroupId != event.eventSubgroupId) {
        event.activeEvent = o101Common.lazyGetSubgroup(eventSubgroupId);
    }

    if (event.activeEvent == null) {
        let route = o101Common.lazyGetRoute(info.state.routeId);

        if (route == null) return;

        const routeDistance = route.distanceInMeters;

        courseInfo.routeName = route.name;
        courseInfo.routeDistance = routeDistance - route.leadinDistanceInMeters;
        courseInfo.totalDistance = routeDistance;
        //courseInfo.lapInfo.laps = event.activeEvent.laps;
        courseInfo.lapInfo.lapDistance = route.distanceInMeters;
        courseInfo.leadInDistance = route.leadinDistanceInMeters;
        courseInfo.distanceToFinish = routeDistance - info.state.eventDistance;
        courseInfo.distanceCompleted =  info.state.eventDistance;
        courseInfo.progress = info.state.eventDistance / routeDistance * 100;
        courseInfo.distanceCompleted = info.state.distance;
        console.log(route)
    } else {
        let zwiftRoute = o101Common.lazyGetRoute(event.activeEvent.routeId);

        if (zwiftRoute == null) return;

        const routeDistance = event.activeEvent.distanceInMeters ?? event.activeEvent.routeDistance;

        courseInfo.routeName = zwiftRoute.name;
        courseInfo.routeDistance = routeDistance - zwiftRoute.leadinDistanceInMeters;
        courseInfo.totalDistance = routeDistance;
        courseInfo.lapInfo.laps = event.activeEvent.laps;
        courseInfo.lapInfo.lapDistance = zwiftRoute.distanceInMeters;
        courseInfo.leadInDistance = zwiftRoute.leadinDistanceInMeters;
        courseInfo.distanceToFinish = routeDistance - info.state.eventDistance;
        courseInfo.distanceCompleted =  info.state.eventDistance;
        courseInfo.progress = info.state.eventDistance / routeDistance * 100;
        courseInfo.distanceCompleted = info.state.distance;
    }

    if (courseInfo.progress >= 99.9) {
        if (courseInfo.progress > 100) courseInfo.progress = 100; 
        courseInfo.distanceToFinish = 0.00000001;
    }
    if (courseInfo.progress <= 101) render();
    
    lastRefreshDate = Date.now();
}

function render() {
    let tableTotal = document.querySelector('#total');
    tableTotal.innerHTML = '';

    let tr = document.createElement('tr');

    const leadInPercentage = Math.round(courseInfo.leadInDistance / (courseInfo.totalDistance*0.01));

    if (leadInPercentage >= 1) {
        const distance = settings.showDistance ? ' ('+ o101Common.formatNumber(courseInfo.leadInDistance/1000, 2) + ' km)' : '';
        //const distance = '';
        const title = leadInPercentage > 10 && courseInfo.lapInfo.laps < 5 ? 'Lead-in' + distance : '&nbsp;';
        const leadInPercentageCompleted = courseInfo.distanceCompleted < courseInfo.leadInDistance
            ? courseInfo.distanceCompleted / (courseInfo.leadInDistance*0.01) : 100;

        tr.appendChild(createPart(title, leadInPercentage, false, false, leadInPercentageCompleted));
    }

    if (courseInfo.lapInfo.laps > 1) {
        // use leadInDistance in calculation?
        const lapPercentage = courseInfo.lapInfo.lapDistance / (courseInfo.totalDistance*0.01);
        for (let l=1; l<=courseInfo.lapInfo.laps; l++) {
            let title = '';

            switch(settings.lapNames) {
                case 'hidden': { title = ''; break; }
                case 'short': { title = l; break; }
                default: { title = 'lap ' + l; break; }
            }

            const lapCompleted = (courseInfo.distanceCompleted-courseInfo.leadInDistance > courseInfo.lapInfo.lapDistance * l);
            const remainingOfLap = courseInfo.lapInfo.lapDistance * l - courseInfo.distanceCompleted + courseInfo.leadInDistance;

            let lapPercentageCompleted = 0;
            if (courseInfo.distanceCompleted > courseInfo.leadInDistance && !lapCompleted && remainingOfLap < courseInfo.lapInfo.lapDistance) {
                lapPercentageCompleted = 100 - remainingOfLap / (courseInfo.lapInfo.lapDistance*0.01);
            }

            const tdPart = createPart(title, lapPercentage, l == courseInfo.lapInfo.laps, l == 0 && settings.showPercentage, lapCompleted ? 100 : Math.round(lapPercentageCompleted));

            tr.appendChild(tdPart);
        }
    } else {
        let title = courseInfo.routeName;

        if (settings.showDistance) {
            title += ' ('+ o101Common.formatNumber(courseInfo.routeDistance/1000, 2) + ' km)';
        }

        let coursePercentageProgress = 0;

        if (courseInfo.progress > leadInPercentage) { //courseInfo.distanceCompleted > courseInfo.leadInDistance
            coursePercentageProgress = (courseInfo.distanceCompleted-courseInfo.leadInDistance) / (courseInfo.totalDistance-courseInfo.leadInDistance) * 100
        }

        tr.appendChild(createPart(title, 100-leadInPercentage, true, settings.showPercentage, coursePercentageProgress));
    }
    
    tableTotal.appendChild(tr);

    if (settings.showPercentage) {
        const divPercentage = document.querySelector('#percentage');

        if (divPercentage && courseInfo.progress) {
            divPercentage.innerHTML = '&nbsp;' + Math.round(courseInfo.progress) + '%';    
        }
    }
}

function createPart(title, percentage, withFinish = false, withProgressText = false, progress = 0) {
    let tdPart = document.createElement('td');

    tdPart.innerHTML = title;
    tdPart.classList.add('part');
    tdPart.style.width = Math.round(percentage) + '%';

    if (withProgressText) {
        tdPart.withChildDiv(['percentage'], '', 'percentage');
    }

    if (withFinish) {
        if (settings.showDistanceToFinish) {
            tdPart.withChildDiv(['distance-togo'], o101Common.formatNumber(courseInfo.distanceToFinish/1000, 2) + ' km');
            tdPart.withChildDiv(['finish'], '<img src="././images/flag.png"/>');
        }
    }

    if (progress == 100) {        
        o101UiLib.toggleElementClass(tdPart, 'completed', true);
    } else {
        o101UiLib.toggleElementClass(tdPart, 'progress', true)

        tdPart.style.setProperty('--progressCompleted', progress);
        tdPart.style.setProperty('--progressToGo', 100-progress);
    }

    return tdPart;
}

const getEventSubgroupId = (athlete) => {
    let eventSubgroupId;

    // if (Object.hasOwn(athlete, 'o101')) {
    //     eventSubgroupId = athlete.o101.eventSubgroupId;
    // }

    return eventSubgroupId ?? athlete.state.eventSubgroupId;
}