import * as sauce from '/pages/src/../../shared/sauce/index.mjs';
import * as common from '/pages/src/common.mjs';

export function arrayAverage(e){
    //    console.log("Start arrayAverage");
    var total = 0;
    for(var i = 0; i < e.length; i++) {
        total += e[i];
    }
    var avg = total / e.length;
    return avg;
}
    
export function correctZwiftSegmentNames(route,segmentName){
    //console.log("Start correctZwiftSegmentNames");
    //console.log("segmentName :", segmentName);
    //console.log("route.world :", route.world);
    if (route.world == 5) { // Innsbruck
        return "Innsbruck KOM";
    } else if (route.world == 2 && segmentName == "KOM Reverse") { // Richmond Libby Hill Reverse
        return "Libby Hill KOM Reverse";
    } else if (route.world == 2 && segmentName == "KOM") { // Richmond Libby Hill
        return "Libby Hill";
    }
}

export function fifoQueue(queue,item,maxLength){
    //    console.log("Start fifoQueue");
    //    console.log("queue :", queue);
    queue.push(item);         // Add 'item' to the queue
    if (queue.length > maxLength) { queue.shift(); } // remove the First item from the queue, if queue is over maxLength
    return queue;
}

export function kmStringToNumber(kmString) {
    if (kmString.includes("km")) {
        var a = kmString.split('k'); // split it at the 'k'
        return a[0] * 1000;
    } else if (kmString.includes("m")){
        var a = kmString.split('m'); // split it at the 'm'
        return a[0];
    }
}

export function hhmmssToMinutes(hms) {
    var a = hms.split(':'); // split it at the colons
    // Hours are worth 60 minutes.
    var minutes = (+a[0]) * 60 + (+a[1]);
    var seconds = (+a[2]) / 60;
    return minutes + seconds;
}

export function minsToHHMMSS(minutes) {
    var minutes = Math.abs(minutes);
    var mins_num = parseFloat(minutes, 10); // don't forget the second param
    var hours   = Math.floor(mins_num / 60);
    var minutes = Math.floor((mins_num - ((hours * 3600)) / 60));
    var seconds = Math.floor((mins_num * 60) - (hours * 3600) - (minutes * 60));

    // Appends 0 when unit is less than 10
    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}

export function timeValidation(strTime) {
    var timeFormat = /^(?:1[0-2]|0?[0-9]):[0-5][0-9]:[0-5][0-9]$/;
    return timeFormat.test(strTime);
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
