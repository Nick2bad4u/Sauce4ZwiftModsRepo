import * as o101UiLib from './ui-lib.mjs';

Array.prototype.first = function() {
    return this.length>0 ? this[0] : null;
}

Array.prototype.optionalFilter = function(condition, filter) {
    if (!condition) return this;

    return this.filter(filter);
}

Array.prototype.toListWithWatchingCentered = function(watchingPredicate, nearby) {
    const watchingIdx = this.findIndex(watchingPredicate);
    const max = 2*nearby+1;
    let startIdx = (watchingIdx-nearby < 0) ? 0: watchingIdx-nearby;
    var newList = [];

    if (this.length-watchingIdx < nearby) {
        startIdx -= this.length-watchingIdx;
        if (startIdx<0) startIdx = 0;
    }

    for (let i=startIdx; i<=watchingIdx; i++) {
        newList.push(this[i]);
    }
    for (let i=(watchingIdx+1); i<this.length && newList.length<max; i++) {
        newList.push(this[i]);
    }
    
    return newList;
}

Array.prototype.sortAndFixEventPosition = function() {
    const sortedList = this.sort(function(a, b) { return a.eventPosition - b.eventPosition; });
    const noFixNeeded = sortedList.filter(x => x.eventPosition == null && x.state.eventSubgroupId>0).length==0;

    if (noFixNeeded) return sortedList;

    let eventParticipants = 0;
    let eventPosition = 0;
    let useNewEventPosition = false;
    let fixedList = [];

    for(let rider of sortedList) {
        if (rider.eventPosition == null) useNewEventPosition = true;

        if (useNewEventPosition) {
            rider.eventPosition = ++eventPosition;
            rider.eventParticipants = eventParticipants;
            fixedList.push(rider);
            continue;
        }

        if (rider.eventPosition != null && rider.eventPosition>0) eventPosition = rider.eventPosition;
        if (rider.eventParticipants != null && rider.eventParticipants>0 && rider.eventParticipants>eventParticipants) eventParticipants = rider.eventParticipants;
        
        fixedList.push(rider);
    }

    return fixedList;
}

Array.prototype.sortAndFixEventPositionRiders = function(myCategoryOnly, resetPositions) {
    if (!myCategoryOnly || !resetPositions) return this;
    //todo refactor to use other

    const sortedList = this.sort(function(a, b) { return a.position - b.position; });
    const noFixNeeded = sortedList.filter(x => x.position == null && x.eventSubgroupId>0).length==0;

    if (noFixNeeded && !resetPositions) return sortedList;

    let eventParticipants = 0;
    let eventPosition = 0;
    let useNewEventPosition = resetPositions;
    let fixedList = [];

    for(let rider of sortedList) {
        if (rider.eventPosition == null) useNewEventPosition = true;

        if (useNewEventPosition) {
            rider.eventPosition = ++eventPosition;
            rider.eventParticipants = eventParticipants;
            fixedList.push(rider);
            continue;
        }

        if (rider.eventPosition != null && rider.eventPosition>0) eventPosition = rider.eventPosition;
        if (rider.eventParticipants != null && rider.eventParticipants>0 && rider.eventParticipants>eventParticipants) eventParticipants = rider.eventParticipants;
        
        fixedList.push(rider);
    }

    return fixedList;
}

HTMLElement.prototype.withWkgColor = function (wkg) {
    const wkgClass = o101UiLib.getWkgColorCss(wkg);

    if (wkgClass == '') {
        this.removeCsss(['orange', 'red', 'purple']);

        return this;
    }
    
    this.addCsss([wkgClass]);

    return this;
};

HTMLElement.prototype.withChildDiv = function (csss, value, id = null, title = null) {
    let div = document.createElement('div');

    if (id != null && id != '') {
        div.id = id;
    }
    if (title != null && title != '') {
        div.title = title;
    }

    div.addCsss(csss);
    div.innerHTML = value;

    this.appendChild(div);

    return this;
};

HTMLElement.prototype.withChildDivWithDataAttribute = function (csss, value, dataName, dataValue) {
    let div = document.createElement('div');

    div.addCsss(csss);
    div.innerHTML = value;
    div.setAttribute('data-' + dataName, dataValue);

    this.appendChild(div);

    return this;
};

HTMLElement.prototype.withOptionalChildDiv = function (expr, csss, value, title = null) {
    if (!expr) return this;

    return this.withChildDiv(csss, value, null, title);
};

HTMLElement.prototype.withCssClass = function (csss) {
    this.addCsss(csss);
    
    return this;
};

HTMLElement.prototype.withOptionalCssClass = function (expr, csss, powerUp = null) {
    if (!expr) return this;

    if (powerUp != null && powerUp.image != '') {
        this.style.setProperty('--timeRemaining', powerUp.remaining);
        this.style.setProperty('--timeToGo', powerUp.togo);    
    }

    return this.withCssClass(csss);
};

HTMLElement.prototype.addCsss = function (csss) {
    if (csss != null && csss.length>0){
        for(const css of csss) {
            if (css != '') this.classList.add(css);
        }
    }
}

HTMLElement.prototype.removeCsss = function (csss) {
    if (csss != null && csss.length>0){
        for(const css of csss) {
            if (css != '' && this.classList.contains(css)) this.classList.remove(css);
        }
    }
}

HTMLElement.prototype.withAttribute = function (id, value) {
    if (value == null && value == '') return;

    this.setAttribute(id, value);

    return this;
}

HTMLElement.prototype.withOptionalAttribute = function (expr, id, value) {
    if (!expr) return this;

    return this.withAttribute(id, value);
}

Date.prototype.addHours = function(h) {
    this.setTime(this.getTime() + (h*60*60*1000));
    return this;
}
Date.prototype.addMinutes = function(m) {
    this.setTime(this.getTime() + (m*60*1000));
    return this;
}
Date.prototype.addSeconds = function(s) {
    this.setTime(this.getTime() + (s*1000));
    return this;
}