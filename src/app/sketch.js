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
import { WebGLMultipleRenderTargets } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

import mrtBrickFrag from './shader/mrt-brick.frag.glsl';
import mrtBrickVert from './shader/mrt-brick.vert.glsl';
import mrtFloorVert from './shader/mrt-floor.vert.glsl';
import mrtFloorFrag from './shader/mrt-floor.frag.glsl';
import quadVert from './shader/quad.vert.glsl';
import sssDilationFrag from './shader/sss-dilation.frag.glsl';
import sssBlurFrag from './shader/sss-blur.frag.glsl';
import compositeFrag from './shader/composite.frag.glsl';

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
    enableSSAO: true,
    enableSSS: true
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
    mrtFloorMaterial,
    movementPlane,
    sceneBox,
    viewportSize,
    canvasRect;

var mrtBrickMaterial, mrtTarget, quadMesh, sssDilationMaterial, sssDilationRT, sssBlurRTHorizonal, sssBlurRTVertical, blurSize, compositeMaterial, sssBlurMaterial, composer, ssaoPass;

var world, dragSpring, brickBodies, isDragging = false, jointBody, jointConstraint, pointerDownPos;

const overrideMaterial = new MeshBasicMaterial();

const blurScale = .5;
const ssaoScale = .25;

const albedoColors = [
    //new Vector3(0.8, 0.18, .18),
    new Vector3(0.15, 0.58, .88),
    new Vector3(0.15, 0.38, .98),
    new Vector3(0.3, 0.7, .2),
]

