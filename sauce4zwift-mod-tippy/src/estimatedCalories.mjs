// estimatedCalories.mjs
// Show estimated calories burned at finish

function getCurrentPower() {
    // Placeholder: Replace with actual data source
    return 200; // watts
}

function getElapsedSeconds() {
    // Placeholder: Replace with actual data source
    return 3600; // seconds
}
}

function getEstimatedTotalSeconds() {
    // Placeholder: Replace with actual data source
    return 5400; // seconds
}

function calculateCalories(power, seconds) {
    // 1 watt = 3.6 kJ/hour, 1 kcal = 4.184 kJ
    // Calories = (power * seconds / 1000) / 4.184
    return Math.round((power * seconds / 1000) / 4.184);
}

export function main() {
    const currentPower = getCurrentPower();
    const elapsed = getElapsedSeconds();
    const total = getEstimatedTotalSeconds();
    const currentCalories = calculateCalories(currentPower, elapsed);
    const estimatedCalories = calculateCalories(currentPower, total);
    document.querySelector('[name="currentCalories"]').textContent = currentCalories + ' kcal';
    document.querySelector('[name="estimatedCalories"]').textContent = estimatedCalories + ' kcal';
}
