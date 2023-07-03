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
import * as CANNON from 'cannon-es';
import { Raycaster } from 'three';
import { Vector3 } from 'three';
import { PlaneBufferGeometry } from 'three';
import { Mesh } from 'three';
import { PlaneGeometry } from 'three';
import { Box3 } from 'three';
import  './modernizr';
import { Matrix4 } from 'three';
import { ShaderMaterial } from 'three';
import { UniformsUtils } from 'three';

import brickVert from './shader/brick.vert.glsl';
import brickFrag from './shader/brick.frag.glsl';
import floorVert from './shader/floor.vert.glsl';
import floorFrag from './shader/floor.frag.glsl';

// the target duration of one frame in milliseconds
const TARGET_FRAME_DURATION_MS = 16;

// total time
var time = 0; 

// duration betweent the previous and the current animation frame
var deltaTimeMS = 0; 

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
    mainLight,
    floorMesh,
    bricksGroup,
    controls, 
    raycaster,
    glbScene,
    bricksContainer,
    brickMeshes,
    boundingBox,
    brickMaterial,
    movementPlane,
    sceneBox,
    canvasRect;

var world, dragSpring, brickBodies, isDragging = false, jointBody, jointConstraint, pointerDownPos;


function init(canvas, onInit = null, isDev = false, pane = null) {
    _isDev = isDev;
    _pane = pane;

    const manager = new LoadingManager();

    const objLoader = new GLTFLoader(manager);
    objLoader.load((new URL('../assets/scene.glb', import.meta.url)).toString(), (gltf) => {
        glbScene = (gltf.scene)
    });

    manager.onLoad = () => {
        setupScene(canvas);

        if (onInit) onInit(this);
        
        renderer.setAnimationLoop((t) => run(t));

        resize();
    }
}

function setupScene(canvas) {
    floorMesh = glbScene.getObjectByName('floor');
    bricksGroup = glbScene.getObjectByName('bricks');

    floorMesh.geometry.computeBoundingBox();
    sceneBox = floorMesh.geometry.boundingBox.clone();
    sceneBox.max.y = 10;

    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
    camera.position.set(0, 8, 15);
    camera.lookAt(new Vector3());

    scene = new THREE.Scene();
    scene.add(glbScene);
    scene.background = 0xffffff;
    const light = new DirectionalLight();
    light.position.set(-10, 10, 0);
    light.intensity = 2;
    light.castShadow = true;
    light.shadow.mapSize.width = 1024; // default
    light.shadow.mapSize.height = 1024; // default
    light.shadow.camera.near = 0; // default
    light.shadow.type = THREE.PCFSoftShadowMap;
    light.shadow.blurSamples = 5;
    light.shadow.radius = 2;
    light.shadow.normalBias = - 0.15;
    fitShadowCameraToBox(light, sceneBox);

    light.shadow.camera.updateProjectionMatrix();
    mainLight = light;

    const helper = new THREE.CameraHelper( light.shadow.camera );
    //scene.add( helper );

    scene.add(light);

    renderer = new THREE.WebGLRenderer( { canvas, antialias: false } );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    document.body.appendChild( renderer.domElement );


    floorMesh.receiveShadow = true;
    bricksGroup.children.forEach(mesh => {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    })

    raycaster = new Raycaster();

    /*controls = new OrbitControls( camera, renderer.domElement );
    controls.enableDamping = true;
    controls.update();*/

    brickMaterial = new ShaderMaterial({
        uniforms: UniformsUtils.merge([
          {},
          THREE.UniformsLib.lights,
        ]),
        vertexShader: brickVert,
        fragmentShader: brickFrag,
        glslVersion: THREE.GLSL3,
        lights: true,
        dithering: true
      });
      brickMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = `
          #include <common>
          #include <shadowmap_pars_vertex>
          ${shader.vertexShader}
        `;
        shader.fragmentShader = `
          #include <common>
          #include <packing>
          #include <bsdfs>
          #include <lights_pars_begin>
          #include <lights_lambert_pars_fragment>
          #include <shadowmap_pars_fragment>
          #include <shadowmask_pars_fragment>
          #include <dithering_pars_fragment>
          ${shader.fragmentShader}
        `;
      };
    bricksGroup.children.forEach(mesh => mesh.material = brickMaterial)

    const floorMaterial = new ShaderMaterial({
        uniforms: UniformsUtils.merge([
          {},
          THREE.UniformsLib.lights,
        ]),
        vertexShader: floorVert,
        fragmentShader: floorFrag,
        glslVersion: THREE.GLSL3,
        lights: true,
        dithering: true
      });
      floorMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = `
          #include <common>
          #include <shadowmap_pars_vertex>
          ${shader.vertexShader}
        `;
        shader.fragmentShader = `
          #include <common>
          #include <packing>
          #include <bsdfs>
          #include <lights_pars_begin>
          #include <lights_lambert_pars_fragment>
          #include <shadowmap_pars_fragment>
          #include <shadowmask_pars_fragment>
          #include <dithering_pars_fragment>
          ${shader.fragmentShader}
        `;
      };
    floorMesh.material = floorMaterial;

    // Movement plane when dragging
    const planeGeometry = new PlaneGeometry(100, 100)
    movementPlane = new Mesh(planeGeometry, new MeshBasicMaterial());
    movementPlane.rotation.x = -Math.PI / 2;
    movementPlane.visible = false;
    scene.add(movementPlane)

    setupPhysicsScene();

    _isInitialized = true;
}

