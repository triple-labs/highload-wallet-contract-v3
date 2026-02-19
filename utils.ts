export const getRandom = (min: number, max: number) => {
    return Math.random() * (max - min) + min;
}

export const getRandomInt = (min: number, max: number) => {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new TypeError('getRandomInt: min and max must be finite numbers');
    }
    if (min > max) {
        throw new RangeError('getRandomInt: min must be less than or equal to max');
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const sleep = (ms: number) => {
    const safeMs = Number.isFinite(ms) && ms >= 0 ? ms : 0;
    return new Promise(resolve => setTimeout(resolve, safeMs));
}
