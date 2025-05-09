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
    console.log("Initializing simulator...");
    
    // Core elements
    this.canvas = document.getElementById('canvas');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    console.log("Core elements initialized");
    
    // Game elements
    this.gameState = new GameState();
    this.physics = new Physics();
    this.inputManager = new InputManager();
    this.cameraManager = new CameraManager(this.camera, this.scene);
    this.vehicle = new Vehicle(this.scene, this.physics);
    this.terrain = new TerrainGenerator(this.scene, this.physics);
    this.snowEffect = new SnowEffect(this.scene);
    
    // Game state flag
    this.gameStarted = false;
    
    console.log("Game elements initialized");
    
    // Setup controls
    this.setupUIControls();
    
    // Setup lighting
    this.setupLighting();
    
    console.log("Starting loading process...");
    
    // Start loading process
    this.init();
  }
  
  init() {
    console.log("Initializing physics...");
    // Initialize physics
    this.physics.init();
    
    console.log("Generating terrain...");
    // Generate the terrain first
    this.terrain.generate();
    
    // Set up debug button 
    this.setupDebugSnowButton();
    
    console.log("Loading vehicle...");
    // Load vehicle and place it on the terrain after terrain is generated
    this.vehicle.init(this.terrain).then(() => {
      console.log("Vehicle loaded, setting up cameras...");
      // When vehicle is loaded, set up cameras
      this.cameraManager.init(this.vehicle.chassis);
      
      console.log("Setting up snow effect...");
      // Set up snow effect with camera reference
      this.snowEffect.init(this.camera);
      console.log("Snow effect initialized with camera at position:", this.camera.position);
      
      console.log("Loading complete!");
      // Hide loading screen
      const loadingElement = document.getElementById('loading');
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      
      // Setup Play Game button
      this.setupPlayButton();
      
      // Start animation loop
      this.animate();
    }).catch(error => {
      console.error("Error during initialization:", error);
      const loadingElement = document.getElementById('loading');
      if (loadingElement) {
        loadingElement.textContent = "Error loading simulation: " + error.message;
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }
  
  setupPlayButton() {
    // Get play button element
    const playButton = document.getElementById('play-button');
    const playContainer = document.getElementById('menu-container');
    
    if (playButton && playContainer) {
      // Add click event listener
      playButton.addEventListener('click', () => {
        // Start camera transition
        this.cameraManager.transitionToGameView(() => {
          // Enable game controls after transition completes
          this.gameStarted = true;
          console.log("Game started!");
          
          // Show HUD and controls
          const hud = document.getElementById('hud');
          if (hud) hud.style.opacity = '1';
          
          const controlsHelp = document.getElementById('controls-help');
          if (controlsHelp) controlsHelp.style.opacity = '1';
          
          const controls = document.getElementById('controls');
          if (controls) controls.style.opacity = '1';
        });
        
        // Hide play button and container
        playContainer.style.opacity = '0';
        setTimeout(() => {
          playContainer.style.display = 'none';
        }, 1000);
      });
    }
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
  
  setupDebugSnowButton() {
    const debugSnowButton = document.getElementById('debug-snow');
    if (debugSnowButton) {
      debugSnowButton.addEventListener('click', () => {
        console.log("Force snow button clicked");
        
        // Make sure snow is visible
        if (this.snowEffect) {
          // Reinitialize snow with the current camera
          console.log("Reinitializing snow with camera at position:", this.camera.position);
          
          // Remove any existing snow
          if (this.snowEffect.particleSystem && this.snowEffect.particleSystem.parent) {
            this.snowEffect.particleSystem.parent.remove(this.snowEffect.particleSystem);
          }
          
          // Reinitialize with current camera
          this.snowEffect.init(this.camera);
          
          // Set to maximum intensity
          this.snowEffect.setIntensity(1.0);
          
          // Update snow slider
          const snowSlider = document.getElementById('snow-intensity');
          if (snowSlider) {
            snowSlider.value = 100;
          }
          
          // Make sure it's visible
          if (this.snowEffect.particleSystem) {
            this.snowEffect.particleSystem.visible = true;
            console.log("Snow system visible:", this.snowEffect.particleSystem.visible);
            console.log("Snow particle count:", this.snowEffect.particleCount);
            console.log("Snow intensity:", this.snowEffect.intensity);
          }
        }
      });
    }
  }
  
  setupUIControls() {
    // Camera toggle button
    document.getElementById('camera-toggle').addEventListener('click', () => {
      this.cameraManager.toggleCameraMode();
      console.log("Camera mode toggled to:", this.cameraManager.currentMode);
    });
    
    // Set high initial snow intensity
    const initialSnowIntensity = 0.8;
    
    // Snow intensity slider
    const snowSlider = document.getElementById('snow-intensity');
    // Update slider value to match initial intensity
    if (snowSlider) {
      snowSlider.value = initialSnowIntensity * 100;
    }
    
    // Set initial snow intensity
    this.snowEffect.setIntensity(initialSnowIntensity);
    
    // Add listener for slider changes
    snowSlider.addEventListener('input', (e) => {
      const intensity = e.target.value / 100;
      console.log("Snow intensity set to:", intensity);
      this.snowEffect.setIntensity(intensity);
    });
    
    // Initially hide HUD and controls until game starts
    const hud = document.getElementById('hud');
    if (hud) hud.style.opacity = '0';
    
    const controlsHelp = document.getElementById('controls-help');
    if (controlsHelp) controlsHelp.style.opacity = '0';
    
    const controls = document.getElementById('controls');
    if (controls) controls.style.opacity = '0';
    
    // Add transition style
    const style = document.createElement('style');
    style.innerHTML = `
      #hud, #controls-help, #controls {
        transition: opacity 1s ease;
      }
      #menu-container {
        transition: opacity 1s ease;
      }
    `;
    document.head.appendChild(style);
  }
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const delta = this.gameState.update();
    
    // Update input manager first
    this.inputManager.update(delta);
    
    // Update physics
    this.physics.update(delta);
    
    // Get current vehicle speed
    const vehicleSpeed = this.vehicle.getSpeed();
    
    // Only update vehicle controls if game has started
    if (this.gameStarted) {
      // Update vehicle with current inputs
      this.vehicle.update(delta, this.inputManager.getInputs());
    } else {
      // Use empty inputs when game hasn't started yet
      this.vehicle.update(delta, {
        steering: 0,
        throttle: 0,
        brake: 0,
        handbrake: false,
        reverse: false,
        boost: false
      });
    }
    
    // Update camera
    this.cameraManager.update(delta);
    
    // Update snow effect with current vehicle speed
    if (this.snowEffect) {
      this.snowEffect.updateVehicleSpeed(vehicleSpeed);
      this.snowEffect.update(delta);
    }
    
    // Update UI
    const speedElement = document.getElementById('speed');
    if (speedElement) {
      speedElement.textContent = `Speed: ${Math.round(vehicleSpeed)} km/h`;
    }
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
}

// Start the simulator when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded, creating simulator...");
  const simulator = new DrivingSimulator();
}); 