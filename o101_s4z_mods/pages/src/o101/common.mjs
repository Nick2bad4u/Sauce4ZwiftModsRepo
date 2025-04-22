import * as sauce from '/pages/src/../../shared/sauce/index.mjs';
import * as common from '/pages/src/common.mjs';

let imperial = common.storage.get('/imperialUnits');

export const hasAthleteAttribute = (info, prop) => {
    return Object.hasOwn(info, 'athlete')
        && info.athlete != null
        && Object.hasOwn(info.athlete, prop);
}

export function formatNumber(value, precision) {
    if (value == null) return null;    

    return sauce.locale.human.number(value, {precision: precision, fixed: true});
}

export function formatDuration(value) {
    const hours = Math.floor(value / 3600);
    let minutes = Math.floor((value % 3600) / 60);
    let seconds = Math.floor(value % 60);

    if (minutes < 10) {
        minutes = '0' + minutes;
    }
    if (seconds < 10) {
        seconds = '0' + seconds;
    }

    if (hours > 0) {
        return hours + ':' + minutes + ':' + seconds;
    } else {
        return minutes + ':' + seconds;
    }
}

export function formatDistanceInMeters(value) {
    return formatDistance(value, true);
}

export function formatDistance(value, noKm) {
    let distance = ''

    if ((value == null || value === Infinity || value === -Infinity || isNaN(value))) {
        return distance;
    } else if (Math.abs(value) < 1000 || noKm) {
        distance = sauce.locale.human.number(imperial ? value / sauce.locale.metersPerFoot : value);
    } else {
        distance = sauce.locale.human.distance(value, {precision: 2, suffix: true, html: true});
    }

    return distance.replace('-', '')
}

export function getAthleteId(info) {
    return (Object.hasOwn(info, 'athleteId')) ? info.athleteId : null;
}

export function getAthleteType(info) {
    try {
        if (hasAthleteAttribute(info, 'type') && info.athlete.type == 'PACER_BOT') {
            return 'pacer';
        } else if (Object.hasOwn(info, 'eventLeader') && info.eventLeader) {
            return 'leader';
        } else if (Object.hasOwn(info, 'eventSweeper') && info.eventSweeper) {
            return 'sweeper';
        } else if (hasAthleteAttribute(info, 'marked') && info.athlete.marked === true) {
            return 'marked';
        }
      } catch (error) {
        console.error(error);
        //console.log(info);
      }
      
    return 'normal';
}

export function getEventPosition(info) {
    return (Object.hasOwn(info, 'eventPosition')) ? info.eventPosition : 0;
}

export function getWkg(rider) {
    const wkg = rider.state.power / (rider.athlete && rider.athlete.weight);

    return sauce.locale.human.number(wkg, {precision: 1, fixed: true});
}

export function getWkgGroup(group) {
    //group avg?
    const wkg = group.power / group.weight;

    return sauce.locale.human.number(wkg, {precision: 1, fixed: true});
}

export function getWbal(info) {
    const wprime = info.athlete && info.athlete.wPrime;
    const wbal = wprime ? info.wBal / wprime * 100 : 0;

    return formatNumber(wbal, 0);
}

export function initPowerUpsState() {
    return {
        powerUps: [],
        expiredPowerUps: []
    }
}

