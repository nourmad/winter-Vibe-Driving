import * as THREE from 'three';

/**
 * CameraManager handles different camera perspectives and transitions
 */
export class CameraManager {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    
    // Camera modes
    this.FIRST_PERSON = 'first-person';
    this.THIRD_PERSON = 'third-person';
    this.ORBIT = 'orbit';
    
    // Current camera mode
    this.currentMode = this.THIRD_PERSON;
    
    // Camera settings
    this.firstPersonOffset = new THREE.Vector3(0, 1.1, 0.2); // Slightly above steering wheel
    this.thirdPersonDistance = 5;
    this.thirdPersonHeight = 2;
    this.thirdPersonLag = 0.1; // How much the camera lags behind the vehicle
    
    // Camera helpers
    this.target = new THREE.Object3D();
    this.lookAt = new THREE.Vector3();
    this.cameraPosition = new THREE.Vector3();
    
    // Vehicle reference
    this.vehicle = null;
    
    // Camera shake settings for immersion
    this.shakeEnabled = true;
    this.shakeIntensity = 0.05;
    this.currentShake = new THREE.Vector3();
  }
  
  /**
   * Initialize camera system with vehicle reference
   * @param {THREE.Object3D} vehicle - The vehicle mesh/object
   */
  init(vehicle) {
    this.vehicle = vehicle;
    this.scene.add(this.target);
    
    // Position camera initially
    this.updateCameraPosition(0);
  }
  
  /**
   * Toggle between camera modes
   */
  toggleCameraMode() {
    if (this.currentMode === this.FIRST_PERSON) {
      this.currentMode = this.THIRD_PERSON;
    } else if (this.currentMode === this.THIRD_PERSON) {
      this.currentMode = this.ORBIT;
    } else {
      this.currentMode = this.FIRST_PERSON;
    }
    
    return this.currentMode;
  }
  
  /**
   * Set specific camera mode
   * @param {string} mode - Camera mode
   */
  setCameraMode(mode) {
    if ([this.FIRST_PERSON, this.THIRD_PERSON, this.ORBIT].includes(mode)) {
      this.currentMode = mode;
    }
    return this.currentMode;
  }
  
  /**
   * Update camera based on current mode and vehicle position
   * @param {number} deltaTime - Time since last update
   */
  update(deltaTime) {
    if (!this.vehicle) return;
    
    // Get vehicle position and rotation
    const vehiclePosition = this.vehicle.position.clone();
    const vehicleRotation = this.vehicle.quaternion.clone();
    
    // Update target position with vehicle
    this.target.position.copy(vehiclePosition);
    this.target.quaternion.copy(vehicleRotation);
    
    // Add some camera shake based on vehicle speed or terrain
    if (this.shakeEnabled) {
      this.updateCameraShake(deltaTime);
    }
    
    // Update camera based on mode
    this.updateCameraPosition(deltaTime);
    
    // Apply final camera position with shake
    this.camera.position.copy(this.cameraPosition).add(this.currentShake);
    
    // Set camera lookAt
    this.camera.lookAt(this.lookAt);
  }
  
  /**
   * Update camera shake for immersion
   * @param {number} deltaTime - Time since last update 
   */
  updateCameraShake(deltaTime) {
    // Reset shake
    this.currentShake.set(0, 0, 0);
    
    // Only shake if enabled and vehicle is available
    if (!this.shakeEnabled || !this.vehicle) return;
    
    // Get vehicle velocity for shake intensity
    const velocity = this.vehicle.userData?.velocity || 0;
    const intensity = this.shakeIntensity * Math.min(1, velocity / 20);
    
    // Generate random shake
    this.currentShake.set(
      (Math.random() - 0.5) * intensity,
      (Math.random() - 0.5) * intensity,
      (Math.random() - 0.5) * intensity
    );
  }
  
  /**
   * Update camera position based on current mode
   * @param {number} deltaTime - Time since last update
   */
  updateCameraPosition(deltaTime) {
    if (!this.vehicle) return;
    
    const vehiclePosition = this.vehicle.position.clone();
    
    if (this.currentMode === this.FIRST_PERSON) {
      // First person mode - inside the vehicle
      // Get position relative to the vehicle
      const firstPersonPos = this.firstPersonOffset.clone();
      
      // Convert local position to world position
      this.target.updateMatrixWorld();
      const worldPos = firstPersonPos.applyMatrix4(this.target.matrixWorld);
      
      // Set camera position
      this.cameraPosition.copy(worldPos);
      
      // Look ahead
      const lookAheadPos = new THREE.Vector3(0, 1, -10);
      this.lookAt = lookAheadPos.applyMatrix4(this.target.matrixWorld);
      
    } else if (this.currentMode === this.THIRD_PERSON) {
      // Third person mode - following behind the vehicle
      // Calculate target camera position
      const offset = new THREE.Vector3(
        0, 
        this.thirdPersonHeight, 
        this.thirdPersonDistance
      );
      
      // Transform offset to world space based on vehicle rotation
      this.target.updateMatrixWorld();
      const worldOffset = offset.applyMatrix4(this.target.matrixWorld);
      
      // Smoothly move camera to new position
      if (deltaTime > 0) {
        this.cameraPosition.lerp(worldOffset, 1 - Math.pow(this.thirdPersonLag, deltaTime));
      } else {
        this.cameraPosition.copy(worldOffset);
      }
      
      // Look at vehicle with slight offset
      this.lookAt.copy(vehiclePosition).add(new THREE.Vector3(0, 1, 0));
      
    } else if (this.currentMode === this.ORBIT) {
      // Orbit mode - circle around the vehicle
      const time = performance.now() * 0.001;
      const radius = 10;
      
      this.cameraPosition.set(
        vehiclePosition.x + radius * Math.cos(time * 0.3),
        vehiclePosition.y + 5,
        vehiclePosition.z + radius * Math.sin(time * 0.3)
      );
      
      // Look at vehicle
      this.lookAt.copy(vehiclePosition);
    }
  }
  
  /**
   * Set camera shake options
   * @param {boolean} enabled - Enable/disable camera shake
   * @param {number} intensity - Camera shake intensity
   */
  setShake(enabled, intensity = 0.05) {
    this.shakeEnabled = enabled;
    if (intensity !== undefined) {
      this.shakeIntensity = intensity;
    }
  }
} 