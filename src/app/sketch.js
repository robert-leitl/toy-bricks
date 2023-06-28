import * as THREE from 'three';
import { OrbitControls } from '../libs/OrbitControls';
import { resizeRendererToDisplaySize } from '../libs/three-utils';
import { Vector2 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LoadingManager } from 'three';
import { DirectionalLight } from 'three';
import { AmbientLight } from 'three';
import { MeshBasicMaterial } from 'three';
import { MeshStandardMaterial } from 'three';
import { PointLight } from 'three';
import { MeshLambertMaterial } from 'three';

// the target duration of one frame in milliseconds
const TARGET_FRAME_DURATION = 16;

// total time
var time = 0; 

// duration betweent the previous and the current animation frame
var deltaTime = 0; 

// total framecount according to the target frame duration
var frames = 0; 

// relative frames according to the target frame duration (1 = 60 fps)
// gets smaller with higher framerates --> use to adapt animation timing
var deltaFrames = 0;

const settings = {
}

// module variables
var _isDev, 
    _pane, 
    _isInitialized = false,
    camera, 
    scene, 
    renderer, 
    controls, 
    glbScene;


function init(canvas, onInit = null, isDev = false, pane = null) {
    _isDev = isDev;
    _pane = pane;

    const manager = new LoadingManager();

    const objLoader = new GLTFLoader(manager);
    objLoader.load((new URL('../assets/scene.glb', import.meta.url)).toString(), (gltf) => {
        glbScene = (gltf.scene)
    });

    manager.onLoad = () => {
        camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
        camera.position.set(0, 5, 20);
        scene = new THREE.Scene();
        scene.add(glbScene);
        const light = new DirectionalLight();
        light.position.set(0, 1, 1);
        light.intensity = 0.5;
        const ambient = new AmbientLight(0x666666);
        const pointLight = new PointLight();
        pointLight.position.set(-1, 10, 10);
        pointLight.intensity = 2;
        scene.add(light);
        scene.add(ambient);
        scene.add(pointLight);
        scene.overrideMaterial = new MeshLambertMaterial({color: 0x555555});
        renderer = new THREE.WebGLRenderer( { canvas, antialias: false } );
        document.body.appendChild( renderer.domElement );
    
        controls = new OrbitControls( camera, renderer.domElement );
        controls.enableDamping = true;
        controls.update();
    
        _isInitialized = true;
        if (onInit) onInit(this);
        
        renderer.setAnimationLoop((t) => run(t));

        resize();
    }
}

function run(t = 0) {
    deltaTime = Math.min(TARGET_FRAME_DURATION, t - time);
    time = t;
    deltaFrames = deltaTime / TARGET_FRAME_DURATION;
    frames += deltaFrames;

    animate();
    render();
}

function resize() {
    if (!_isInitialized) return;
    
    if (resizeRendererToDisplaySize(renderer)) {
        const size = new Vector2(renderer.domElement.clientWidth, renderer.domElement.clientHeight);
        camera.aspect = size.x / size.y;
        camera.updateProjectionMatrix();
    }
}

function animate() {
    if (controls) controls.update();
}

function render() {
    renderer.render( scene, camera );
}

export default {
    init,
    run,
    resize
}