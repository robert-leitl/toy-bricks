// https://github.com/Unity-Technologies/UnityCsReference/blob/master/Runtime/Export/Math/Mathf.cs

export const PI_2 = Math.PI * 2;

/**
 * Clamps a value between a minimum float and maximum float value.
 * 
 * @param {number} num The value to clamp
 * @param {number} min The minium value
 * @param {number} max The maxium value
 * @returns The clamped value
 */
export function clamp(num, min, max) { return Math.min(Math.max(num, min), max) }

/**
 * Loops the value t, so that it is never larger than length and never smaller than 0.
 * 
 * @param {number} t The value to loop
 * @param {number} length The length of the loop
 * @returns The looped value
 */
export function repeat(t, length) {
    return clamp(t - Math.floor(t / length) * length, 0.0, length);
}

/**
 * Calculates the shortest difference between two given angles in degrees.
 * 
 * @param {number} from The start angle in degrees
 * @param {number} to The end angle in degrees
 * @returns The minimal delta angle in degrees
 */
export function deltaAngleDeg(from, to) {
    let delta = repeat((to - from), 360.0);
    if (delta > 180.0)
        delta -= 360.0;
    return delta;
}

/**
 * Calculates the shortest difference between two given angles.
 * 
 * @param {number} from The start angle
 * @param {number} to The end angle
 * @returns The minimal delta angle
 */
export function deltaAngle(from, to) {
    let delta = repeat((to - from), PI_2);
    if (delta > Math.PI)
        delta -= PI_2;
    return delta;
}