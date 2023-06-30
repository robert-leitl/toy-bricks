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
    controls, 
    raycaster,
    glbScene,
    bricksContainer,
    brickMeshes,
    movementPlane;

var world, brickBodies, isDragging = false, jointBody, jointConstraint;


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
    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
    camera.position.set(0, 5, 20);
    camera.lookAt(new Vector3());

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

    raycaster = new Raycaster();

    /*controls = new OrbitControls( camera, renderer.domElement );
    controls.enableDamping = true;
    controls.update();*/

    // Movement plane when dragging
    const planeGeometry = new PlaneGeometry(100, 100)
    movementPlane = new Mesh(planeGeometry, new MeshBasicMaterial());
    movementPlane.rotation.x = -Math.PI / 2;
    movementPlane.visible = false;
    scene.add(movementPlane)

    setupPhysicsScene();

    _isInitialized = true;
}

function setupPhysicsScene() {
    world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.81, 0)
    });

    const bricks = glbScene.getObjectByName('bricks');
    const floorMesh = glbScene.getObjectByName('floor');
    const floorBoundingBox = floorMesh.geometry.boundingBox;

    const groundMaterial = new CANNON.Material('ground')
    const groundBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
        material: groundMaterial
    })
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0) // make it face up
    groundBody.position.set(floorMesh.position.x, floorMesh.position.y + floorBoundingBox.max.y, floorMesh.position.z);
    world.addBody(groundBody)

    bricksContainer = bricks;
    brickMeshes = bricks.children;
    brickBodies = [];
    brickMeshes.forEach(mesh => {
        console.log(mesh);
        mesh.geometry.computeBoundingBox();
        const brickBoundingBox = mesh.geometry.boundingBox;
        const dim = brickBoundingBox.max.sub(brickBoundingBox.min);
        dim.multiplyScalar(0.5);

        const brickBody = new CANNON.Body({
            mass: 1,
            shape: new CANNON.Box(new CANNON.Vec3(dim.x, dim.y, dim.z)),
            material: groundMaterial,
            angularDamping: .95,
            linearDamping: 0.2
        });
        brickBody.position.copy(mesh.position);
        brickBody.quaternion.copy(mesh.quaternion);
        world.addBody(brickBody);

        brickBodies.push(brickBody);
        mesh.userData = { body: brickBody };
    });

    // Adjust constraint equation parameters for ground/ground contact
    /*const ground_ground = new CANNON.ContactMaterial(groundMaterial, groundMaterial, {
        friction: 1.4,
        restitution: 0.1,
        contactEquationStiffness: 1e5,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e5,
        frictionEquationRegularizationTime: 1,
    });

    // Add contact material to the world
    world.addContactMaterial(ground_ground);*/

    // Max solver iterations: Use more for better force propagation, but keep in mind that it's not very computationally cheap!
    world.solver.iterations = 20

    // Tweak contact properties.
    // Contact stiffness - use to make softer/harder contacts
    world.defaultContactMaterial.contactEquationStiffness = 1e20

    // Stabilization time in number of timesteps
    world.defaultContactMaterial.contactEquationRelaxation = 3

    world.defaultContactMaterial.restitution = 0.1;

    // Joint body, to later constraint the cube
    const jointShape = new CANNON.Sphere(0.1)
    jointBody = new CANNON.Body({ mass: 0 })
    jointBody.addShape(jointShape)
    jointBody.collisionFilterGroup = 0
    jointBody.collisionFilterMask = 0
    world.addBody(jointBody)

    // init events
    window.addEventListener('pointerdown', (e) => {
        // Cast a ray from where the mouse is pointing and
        // see if we hit something
        const intersection = getIntersection(e.clientX, e.clientY, bricksContainer, camera);

        console.log(intersection);

        // Return if the cube wasn't hit
        if (!intersection) {
          return
        }

        // Move the movement plane on the z-plane of the hit
        moveMovementPlane(intersection.point, camera)

        // Create the constraint between the cube body and the joint body
        addJointConstraint(intersection.point, intersection.object.userData.body)

        // Set the flag to trigger pointermove on next frame so the
        // movementPlane has had time to move
        requestAnimationFrame(() => {
          isDragging = true
        })
    });
    window.addEventListener('pointermove', (e) => {
        if (!isDragging) {
            return
          }
  
          // Project the mouse onto the movement plane
          const intersection = getIntersection(e.clientX, e.clientY, movementPlane, camera);
  
          if (intersection) {
            // Move the cannon constraint on the contact point
            moveJoint(intersection.point)
          }
    });
    window.addEventListener('pointerup', (e) => {
        isDragging = false

        // Remove the mouse constraint from the world
        removeJointConstraint()
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
    movementPlane.rotation.x = -Math.PI / 4;
}

// Returns an hit point if there's a hit with the mesh,
// otherwise returns undefined
function getIntersection(clientX, clientY, mesh, camera) {
    // Get 3D point form the client x y
    const mouse = new THREE.Vector2()
    mouse.x = (clientX / window.innerWidth) * 2 - 1
    mouse.y = -((clientY / window.innerHeight) * 2 - 1)

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
}

// This functions moves the joint body to a new postion in space
// and updates the constraint
function moveJoint(position) {
    jointBody.position.copy(position)
    jointConstraint.update()
}

// Remove constraint from world
function removeJointConstraint() {
    world.removeConstraint(jointConstraint)
    jointConstraint = undefined
}

export default {
    init,
    run,
    resize
}