function init(canvas, onInit = null, isDev = false, pane = null) {
    _isDev = isDev;
    _pane = pane;

    if (pane) {
        pane.addInput(settings, 'enableSSS', { label: 'SSS' });
        pane.addInput(settings, 'enableSSAO', { label: 'SSAO' });
    }


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
    //sceneBox.min.multiplyScalar(0.7);
    //sceneBox.min.z *= 0.3;
    //sceneBox.max.multiplyScalar(0.7);

    floorMesh.scale.set(10, 1, 10);

    camera = new THREE.PerspectiveCamera( 20, window.innerWidth / window.innerHeight, 6, 96 );
    //camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 5, 20);
    camera.position.set(0, 19, 25);
    camera.lookAt(new Vector3());
    const nearPoint = (new Vector3(0, sceneBox.max.y, sceneBox.max.z)).applyMatrix4(camera.matrixWorldInverse);
    const farPoint = (new Vector3(0, sceneBox.min.y, sceneBox.min.z)).applyMatrix4(camera.matrixWorldInverse);
    camera.near = nearPoint.length();
    camera.far = farPoint.length();
    

    scene = new THREE.Scene();
    scene.add(glbScene);
    const light = new DirectionalLight();
    light.position.set(-10, 10, 0);
    light.intensity = 2;
    light.castShadow = true;
    light.shadow.mapSize.width = 2048; // default
    light.shadow.mapSize.height = 2048; // default
    light.shadow.camera.near = 0; // default
    light.shadow.type = THREE.PCFShadowMap;
    light.shadow.blurSamples = 3;
    light.shadow.radius = 4;
    light.shadow.normalBias = -0.05;
    fitShadowCameraToBox(light, sceneBox);

    light.shadow.camera.updateProjectionMatrix();
    mainLight = light;
    mainLight.layers.enable(5);

    const helper = new THREE.CameraHelper( light.shadow.camera );
    //scene.add( helper );

    scene.add(light);

    renderer = new THREE.WebGLRenderer( { canvas, antialias: true } );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.sortObjects = false;
    renderer.setClearAlpha(1.);
    document.body.appendChild( renderer.domElement );
    viewportSize = new Vector2(renderer.domElement.clientWidth, renderer.domElement.clientHeight);


    floorMesh.receiveShadow = true;
    bricksGroup.children.forEach(mesh => {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    })

    raycaster = new Raycaster();

    // Movement plane when dragging
    const planeGeometry = new PlaneGeometry(100, 100)
    movementPlane = new Mesh(planeGeometry, new MeshBasicMaterial());
    movementPlane.rotation.x = -Math.PI / 2;
    movementPlane.visible = false;
    scene.add(movementPlane);


    ////////// 

    mrtTarget = new WebGLMultipleRenderTargets(
        viewportSize.x,
        viewportSize.y,
        4,
        {
            samples: 4
        }
    );
    mrtTarget.texture[0].name = 'RGB_diffuse_A_id';
	mrtTarget.texture[1].name = 'normalized_linear_depth';
    mrtTarget.texture[1].type = THREE.FloatType;
    mrtTarget.texture[1].format = THREE.RedFormat;
    mrtTarget.texture[1].internalFormat = 'R32F';
	mrtTarget.texture[2].name = 'XYZ_normal_W_specular';
    mrtTarget.texture[2].type = THREE.FloatType;
    mrtTarget.texture[3].name = 'albedo';

    blurSize = viewportSize.clone().multiplyScalar(blurScale);
    sssBlurRTHorizonal = new THREE.WebGLRenderTarget( blurSize.x, blurSize.y, { });
    sssBlurRTVertical = new THREE.WebGLRenderTarget( blurSize.x, blurSize.y, { });

    //////////

    sssBlurMaterial = new ShaderMaterial({
        uniforms: UniformsUtils.merge([
        {
            tDiffuse_Id: { value: mrtTarget.texture[ 0 ] },
            tDepth: { value: mrtTarget.texture[ 1 ] },
            tNormal_Specular: { value: mrtTarget.texture[ 2 ] },
            resolution: { value: new Vector2() },
            uDirection: { value: 0 },
            uFBOScale: { value: blurScale }
        },
        THREE.UniformsLib.lights,
        ]),
        vertexShader: quadVert,
        fragmentShader: sssBlurFrag,
        glslVersion: THREE.GLSL3,
    });

    sssDilationMaterial = new ShaderMaterial({
        uniforms: 
        {
            tDiffuse_Id: { value: mrtTarget.texture[ 0 ] },
            resolution: { value: new Vector2() },
            uDirection: { value: 0 }
        },
        vertexShader: quadVert,
        fragmentShader: sssDilationFrag,
        glslVersion: THREE.GLSL3,
    });

    mrtFloorMaterial = new ShaderMaterial({
        uniforms: UniformsUtils.merge([
          {
          },
          THREE.UniformsLib.lights,
        ]),
        vertexShader: mrtFloorVert,
        fragmentShader: mrtFloorFrag,
        glslVersion: THREE.GLSL3,
        lights: true,
        dithering: true
      });
    mrtFloorMaterial.onBeforeCompile = (shader) => {
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

    mrtBrickMaterial = new ShaderMaterial({
        uniforms: UniformsUtils.merge([
          {
            uAlbedo: { value: new Vector3(0.15, 0.35, .9) },
            uId: { value: 1 }
          },
          THREE.UniformsLib.lights,
        ]),
        vertexShader: mrtBrickVert,
        fragmentShader: mrtBrickFrag,
        glslVersion: THREE.GLSL3,
        lights: true,
        dithering: true,
    });
    mrtBrickMaterial.onBeforeCompile = (shader) => {
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
    mrtBrickMaterial.onBeforeRender = (renderer, scene, camera, geometry, object, group) => {
        renderer.setRenderTarget(mrtTarget);
        mrtBrickMaterial.uniforms.uAlbedo.value = (albedoColors[object.userData.ndx % albedoColors.length]);
        mrtBrickMaterial.uniforms.uId.value = object.userData.ndx + 1;
        mrtBrickMaterial.uniformsNeedUpate = true;
    }

    compositeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tDiffuse_Id: { value: null },
            tAlbedo: { value: null },
            tNormal_Specular: { value: null },
            tSSS: { value: null },
            tSSAO: { value: null }
        },
        vertexShader: quadVert,
        fragmentShader: compositeFrag,
        glslVersion: THREE.GLSL3,
        dithering: true
    });
    compositeMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = `
            #include <common>
            ${shader.vertexShader}
        `;
        shader.fragmentShader = `
            #include <common>
            #include <dithering_pars_fragment>
            ${shader.fragmentShader}
        `;
        };



    const quadGeo = new THREE.BufferGeometry();
    quadGeo.setAttribute( 'position', new THREE.Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );
    quadGeo.setAttribute( 'uv', new THREE.Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );
    quadMesh = new Mesh(quadGeo, sssBlurMaterial);
    
    floorMesh.material = mrtFloorMaterial;

    bricksGroup.children.forEach((mesh, ndx) => {
        mesh.userData = { ...mesh.userData, ndx }
        mesh.material = mrtBrickMaterial;
        mesh.layers.enable(5);
    });
    bricksGroup.layers.enable(5);


    /////// Effect Composer

    composer = new EffectComposer( renderer );
    composer.renderToScreen = false;

    ssaoPass = new SSAOPass( scene, camera, viewportSize.x, viewportSize.y );
    ssaoPass.kernelRadius = 6;
    ssaoPass.kernelRadius = 0.25;
    ssaoPass.minDistance = 0.005;
    ssaoPass.maxDistance = 0.02;
    composer.addPass( ssaoPass );

    setupPhysicsScene();

    _isInitialized = true;
}