function fitShadowCameraToBox(light, box) {
    const direction = light.position.clone().normalize();
    const m = new Matrix4().lookAt(new Vector3(), direction, new Vector3(0, 1, 0));
    m.invert();
    const vertices = [];
    vertices[0] = box.min.clone().applyMatrix4(m);
    vertices[1] = (new Vector3(box.min.x, box.min.y, box.max.z)).applyMatrix4(m);
    vertices[2] = (new Vector3(box.min.x, box.max.y, box.min.z)).applyMatrix4(m);
    vertices[3] = (new Vector3(box.max.x, box.min.y, box.min.z)).applyMatrix4(m);
    vertices[4] = (new Vector3(box.max.x, box.max.y, box.min.z)).applyMatrix4(m);
    vertices[5] = box.max.clone().applyMatrix4(m);
    const camera = light.shadow.camera;
    camera.left = vertices.reduce((a, v) => v.x < a ? v.x : a, Number.MAX_VALUE); 
    camera.right = vertices.reduce((a, v) => v.x > a ? v.x : a, Number.MIN_VALUE);
    camera.bottom = vertices.reduce((a, v) => v.y < a ? v.y : a, Number.MAX_VALUE); 
    camera.top = vertices.reduce((a, v) => v.y > a ? v.y : a, Number.MIN_VALUE);
    const minZ = vertices.reduce((a, v) => v.z < a ? v.z : a, Number.MAX_VALUE);
    camera.near = light.position.length() + minZ; 
    camera.far = camera.near - minZ + vertices.reduce((a, v) => v.z > a ? v.z : a, Number.MIN_VALUE);
    console.log(camera);
}

