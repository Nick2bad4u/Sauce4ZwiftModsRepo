import * as common from '/pages/src/common.mjs';
import * as o101Common from './o101/common.mjs';
import * as o101UiLib from './o101/ui-lib.mjs';
import * as o101Ext from './o101/extensions.mjs';

let lastRefreshDate = Date.now() - 99999;
let settings = {};

common.settingsStore.setDefault({
    fontScale: 1.2,
    solidBackground: false,
    backgroundColor: '#00ff00',
    refreshInterval: 2,
    speedDecimals: 0,
    speedDelta1: 2,
    speedDelta2: 15,
    maxGroups: 6,
    showAllGroups: false,
    minRiders: 1,
    hideMinimalGroups: true,
    showGapTimeInbetween: false,
    showMaxRank: false,
    showMarkedRiders: false,
    hideBackMarkers: false,
    tttMode: false,
    tttRidersToMatch: 2,
    useNearbyData: false
});

// TODO Event category only

export async function main() {
    common.initInteractionListeners();
    common.subscribe('groups', handleGroupsData);
    common.subscribe('nearby', handleNearbyData);
    common.settingsStore.addEventListener('changed', onSettingsChanged);
    o101Common.initTeamColors();

    document.querySelector('#groups').addEventListener('click', clickGroup);

    updateSettings();
    render();
}

function onSettingsChanged() {
    updateSettings();
    render();
    location.reload();
}

function render() {
    common.setBackground(common.settingsStore.get());

    document.documentElement.style.setProperty('--font-scale', settings.fontScale || 1);
}

function updateSettings() {
    settings.refreshInterval = common.settingsStore.get('refreshInterval') * 1000;
    settings.fontScale = common.settingsStore.get('fontScale');

    settings.speedDecimals = common.settingsStore.get('speedDecimals');
    settings.speedDelta1 = common.settingsStore.get('speedDelta1');
    settings.speedDelta2 = common.settingsStore.get('speedDelta2');
    settings.maxGroups = common.settingsStore.get('maxGroups');
    settings.showAllGroups = common.settingsStore.get('showAllGroups');    
    settings.minRiders = common.settingsStore.get('minRiders');   
    settings.hideMinimalGroups = common.settingsStore.get('hideMinimalGroups');
    settings.showGapTimeInbetween = common.settingsStore.get('showGapTimeInbetween');
    settings.showMaxRank = common.settingsStore.get('showMaxRank');   
    settings.showMarkedRiders = common.settingsStore.get('showMarkedRiders');   
    settings.hideBackMarkers = common.settingsStore.get('hideBackMarkers');
    settings.useNearbyData = common.settingsStore.get('useNearbyData'); 

    settings.tttMode = {
        enabled: common.settingsStore.get('tttMode'),
        tttRidersToMatch: common.settingsStore.get('tttRidersToMatch'),
        teams: []
    };

    for (let i=1; i<=8; i++) {
        const name = common.settingsStore.get('tttTeam'+i+'Name');
        const riders = common.settingsStore.get('tttTeam'+i+'Riders');

        if (name != null && riders != null) {
            settings.tttMode.teams.push({name, riders: riders.split(',')});
        }
    }
}

const isSeparation = (athlete1, athlete2) => {
    const gapTimeAbs = Math.abs(athlete1.gap - athlete2.gap);
    
    //const gapDistanceAbs = Math.abs(athlete1.gapDistance - athlete2.gapDistance);
    //console.log(gapDistanceAbs)
    //use draft and speed, and blink indicator?
    
    return (gapTimeAbs > 1) && athlete2.state.draft == 0;
}

function createNearbyGroup() {
    return {
        athletes: [],
        draft: 0, // not used by me
        gap: 0,
        heartrate: 0, // not used by me
        heartrateCount: 0, // not used by me
        innerGap: 0, // not used by me
        isGapEst: true, // not used by me
        power: 0, // not used by me
        speed: 0, // not used by me
        weight: 0, // not used by me
        weightCount: 0 // not used by me
    };
}

