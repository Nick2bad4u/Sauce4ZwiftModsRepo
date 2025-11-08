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

export function getEventType(rider) {
    let activeEvent = lazyGetSubgroup(rider.state.eventSubgroupId);
    console.log("activeEvent :", activeEvent);
    if (rider.remainingMetric == "time") {
        return "Time";
    }

    if (rider.remainingMetric == "distance" && rider.remainingType == "route") {
        if (rider.state.workoutZone != null) {
            return "Workout";

        }
        return "FreeRide";
    }
    
    if (rider.remainingMetric == "distance" && rider.remainingType == "event" && activeEvent != null) {
        let eventDescription = activeEvent.description;
        let allTags = activeEvent.allTags;
        console.log("allTags :", allTags);

// Look for Crit Races
        if (activeEvent.name.includes(" Crit ") || allTags.includes("critclub")) {
            return "Crit Race";
        }

// Look for Tiny Races
        if (allTags.includes("tinyraces")) {
            return "Tiny Race";
        }

// Look for Chase Race
        if (activeEvent.name.includes(" Chase ") || activeEvent.name.includes("Kiwi Crew Riot Race")) {
            return "Chase Race?";
        }

// Look for iTT
        if (activeEvent.name.includes(" TT ") || eventDescription.includes("Zwift TT Club") || eventDescription.includes("iTT")) {
            return "iTT?";
        }

// Look for TTT
        if (activeEvent.name.includes("Team Time Trial") || allTags.includes("ttt")) {
            return "TTT";
        }

// Look for Point Races
        if (eventDescription.includes("FTS") || eventDescription.includes("FAL")) {
            return "Points Race?";
        }

// Look for Scratch Races
        if (allTags.includes("zracing")) {
            return "Scratch Race?";
        }
        return "Event";
    }
    return "Unknown";
    
}

export function getPowerZone(effort) {
    let debug = true;
    let riderPowerColour = " style='color: white; background-color:transparent;'";
    if (effort > 0 && effort < 56) { // Z1	Recovery		0-55% of FTP. Focuses on light activity to aid recovery after hard efforts		Grey
        if (debug) console.log("power-Z1	Recovery		0-55% of FTP. Focuses on light activity to aid recovery after hard efforts		Grey");
        riderPowerColour=" style='color: white; background-color:transparent;'";
//        riderHrTitle = "Z1 HR - Recovery";
    } else if (effort > 55 && effort < 76) { // Z2	Aerobic			56-75% of FTP. Builds your aerobic base and improves fat burning	Blue
        if (debug) console.log("power-Z2	Aerobic			56-75% of FTP. Builds your aerobic base and improves fat burning	Blue");
        riderPowerColour=" style='color: DeepSkyBlue; background-color:transparent;'";
//        riderHrTitle = "Z2 HR - Aerobic";
    } else if (effort > 76 && effort < 88) { // Z3	Tempo			76-87% of FTP. Improves your ability to sustain moderate intensity for longer periods	Green
        if (debug) console.log("power-Z3	Tempo			76-87% of FTP. Improves your ability to sustain moderate intensity for longer periods	Green");
        riderPowerColour=" style='color: Lime; background-color:transparent;'";
//        riderHrTitle = "Z3 HR - Tempo";
    } else if (effort > 88 && effort < 106) { // Z4	Threshold		88-105% of FTP. Increases your FTP and improves your ability to handle higher intensities	Yellow
        if (debug) console.log("power-Z4	Threshold		88-105% of FTP. Increases your FTP and improves your ability to handle higher intensities	Yellow");
        riderPowerColour=" style='color: Yellow; background-color:transparent;'";
//        riderHrTitle = "Z4 HR - SubThreshold";
    } else if (effort > 105 && effort < 121) { // Z5	VO2 Max		106-120% of FTP. Improves your cardiovascular fitness and ability to produce power at high intensities	Orange
        if (debug) console.log("power-Z5	VO2 Max		106-120% of FTP. Improves your cardiovascular fitness and ability to produce power at high intensities	Orange");
        riderPowerColour=" style='color: Orange; background-color:transparent;'";
//        riderHrTitle = "Z5 HR - SuperThreshold";
    } else if (effort > 121 && effort <= 150) { // Z6	Anaerobic	121-150% of FTP. Focuses on improving your ability to produce short bursts of high power	Red
        if (debug) console.log("power-Z6	Anaerobic	121-150% of FTP. Focuses on improving your ability to produce short bursts of high power	Red");
        riderPowerColour=" style='color: Red; background-color:transparent;'";
//        riderHrTitle = "Z6 HR - Aerobic Capacity";
    } else if (effort > 150) { // Z7	Neuromuscular		Above 150% of FTP. Focuses on improving your ability to produce maximum power for very short durations	Purple
        if (debug) console.log("power-Z7	Neuromuscular		Above 150% of FTP. Focuses on improving your ability to produce maximum power for very short durations	Purple");
        riderPowerColour=" style='color: white; background-color:Purple;'";
//        riderHrColour=" style='color: white; background-color:red;'";
//        riderHrTitle = "Z7 HR - Anaerobic";
    }
    return riderPowerColour;
}