function setupPhysicsScene() {
    world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.81, 0)
    });

    const bricks = bricksGroup;

    boundingBox = sceneBox;
    const boundingPlanes = new Array(6).fill(0).map(() => new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane()
    }));
    const bottomPlane = boundingPlanes[0];
    bottomPlane.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    bottomPlane.position.set(0, boundingBox.min.y, 0);
    const topPlane = boundingPlanes[1];
    topPlane.quaternion.setFromEuler(Math.PI / 2, 0, 0);
    topPlane.position.set(0, boundingBox.max.y, 0);
    const leftPlane = boundingPlanes[2];
    leftPlane.quaternion.setFromEuler(0, Math.PI / 2, 0);
    leftPlane.position.set(boundingBox.min.x, 0, 0);
    const rightPlane = boundingPlanes[3];
    rightPlane.quaternion.setFromEuler(0, -Math.PI / 2, 0);
    rightPlane.position.set(boundingBox.max.x, 0, 0);
    const backPlane = boundingPlanes[4];
    backPlane.position.set(0, 0, boundingBox.min.z);
    const frontPlane = boundingPlanes[5];
    frontPlane.quaternion.setFromEuler(Math.PI, 0, 0);
    frontPlane.position.set(0, 0, boundingBox.max.z);
    boundingPlanes.forEach(plane => world.addBody(plane));

    bricksContainer = bricks;
    brickMeshes = bricks.children;
    brickBodies = [];
    brickMeshes.forEach(mesh => {
        mesh.geometry.computeBoundingBox();
        const brickBoundingBox = mesh.geometry.boundingBox;
        const dim = brickBoundingBox.max.sub(brickBoundingBox.min);
        dim.multiplyScalar(0.49);

        const brickBody = new CANNON.Body({
            mass: 1,
            shape: new CANNON.Box(new CANNON.Vec3(dim.x, dim.y, dim.z)),
            angularDamping: .94,
            linearDamping: 0.1
        });
        brickBody.position.copy(mesh.position);
        brickBody.quaternion.copy(mesh.quaternion);
        world.addBody(brickBody);

        brickBodies.push(brickBody);
        mesh.userData = { body: brickBody };
    });

    // Max solver iterations: Use more for better force propagation, but keep in mind that it's not very computationally cheap!
    world.solver.iterations = 20

    // Tweak contact properties.
    // Contact stiffness - use to make softer/harder contacts
    world.defaultContactMaterial.contactEquationStiffness = 1e20

    // Stabilization time in number of timesteps
    world.defaultContactMaterial.contactEquationRelaxation = 3;

    world.defaultContactMaterial.restitution = 0.1;
    world.defaultContactMaterial.friction = 1;
    world.defaultContactMaterial.frictionEquationStiffness = 1e10;

    // Joint body, to later constraint the cube
    const jointShape = new CANNON.Particle(0.1)
    jointBody = new CANNON.Body({ mass: 0 })
    jointBody.addShape(jointShape)
    jointBody.collisionFilterGroup = 0
    jointBody.collisionFilterMask = 0
    world.addBody(jointBody)


    dragSpring = new CANNON.Spring(jointBody, null, {
        stiffness: 100,
        restLength: 0,
        damping: 8
    });

    // init events
    renderer.domElement.addEventListener(Modernizr.touchevents ? 'touchstart' : 'pointerdown', (e) => {
        if (e.touches && e.touches.length > 1) return;

        canvasRect = renderer.domElement.getBoundingClientRect();

        let clientX, clientY;
        if (Modernizr.touchevents) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        clientX -= canvasRect.left;
        clientY -= canvasRect.top;

        // Cast a ray from where the mouse is pointing and
        // see if we hit something
        const intersection = getIntersection(clientX, clientY, bricksContainer, camera);

        // Return if the cube wasn't hit
        if (!intersection) {
          return
        }

        pointerDownPos = new THREE.Vector2()
        pointerDownPos.x = (clientX / renderer.domElement.clientWidth) * 2 - 1
        pointerDownPos.y = -((clientY / renderer.domElement.clientHeight) * 2 - 1)

        // Move the movement plane on the z-plane of the hit
        moveMovementPlane(intersection.point, camera)

        // Create the constraint between the cube body and the joint body
        addJointConstraint(intersection.point, intersection.object.userData.body)

        // Set the flag to trigger pointermove on next frame so the
        // movementPlane has had time to move
        requestAnimationFrame(() => {
          isDragging = true
        });

        e.preventDefault();
    }, { passive: false });
    renderer.domElement.addEventListener('pointermove', (e) => {
        if (!isDragging) {
            return
        }

        let clientX = e.clientX - canvasRect.left;
        let clientY = e.clientY - canvasRect.top;

        // Project the mouse onto the movement plane
        const intersection = getIntersection(clientX, clientY, movementPlane, camera);

        if (intersection) {
            const pointerPos = new THREE.Vector2()
            pointerPos.x = (clientX / renderer.domElement.clientWidth) * 2 - 1
            pointerPos.y = -((clientY / renderer.domElement.clientHeight) * 2 - 1)

            // Move the cannon constraint on the contact point
            moveJoint(intersection.point, pointerPos)
        }
    });
    renderer.domElement.addEventListener('pointerup', (e) => {
        isDragging = false

        // Remove the mouse constraint from the world
        removeJointConstraint()
    });
    renderer.domElement.addEventListener('pointerout', (e) => {
        isDragging = false;
        removeJointConstraint();
    });
    renderer.domElement.addEventListener('pointercancel', (e) => {
        isDragging = false;
        removeJointConstraint();
    });
    renderer.domElement.addEventListener('pointerleave', (e) => {
        isDragging = false;
        removeJointConstraint();
    });
}