function fitShadowCameraToBox(light, box) {
    const direction = light.position.clone().normalize();
    const m = new Matrix4().lookAt(direction, new Vector3(), new Vector3(0, 1, 0));
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
}

function setupPhysicsScene() {
    world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.81, 0)
    });

    const bricks = bricksGroup;

    boundingBox = sceneBox.clone();
    boundingBox.min.multiplyScalar(0.7);
    boundingBox.max.multiplyScalar(0.7);
    boundingBox.min.x *= 0.6;
    boundingBox.max.x *= 0.6;
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
        dim.multiplyScalar(0.48);

        const brickBody = new CANNON.Body({
            mass: 1,
            angularDamping: .94,
            linearDamping: 0.1
        });

        let shape;
        if (mesh.name.indexOf('cylinder') !== -1) {
            shape = new CANNON.Cylinder(dim.x, dim.z, dim.y * 2, 20);
            brickBody.addShape(shape);
        } else if (mesh.name.indexOf('plus') !== -1) {
            shape = new CANNON.Box(new CANNON.Vec3(dim.x, dim.y / 4, dim.z))
            brickBody.addShape(shape);
            shape = new CANNON.Box(new CANNON.Vec3(dim.x, dim.y, dim.z / 4))
            brickBody.addShape(shape);
        } else {
            shape = new CANNON.Box(new CANNON.Vec3(dim.x, dim.y, dim.z))
            brickBody.addShape(shape);
        }

        
        brickBody.position.copy(mesh.position);
        brickBody.quaternion.copy(mesh.quaternion);
        world.addBody(brickBody);

        brickBodies.push(brickBody);
        mesh.userData = { ...mesh.userData, body: brickBody };
    });

    // Max solver iterations: Use more for better force propagation, but keep in mind that it's not very computationally cheap!
    world.solver.iterations = 20

    // Tweak contact properties.
    // Contact stiffness - use to make softer/harder contacts
    world.defaultContactMaterial.contactEquationStiffness = 1e20

    // Stabilization time in number of timesteps
    world.defaultContactMaterial.contactEquationRelaxation = 3;

    world.defaultContactMaterial.restitution = .3;
    world.defaultContactMaterial.friction = .5;
    world.defaultContactMaterial.frictionEquationStiffness = 1e6;

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
        renderer.getSize(viewportSize);
        camera.aspect = viewportSize.x / viewportSize.y;
        camera.updateProjectionMatrix();

        mrtTarget.setSize(viewportSize.x, viewportSize.y);

        const ssaoSize = viewportSize.clone().multiplyScalar(ssaoScale);
        composer.setSize(ssaoSize.x, ssaoSize.y);
        ssaoPass.setSize(ssaoSize.x, ssaoSize.y);

        blurSize = viewportSize.clone().multiplyScalar(blurScale);
        sssBlurRTHorizonal.setSize(blurSize.x, blurSize.y);
        sssBlurRTVertical.setSize(blurSize.x, blurSize.y);
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
        if (body) {
            mesh.position.copy(body.position);
            mesh.quaternion.copy(body.quaternion);
        }
    });
}