function handleNearbyData(data) {
    if (!settings.useNearbyData) return;
    if ((Date.now() - lastRefreshDate) < settings.refreshInterval) return;

    const nearbyData = data.sort(function(a, b) { return a.gap - b.gap; });
    let groupsData = [];
    let group = createNearbyGroup();
    let previousRider;

    for (let athlete of nearbyData) {
        if (previousRider == null) {
            group.athletes.push(athlete);
            group.speed = athlete.state.speed ?? 0;
        } else if (isSeparation(previousRider, athlete)) {
            if (group.athletes.length >= settings.minRiders) {
                if (groupsData.length>0) {
                    const previousGroup = groupsData[groupsData.length-1];
                    const previousGroupLastAthlete = previousGroup.athletes[previousGroup.athletes.length-1];
                    const currentGroupFirstAthlete = group.length>0 ? group[0] : athlete;

                    group.gap = previousGroupLastAthlete.gap - currentGroupFirstAthlete.gap;
                }
                groupsData.push(group);
            }
            group = createNearbyGroup();
            group.athletes.push(athlete);
        } else {
            group.athletes.push(athlete);
        }

        previousRider = athlete;
    }
    groupsData.push(group);

    processGroupsData(groupsData)
}

function handleGroupsData(data) {
    if (settings.useNearbyData) return;

    processGroupsData(data);
}

function processGroupsData(data) {
    if ((Date.now() - lastRefreshDate) < settings.refreshInterval) return;

    let groups = data.map((g, id) => createGroup(g, id++))
    const myGroup = groups.filter(g => g.riders.filter(r => r.watching).length>0).first();

    if (myGroup && Object.hasOwn(myGroup, 'hasEvent') && myGroup.hasEvent) {
        if (settings.hideBackMarkers) {
            groups = groupsWithoutBackMarkers(groups);
        }

        const leader = groups.find(g => g.rank.min == 1);

        if (settings.tttMode.enabled) {
            groups = setGroupInfoTTT(groups, myGroup);
        } else if (leader != null) {
            groups = setGroupInfoWithLeader(groups, myGroup);
        } else {
            groups = setGroupInfo(groups, myGroup);
        }
    } else {
        groups = setGroupInfo(groups, myGroup);
        if (myGroup) myGroup.name = 'My group';
    }

    renderGroups(getGroupsToRender(groups));

    lastRefreshDate = Date.now();
}

function groupsWithoutBackMarkers(groups) {
    // TODO also filter id group size 1
    let filteredGroups = [];
    let leaderFound = false;
    
    for (let group of groups) {
        if (group.rank.min == 1) {
            leaderFound = true;
        }
        if (!leaderFound) {
            continue;
        }

        filteredGroups.push(group);
    }

    if (groups.length != filteredGroups.length) {
        groups = filteredGroups;
    }

    return groups;
}

function setGroupInfo(groups, myGroup) {
    for (let currentGroup of groups) {
        setCommonGroupInfo(currentGroup, myGroup);        
    }

    return groups;
}

function setGroupInfoWithLeader(groups, myGroup) {
    for (let i=0; i<groups.length; i++) {
        const currentGroup = groups[i];
        setCommonGroupInfo(currentGroup, myGroup);             
        
        currentGroup.name = currentGroup.size>1 ? 'Group ' + (i+1) : 'Rider';
    
        if (i == 0) {
            currentGroup.visibility = 'leader';
            currentGroup.name = currentGroup.size>1 ? 'Leading group' : 'Leader';
        } else if (i == 1) {
            currentGroup.visibility = 'chaser';
            currentGroup.name = currentGroup.size>1 ? 'Chasing group' : 'Chaser';
        }
    }

    return groups;
}

function setGroupInfoTTT(groups, myGroup) {
    for (let currentGroup of groups) {
        setCommonGroupInfo(currentGroup, myGroup);

        let teamName = '';
        const currentGroupRiders = currentGroup.riders.map(r => r.id.toString());
        for (let i=0; i<settings.tttMode.teams.length; i++) {
            const team = settings.tttMode.teams[i];

            if (team.riders.filter(t => currentGroupRiders.includes(t)).length >= settings.tttMode.tttRidersToMatch-2) {
                teamName = team.name;
                break;
            }        
        }

        if (teamName == '') {
            const teamNames = currentGroup.riders.map(r => r.team).filter(t => t != '');
            teamName = teamNames.length>0 ? getDominantTeam(teamNames) : '';
        }
        
        if (teamName == '') continue;

        const teamColor = o101Common.preferredTeamColor(teamName);
        currentGroup.name = o101Common.fmtTeamBadgeV2Raw(teamColor, true);
    }

    return groups;
}