export function getPowerUp(info, state, showUnAvailability = false) {
    const powerUp = getActivePowerUp(info);
    const riderId = getAthleteId(info);
    const currentPosition = getCurrentPosition(info);
    const zenmasterDataAvailable = segmentDataAvailable(info);
    
    if (powerUp.image == '') {
        if (!showUnAvailability || !zenmasterDataAvailable) return powerUp;

        const lastExpiredPowerUp = state.expiredPowerUps.filter(x => x.id == riderId).pop();

        if (lastExpiredPowerUp == undefined || !Object.hasOwn(lastExpiredPowerUp, 'spawnPoints')) return powerUp;

        const activatedBeforeNextSpawnPoint = lastExpiredPowerUp.activatedPosition < lastExpiredPowerUp.spawnPoints.next.markLine;
        const currentPositionBeforeNextSpawnPoint = currentPosition < lastExpiredPowerUp.spawnPoints.next.markLine;

        if (activatedBeforeNextSpawnPoint && currentPositionBeforeNextSpawnPoint) {
            return {
                image:'unavailable',
                remaining: 0,
                togo: 0
            }; 
        }
    } 

    let idx = state.powerUps.findIndex(x => x.id == riderId);
    let enrichedPowerUp = {};

    if (idx < 0) {
        enrichedPowerUp = {
            image: powerUp.image,
            seconds: powerUp.seconds,
            id: riderId,
            activatedPosition: currentPosition,
            expiration: Date.now()/1000 + powerUp.seconds,
            remaining: 100,
            togo: 0
        };
        if (powerUp.image != '') state.powerUps.push(enrichedPowerUp);
    } else {
        enrichedPowerUp = state.powerUps[idx];
        enrichedPowerUp.remaining = Math.round(enrichedPowerUp.expiration - Date.now()/1000) / powerUp.seconds * 100;
        enrichedPowerUp.togo = 100 - enrichedPowerUp.remaining;
        enrichedPowerUp.expiredPosition = currentPosition; 
    }

    if (zenmasterDataAvailable) {
        enrichedPowerUp.spawnPoints = {
            last: info.segmentData.routeSegments.filter(x => x.name.toLowerCase().indexOf('finish') >= 0 && enrichedPowerUp.activatedPosition > x.markLine).pop(),
            next: info.segmentData.routeSegments.filter(x => x.name.toLowerCase().indexOf('finish') >= 0 && enrichedPowerUp.activatedPosition < x.markLine)[0]
        }
    }

    return enrichedPowerUp;
}

function getActivePowerUp(info) {
    if (info.state == null) return { image:'', seconds:0 };

    const powerUp = (Object.hasOwn(info.state, 'activePowerUp')) ? info.state.activePowerUp : null;

    switch (powerUp) {
        case 'COFFEE_STOP':
        case 'POWERUP_CNT': return { image:'coffee', seconds:180 };
        case 'AERO': return { image:'aero', seconds:15 };
        case 'ANVIL': return { image:'anvil', seconds:15 };
        case 'DRAFTBOOST': return { image:'draft', seconds:40 };
        case 'LIGHTNESS': return { image:'feather', seconds:30 };
        case 'STEAMROLLER': return { image:'steamroller', seconds:30 };
        case 'UNDRAFTABLE': return { image:'burrito', seconds:20 };
        // cloaking/ghost, 15 seconds
        default: return { image:'', seconds:0 };
    }
}

function segmentDataAvailable(info) {
    return (Object.hasOwn(info, 'segmentData'));
}

export function getCurrentPosition(info) {
    return (Object.hasOwn(info, 'segmentData'))
        ? info.segmentData.currentPosition
        : 0;
}

export function findAndMoveExpiredPowerUps(state) {
    if (state.powerUps.length > 0) {
        Array.prototype.push.apply(state.expiredPowerUps, state.powerUps.filter(x => x.expiration - Date.now()/1000 <= 0));
        state.powerUps = state.powerUps.filter(x => x.expiration - Date.now()/1000 > 0);
    }
}

export function fmtGapTime(info) {
    if (isInGroup(info)) {
        return '&nbsp';
    }

    return fmtGapTimeByGap(info.gap);
}

export function fmtGapTimeByGap(gap, usePrefix = true, precision = 0) {
    if (gap==0 || gap == null) return '&nbsp;';
    const prefix = usePrefix ? gap<0 ? '-' : '+' : '';
    const value = Math.abs(gap);
    let minutes = Math.floor((value % 3600) / 60);
    let seconds = Math.floor(value % 60);

    if (minutes>0 && seconds<10) seconds = '0' + seconds;

    if (precision>0 && minutes==0) {
        let temp = (gap%1)+'';
        temp = temp.substring(temp.indexOf('.')+1)+'0000000000';
        seconds += '.' + temp.substring(0,precision);
    }

    if (minutes==0) return prefix + seconds + '<abbr>s</abbr>';

    return prefix + minutes + 'm' + seconds;
}

export function fmtGapTimeRtf(info) { 
    var time = sauce.locale.human.timer(info.gap);
    var prefix = (time+'').indexOf('-')<0 ? '+' : '-';
    
    time = time.replace('-', '');
    
    if (time.indexOf(':')<0) {
        return prefix + time;
    }

    return prefix + time;
}

