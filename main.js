import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- DOM ELEMENTS ---
const levelContainerEl = document.getElementById('level');
const levelValueEl = document.getElementById('level-value');
const chargingStateEl = document.getElementById('chargingState');
const unsupportedUI = document.getElementById('unsupported-message');
const descriptionTextEl = document.getElementById('description-text');
const yearUI = document.getElementById('year');
yearUI.textContent = new Date().getFullYear();
const fullscreenBtn = document.getElementById('fullscreen-btn');
const iconEnter = document.getElementById('icon-enter');
const iconExit = document.getElementById('icon-exit');

// --- STATE MANAGEMENT ---
let batteryState = { charging: false, level: 0 };
let wakeLock = null;

// --- SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('bg'), antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(0, 5, 20);

// --- LIGHTING ---
const sunLight = new THREE.DirectionalLight(0xffffff, 3.0);
sunLight.position.set(-15, 10, 15);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(sunLight, ambientLight);

// --- LOADERS ---
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();

// --- GALAXY (Initially hidden) ---
const galaxyMaterial = new THREE.MeshBasicMaterial({ map: textureLoader.load('https://unpkg.com/three-globe/example/img/night-sky.png'), side: THREE.BackSide });
const galaxyGeometry = new THREE.SphereGeometry(200, 64, 64);
const galaxy = new THREE.Mesh(galaxyGeometry, galaxyMaterial);
galaxy.visible = false;
scene.add(galaxy);

// --- EARTH ---
const EMISSIVE_NORMAL_COLOR = new THREE.Color(0xffffff);
const EMISSIVE_CHARGING_COLOR = new THREE.Color(0x00ffff);
const earthGeometry = new THREE.SphereGeometry(10, 64, 64);
const earthMaterial = new THREE.MeshPhongMaterial({ map: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-day.jpg'), specularMap: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-water.png'), emissiveMap: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg'), emissive: EMISSIVE_NORMAL_COLOR, emissiveIntensity: 1, shininess: 10 });
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earth);

// --- CLOUDS ---
const cloudGeometry = new THREE.SphereGeometry(10.1, 64, 64);
const cloudMaterial = new THREE.MeshStandardMaterial({ map: textureLoader.load('https://upload.wikimedia.org/wikipedia/commons/7/7a/Solarsystemscope_texture_8k_earth_clouds.jpg'), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
scene.add(clouds);

// --- ATMOSPHERE ---
const atmosphereGeometry = new THREE.SphereGeometry(10.3, 64, 64);
const atmosphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00aaff, transparent: true, opacity: 0.15 });
const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
scene.add(atmosphere);

// --- DYNAMIC OBJECTS PIVOT ---
const chargingEffectsPivot = new THREE.Object3D();
chargingEffectsPivot.visible = false;
scene.add(chargingEffectsPivot);

// --- SATELLITE ---
let satellite;
const satellitePivot = new THREE.Object3D(); // This pivot will rotate around the Earth
chargingEffectsPivot.add(satellitePivot);
gltfLoader.load('ISS_stationary.glb', (gltf) => {
    satellite = gltf.scene;
    satellite.scale.set(0.005, 0.005, 0.005);
    satellite.position.set(15, 0, 0);
    satellitePivot.add(satellite);
});

// --- ASTEROID FIELD (Using asteroid.glb) ---
const asteroids = [];
const numAsteroids = 50; // Keep the number of asteroids the same for consistency
gltfLoader.load('asteroid.glb', (gltf) => {
    const asteroidModel = gltf.scene;
    asteroidModel.scale.set(0.1, 0.1, 0.1); // Initial scale for the GLB asteroid, adjust as needed

    for (let i = 0; i < numAsteroids; i++) {
        const asteroid = asteroidModel.clone(); // Clone the loaded model for each asteroid
        asteroid.position.set(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
        );
        asteroid.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.01,
            (Math.random() - 0.5) * 0.01,
            (Math.random() - 0.5) * 0.01
        );
        // Randomize initial rotation for better visual variety
        asteroid.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        asteroids.push(asteroid);
        chargingEffectsPivot.add(asteroid);
    }
});


// --- SHOOTING STARS ---
const starGeometry = new THREE.BufferGeometry();
const starVertices = [];
const starVelocities = [];
for (let i = 0; i < 200; i++) {
    const x = (Math.random() - 0.5) * 300;
    const y = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;
    starVertices.push(x, y, z);
    starVelocities.push({ x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5, z: (Math.random() + 0.1) * 2 });
}
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, blending: THREE.AdditiveBlending });
const shootingStars = new THREE.Points(starGeometry, starMaterial);
chargingEffectsPivot.add(shootingStars);

// --- CONTROLS ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 15;
controls.maxDistance = 50;

