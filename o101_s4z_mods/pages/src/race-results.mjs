import * as common from '/pages/src/common.mjs';

common.settingsStore.setDefault({
    panelColor: 'zwift-blue'
});

export async function main() {
    common.initInteractionListeners();
    common.settingsStore.addEventListener('changed', render);
    //common.subscribe('watching-athlete-change', getInfo);

    render();
}

function render() {
    let div = document.querySelector('#emptyPanel');

    if (div == null) return;

    div.className = common.settingsStore.get('panelColor');
}

// function getInfo(info) {

//     console.log(info);
// }