import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Hands } from './Hands.js';

/**
 * Vehicle class with physics and animated steering wheel and hands
 */
export class Vehicle {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.loader = new GLTFLoader();
    
    // Vehicle model properties
    this.chassis = null;        // The main vehicle body
    this.wheels = [];           // Wheel meshes
    this.steeringWheel = null;  // Steering wheel mesh
    
    // Physics properties
    this.chassisBody = null;
    this.vehicle = null;
    
    // Vehicle dimensions and properties
    this.width = 1.8;
    this.height = 1.4;
    this.length = 4.5;
    this.mass = 1500;
    
    // Position properties
    this.spawnPosition = new CANNON.Vec3(0, 0, 0); // Default position
    
    // Engine properties
    this.maxForce = 3000;       // Reduced from 8000 to prevent flipping
    this.maxBrakeForce = 500;   // Increased from 100 to 500 for stronger braking
    this.maxSteeringAngle = Math.PI / 4; // 45 degrees
    
    // Current vehicle state
    this.speed = 0;             // Current speed in km/h
    this.steeringAngle = 0;     // Current steering angle
    
    // Wheel indices
    this.FRONT_LEFT = 0;
    this.FRONT_RIGHT = 1;
    this.BACK_LEFT = 2;
    this.BACK_RIGHT = 3;
    