function setCommonGroupInfo(currentGroup, myGroup) {
    currentGroup.name = currentGroup.size>1 ? 'Group' : 'Rider';

    const isMyGroup = (currentGroup.id == myGroup.id);

    if (!isMyGroup && currentGroup.size < settings.minRiders) {
        currentGroup.visibility = 'none';
    }
        
    if (isMyGroup) {
        currentGroup.style = 'watching';
    }

    const speedDelta = currentGroup.speed - myGroup.speed;
    currentGroup.raceInfo.speedDelta = speedDelta;
    currentGroup.raceInfo.speedDeltaPercentage = (speedDelta / myGroup.speed) * 100; 
}

function renderGroups(groupsToRender) {
    let groupsDiv = o101UiLib.createDiv();

    if (settings.hideMinimalGroups) {
        groupsToRender = groupsToRender.filter(g => g.visibility != 'none');
    }

    let groupsInFront = true;
    let myGroupIdx = 999;
    for(let i=0; i<groupsToRender.length; i++) {
        const group = groupsToRender[i];

        if (group.visibility == 'none') {
            if (settings.showMarkedRiders && group.markedRiders>=1) {
                const miniDiv = o101UiLib
                    .createDivWithSpan(['group-item-mini', 'group-item-mini-marked'], '&star;')
                groupsDiv.appendChild(miniDiv);            
            } else {
                const miniDiv = o101UiLib
                    .createDivWithSpan(['group-item-mini'], group.size)
                groupsDiv.appendChild(miniDiv);
            }

            continue;
        }

        if (group.watching) {
            groupsInFront = false;
            myGroupIdx = i;
        }

        let gapTime = '&nbsp;';
        if (i>0) {
            if (group.watching && group.visibility != 'leader') {
                gapTime = fmtGapTime(groupsToRender[i-1].gap.time);
            } else if (groupsInFront) {
                for(let j=i; j>0; j--) {
                    if (group.visibility != 'none') {
                        const value = settings.showGapTimeInbetween ? groupsToRender[j-1].gap.time - group.gap.time : groupsToRender[j-1].gap.time;
                        gapTime = fmtGapTime(value);
                        break;
                    }
                }
            } else {
                for(let j=i; j<groupsToRender.length-1; j++) {
                    if (j < myGroupIdx+1) {
                        gapTime = fmtGapTime(groupsToRender[j].gap.time);
                        break;
                    } else if (group.visibility != 'none') {
                        const value = settings.showGapTimeInbetween ? groupsToRender[j+1].gap.time - group.gap.time : groupsToRender[j].gap.time;
                        gapTime = fmtGapTime(value);
                        break;
                    }
                }  
            }

            const delta = o101UiLib
                .createDiv(['group-delta'])
                .withChildDiv(['group-item-gaptime'], gapTime)
                //distance?
            groupsDiv.appendChild(delta);
        }

        let groupDiv = o101UiLib.createDiv(['group', group.style]);
        const main = o101UiLib
            .createDiv(['group-item'])
            .withChildDivWithDataAttribute(['group-item-name'], group.name, 'id', group.firstRiderId)
            .withOptionalChildDiv(settings.showMarkedRiders && group.markedRiders==1, ['group-item-marked'], fmtMarkedRiders(group.markedRiders))
            .withOptionalChildDiv(settings.showMarkedRiders && group.markedRiders>1, ['group-item-marked', 'multiple'], fmtMarkedRiders(group.markedRiders))
            .withChildDiv(['group-item-size'], fmtSize(group.size))
        groupDiv.appendChild(main);
        const sub = o101UiLib
            .createDiv(['group-item', 'sub'])
            .withChildDiv(['group-item-gaptime'], fmtGapTime(group.gap.time))
            .withOptionalChildDiv(settings.showMaxRank && group.rank.min==1, ['group-item-rank'], '<img src="././images/1st.png"/>')
            .withOptionalChildDiv(settings.showMaxRank && group.rank.min==2, ['group-item-rank'], '<img src="././images/2nd.png"/>')
            .withOptionalChildDiv(settings.showMaxRank && group.rank.min==3, ['group-item-rank'], '<img src="././images/3rd.png"/>')
            .withOptionalChildDiv(settings.showMaxRank && group.rank.min>=4, ['group-item-maxrank'], group.rank.min + '<img src="././images/number-sign.png"/>')
            .withChildDiv(['group-item-speed-delta'], fmtSpeedDelta(group.raceInfo.speedDeltaPercentage))
            .withChildDiv(['group-item-speed'], o101Common.formatNumber(group.speed, settings.speedDecimals) + '<img src="././images/speed.png"/>')
            .withChildDiv(['group-item-power'], o101Common.formatNumber(group.powerWkg, 1))
            .withChildDiv(['info-item-wkgunit'], '&#9889')
        groupDiv.appendChild(sub);
        groupsDiv.appendChild(groupDiv);

        if (i+1 < groupsToRender.length && groupsToRender[i+1].visibility!='none') {
            groupsDiv.appendChild(o101UiLib.createDiv(['group-item', 'spacer'], '&nbsp'));
        }
    }

    o101UiLib.setInfoSection('#groups', groupsDiv);
}