export function fmtGapTimeGroup(group) {
    const closest = group.athletes.reduce(function(prev, current) {
        return (Math.abs(prev.gap) < Math.abs(current.gap)) ? prev : current
    })

    return fmtGapTime(closest, 0);
}

export function fmtGapDistance(info) {
    let distance = '&nbsp;'
    const value = info.gapDistance;

    if ((value == null || value === Infinity || value === -Infinity || isNaN(value) || isInGroup(info))) {
        return distance;
    } else if (Math.abs(value) < 1000) {
        distance = sauce.locale.human.number(value) + '<abbr>m</abbr>';
    } else {
        distance = sauce.locale.human.distance(value, {precision: 1, suffix: true, html: true});
    }

    return distance.replace('-', '')
}

export function fmtGapDistanceRtf(info) {
    let distance = ''
    const value = info.gapDistance;

    if ((value == null || value === Infinity || value === -Infinity || isNaN(value))) {
        return distance;
    } else if (Math.abs(value) < 1000) {
        distance = sauce.locale.human.number(value);
    } else {
        distance = sauce.locale.human.distance(value, {precision: 1, suffix: true, html: true});
    }

    return distance.replace('-', '')
}

export function fmtGapDistanceGroup(group) {
    const closest = group.athletes.reduce(function(prev, current) {
        return (Math.abs(prev.gapDistance) < Math.abs(current.gapDistance)) ? prev : current
    })

    return fmtGapDistance(closest, 0);
}

export function isInGroup(info) {
    const value = info.gap;
    return (value > -1 && value < 1);
}

export function fmtRacingScore(info) {
    return (Object.hasOwn(info.athlete, 'racingScore')) ? formatNumber(info.athlete.racingScore, 0) : '';
}

export function fmtRacingCategory(info) {
    return (Object.hasOwn(info.athlete, 'racingCategory')) ? info.athlete.racingCategory : '';
}

export function fmtName(info) {
    const firstName = fmtFirstName(info, 1);
    const name = (firstName.length > 0)
        ? fmtFirstName(info, 1) + '.' + fmtLastName(info)
        : fmtLastName(info);

    return (name.length>0) ? name : '';

}

export function fmtFullName(info) {
    return fmtFirstName(info) + ' ' + fmtLastName(info);
}

export function fmtFirstName(info, maxLength) {
    let first = info != null && info.athlete != null && Object.hasOwn(info.athlete, 'firstName') ? info.athlete.firstName : '';
    if (first == null) first = '';

    first = first.trim();

    if (maxLength == null) {
        first = first
            .namingCharsOnly()
            .noNumbers()
            .noEmojis()
            .filterOutSpecialChars();
    } else {
        first = first
            .namingCharsOnly()
            .noNumbers()
            .noEmojis()
            .filterOutSpecialChars()
            .substring(0,1).toUpperCase();
    }
    
    first = first.trim();
    
    if (first.length>1) {
        first = first.substring(0,1).toUpperCase() + first.substring(1).toLowerCase()
    } else {
        first = first.substring(0,1).toUpperCase();
    }

    return first == '' ? 'N' : first;
}

export function fmtLastName(info) {
    let last = info != null && info.athlete != null && Object.hasOwn(info.athlete, 'lastName') ? info.athlete.lastName : '';

    return fmtLastNameRaw(last);
}

export function fmtLastNameRaw(last) {
    const maxLength = 16;

    if (last == null) last = '';

    last = last.trim();

    if (last.length>0) {
        last = stripSpamFromName(last);

        if (last.length>1) {
            last = last.substring(0,1).toUpperCase() + last.substring(1).toLowerCase()
        } else {
            last = last.substring(0,1).toUpperCase();
        }

        const lastParts = last.split(' ');
        last = '';
        for (let i = 0; i < lastParts.length; i++) {
            let lastPart = lastParts[i]
                .namingCharsOnly()
                .noNumbers()
                .noEmojis()
                .filterOutSpecialChars();
            if (lastPart.length>=maxLength) {
                lastPart = lastPart.substring(0, maxLength-1)
            }
            if (lastPart.length>=1) {
                lastPart = lastPart.substring(0,1).toUpperCase() + lastPart.substring(1).toLowerCase()
            }
            last += lastPart + ' ';
        }
    }

    last = last.trim();

    return last;
}