function render() {

    ///// MRT pass

    renderer.setRenderTarget(mrtTarget);
    renderer.setClearColor(new THREE.Color(0.18, 0.18, 0.18));
    renderer.setClearAlpha(0.14);
    renderer.clear();
    renderer.render(scene, camera);

    if (!settings.enableSSS) {
        renderer.setRenderTarget( sssBlurRTVertical );
        renderer.clear();
    } else {

        ///// SSS blur passes

        quadMesh.material = sssBlurMaterial;
        quadMesh.material.uniforms.tDiffuse_Id.value = mrtTarget.texture[0];
        quadMesh.material.uniforms.tDepth.value = mrtTarget.texture[1];
        quadMesh.material.uniforms.tNormal_Specular.value = mrtTarget.texture[2];
        quadMesh.material.uniforms.uDirection.value = new Vector2(3, 0);
        quadMesh.material.uniforms.resolution.value = viewportSize;
        renderer.setRenderTarget( sssBlurRTHorizonal );
        renderer.clear(true, true);
        renderer.render( quadMesh, camera );

        quadMesh.material.uniforms.tDiffuse_Id.value = sssBlurRTHorizonal.texture;
        quadMesh.material.uniforms.uDirection.value = new Vector2(0., 3);
        quadMesh.material.uniforms.resolution.value = blurSize;
        renderer.setRenderTarget( sssBlurRTVertical );
        renderer.clear(true, true);
        renderer.render( quadMesh, camera );

        quadMesh.material.uniforms.tDiffuse_Id.value = sssBlurRTVertical.texture;
        quadMesh.material.uniforms.uDirection.value = new Vector2(1, 0);
        renderer.setRenderTarget( sssBlurRTHorizonal );
        renderer.clear(true, true);
        renderer.render( quadMesh, camera );

        quadMesh.material.uniforms.tDiffuse_Id.value = sssBlurRTHorizonal.texture;
        quadMesh.material.uniforms.uDirection.value = new Vector2(0., 1);
        renderer.setRenderTarget( sssBlurRTVertical );
        renderer.clear(true, true);
        renderer.render( quadMesh, camera );
    }

    ///// SSAO pass

    if (settings.enableSSAO) {
        scene.overrideMaterial = overrideMaterial;
        composer.render();
        scene.overrideMaterial = null;
    } else {
        renderer.setRenderTarget(ssaoPass.blurRenderTarget);
        renderer.setClearColor(0xffffff);
        renderer.clear();
    }
    

    ///// Composite pass

    quadMesh.material = compositeMaterial;
    quadMesh.material.uniforms.tDiffuse_Id.value = mrtTarget.texture[0];
    quadMesh.material.uniforms.tAlbedo.value = mrtTarget.texture[3];
    quadMesh.material.uniforms.tNormal_Specular.value = mrtTarget.texture[2];
    quadMesh.material.uniforms.tSSS.value = sssBlurRTVertical.texture;
    quadMesh.material.uniforms.tSSAO.value = ssaoPass.blurRenderTarget.texture;
    renderer.setRenderTarget(null);
    renderer.render( quadMesh, camera );
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