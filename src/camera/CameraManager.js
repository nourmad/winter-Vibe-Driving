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
    this.FRONT_VIEW = 'front-view'; // Added front view mode
    
    // Current camera mode
    this.currentMode = this.FRONT_VIEW; // Default to front view now
    
    // Camera settings
    this.firstPersonOffset = new THREE.Vector3(0, 1.1, 0.2); // Slightly above steering wheel
    this.thirdPersonDistance = 5;
    this.thirdPersonHeight = 2;
    this.thirdPersonLag = 0.1; // How much the camera lags behind the vehicle
    this.frontViewDistance = 8; // Distance in front of the vehicle
    this.frontViewHeight = 2; // Height for front view
    
    // Camera transition properties
    this.isTransitioning = false;
    this.transitionStartPos = new THREE.Vector3();
    this.transitionEndPos = new THREE.Vector3();
    this.transitionStartLook = new THREE.Vector3();
    this.transitionEndLook = new THREE.Vector3();
    this.transitionProgress = 0;
    this.transitionDuration = 2.0; // Transition duration in seconds
    this.transitionCallback = null; // Function to call after transition
    
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
    
    // Position camera initially in front of the vehicle
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
    } else if (this.currentMode === this.ORBIT) {
      this.currentMode = this.FRONT_VIEW;
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
    if ([this.FIRST_PERSON, this.THIRD_PERSON, this.ORBIT, this.FRONT_VIEW].includes(mode)) {
      this.currentMode = mode;
    }
    return this.currentMode;
  }

  /**
   * Start transition from front view to behind the car
   * @param {Function} callback - Function to call when transition completes
   */
  transitionToGameView(callback = null) {
    if (this.isTransitioning) return;
    
    // Store current camera position and target as start values
    this.transitionStartPos.copy(this.camera.position);
    this.transitionStartLook.copy(this.lookAt);
    
    // Calculate end position (behind the vehicle)
    const vehiclePosition = this.vehicle.position.clone();
    const vehicleRotation = this.vehicle.quaternion.clone();
    
    // Create a temporary target to calculate world position
    const tempTarget = new THREE.Object3D();
    tempTarget.position.copy(vehiclePosition);
    tempTarget.quaternion.copy(vehicleRotation);
    tempTarget.updateMatrixWorld();
    
    // Calculate behind vehicle position (third person view)
    const behindOffset = new THREE.Vector3(0, this.thirdPersonHeight, this.thirdPersonDistance);
    this.transitionEndPos = behindOffset.clone().applyMatrix4(tempTarget.matrixWorld);
    
    // Set end look target (slightly above the vehicle)
    this.transitionEndLook = vehiclePosition.clone().add(new THREE.Vector3(0, 1, 0));
    
    // Setup transition
    this.isTransitioning = true;
    this.transitionProgress = 0;
    this.transitionCallback = callback;
    
    // Set mode to third person for after the transition
    this.currentMode = this.THIRD_PERSON;
  }
  
  /**
   * Update camera based on current mode and vehicle position
   * @param {number} deltaTime - Time since last update
   */
  update(deltaTime) {
    if (!this.vehicle) return;
    
    if (this.isTransitioning) {
      // Handle camera transition
      this.updateCameraTransition(deltaTime);
    } else {
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
  }
  
  /**
   * Update camera transition animation
   * @param {number} deltaTime - Time since last update
   */
  updateCameraTransition(deltaTime) {
    // Update transition progress
    this.transitionProgress += deltaTime / this.transitionDuration;
    
    // Clamp and check if transition is complete
    if (this.transitionProgress >= 1.0) {
      this.transitionProgress = 1.0;
      this.isTransitioning = false;
      
      // Execute callback if provided
      if (this.transitionCallback) {
        this.transitionCallback();
        this.transitionCallback = null;
      }
    }
    
    // Use smooth easing function
    const easedProgress = this.easeInOutCubic(this.transitionProgress);
    
    // Interpolate camera position
    this.camera.position.lerpVectors(
      this.transitionStartPos,
      this.transitionEndPos,
      easedProgress
    );
    
    // Interpolate look target
    this.lookAt.lerpVectors(
      this.transitionStartLook,
      this.transitionEndLook,
      easedProgress
    );
    
    // Update camera look
    this.camera.lookAt(this.lookAt);
  }
  
  /**
   * Cubic easing function for smooth transitions
   * @param {number} t - Progress from 0 to 1
   * @returns {number} Eased value
   */
  easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
    } else if (this.currentMode === this.FRONT_VIEW) {
      // Front view mode - facing the vehicle from the front
      const frontOffset = new THREE.Vector3(
        0,
        this.frontViewHeight,
        -this.frontViewDistance // Negative to be in front
      );
      
      // Transform offset to world space based on vehicle rotation
      this.target.updateMatrixWorld();
      const worldOffset = frontOffset.applyMatrix4(this.target.matrixWorld);
      
      // Set camera position
      this.cameraPosition.copy(worldOffset);
      
      // Look at vehicle
      this.lookAt.copy(vehiclePosition).add(new THREE.Vector3(0, 0.5, 0));
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