function run(t = 0) {
    deltaTimeMS = Math.min(TARGET_FRAME_DURATION_MS, t - time);
    time = t;
    deltaFrames = deltaTimeMS / TARGET_FRAME_DURATION_MS;
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

    world.step(TARGET_FRAME_DURATION_MS / 1000, deltaTimeMS / 500);

    if (isDragging && dragSpring.bodyB) {
        dragSpring.applyForce();
    }

    brickMeshes.forEach((mesh, ndx) => {
        const body = brickBodies[ndx];
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
    });
}

function render() {
    renderer.render( scene, camera );
}

// This function moves the virtual movement plane for the mouseJoint to move in
function moveMovementPlane(point, camera) {
    // Center at mouse position
    movementPlane.position.copy(point)

    // Make it face toward the camera
    movementPlane.quaternion.copy(camera.quaternion);
}

// Returns an hit point if there's a hit with the mesh,
// otherwise returns undefined
function getIntersection(clientX, clientY, mesh, camera) {
    // Get 3D point form the client x y
    const mouse = new THREE.Vector2()
    mouse.x = (clientX / renderer.domElement.clientWidth) * 2 - 1
    mouse.y = -((clientY / renderer.domElement.clientHeight) * 2 - 1)

    // Get the picking ray from the point
    raycaster.setFromCamera(mouse, camera)

    // Find out if there's a hit
    const hits = raycaster.intersectObject(mesh)

    // Return the closest hit or undefined
    return hits.length > 0 ? hits[0] : undefined
}

// Add a constraint between the cube and the jointBody
// in the initeraction position
function addJointConstraint(position, constrainedBody) {
    // Vector that goes from the body to the clicked point
    const vector = new CANNON.Vec3().copy(position).vsub(constrainedBody.position)

    // Apply anti-quaternion to vector to tranform it into the local body coordinate system
    const antiRotation = constrainedBody.quaternion.inverse()
    const pivot = antiRotation.vmult(vector) // pivot is not in local body coordinates

    // Move the cannon click marker body to the click position
    jointBody.position.copy(position)

    // Create a new constraint
    // The pivot for the jointBody is zero
    jointConstraint = new CANNON.PointToPointConstraint(constrainedBody, pivot, jointBody, new CANNON.Vec3(0, 0, 0))

    // Add the constraint to world
    world.addConstraint(jointConstraint)

    //dragSpring.bodyB = constrainedBody;
    dragSpring.localAnchorB = pivot;
}

// This functions moves the joint body to a new postion in space
// and updates the constraint
function moveJoint(position, pointerPos) {
    const pointerDelta = pointerPos.sub(pointerDownPos);
    const pY = pointerDelta.y * 2;
    const zOffset = pY * pY * pY;
    position.z -= zOffset;

    const bounds = boundingBox.clone();
    bounds.clampPoint(position, position);

    jointBody.position.copy(position)
    jointConstraint.update()
}

// Remove constraint from world
function removeJointConstraint() {
    world.removeConstraint(jointConstraint)
    jointConstraint = undefined
    dragSpring.bodyB = null;
}

export default {
    init,
    run,
    resize
}