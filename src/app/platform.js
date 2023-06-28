/**
 * Check for an iPhone device.
 *
 * @returns boolean true if the device is an iPhone
 */
export const iphone = () => {
    if (typeof window === `undefined` || typeof navigator === `undefined`) return false;
    return /iPhone/i.test(navigator.userAgent || navigator.vendor || (window.opera && opera.toString() === `[object Opera]`));
};

export const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|BB|PlayBook|IEMobile|Windows Phone|Kindle|Silk|Opera Mini/i.test(navigator.userAgent);