export function getRouteName(rider) {
    activeEvent = lazyGetSubgroup(rider.state.eventSubgroupId);
    
}

export function getRemainingHTML(rider,route) {
    let percentCalculation = common.settingsStore.get('percentCalculation');
    let riderRemainingColour = " style='color: white; background-color:transparent;'";
    let activeEvent = lazyGetSubgroup(rider.state.eventSubgroupId);
    let watchRemainingPercent = 0;
    let watchRemainingTitle = "";

    if (rider.segmentData.currentPosition !=null && activeEvent != null) {
        let watchRemainingKM = (activeEvent.routeDistance - rider.segmentData.currentPosition)/1000;
        if (percentCalculation == "Remaining") {
            watchRemainingTitle ="% remaining";
            watchRemainingPercent = (((watchRemainingKM * 1000) / activeEvent.routeDistance) * 100);
        } else {
            watchRemainingTitle = "% complete";
            watchRemainingPercent = (((rider.segmentData.currentPosition) / activeEvent.routeDistance) * 100);
        }
        return "<span title='Remaining Distance'" + riderRemainingColour + ">" +  watchRemainingKM.toFixed(2) + "km</span><span title='" + watchRemainingTitle + "' " + riderRemainingColour + "> (" + watchRemainingPercent.toFixed(1) + "%)</span>";
    } else if (rider.remaining != null && activeEvent != null) {
        let watchRemainingKM = rider.remaining/1000;
        if (percentCalculation == "Remaining") {
            watchRemainingPercent = (((watchRemainingKM * 1000) / activeEvent.routeDistance) * 100);
        } else {
            watchRemainingPercent = (((rider.segmentData.currentPosition) / activeEvent.routeDistance) * 100);
        }
        return "<span title='Remaining Distance'" + riderRemainingColour + ">" +  watchRemainingKM.toFixed(2) + "km (" + watchRemainingPercent.toFixed(1) + "%)</span>";
    } else if (rider.remainingMetric == "distance" && rider.remainingType == "route") { // FreeRide
        let totalDistance = route.distanceInMeters;
        console.log("totalDistance", totalDistance);
        let watchRemainingKM = (totalDistance - rider.segmentData.currentPosition)/1000;
        console.log("watchRemainingKM", watchRemainingKM);
        if (percentCalculation == "Remaining") {
            watchRemainingPercent = (((watchRemainingKM * 1000) / totalDistance) * 100);
        } else {
            watchRemainingPercent = (((rider.segmentData.currentPosition) / route.distanceInMeters) * 100);
        }
        return "<span title='Remaining Distance'" + riderRemainingColour + ">" +  watchRemainingKM.toFixed(2) + "km (" + watchRemainingPercent.toFixed(1) + "%)</span>";
    } else {
        return "";
    }
}

export function getEFTHTML(rider) {
    let riderEFTColour = " style='color: white; background-color:transparent;'";

    if (rider.stats.speed.avg > 0 && rider.remaining != null) {
        let watchMinutesRemaining = ((rider.remaining/1000)/rider.stats.speed.avg) * 60;
        let watchRemainingMMSS = minsToHHMMSS(watchMinutesRemaining);
        let watchElapsedMinutes = rider.state.time / 60;
        let watchEstimatedMinutesAtFinish = watchElapsedMinutes + watchMinutesRemaining;
        let watchEstimatedFinishTime = minsToHHMMSS(watchEstimatedMinutesAtFinish);

        return "<span title='Estimated Finish Time'" + riderEFTColour + ">" +  watchEstimatedFinishTime + " (" + watchMinutesRemaining.toFixed(1) + " min)</span>";
    } else {
        return "";
    }
}

