import * as common from '/pages/src/common.mjs';

export function create(params) {
    // TODO: add factor by gradient
    if (params.speed <= 0) return '';

    if (params.dataStore == null) {
        params.dataStore = {
            defaultInterval: 1500,
            buffer: {
                datapoints: [],
                avg: 0,
                maxInterval: 0,
                refreshDate: Date.now(),
            },
            datapoints: []
        };
    }

    const eta = getEta(params);
    const percentageComplete = Math.round(100 - (params.distanceToGo / params.distance) * 100);
    const applyEtaActualFactor = (eta, actualFactor = 0) => { return (eta.average + eta.actual*actualFactor) / (actualFactor+1); }

    // use actualfactor profile
    // for long segments, actual value should kick in later
    // and use avg less factor at the end
    if (percentageComplete < 30) {
        return eta.average;
    } else if (percentageComplete < 50) {
        return applyEtaActualFactor(eta, 1);
    } else if (percentageComplete < 70) {
        return applyEtaActualFactor(eta, 3);
    } else if (percentageComplete < 80) {
        return applyEtaActualFactor(eta, 4);
    } else if (percentageComplete < 90) {
        return applyEtaActualFactor(eta, 5);
    } else if (percentageComplete < 95) {
        return applyEtaActualFactor(eta, 8);
    } else {
        return applyEtaActualFactor(eta, 16);
    }
}

function getEta(params) {
    const buffer = params.dataStore.buffer;
    const datapoints = params.dataStore.datapoints;
   
    buffer.datapoints.push({
        eta: params.distanceToGo / (params.speed / 3.6) + params.elapsedTime
    });

    const actualEta = buffer.datapoints.reduce((total, next) => total + next.eta, 0) / buffer.datapoints.length

    if (datapoints.length == 0 || (Date.now() - buffer.refreshDate) >= buffer.maxInterval) {
        buffer.datapoints = [];
        buffer.refreshDate = Date.now();
        buffer.maxInterval = getBufferInterval(params.dataStore, params.startTime);

        datapoints.push({
            interval: buffer.maxInterval,
            eta: actualEta
        });

        compressDatapoints(params.dataStore, buffer.maxInterval);
        //common.storage.set(params.storageKey, params.overviewData);
    }

    const averageEta = datapoints.reduce((total, next) => total + next.eta, 0) / datapoints.length;
    
    return {
        actual: actualEta,
        average: averageEta
    };
}

function getBufferInterval(dataStore, startTime) {
    const elapsedTime = (startTime - Date.now()) / 1000;

    if (elapsedTime > 600) return 48000;
    else if (elapsedTime > 300) return 24000;
    else if (elapsedTime > 120) return 12000;
    else if (elapsedTime > 60) return 6000;
    else if (elapsedTime > 30) return 3000;

    return dataStore.defaultInterval;
}

function compressDatapoints(dataStore, maxInterval) {
    const datapoints = dataStore.datapoints;
    const datapointsToCompress = datapoints.filter(d => d.interval == (maxInterval/2))
    const dataLength = datapointsToCompress.length;

    if (dataLength > 1) {
        const compressedDatapoints = [];
        
        for (var i=0; i<dataLength; i++) {
            if (i+1<dataLength) {
                compressedDatapoints.push({
                    interval: maxInterval,
                    eta: (datapointsToCompress[i].eta + datapointsToCompress[i+1].eta) / 2
                });
            }
            i++;       
        }

        dataStore.datapoints = compressedDatapoints;
    }
}