export function fmtTeamName(info) {
    const teamName = (info != null && info.athlete != null && Object.hasOwn(info.athlete, 'team'))
        ? info.athlete.team.trim()
        : '';

    if (teamName.length > 0) {
        return teamName.substring(0,1).toUpperCase() + teamName.substring(1).toLowerCase()
    }

    return teamName.toLowerCase();
}

export function fmtTeamBadge(info) {
    let team = '';
    if (info != null && info.athlete != null && Object.hasOwn(info.athlete, 'team')) {
        team = info.athlete.team;

        if (team.toLocaleLowerCase() == 'tfc') {
            return '<span class="badge" style="--hue: 60">TFC</span>'
        }

        return common.teamBadge(team.substring(0,40).toUpperCase());
    }
}

export function fmtTeamBadgeV2(info, useDisplayName, overrideTeamName, overrideTeamColor) {
    let teamName = '';
    if (info != null && info.athlete != null && Object.hasOwn(info.athlete, 'team')) {
        teamName =  info.athlete.team.filterOutSpecialChars().noEmojis();
    }

    if (info != null && info.athlete != null && Object.hasOwn(info.athlete, 'fullname') && info.athlete.fullname.toUpperCase().indexOf('TFC') >= null) {
        teamName = 'tfc';
    }

    if (overrideTeamName != null && overrideTeamName != '') {
        teamName = overrideTeamName;
    }

    if (teamName == '') return '';

    if (teamName.length>15) {
        teamName = teamName.substring(0,15);
    } 
    
    let teamColor = preferredTeamColor(teamName.toUpperCase());

    if (overrideTeamColor != null) {
        teamColor.color = overrideTeamColor.textColor;
        teamColor.lgColor1 = overrideTeamColor.backgroundColor;
        teamColor.lgColor2 = overrideTeamColor.backgroundColor;
    }

    return(fmtTeamBadgeV2Raw(teamColor, useDisplayName));
}

export function fmtTeamBadgeV2Raw(teamColor, useDisplayName = false) {
    const displayName = useDisplayName ? teamColor.displayName : teamColor.name;

    return '<div class="info-item-team" style="--o101c:'+teamColor.color+'; --o101lg1:'+teamColor.lgColor1+'; --o101lg2:'+teamColor.lgColor2+'; --weight:'+teamColor.weight+'"><span>'+displayName+'</span></div>';
}

export function frrCategory(athlete) {
    let fhrc = 'UNC';
    const codes = ['CAP', 'DRA', 'CRP', 'GHT', 'HAB', 'BON', 'CAY', 'JLP', 'PEP', 'BEL'];
    const lastName = athlete != null && athlete.athlete != null && Object.hasOwn(athlete.athlete, 'lastName') ? athlete.athlete.lastName : '';
    const nameParts = lastName.split(' ');

    for (let i=0; i<nameParts.length; i++) {
        for (const code of codes) {
            if (nameParts[i].toUpperCase().indexOf(code)>=0) {
                fhrc = code;
                break;
            }
        }
    }

    return fhrc;
}

export function fmtSegmentName(name) {
    let newName = name;
    
    if (name.length>0) {
        const nameParts = name.split(' ');
        
        newName = '';
        for (let np of nameParts) {
            if (np.toUpperCase()=='KOM') {
                newName += 'KOM ';
            } else if (np.length>=1) {
                newName += np.substring(0,1).toUpperCase() + np.substring(1).toLowerCase() + ' ';
            }
        }
    }

    return newName.trim();
}

export function fmtHeartrate(info) {
    if (info.state == null) return 0;
   
    const value = info.state.heartrate;
    return (value == null || value == 0) ? '' : value;
}

export function fmtWkg(info) {
    if (info.state == null) return 0;

    let wkg = info.state.power / (info.athlete && info.athlete.weight);
    
    return sauce.locale.human.number(wkg, {precision: 1, fixed: true});
}