// --- ANIMATION LOOP ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // The charging effects pivot and galaxy should only be visible if battery is charging
    const shouldShowChargingEffects = batteryState.charging;
    galaxy.visible = shouldShowChargingEffects;
    chargingEffectsPivot.visible = shouldShowChargingEffects;


    // Apply rotations only if charging effects are visible
    if (shouldShowChargingEffects) {
        earth.rotation.y += 0.05 * delta;
        clouds.rotation.y += 0.06 * delta;
        if (satellite) satellitePivot.rotation.y += 0.2 * delta; // ISS orbiting
        galaxy.rotation.y += 0.01 * delta;

        // Asteroid movement and rotation
        asteroids.forEach(a => {
            a.position.add(a.userData.velocity);
            a.rotation.x += a.userData.velocity.x * 0.1; // Add rotation
            a.rotation.y += a.userData.velocity.y * 0.1;
            a.rotation.z += a.userData.velocity.z * 0.1;

            if (a.position.length() > 150) {
                // Reset position if too far
                a.position.set((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
                // Randomize velocity again for new direction
                a.userData.velocity.set(
                    (Math.random() - 0.5) * 0.01,
                    (Math.random() - 0.5) * 0.01,
                    (Math.random() - 0.5) * 0.01
                );
            }
        });

        const positions = shootingStars.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const v = starVelocities[i];
            positions.setXYZ(i, positions.getX(i) + v.x, positions.getY(i) + v.y, positions.getZ(i) + v.z);
            if (positions.getZ(i) > 150) positions.setZ(i, -150);
        }
        positions.needsUpdate = true;
    }
    controls.update();
    renderer.render(scene, camera);
}
animate();

// --- BATTERY LOGIC ---
function updateAllBatteryInfo(battery) {
    batteryState = battery; // Always update batteryState

    const levelPercent = Math.floor(battery.level * 100);

    // Update the liquid text
    const levelText = `${levelPercent}%`;
    levelValueEl.innerText = levelText;
    levelValueEl.dataset.text = levelText;
    levelContainerEl.style.setProperty('--liquid-fill-percent', `${levelPercent}%`);
    updateFavicon(levelPercent); // Update favicon with battery level

    // Update charging status text
    if (battery.charging) {
        chargingStateEl.textContent = 'Charging Protocol Active';
        descriptionTextEl.style.display = 'none';
    } else if (levelPercent === 100) {
        chargingStateEl.textContent = 'Energy Core Full';
        descriptionTextEl.style.display = 'block';
    } else {
        chargingStateEl.textContent = 'On Reserve Power';
        descriptionTextEl.style.display = 'block';
    }

    // Update 3D scene colors based on battery charge
    const hue = 0.33 * battery.level;
    atmosphereMaterial.color.setHSL(hue, 0.8, 0.5);
    if (battery.charging) {
        earthMaterial.emissive.copy(EMISSIVE_CHARGING_COLOR);
        earthMaterial.emissiveIntensity = 1.5;
        levelContainerEl.classList.add('is-charging');
    } else {
        earthMaterial.emissive.copy(EMISSIVE_NORMAL_COLOR);
        earthMaterial.emissiveIntensity = 1.2 - battery.level * 1.2;
        levelContainerEl.classList.remove('is-charging');
    }
}

// --- FULLSCREEN AND WAKE LOCK LOGIC ---
const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => console.log('Wake Lock was released'));
            console.log('Screen Wake Lock is active');
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    } else {
        console.log('Wake Lock API not supported.');
    }
};
const releaseWakeLock = async () => {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
    }
};
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});
document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        iconEnter.style.display = 'none';
        iconExit.style.display = 'block';
        requestWakeLock();
    } else {
        iconEnter.style.display = 'block';
        iconExit.style.display = 'none';
        releaseWakeLock();
    }
});

// --- INITIALIZE ---
// Check for battery API support
if ('getBattery' in navigator) {
    // --- REAL BATTERY MODE ---
    unsupportedUI.style.display = 'none'; // Hide unsupported message
    navigator.getBattery().then(bat => {
        updateAllBatteryInfo(bat);
        bat.addEventListener('levelchange', () => updateAllBatteryInfo(bat));
        bat.addEventListener('chargingchange', () => updateAllBatteryInfo(bat));
    }).catch(e => {
        // This might happen if the connection is not secure (not HTTPS)
        unsupportedUI.textContent = 'Battery API requires a secure (HTTPS) connection.';
        unsupportedUI.style.display = 'block';
    });
} else {
    // --- SIMULATION MODE (BATTERY API NOT SUPPORTED) ---
    console.log('Battery API not supported. Running in simulation mode.');
    unsupportedUI.style.display = 'none'; // Hide the generic unsupported message

    // 1. Create a fake battery state to trigger all animations
    const fakeBatteryState = { charging: true, level: 1.0 }; // 100% charged
    updateAllBatteryInfo(fakeBatteryState);

    // 2. Override UI text to inform the user they are in simulation mode
    chargingStateEl.textContent = 'Simulation Mode Active';
    descriptionTextEl.textContent = 'Your device does not support the Battery Status API.';
    document.getElementById('battery-status-container').style.display = 'none'; // Hide the battery status container
    descriptionTextEl.style.display = 'block';
}

// --- RESIZE HANDLER ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- FAVICON UPDATE ---
function updateFavicon(faviconBtryLevel) {
    // Using a more robust placeholder service that is less likely to be blocked
    const newFaviconUrl = `https://via.placeholder.com/32/000000/FFFFFF/?text=${faviconBtryLevel}`;

    let faviconLink = document.getElementById('favicon-link');
    if (faviconLink) {
        faviconLink.href = newFaviconUrl;
    } else {
        const head = document.querySelector('head');
        const newLink = document.createElement('link');
        newLink.id = 'favicon-link';
        newLink.rel = 'icon';
        newLink.href = newFaviconUrl;
        head.appendChild(newLink);
    }
}