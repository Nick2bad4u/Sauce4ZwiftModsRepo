import * as common from '/pages/src/common.mjs';

export async function main(fieldsKey) {
    common.initInteractionListeners();
    let fieldStates = common.storage.get(fieldsKey);
    const form = document.querySelector('form#fields');
    form.addEventListener('input', ev => {
        fieldStates[ev.target.name] = ev.target.checked;
        common.storage.set(fieldsKey, fieldStates);
    });
    await common.initSettingsForm('form#options')();
}