export function fmtWeight(info) {
    return (Object.hasOwn(info.athlete, 'weight')) ? formatNumber(info.athlete.weight, 0) : 0;
}

export function fmtHeight(info) {
    return (Object.hasOwn(info.athlete, 'height')) ? formatNumber(info.athlete.height, 0) : 0;
}

export function fmtWkgSmooth(info, interval) {
    let wkg = Math.round(info.stats.power.smooth[interval]) / (info.athlete && info.athlete.weight);
    
    return sauce.locale.human.number(wkg, {precision: 1, fixed: true});
}

export function fmtDraft(info, asWkg = false) {
    if (info.state == null) return 0;
    if (info.state.draft == null || info.state.draft == 0) return '0';
    if (!asWkg) return info.state.draft;

    const wkg = info.state.draft / (info.athlete && info.athlete.weight)

    return sauce.locale.human.number(wkg, {precision: 1, fixed: true})
}

export function canSteer(info) {
    if (info.state == null) return 0;
   
    const value = info.state.canSteer;
    return (value == null || value == 0) ? false : value;
}

export function stripSpamFromName(value, arr = []) {
    const spamChars = arr.length>0 ? arr : ['[','(','/','|',',','#','-','Team','TEAM','team','Year','YEAR','year','TFC'];

    for (let i = 0; i < spamChars.length; i++) {
        if (value.indexOf(spamChars[i])>0) {
            const nameParts = value.split(spamChars[i]);
            value = nameParts[0];
        }
    }

    return value;
}

export function getCategoryBadge(info) {
    const sgid = info.state.eventSubgroupId;
    if (sgid) {
        const sg = lazyGetSubgroup(sgid);
        if (sg) {
            return common.eventBadge(sg.subgroupLabel);
        }
    }
    return '';
}

export const lazyGetSubgroup = makeLazyGetter(id => common.rpc.getEventSubgroup(id));
export const lazyGetRoute = makeLazyGetter(id => common.rpc.getRoute(id));
function makeLazyGetter(cb) {
    const getting = {};
    const cache = new Map();

    return function getter(key) {
        if (!cache.has(key)) {
            if (!getting[key]) {
                getting[key] = cb(key).then(value => {
                    cache.set(key, value || null);
                    if (!value) {
                        // Allow retry, especially for event data which is wonky
                        setTimeout(() => cache.delete(key), 10000);
                    }
                    delete getting[key];
                });
            }
            return;
        } else {
            return cache.get(key);
        }
    };
}

let _nations, _flags;
export async function initNationFlags() {
    const r = await fetch('/shared/deps/data/countries.json');
    if (!r.ok) {
        throw new Error('Failed to get country data: ' + r.status);
    }
    const data = await r.json();
    _nations = Object.fromEntries(data.map(({id, en}) => [id, en]));
    _flags = Object.fromEntries(data.map(({id, alpha2}) => [id, `/pages/deps/flags/${alpha2}.png`]));
    // Hack in the custom codes I've seen for UK
    _flags[900] = _flags[826]; // Scotland
    _flags[901] = _flags[826]; // Wales
    _flags[902] = _flags[826]; // England
    _flags[903] = _flags[826]; // Northern Ireland
    return {nations: _nations, flags: _flags};
}

export function fmtFlag(info) {
    let flag = '<img src="/pages/deps/flags/fm.png"/>';

    if (info.athlete == null || !Object.hasOwn(info.athlete, 'countryCode')) {
        return flag;
    }

    const code = info.athlete.countryCode;

    if (code && _flags && _flags[code]) {
        const nation = sanitizeAttr(_nations[code]);
        return `<img src="${_flags[code]}" title="${nation}"/>`;
    }

    return flag;
}

export function fmtFlagByCountryCode(code) {
    let flag = '<img src="/pages/deps/flags/fm.png"/>';

    if (code && _flags && _flags[code]) {
        const nation = sanitizeAttr(_nations[code]);
        return `<img src="${_flags[code]}" title="${nation}"/>`;
    }

    return flag;
}

const _saniEl = document.createElement('span');
export function sanitizeAttr(raw) {
    _saniEl.setAttribute('clean', raw);
    try {
        return _saniEl.outerHTML.substr(13, _saniEl.outerHTML.length - 22);
    } finally {
        _saniEl.setAttribute('clean', '');
    }
}

