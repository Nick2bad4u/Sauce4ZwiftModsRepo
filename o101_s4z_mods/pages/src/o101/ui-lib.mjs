export function createInfoSection(id, dataFieldIdPrefix, dataFields) {
    const infoGroup = createDiv(['info-group']);

    for(const datafield of dataFields) {
        let dataItem = createDivWithId(dataFieldIdPrefix+datafield, ['info-item']);

        dataItem.appendChild(createDivWithId(dataFieldIdPrefix+datafield+'-label',['info-item-label'], convertIdToLabel(datafield)));
        dataItem.appendChild(createDivWithId(dataFieldIdPrefix+datafield+'-value', ['info-item-value'], ''));

        infoGroup.appendChild(dataItem);
    }

    setInfoSection(id, infoGroup);
}

export function setInfoSection(id, infoGroup, csss = ['info-wrapper']) {
    const div = document.querySelector(id);

    if (infoGroup == null) {
        div.innerHTML = '';
        return;
    }

    const tempDiv = createDiv();
    const infoWrapperDiv = createDiv(csss);

    infoWrapperDiv.appendChild(infoGroup);
    tempDiv.appendChild(infoWrapperDiv);
    
    div.innerHTML = tempDiv.innerHTML;
}

export function addInfoItemDivider(ids) {
    for (const id of ids) {
        const elementAfterDivider = document.querySelector('#' + id);
        if (elementAfterDivider == null) continue;

        const parent = elementAfterDivider.parentNode;
        const divider = createDivWithId(id+'-divider', ['info-item-divider'], '&nbsp;');
        
        parent.insertBefore(divider, elementAfterDivider);
    }

}

export function setValue(id, value) {
    const element = document.querySelector(id);

    if (element == null) return;

    element.innerHTML = value;
}

export function createDivWithId(id, csss, value) {
    let element = document.createElement('div');

    if (id != null && id != '') {
        element.id = id.replace(' ', '-').toLowerCase();
    }

    if (csss != null && csss.length>0){
        for(const css of csss) {
            if (css != '') element.classList.add(css);
        }
    }

    if (value != null){
        element.innerHTML = value;
    }
    
    return element;
}

export function createDivWithSpan(csss, value) {
    const div = createDiv(csss, value);

    div.innerHTML = '<span>' + value + '</span>';

    return div;
}

export function createDiv(csss, value) {
    return createDivWithId(null, csss, value);
}

export function toggleClassByElements(toggle, clss, elements) {
    for (let i = 0; i < elements.length; i++) {
        let el = document.querySelector(elements[i]);
        
        if (toggle) {
            el.classList.add(clss);
        } else {
            el.classList.remove(clss);
        }
    }
}

export function convertToHeader(ids) {
    toggleClassByElements(true, 'header', ids);
}

export function convertToSubHeader(ids) {
    toggleClassByElements(true, 'subheader', ids);
    toggleClassByElements(true, 'divider', ids);
}

export function toggleElementClass(el, cls, force) {
    const has = el.classList.contains(cls);
    if (has && !force) {
        el.classList.remove(cls);
    } else if (!has && force) {
        el.classList.add(cls);
    }
}

export function getWkgColorCss(wkg) {
    const n = wkg.replace(',', '.')

    if (n>=11) {
        return 'purple';
    } else if (n>=8) {
        return 'red';
    } else if (n>=5) {
        return 'orange';
    }
    
    return '';
}

export function scrollIntoView(className) {
    const elements = document.getElementsByClassName(className);

    if (elements.length < 1) return;

    elements[0].scrollIntoView({
        behavior: 'auto',
        block: 'center',
        inline: 'center'
    });
}

function convertIdToLabel(id) {
    let idAsLabel = id.split('-').join(' ');
    
    return idAsLabel.charAt(0).toUpperCase() + idAsLabel.slice(1);
}