export function getPositionHTML(rider) {
    let riderPositionCurrent = 0;
    let riderPositionTotal = 0;
    let riderPositionColour = " style='color: white; background-color:transparent;'";
    let riderDPositionTitle = "Position";
    if (rider.eventPosition != null ) {
        riderPositionCurrent = rider.eventPosition;
        if (riderPositionCurrent == 0) {
            riderPositionColour = " style='color: red; background-color:transparent;'";
        }
    }
    if (rider.eventParticipants != null) {
        riderPositionTotal = rider.eventParticipants;
    }
    return "<span title='Current'" + riderPositionColour + ">" + riderPositionCurrent + "</span> of <span title='Total' style='color: white; background-color:transparent;'>" + riderPositionTotal + "</span>";
}

export function getDraftHTML(rider) {
    let showDraftKey = common.settingsStore.get('showDraftKey');
    if (showDraftKey === undefined) showDraftKey = true;
    let showDraftCurrent = common.settingsStore.get('showDraftCurrent');
    if (showDraftCurrent === undefined) showDraftCurrent = true;
    let showDraftAverage = common.settingsStore.get('showDraftAverage');
    if (showDraftAverage === undefined) showDraftAverage = true;
    
    let keyA = "";
    let keyC = "";
    if (showDraftKey) {
        keyC = " (C)";
        keyA = " (A)";
    }
    let riderDraftCurrent = 0;
    let riderDraftAverage = 0;
    let riderDraftColour = " style='color: white; background-color:transparent;'";
    let riderDraftTitle = "Draft";
    if (rider.state.draft != null ) {
        riderDraftCurrent = rider.state.draft;
        if (riderDraftCurrent == 0) {
            riderDraftColour = " style='color: red; background-color:transparent;'";
        }
    }
    if (rider.stats.draft.avg != null) {
        riderDraftAverage = rider.stats.draft.avg;
    }
    if ( !showDraftCurrent && showDraftAverage) {
        return "<span title='Average'" + riderDraftColour + ">" + riderDraftAverage.toFixed(1) + keyA + "</span>";
    } else if (showDraftCurrent && !showDraftAverage) {
        return "<span title='Current'" + riderDraftColour + ">" + riderDraftCurrent.toFixed(0) + keyC + "</span>";
    } else {
        return "<span title='Current'" + riderDraftColour + ">" + riderDraftCurrent.toFixed(0) + keyC + "</span> / <span title='Average'" + riderDraftColour + ">" + riderDraftAverage.toFixed(1) + keyA + "</span>";
    }
}

export function getWattsHTML(rider) {
    let debug = false;
    let showWattsKey = common.settingsStore.get('showWattsKey');
    if (showWattsKey === undefined) showWattsKey = true;
    let showWattsCurrent = common.settingsStore.get('showWattsCurrent');
    if (showWattsCurrent === undefined) showWattsCurrent = true;
    let showWattsAverage = common.settingsStore.get('showWattsAverage');
    if (showWattsAverage === undefined) showWattsAverage = true;
    
    let keyA = "";
    let keyC = "";
    if (showWattsKey) {
        keyC = " (C)";
        keyA = " (A)";
    }
    let riderFTP = rider.athlete.ftp;
    if (debug) console.log("FTP = " , riderFTP);
    let riderWattsCurrent = 0;
    let riderWattsAverage = 0;
    let riderWattsCurrentPercent = 0;
    let riderWattsAveragePercent = 0;
    let riderWattsCurrentColour = " style='color: white; background-color:transparent;'";
    let riderWattsAverageColour = " style='color: white; background-color:transparent;'";
    let riderWattsTitle = "Watts";
    if (rider.state.power != null ) {
        riderWattsCurrent = rider.state.power;
        riderWattsCurrentPercent = (riderWattsCurrent / riderFTP) *100;
        if (debug) console.log("riderWattsCurrentPercent = " , riderWattsCurrentPercent);
        riderWattsCurrentColour = getPowerZone(riderWattsCurrentPercent);
    }
    if (rider.stats.power.avg != null) {
        riderWattsAverage = rider.stats.power.avg;
        riderWattsAveragePercent = (riderWattsAverage / riderFTP) *100;
        if (debug) console.log("riderWattsAveragePercent = " , riderWattsAveragePercent);
        riderWattsAverageColour = getPowerZone(riderWattsAveragePercent);
    }
        if ( !showWattsCurrent && showWattsAverage) {
        return "<span title='Average'" + riderWattsAverageColour + ">" + riderWattsAverage.toFixed(1) + keyA + "</span>";
    } else if (showWattsCurrent && !showWattsAverage) {
        return "<span title='Current'" + riderWattsCurrentColour + ">" + riderWattsCurrent.toFixed(0) + keyC + "</span>";
    } else {
        return "<span title='Current'" + riderWattsCurrentColour + ">" + riderWattsCurrent.toFixed(0) + keyC + "</span> / <span title='Average'" + riderWattsAverageColour + ">" + riderWattsAverage.toFixed(1) + keyA + "</span>";
    }
}

