import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Vehicle } from './vehicle/Vehicle.js';
import { TerrainGenerator } from './terrain/TerrainGenerator.js';
import { SnowEffect } from './effects/SnowEffect.js';
import { CameraManager } from './camera/CameraManager.js';
import { InputManager } from './controls/InputManager.js';
import { GameState } from './core/GameState.js';
import { Physics } from './physics/Physics.js';

class DrivingSimulator {
  constructor() {
    // Core elements
    this.canvas = document.getElementById('canvas');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Game elements
    this.gameState = new GameState();
    this.physics = new Physics();
    this.inputManager = new InputManager();
    this.cameraManager = new CameraManager(this.camera, this.scene);
    this.vehicle = new Vehicle(this.scene, this.physics);
    this.terrain = new TerrainGenerator(this.scene, this.physics);
    this.snowEffect = new SnowEffect(this.scene);
    
    // Setup controls
    this.setupUIControls();
    
    // Setup lighting
    this.setupLighting();
    
    // Start loading process
    this.init();
  }
  
  init() {
    // Initialize physics
    this.physics.init();
    
    // Load vehicle and place it on the terrain
    this.vehicle.init().then(() => {
      // When vehicle is loaded, set up cameras
      this.cameraManager.init(this.vehicle.chassis);
      
      // Generate the terrain
      this.terrain.generate();
      
      // Set up snow effect
      this.snowEffect.init();
      
      // Hide loading screen
      document.getElementById('loading').style.display = 'none';
      
      // Start animation loop
      this.animate();
    });
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }
  
  setupLighting() {
    // Ambient light for general illumination
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.5);
    this.scene.add(ambientLight);
    
    // Directional light for sun
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    
    // Configure shadows
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    
    this.scene.add(directionalLight);
    
    // Add winter atmosphere fog
    this.scene.fog = new THREE.FogExp2(0xeeeeff, 0.01);
    this.scene.background = new THREE.Color(0xdfe9f0);
  }
  
  setupUIControls() {
    // Camera toggle button
    document.getElementById('camera-toggle').addEventListener('click', () => {
      this.cameraManager.toggleCameraMode();
    });
    
    // Snow intensity slider
    document.getElementById('snow-intensity').addEventListener('input', (e) => {
      const intensity = e.target.value / 100;
      this.snowEffect.setIntensity(intensity);
    });
  }
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const delta = this.gameState.update();
    
    // Update physics
    this.physics.update(delta);
    
    // Update vehicle and get driver inputs
    this.vehicle.update(delta, this.inputManager.getInputs());
    
    // Update camera
    this.cameraManager.update(delta);
    
    // Update snow effect
    this.snowEffect.update(delta);
    
    // Update UI
    document.getElementById('speed').textContent = `Speed: ${Math.round(this.vehicle.getSpeed())} km/h`;
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
}

// Start the simulator when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const simulator = new DrivingSimulator();
}); 