    // Create the hands controller
    this.hands = new Hands(scene);
  }
  
  /**
   * Initialize the vehicle
   * @param {TerrainGenerator} terrain - The terrain generator for road information
   * @returns {Promise} Promise that resolves when the vehicle is loaded
   */
  async init(terrain) {
    // Set spawn position on the road
    if (terrain) {
      // Get road height from terrain and add a larger buffer to ensure it spawns above the road
      const roadHeight = terrain.getRoadHeight() + 1.0; // Increased from 0.6 to 1.0
      
      // Position vehicle on the road, away from edges
      this.spawnPosition = new CANNON.Vec3(0, roadHeight, 50);
    }
    
    // Create physics chassis and vehicle
    this.createPhysicsChassis();
    
    // Load model
    await this.loadModel();
    
    // Create hands
    this.hands.init(this.steeringWheel);
    
    return this;
  }
  
  /**
   * Create physics bodies for the vehicle
   */
  createPhysicsChassis() {
    // Create chassis shape
    const chassisShape = new CANNON.Box(new CANNON.Vec3(
      this.width / 2,
      this.height / 2,
      this.length / 2
    ));
    
    // Create chassis body
    this.chassisBody = new CANNON.Body({
      mass: this.mass,
      material: this.physics.tireMaterial,
      linearDamping: 0.06,       // Increased damping for more stability
      angularDamping: 0.1        // Increased to prevent flipping
    });
    this.chassisBody.addShape(chassisShape);
    
    // Use the spawn position set in the init method
    this.chassisBody.position.copy(this.spawnPosition);
    
    // Set initial rotation to face along the road (z-axis)
    this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
    
    // Add chassis to the physics world
    this.physics.addBody(this.chassisBody, true);
    
    // Create vehicle
    this.vehicle = this.physics.createVehicle(this.chassisBody);
    
    // Configure suspension and wheel properties
    const suspensionStiffness = 30;        // Increased for better road holding
    const suspensionRestLength = 0.3;      // Reduced to keep car closer to ground
    const suspensionDamping = 4.5;         // Increased for stability
    const suspensionCompression = 4.5;     // Increased for stability
    const rollInfluence = 0.005;           // Reduced to prevent tipping
    
    const axleWidth = 1.7;
    const wheelRadius = 0.33;
    const wheelHalfWidth = 0.2;
    
    // Add wheels
    const wheelOptions = {
      radius: wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness,
      suspensionRestLength,
      dampingRelaxation: suspensionDamping,
      dampingCompression: suspensionCompression,
      rollInfluence,
      maxSuspensionForce: 100000,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true
    };
    
    // Front left wheel
    wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(-axleWidth / 2, 0, this.length / 2 - wheelRadius);
    this.vehicle.addWheel(wheelOptions);
    
    // Front right wheel
    wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(axleWidth / 2, 0, this.length / 2 - wheelRadius);
    this.vehicle.addWheel(wheelOptions);
    
    // Back left wheel
    wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(-axleWidth / 2, 0, -this.length / 2 + wheelRadius);
    this.vehicle.addWheel(wheelOptions);
    
    // Back right wheel
    wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(axleWidth / 2, 0, -this.length / 2 + wheelRadius);
    this.vehicle.addWheel(wheelOptions);
    
    // Create wheel bodies
    this.vehicle.wheelInfos.forEach((wheel, index) => {
      const wheelBody = new CANNON.Body({
        mass: 1,
        material: this.physics.tireMaterial,
        type: CANNON.Body.KINEMATIC,
        collisionFilterGroup: 0, // turn off collisions
      });
      
      const wheelShape = new CANNON.Cylinder(
        wheel.radius, 
        wheel.radius, 
        wheelHalfWidth * 2, 
        20
      );
      
      wheelBody.addShape(wheelShape, new CANNON.Vec3(), new CANNON.Quaternion().setFromAxisAngle(
        new CANNON.Vec3(1, 0, 0),
        Math.PI / 2
      ));
      
      this.physics.addBody(wheelBody);
    });
  }
  
  /**
   * Load the 3D model of the vehicle
   * @returns {Promise} Promise that resolves when the model is loaded
   */
  async loadModel() {
    return new Promise((resolve, reject) => {
      console.log("Starting vehicle model loading process...");
      
      // We'll directly load the Ferrari F40 model which we know exists
      const modelPath = './winterVibe/ferrari_f40.glb';
      console.log(`Loading model from path: ${modelPath}`);
      
      this.loader.load(
        modelPath,
        (gltf) => {
          // Model loaded successfully
          console.log(`Ferrari F40 model loaded successfully!`);
          
          // Set the chassis to the loaded model
          this.chassis = gltf.scene;
          
          // Configure Ferrari F40 specific settings
          console.log("Applying Ferrari F40 specific settings");
          this.chassis.scale.set(0.7, 0.7, 0.7); // Scale for Ferrari F40
          this.chassis.rotation.y = Math.PI; // Rotate to face forward
          
          // Enable shadows
          this.chassis.castShadow = true;
          this.chassis.receiveShadow = true;
          
          // Apply shadows to all child meshes
          this.chassis.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              console.log(`Applied shadows to mesh: ${child.name}`);
            }
          });
          
          // Add the model to the scene
          this.scene.add(this.chassis);
          console.log("Added Ferrari model to scene");
          
          // Link chassis to physics body
          this.chassis.userData.physicsBody = this.chassisBody;
          
          // Find wheels in the model
          console.log("Searching for wheels in the Ferrari model...");
          const wheelRadius = 0.33;
          const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
          
          // Try to find wheels in the model using extended pattern matching
          let wheelMeshes = [];
          this.chassis.traverse((child) => {
            const lowerName = child.name.toLowerCase();
            // Look for common wheel naming patterns
            if (lowerName.includes('wheel') || 
                lowerName.includes('tire') || 
                lowerName.includes('tyre') ||
                lowerName.includes('rim') ||
                lowerName.match(/wheel[_-]?[fr]?[lr]/) || // wheel_fl, wheel_fr, wheel_rl, wheel_rr
                lowerName.match(/w[fr][lr]/)) {          // wfl, wfr, wrl, wrr
              console.log(`Found wheel in Ferrari model: ${child.name}`);
              wheelMeshes.push(child);
            }
          });
          
          // If no wheels found in the model, create them
          if (wheelMeshes.length < 4) {
            console.log(`Only found ${wheelMeshes.length} wheels in model, creating procedural wheels`);
            const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.2, 24);
            wheelGeometry.rotateZ(Math.PI / 2);
            
            // Create wheel meshes
            for (let i = 0; i < 4; i++) {
              const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
              wheelMesh.castShadow = true;
              this.scene.add(wheelMesh);
              this.wheels.push(wheelMesh);
            }
          } else {
            // Use the wheels from the model
            console.log(`Using ${wheelMeshes.length} wheels from the Ferrari model`);
            this.wheels = wheelMeshes;
          }
          
          // Debug the wheels array
          console.log(`Final wheel count: ${this.wheels.length}`);
          
          // Create steering wheel
          console.log("Setting up steering wheel...");
          let steeringWheelFound = false;
          this.chassis.traverse((child) => {
            const lowerName = child.name.toLowerCase();
            if (lowerName.includes('steering') || lowerName.includes('steer') || lowerName.includes('wheel_steer')) {
              console.log(`Found steering wheel in model: ${child.name}`);
              this.steeringWheel = child;
              steeringWheelFound = true;
            }
          });
          
          if (!steeringWheelFound) {
            console.log("No steering wheel found in model, creating a procedural one");
            // Create steering wheel
            const steeringWheelGeometry = new THREE.TorusGeometry(0.3, 0.03, 16, 32);
            const steeringWheelMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
            this.steeringWheel = new THREE.Mesh(steeringWheelGeometry, steeringWheelMaterial);
            
            // Add spokes to the steering wheel
            const spokeGeometry = new THREE.BoxGeometry(0.6, 0.02, 0.02);
            const spokeMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
            
            // Horizontal spoke
            const horizontalSpoke = new THREE.Mesh(spokeGeometry, spokeMaterial);
            this.steeringWheel.add(horizontalSpoke);
            
            // Vertical spoke
            const verticalSpoke = new THREE.Mesh(spokeGeometry, spokeMaterial);
            verticalSpoke.rotation.z = Math.PI / 2;
            this.steeringWheel.add(verticalSpoke);
            
            // Position steering wheel in the vehicle
            this.steeringWheel.position.set(0, 0.9, 0.7);
            this.steeringWheel.rotation.x = Math.PI / 2;
            this.chassis.add(this.steeringWheel);
          }
          
          console.log("Ferrari F40 model setup complete!");
          resolve();
        },
        // Progress callback
        (xhr) => {
          const percent = Math.round(xhr.loaded / xhr.total * 100);
          console.log(`Loading Ferrari F40 model: ${percent}%`);
        },
        // Error callback
        (error) => {
          console.error(`Error loading Ferrari F40 model:`, error);
          console.log("Falling back to simple car model");
          this.createSimpleCarModel();
          resolve();
        }
      );
    });
  }
  
  /**
   * Create a simple car model as fallback if GLTF loading fails
   */
  createSimpleCarModel() {
    // Create chassis mesh
    const chassisGeometry = new THREE.BoxGeometry(this.width, this.height, this.length);
    const chassisMaterial = new THREE.MeshPhongMaterial({ color: 0x990000 });
    this.chassis = new THREE.Mesh(chassisGeometry, chassisMaterial);
    this.chassis.castShadow = true;
    this.chassis.receiveShadow = true;
    this.scene.add(this.chassis);
    
    // Link chassis to physics body
    this.chassis.userData.physicsBody = this.chassisBody;
    
    // Create wheel meshes
    const wheelGeometry = new THREE.CylinderGeometry(0.33, 0.33, 0.2, 24);
    const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    
    // Rotate wheel geometry to match physics
    wheelGeometry.rotateZ(Math.PI / 2);
    
    // Create wheel meshes
    for (let i = 0; i < 4; i++) {
      const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheelMesh.castShadow = true;
      this.scene.add(wheelMesh);
      this.wheels.push(wheelMesh);
    }
    
    // Create steering wheel
    const steeringWheelGeometry = new THREE.TorusGeometry(0.3, 0.03, 16, 32);
    const steeringWheelMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
    this.steeringWheel = new THREE.Mesh(steeringWheelGeometry, steeringWheelMaterial);
    
    // Add spokes to the steering wheel
    const spokeGeometry = new THREE.BoxGeometry(0.6, 0.02, 0.02);
    const spokeMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
    
    // Horizontal spoke
    const horizontalSpoke = new THREE.Mesh(spokeGeometry, spokeMaterial);
    this.steeringWheel.add(horizontalSpoke);
    
    // Vertical spoke
    const verticalSpoke = new THREE.Mesh(spokeGeometry, spokeMaterial);
    verticalSpoke.rotation.z = Math.PI / 2;
    this.steeringWheel.add(verticalSpoke);
    
    // Position steering wheel in the vehicle
    this.steeringWheel.position.set(0, 0.9, 0.7);
    this.steeringWheel.rotation.x = Math.PI / 2;
    this.chassis.add(this.steeringWheel);
    
    // Create windshield
    const windshieldGeometry = new THREE.PlaneGeometry(1.7, 1);
    const windshieldMaterial = new THREE.MeshPhongMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
    windshield.position.set(0, 1.2, 0.35);
    windshield.rotation.x = Math.PI / 3;
    this.chassis.add(windshield);
    
    // Add a simple dashboard
    const dashboardGeometry = new THREE.BoxGeometry(1.7, 0.3, 0.2);
    const dashboardMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const dashboard = new THREE.Mesh(dashboardGeometry, dashboardMaterial);
    dashboard.position.set(0, 0.8, 0.4);
    this.chassis.add(dashboard);
  }
  
  /**
   * Update vehicle position and rotation
   * @param {number} deltaTime - Time since last update in seconds
   * @param {Object} inputs - User inputs
   */
  update(deltaTime, inputs) {
    if (!this.vehicle || !this.chassis) return;
    
    // Extract input values
    const { steering, throttle, brake, handbrake, reverse, boost } = inputs;
    
    // Update steering and hand animations
    this.updateSteering(steering, deltaTime);
    
    // Update engine forces
    this.updateEngine(throttle, brake, reverse, boost);
    
    // Update wheel positions
    this.updateWheelPositions();
    
    // Update chassis position and rotation from physics
    this.updateChassisFromPhysics();
    
    // Update hands
    this.hands.update(deltaTime, steering);
    
    // Calculate speed (km/h)
    const velocity = this.chassisBody.velocity;
    
    // Get forward direction based on chassis orientation
    const chassisQuat = this.chassisBody.quaternion;
    const forwardVelocity = new CANNON.Vec3(0, 0, -1);
    forwardVelocity.scale(-1, forwardVelocity); // Flip to match vehicle forward direction
    
    // Transform the forward vector using the chassis quaternion
    chassisQuat.vmult(forwardVelocity, forwardVelocity);
    
    // Calculate dot product using the velocity components
    const dotProduct = 
      velocity.x * forwardVelocity.x + 
      velocity.y * forwardVelocity.y + 
      velocity.z * forwardVelocity.z;
    
    // Convert speed to km/h (Cannon.js uses m/s)
    this.speed = Math.abs(dotProduct) * 3.6;
    
    // Store velocity in userData for other systems (like camera shake)
    this.chassis.userData.velocity = this.speed / 3.6; // back to m/s
  }
  
  /**
   * Update steering angle and steering wheel rotation
   * @param {number} steeringInput - Steering input (-1 to 1)
   * @param {number} deltaTime - Time since last update
   */
  updateSteering(steeringInput, deltaTime) {
    // Calculate target steering angle
    const targetAngle = -steeringInput * this.maxSteeringAngle;
    
    // Smooth steering transitions
    const steeringSpeed = 3.0; // How quickly steering responds
    
    if (Math.abs(targetAngle - this.steeringAngle) > 0.001) {
      this.steeringAngle += (targetAngle - this.steeringAngle) * steeringSpeed * deltaTime;
    } else {
      this.steeringAngle = targetAngle;
    }
    
    // Apply steering to front wheels
    this.vehicle.setSteeringValue(this.steeringAngle, this.FRONT_LEFT);
    this.vehicle.setSteeringValue(this.steeringAngle, this.FRONT_RIGHT);
    
    // Rotate the steering wheel visual
    if (this.steeringWheel) {
      // Map steering angle to steering wheel rotation
      // Typically steering wheels rotate more than the actual wheel angle
      this.steeringWheel.rotation.y = -this.steeringAngle * 2;
    }
  }
  
  /**
   * Update engine forces
   * @param {number} throttle - Throttle input (0 to 1)
   * @param {number} brake - Brake input (0 to 1)
   * @param {boolean} reverse - Whether to drive in reverse
   * @param {boolean} boost - Whether to apply boost
   */
  updateEngine(throttle, brake, reverse, boost) {
    // Calculate engine force
    let engineForce = 0;
    let brakeForce = 0;
    
    // Less aggressive throttle smoothing
    const smoothThrottle = Math.min(throttle * Math.min(1, this.speed/3 + 0.5), 1);
    
    // Debug speed info
    console.log(`Speed: ${this.speed.toFixed(2)} km/h, Reverse: ${reverse}`);
    
    // Calculate actual direction - positive = forward, negative = backward
    const velocity = this.chassisBody.velocity;
    const chassisQuat = this.chassisBody.quaternion;
    const forwardDir = new CANNON.Vec3(0, 0, -1);
    chassisQuat.vmult(forwardDir, forwardDir);
    
    const velInForwardDir = 
      velocity.x * forwardDir.x + 
      velocity.y * forwardDir.y + 
      velocity.z * forwardDir.z;
    
    // Check if we're moving forward or backward
    const isMovingForward = velInForwardDir < 0; // Car faces -Z direction
    const actualSpeed = Math.abs(velInForwardDir) * 3.6; // km/h
    
    console.log(`Moving forward: ${isMovingForward}, Actual speed: ${actualSpeed.toFixed(2)}`);
    
    // Reverse logic with higher max speed
    if (reverse) {
      // Apply stronger brakes when going forward
      if (isMovingForward && actualSpeed > 5) {
        brakeForce = this.maxBrakeForce * 1.5; // Even stronger braking when trying to reverse
        engineForce = 0;
      }
      // Start reversing immediately when slow enough
      else {
        // Much stronger reverse force - increased to allow up to 30 km/h reverse speed
        engineForce = -smoothThrottle * this.maxForce * 5.0;
        
        // Limit reverse speed to 30 km/h (actual speed is in reverse so it's negative)
        if (!isMovingForward && actualSpeed > 30) {
          engineForce = 0;
        }
        
        brakeForce = 0;
      }
    } 
    else if (!reverse) {
      // Forward
      engineForce = smoothThrottle * this.maxForce;
      
      // Apply stronger brakes when brake is pressed
      brakeForce = brake * this.maxBrakeForce * 1.5;
      
      // Apply boost if requested
      if (boost) {
        engineForce *= 1.5;
      }
    }
    
    // Apply forces to wheels
    for (let i = 0; i < 4; i++) {
      // Make this all-wheel drive for better traction
      if (i === this.BACK_LEFT || i === this.BACK_RIGHT) {
        this.vehicle.applyEngineForce(engineForce, i);
      } else {
        // Front wheels also get power for better traction
        this.vehicle.applyEngineForce(engineForce * 0.4, i);
      }
      
      // Apply brakes to all wheels
      this.vehicle.setBrake(brakeForce, i);
    }
    
    // Apply initial impulse to help start moving from standstill
    if ((throttle > 0.1 || reverse) && actualSpeed < 2) {
      // Apply stronger impulse in reverse
      const impulseStrength = reverse ? 1000 : -300;
      const impulse = new CANNON.Vec3(0, 0, impulseStrength);
      const worldImpulse = new CANNON.Vec3();
      this.chassisBody.quaternion.vmult(impulse, worldImpulse);
      this.chassisBody.applyImpulse(worldImpulse, this.chassisBody.position);
    }
    
    // Apply downforce to keep car grounded as speed increases
    if (this.speed > 10) {
      const downforce = new CANNON.Vec3(0, -this.speed * 10, 0);
      this.chassisBody.applyLocalForce(downforce, new CANNON.Vec3(0, 0, 0));
    }
    
    // Simple anti-roll stabilization - counteract extreme tilting
    const rotation = new CANNON.Quaternion();
    this.chassisBody.quaternion.copy(rotation);
    
    // Get the vehicle's up vector (Y-axis)
    const vehicleUp = new CANNON.Vec3(0, 1, 0);
    rotation.vmult(vehicleUp, vehicleUp);
    
    // Calculate the tilt angle (angle between vehicle's up vector and world up)
    const worldUp = new CANNON.Vec3(0, 1, 0);
    const tiltAngle = Math.acos(vehicleUp.dot(worldUp));
    
    // If tilt is too extreme, apply a counter-torque to prevent flipping
    if (tiltAngle > Math.PI / 4) { // 45 degrees
      // Calculate axis of rotation (perpendicular to tilt plane)
      const correctionAxis = new CANNON.Vec3();
      vehicleUp.cross(worldUp, correctionAxis);
      correctionAxis.normalize();
      
      // Apply stronger counter-torque as tilt increases
      const correctionStrength = 5000 * (tiltAngle - Math.PI/4);
      const correctionTorque = correctionAxis.scale(correctionStrength);
      
      this.chassisBody.torque.vadd(correctionTorque, this.chassisBody.torque);
    }
  }
  
  /**
   * Update wheel positions and rotations from physics
   */
  updateWheelPositions() {
    // Update wheel positions from physics
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.updateWheelTransform(i);
      const wheelInfo = this.vehicle.wheelInfos[i];
      const wheelMesh = this.wheels[i];
      
      if (wheelMesh) {
        wheelMesh.position.copy(wheelInfo.worldTransform.position);
        wheelMesh.quaternion.copy(wheelInfo.worldTransform.quaternion);
      }
    }
  }
  
  /**
   * Update chassis position and rotation from physics
   */
  updateChassisFromPhysics() {
    // Update chassis position from physics
    this.chassis.position.copy(this.chassisBody.position);
    this.chassis.quaternion.copy(this.chassisBody.quaternion);
  }
  
  /**
   * Get current vehicle speed
   * @returns {number} Speed in km/h
   */
  getSpeed() {
    return this.speed;
  }
  
  /**
   * Apply force to push the vehicle
   * @param {THREE.Vector3} force - Force to apply
   * @param {THREE.Vector3} point - Point to apply force at (world coordinates)
   */
  applyForce(force, point) {
    this.chassisBody.applyForce(
      new CANNON.Vec3(force.x, force.y, force.z),
      new CANNON.Vec3(point.x, point.y, point.z)
    );
  }
} 