export function getSpeedHTML(rider) {
    let showSpeedKey = common.settingsStore.get('showSpeedKey');
    let keyA = "";
    let keyC = "";
    if (showSpeedKey) {
        keyC = " (C)";
        keyA = " (A)";
    }
    let riderSpeedCurrent = 0;
    let riderSpeedAverage = 0;
    let riderSpeedColour = " style='color: white; background-color:transparent;'";
    let riderCadenceTitle = "Cadence";
    if (rider.state.speed != null ) {
        riderSpeedCurrent = rider.state.speed;
    }
    if (rider.stats.speed.avg != null) {
        riderSpeedAverage = rider.stats.speed.avg;
    }
    return "<span title='Current'" + riderSpeedColour + ">" + riderSpeedCurrent.toFixed(1) + keyC + "</span> / <span title='Average'" + riderSpeedColour + ">" + riderSpeedAverage.toFixed(1) + keyA + " kph</span>";
}

export function getCadenceHTML(info) {
    let showCadenceKey = common.settingsStore.get('showCadenceKey');
    let keyA = "";
    let keyC = "";
    if (showCadenceKey) {
        keyC = " (C)";
        keyA = " (A)";
    }
    let riderCadenceCurrent = 0;
    let riderCadenceAverage = 0;
    let riderCadenceColour = " style='color: white; background-color:transparent;'";
    let riderCadenceTitle = "Cadence";
    if (info.state.cadence != null ) {
        riderCadenceCurrent = info.state.cadence;
    }
    if (info.stats.cadence.avg != null) {
        riderCadenceAverage = info.stats.cadence.avg;
    }
    return "<span title='Current'" + riderCadenceColour + ">" + riderCadenceCurrent.toFixed(0) + keyC + "</span> / <span title='Average'" + riderCadenceColour + ">" + riderCadenceAverage.toFixed(0) + keyA + " rpm</span>";
}

export function getWBalHTML(rider) {
    let debug = false;

    if (rider.WBal != null || rider.wBal > 0 || rider.wBal < 0) {
//        console.log("rider.wBal", rider.wBal);
        let riderWBalColour=" style='color: Lime; background-color:transparent;'";
        let riderWBalValue = rider.wBal;
        let WBalMax = rider.athlete.wPrime;
//        console.log("WBalMax", WBalMax);
        let riderWBalPercent = ((riderWBalValue / WBalMax) *100);
            // Determine what WBal zone they are in
         if (riderWBalPercent > 80) { // 	Green
            riderWBalColour=" style='color: Lime; background-color:transparent;'";
        } else if (riderWBalPercent > 40 && riderWBalPercent <= 70) { // Yellow
            riderWBalColour=" style='color: Yellow; background-color:transparent;'";
        } else if (riderWBalPercent > 10 && riderWBalPercent <= 40) { // Orange
            riderWBalColour=" style='color: Orange; background-color:transparent;'";
        } else if (riderWBalPercent > 0 && riderWBalPercent <= 10) { // Red
            riderWBalColour=" style='color: Red; background-color:transparent;'";
        } else if (rider.wBal <= 0) {
            riderWBalColour=" style='color: white; background-color:red;'";
        }
        let innerHTML = "<span align='right'" + riderWBalColour + ">" + riderWBalPercent.toFixed(1) + "%</span>";
        return innerHTML;
    } else {
        let innerHTML = "<span align='right'></span>";
        return innerHTML;
    }
}

