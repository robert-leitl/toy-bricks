import { debounceTime, fromEvent, take } from 'rxjs';
import { Pane } from 'tweakpane';
import sketch from './sketch';
import Stats from 'three/examples/jsm/libs/stats.module.js';

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const hasDebugParam = urlParams.get('debug');
const isDev = import.meta.env.MODE === 'development';
let pane;

if (isDev) {
    import('https://greggman.github.io/webgl-lint/webgl-lint.js');
}

if (hasDebugParam || isDev) {
    pane = new Pane({ title: 'Settings', expanded: isDev });
}

const stats = new Stats();
if (isDev) {
  stats.showPanel(0);
  document.body.appendChild(stats.dom);
  const updateStats = () => {
    stats.update();
    requestAnimationFrame(updateStats);
  };
  updateStats();
}

const resize = () => {
    // explicitly set the width and height to compensate for missing dvh and dvw support
    document.body.style.width = `${document.documentElement.clientWidth}px`;
    document.body.style.height = `${document.documentElement.clientHeight}px`;

    sketch.resize();
}

// add a debounced resize listener
fromEvent(window, 'resize').pipe(debounceTime(100)).subscribe(() => resize());

// resize initially on load
fromEvent(window, 'load').pipe(take(1)).subscribe(() => resize());

// init
const canvasElm = document.body.querySelector('canvas');
sketch.init(canvasElm, (instance) => instance.run(), isDev, pane);