function getGroupsToRender(groups) {
    if (settings.showAllGroups) return groups;

    let groupsToRender = [];

    const leader = groups.find(g => g.visibility=='leader');
    if(leader != null) groupsToRender.push(leader);
    
    const chaser = groups.find(g => g.visibility=='chaser');
    if(chaser != null) groupsToRender.push(chaser);

    const myIdx = groups.findIndex(g => g.watching);
    let frontGroups = (settings.maxGroups/2)+2, rearGroups = 0;
    let startIdx = myIdx - Math.floor(settings.maxGroups/2);

    if (startIdx<0) startIdx = 0;

    for(let i=startIdx; i<groups.length && i<startIdx+settings.maxGroups; i++) {
        if (frontGroups>0 && i<myIdx) {
            if (i>=2) {
                groupsToRender.push(groups[i]);
            }
            frontGroups--;
        }
        if (i==myIdx && groups[i].visibility=='') {
            groupsToRender.push(groups[i]);
        }
        if (rearGroups<=settings.maxGroups && i>myIdx) {
            if (i>=2) {
                groupsToRender.push(groups[i]);
            }
            rearGroups++;
        }
    }

    return groupsToRender;//.reverse();
}

const pullersOfGroup = (riders) => {
    if (riders.length <= settings.minRiders) return riders;

    const maxPullerPosition = riders.length>=20 ? riders.length/2 : 10;
    const frontRiders = riders.filter(r => r.position.group<maxPullerPosition);
    const pullers = frontRiders.filter(r => r.draft<=5).sort(function(a, b) { return a.powerWkg - b.powerWkg; });

    if (pullers.length > 0 ) return pullers;

    const avgDraft = (frontRiders.reduce((a, b) => a.draft + b.draft, 0) / frontRiders.length) || 0;
    const avgPower = (frontRiders.reduce((a, b) => a.power + b.power, 0) / frontRiders.length) || 0;
    const pullersByAvg = frontRiders.filter(r => (r.draft<=avgDraft || r.draft==0) && r.power>=avgPower);
    if (pullersByAvg.length > 0 ) return pullersByAvg;

    const pullersByDraft = frontRiders.filter(r => r.draft<=avgDraft);
    if (pullersByDraft.length > 0 ) return pullersByDraft;

    return frontRiders;
}