export function getHRHTML(rider) {
    let debug = false;
    let riderHrColour=" style='color: white; background-color:transparent;'";
    let riderHrTitle = "HeartRate";

    if (rider.state.heartrate != null) {
//        if (debug) console.log("rider-Name", rider.athlete.sanitizedFullname);
//        if (debug) console.log("rider-HR", rider.state.heartrate);
        if (rider.athlete.age != null) {
//                    console.log("rider-Age", rider.athlete.age);
            let riderMaxHr = 208 - (0.7 * rider.athlete.age);
//                    console.log("rider-MaxHr", riderMaxHr);
            let riderHr1Percent = riderMaxHr / 110;
//                    console.log("rider-Hr1Percent", riderHr1Percent);
            // Determine what HR zone they are in
            if (rider.state.heartrate > 0 && rider.state.heartrate <= (riderHr1Percent * 80)) { // Z1	Recovery		0 - 80%		0 - 121		Blue
                if (debug) console.log("rider-Z1	Recovery		0 - 80%		0 - 121		Blue");
                riderHrColour=" style='color: DeepSkyBlue; background-color:transparent;'";
                riderHrTitle = "Z1 HR - Recovery";
            } else if (rider.state.heartrate > (riderHr1Percent * 80) && rider.state.heartrate <= (riderHr1Percent * 89)) { // Z2	Aerobic			81% - 89%	122 - 134	Green
                if (debug) console.log("rider-Z2	Aerobic			81% - 89%	122 - 134	Green");
                riderHrColour=" style='color: Lime; background-color:transparent;'";
                riderHrTitle = "Z2 HR - Aerobic";
            } else if (rider.state.heartrate > (riderHr1Percent * 89) && rider.state.heartrate <= (riderHr1Percent * 93)) { // Z3	Tempo			89% - 93%	135 - 140	Yellow
                if (debug) console.log("rider-Z3	Tempo			89% - 93%	135 - 140	Yellow");
                riderHrColour=" style='color: Yellow; background-color:transparent;'";
                 riderHrTitle = "Z3 HR - Tempo";
            } else if (rider.state.heartrate > (riderHr1Percent * 93) && rider.state.heartrate <= (riderHr1Percent * 99)) { // Z4	SubThreshold		93% - 99%	141 - 150	Orange
                if (debug) console.log("rider-Z4	SubThreshold		93% - 99%	141 - 150	Orange");
                riderHrColour=" style='color: Orange; background-color:transparent;'";
                riderHrTitle = "Z4 HR - SubThreshold";
            } else if (rider.state.heartrate > (riderHr1Percent * 99) && rider.state.heartrate <= (riderHr1Percent * 102)) { // Z5	SuperThreshold		100% - 102%	151 - 154	Red
                if (debug) console.log("rider-Z5	SuperThreshold		100% - 102%	151 - 154	Red");
                riderHrColour=" style='color: Red; background-color:transparent;'";
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
    let innerHTML = "<span title='" + riderHrTitle + "' align='right'" + riderHrColour + ">" + rider.state.heartrate + "<abbr>bpm</abbr></span>";
    return innerHTML;
}

export function get5minPowerHTML(info) {
    let showWKGKey = common.settingsStore.get('showWKGKey');
    let key5 = "";
    if (showWKGKey) {
        key5 = "(5)";
    }
    let riderWkgValue = 0;
    let riderWkgColour = " style='color: white; background-color:transparent;'";
    let riderWkgTitle = "Peak 5 Minutes";
    if (info.stats.power.peaks[300].avg != null ) {
        riderWkgValue = info.stats.power.peaks[300].avg / info.athlete.weight;
        riderWkgColour = " style='color: lime; background-color:transparent;'";
    } else {
        riderWkgValue = info.stats.power.smooth[300] / info.athlete.weight;
        riderWkgColour = " style='color: yellow; background-color:transparent;'";
        riderWkgTitle = "Smooth 5 Minutes";
    }
    return "<span title='" + riderWkgTitle + "' " + riderWkgColour + ">" + riderWkgValue.toFixed(2) + key5 + "</span>";
}

export function get20minPowerHTML(info) {
    let showWKGKey = common.settingsStore.get('showWKGKey');
    let key20 = "";
    if (showWKGKey) {
        key20 = "(20)";
    }
    let riderWkgValue = 0;
    let riderWkgColour = " style='color: white; background-color:transparent;'";
    let riderWkgTitle = "Peak 20 Minutes";
    if (info.stats.power.peaks[1200].avg != null ) {
        riderWkgValue = info.stats.power.peaks[1200].avg / info.athlete.weight;
        riderWkgColour = " style='color: lime; background-color:transparent;'";
    } else {
        riderWkgValue = info.stats.power.smooth[1200] / info.athlete.weight;
        riderWkgColour = " style='color: yellow; background-color:transparent;'";
        riderWkgTitle = "Smooth 20 Minutes";
    }
    return "<span title='" + riderWkgTitle + "' " + riderWkgColour + ">" + riderWkgValue.toFixed(2) + key20 + "</span>";
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