export function formatLeaderboardName(entry) {
    let first = entry.firstName.namingCharsOnly().toUpperCase();
    let last = fmtLastNameRaw(entry.lastName);

    if (first == null || first == '') {
        //const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        //first = chars.charAt(Math.floor(Math.random() * chars.length));
        first = '';
    }
    
    return first + '.' + last;
}

export function formatLeaderboardTime(value) {
    const hours = Math.floor(value / 3600);
    let minutes = Math.floor((value % 3600) / 60);
    let seconds = Math.floor(value % 60);
    let hundreds = Math.floor((value*100)%100);
    
    if (hundreds<10) hundreds = hundreds + "0";

    if (hours > 0) {
        if (minutes<10) minutes = "0" + minutes;
        if (seconds<10) seconds = "0" + seconds;
        return hours + ':<timemm>' + minutes + '</timemm>:<timess>' + seconds + '</timess>.<timeff>' + hundreds + '</timeff>';
    }
    if (minutes > 0) {
        if (seconds<10) seconds = "0" + seconds;
        return '<timemm>' + minutes + '</timemm>:<timess>' + seconds + '</timess>.<timeff>' + hundreds + '</timeff>';
    }

    return '<timess>' + seconds + '</timess>.<timeff>' + hundreds + '</timeff>';
}

export const getAthleteCategory = (athlete) => {
    const sgid = athlete.state.eventSubgroupId;
    if (sgid) {
        const sg = lazyGetSubgroup(sgid);
        if (sg) {
            return sg.subgroupLabel;
        }
    }
    return '';
}

let _teamColors;
export async function initTeamColors() {
    const r = await fetch('./src/o101/teamcolors.json');
    if (!r.ok) {
        throw new Error('Failed to get teamcolor data: ' + r.status);
    }
    const data = await r.json();

    _teamColors = data.map(team => { return {
        key: team.name,
        textColor: team.textColor,
        linearGradientColor1: team.linearGradientColor1,
        linearGradientColor2: team.linearGradientColor2,
        weight: team.weight,
        displayName: team.displayName
    }});
}

export function preferredTeamColor(name) {
    let color = '#FFF';
    let lgColor1 = '#71797E';
    let lgColor2 = '#36454F';
    let weight = '600';
    let displayName = name;
    const team = (name != '')
        ? _teamColors.find(t => name.toLowerCase().indexOf(t.key.toLowerCase())>=0)
        : null;

    if (team != null) {
        color = team.textColor;
        lgColor1 = team.linearGradientColor1;
        lgColor2 = team.linearGradientColor2;
        if (team.weight != null && team.weight != '') weight = team.weight;
        if (team.displayName != null && team.displayName != '') displayName = team.displayName;
    } else if (name != '') {
        lgColor1 = name.toHex();
        lgColor2 = name.toHex();
    }

    return {name, color, lgColor1, lgColor2, weight, displayName};
}

String.prototype.toHex = function() {
    var hash = 0;
    if (this.length === 0) return hash;
    for (var i = 0; i < this.length; i++) {
        hash = this.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    var color = '#';
    for (var i = 0; i < 3; i++) {
        var value = (hash >> (i * 8)) & 255;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

String.prototype.filterOutSpecialChars = function() {
    return this.replace(/[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g, '');
}

String.prototype.namingCharsOnly = function() {
    return this.replace(/[-~]*$/g, '')
}

String.prototype.azOnly = function() {
    return this.replace(/[^A-Za-z]/g, '');
}

String.prototype.noNumbers = function() {
    return this.replace(/[0-9]/g, '');
}

String.prototype.noEmojis = function() {
    return this.replace(/((\ud83c[\udde6-\uddff]){2}|([\#\*0-9]\u20e3)|(\u00a9|\u00ae|[\u2000-\u3300]|[\ud83c-\ud83e][\ud000-\udfff])((\ud83c[\udffb-\udfff])?(\ud83e[\uddb0-\uddb3])?(\ufe0f?\u200d([\u2000-\u3300]|[\ud83c-\ud83e][\ud000-\udfff])\ufe0f?)?)*)/g, '');
}