function createGroup(group, id) {
    const riders = group.athletes
        .sort(function(a, b) { return a.gap - b.gap; })
        .map((a, pos) => createRider(a, pos++));
    const pullers = pullersOfGroup(riders);

    return {
        id: id,
        riders: riders,
        pullers: pullers,
        name: '',
        size: riders.length,
        speed: pullers.reduce((total, next) => total + next.speed, 0) / pullers.length,
        power: pullers.reduce((total, next) => total + next.power, 0) / pullers.length,
        powerWkg: pullers.reduce((total, next) => total + next.powerWkg, 0) / pullers.length,
        gap: {
            time: group.gap,
            distance: 0,
        },
        stretch: {
            time: Math.abs(riders.reduce((x, y) => x.gap.time > y.gap.time ? x : y).gap.time + riders.reduce((x, y) => x.gap.time < y.gap.time ? x : y).gap.time),
            distance: Math.abs(riders.reduce((x, y) => x.gap.distance > y.gap.distance ? x : y).gap.distance + riders.reduce((x, y) => x.gap.distance < y.gap.distance ? x : y).gap.distance)
        },
        raceInfo: {
            speedDelta: 0,
            speedDeltaPercentage: 0
        },
        watching: riders.filter(r => r.watching).length>0,
        visibility: '',
        firstRiderId: riders[0].id,
        rank: {
            min: Math.min(...riders.map(r => r.position.event)),
            max: Math.max(...riders.map(r => r.position.event))
        },
        markedRiders: riders.filter(r => r.marked).length,
        hasEvent: riders.filter(r => r.event>0).length>0
    }
}

function createRider(info, position) {
    return {
        id: info.athleteId,
        position: {
            group: position+1,
            event: o101Common.getEventPosition(info)
        },
        name: o101Common.fmtName(info),
        team: o101Common.fmtTeamName(info).toUpperCase(),
        gap: {
            time: info.gap,
            distance: info.gapDistance
        },
        draft: info.state.draft,
        speed: info.state.speed,
        power: info.state.power,
        powerWkg: fmtWkg(info),
        hr: info.state.heartrate,
        watching: info.watching,
        marked: o101Common.hasAthleteAttribute(info, 'marked') ? info.athlete.marked : false,
        event: info.state.eventSubgroupId
    };
}

function fmtWkg(info) {
    const pwr = info.state.power
    const weight = (info.athlete && Object.hasOwn(info.athlete, 'weight')) ? info.athlete.weight : 70;

    return pwr / weight;
}

function fmtGapTime(gap) {
    if (gap>-0.1 && gap<0.1) return '';
    const prefix = gap<0 ? '-' : '+';
    const value = Math.abs(gap);
    let minutes = Math.floor((value % 3600) / 60);
    let seconds = Math.floor(value % 60);

    if (minutes==0) return prefix + seconds + 's';

    if (minutes>0 && seconds<10) seconds = '0' + seconds;

    return prefix + minutes + ':' + seconds;
}

function fmtSpeedDelta(percentage) {
    if (percentage > -1*settings.speedDelta1 && percentage < settings.speedDelta1) return '';
    
    if (percentage > settings.speedDelta2) return '<abbr class="faster">&#x25B2&#x25B2</abbr>';
    if (percentage > 0) return '<abbr class="faster">&#x25B2</abbr>';

    if (percentage < -1*settings.speedDelta2) return '<abbr class="slower">&#x25BC&#x25BC</abbr>';
    if (percentage < 0) return '<abbr class="slower">&#x25BC</abbr>';

    return '';
}

function fmtSize(size) {
    return '<span>' + size + '</span>';
}

function fmtMarkedRiders(size) {
    let markedIndication = '<span>'
    
    for (let i=0;i<size&&i<3;i++) markedIndication += '&star;';

    markedIndication += '</span>';

    return markedIndication;
}

async function clickGroup(ev) {
    if (ev.target.dataset.id == null || ev.target.dataset.id == '') return;

    await common.rpc.watch(ev.target.dataset.id);
}

function getDominantTeam(arr) {
    let m = new Map(); 
  
    for (const i in arr) { 
        if (!m.get(arr[i])) m.set(arr[i], 1); 
        else m.set(arr[i], m.get(arr[i]) + 1);     
    } 

    let max = 0; 
    let el; 
    m.forEach((val, key) => { 
        if (max < val) { 
            max = val; 
            el = key; 
        } 
    });

    return el; 
}