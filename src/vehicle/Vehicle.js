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
    this.width = 1.7;     // Updated to match Ferrari F40 dimensions
    this.height = 1.2;    // Ferrari F40 is low to the ground
    this.length = 4.3;    // Updated to match Ferrari F40 length
    this.mass = 1400;     // Ferrari F40 is lighter
    
    // Position properties
    this.spawnPosition = new CANNON.Vec3(0, 0, 0); // Default position
    
    // Engine properties
    this.maxForce = 4000;       // Increased from 3000 to 4000 for faster acceleration
    this.maxBrakeForce = 500;   // Increased from 100 to 500 for stronger braking
    this.maxSteeringAngle = Math.PI / 4; // 45 degrees
    this.steeringCorrection = 0.025;     // Increased from 0.01 to 0.025 for stronger correction
    
    // Current vehicle state
    this.speed = 0;             // Current speed in km/h
    this.steeringAngle = 0;     // Current steering angle
    
    // Speed logging control
    this.lastLogTime = 0;       // Last time speed was logged
    this.logInterval = 200;     // Log interval in ms (200ms = 5 times per second)
    this.lastLoggedSpeed = 0;   // Track last logged speed to avoid duplicate logs
    
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
      linearDamping: 0.1,       // Increased damping for more stability
      angularDamping: 0.4       // Increased to improve steering responsiveness
    });
    this.chassisBody.addShape(chassisShape);
    
    // Use the spawn position set in the init method
    this.chassisBody.position.copy(this.spawnPosition);
    
    // Set initial rotation to face along the road (z-axis)
    this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), 0);
    
    // Add chassis to the physics world
    this.physics.addBody(this.chassisBody, true);
    
    // Create vehicle
    this.vehicle = this.physics.createVehicle(this.chassisBody);
    
    // Configure suspension and wheel properties for better handling
    const suspensionStiffness = 35;        // Higher value for more responsive steering
    const suspensionRestLength = 0.3;      // Distance from chassis to wheel at rest
    const suspensionDamping = 2.5;         // Damping prevents excessive bouncing
    const suspensionCompression = 4.0;     // Higher value means firmer suspension
    const rollInfluence = 0.01;            // Controls how much the car can roll during turns
    
    // Vehicle dimensions
    const axleWidth = 1.6;                 // Distance between left and right wheels
    const wheelRadius = 0.33;              // Radius of each wheel
    const wheelHalfWidth = 0.2;            // Half the width of each wheel
    
    // IMPORTANT: Define clear wheel positions with correct order:
    // 0: Front Left, 1: Front Right, 2: Back Left, 3: Back Right
    
    // Define wheel connection points with clearer front/back separation
    const frontZ = this.length / 2 - wheelRadius * 1.1;  // Front axle Z position (positive)
    const backZ = -this.length / 2 + wheelRadius * 1.1;  // Back axle Z position (negative)
    const leftX = -axleWidth / 2;                        // Left side X position
    const rightX = axleWidth / 2;                        // Right side X position
    const wheelY = 0;                                   // Wheel height (bottom of chassis)
    
    console.log(`Wheel positions: 
      Front Left: (${leftX}, ${wheelY}, ${frontZ})
      Front Right: (${rightX}, ${wheelY}, ${frontZ})
      Back Left: (${leftX}, ${wheelY}, ${backZ})
      Back Right: (${rightX}, ${wheelY}, ${backZ})`);
    
    // Wheel options configuration
    const wheelOptions = {
      radius: wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0), // Points downward
      suspensionStiffness,
      suspensionRestLength,
      dampingRelaxation: suspensionDamping,
      dampingCompression: suspensionCompression,
      rollInfluence,
      maxSuspensionForce: 50000,           // Maximum force the suspension can apply
      maxSuspensionTravel: 0.3,            // How far the suspension can extend/compress
      customSlidingRotationalSpeed: -30,    // How fast wheels spin when sliding/drifting
      useCustomSlidingRotationalSpeed: true,
      frictionSlip: 1.5                    // Higher value = more grip
    };
    
    // Add wheels in specific order: FL, FR, BL, BR
    
    // Add front left wheel (index 0)
    wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(leftX, wheelY, frontZ);
    this.vehicle.addWheel(wheelOptions);
    
    // Add front right wheel (index 1)
    wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(rightX, wheelY, frontZ);
    this.vehicle.addWheel(wheelOptions);
    
    // Update wheel options for rear wheels - slightly different friction
    wheelOptions.frictionSlip = 1.4;       // Slightly less grip for rear wheels
    
    // Add back left wheel (index 2)
    wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(leftX, wheelY, backZ);
    this.vehicle.addWheel(wheelOptions);
    
    // Add back right wheel (index 3)
    wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(rightX, wheelY, backZ);
    this.vehicle.addWheel(wheelOptions);
    
    // Create wheel bodies for physics simulation
    this.vehicle.wheelInfos.forEach((wheel, index) => {
      const wheelBody = new CANNON.Body({
        mass: 1,
        material: this.physics.tireMaterial,
        type: CANNON.Body.KINEMATIC,
        collisionFilterGroup: 0  // No collision with other objects
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
    
    // After creating the wheels, log their indices and positions for debugging
    console.log("Wheel indices:", {
      "Front Left": 0,
      "Front Right": 1,
      "Back Left": 2,
      "Back Right": 3
    });
  }
  
  /**
   * Load the 3D model of the vehicle
   * @returns {Promise} Promise that resolves when the model is loaded
   */
  async loadModel() {
    return new Promise((resolve, reject) => {
      console.log("Starting vehicle model loading process...");
      
      // Try multiple possible paths for the Ferrari model
      const possiblePaths = [
        './ferrari_f40.glb',
        '/ferrari_f40.glb',
        '../ferrari_f40.glb',
        'assets/ferrari_f40.glb',
        'public/ferrari_f40.glb',
        'models/ferrari_f40.glb',
        'src/ferrari_f40.glb'
      ];
      
      // Function to check if a file exists using fetch
      const checkFileExists = async (url) => {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          return response.ok;
        } catch (e) {
          console.error(`Error checking file at ${url}:`, e);
          return false;
        }
      };
      
      // Function to find the first valid path
      const findValidPath = async () => {
        console.log("Checking Ferrari model in these locations:", possiblePaths);
        
        // Try each path
        for (const path of possiblePaths) {
          console.log(`Checking if model exists at: ${path}`);
          const exists = await checkFileExists(path);
          if (exists) {
            console.log(`Found Ferrari model at: ${path}`);
            return path;
          }
        }
        
        // If no path works, return null
        console.error("Ferrari model not found in any of the expected locations");
        return null;
      };
      
      // Find and load from a valid path
      findValidPath().then(validPath => {
        if (!validPath) {
          console.error("No valid model path found, falling back to simple car");
          this.createSimpleCarModel();
          resolve();
          return;
        }
        
        console.log(`Loading Ferrari model from validated path: ${validPath}`);
        
        this.loader.load(
          validPath,
          (gltf) => {
            // Model loaded successfully
            console.log(`Ferrari F40 model loaded successfully!`);
            
            // Set the chassis to the loaded model
            this.chassis = gltf.scene;
            
            // Configure Ferrari F40 specific settings
            console.log("Applying Ferrari F40 specific settings");
            this.chassis.scale.set(0.7, 0.7, 0.7); // Scale for Ferrari F40
            // Fix car orientation - rotate 180 degrees to face forward
            this.chassis.rotation.y = Math.PI; // Changed back to Math.PI to rotate 180 degrees
            
            // Adjust position to ensure car is on the ground
            this.chassis.position.y = 0.2; // Lower the car to the ground
            
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
            
            // IMPORTANT: Don't create procedural wheels if we find wheels in the model
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
            
            // If exactly 4 wheels found, use them, otherwise create new ones
            if (wheelMeshes.length === 4) {
              console.log(`Using ${wheelMeshes.length} wheels from the Ferrari model`);
              // Sort wheels to ensure they're in the correct order: FL, FR, BL, BR
              // This step is important to match the physics wheel order
              this.wheels = this.sortWheels(wheelMeshes);
              
              // IMPORTANT: Remove wheels from scene to avoid duplicate wheels
              // The physics system will position them correctly
              this.wheels.forEach(wheel => {
                // Make wheel invisible in original position to avoid duplicates
                wheel.visible = false;
                // Create clones that will be positioned by physics
                const wheelClone = wheel.clone();
                wheelClone.visible = true;
                wheelClone.castShadow = true;
                this.scene.add(wheelClone);
                // Replace original wheel with clone in the wheels array
                const index = this.wheels.indexOf(wheel);
                this.wheels[index] = wheelClone;
              });
            } else {
              // Create procedural wheels
              console.log(`Found ${wheelMeshes.length} wheels in model, creating 4 procedural wheels instead`);
              this.wheels = [];
              const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.2, 24);
              wheelGeometry.rotateZ(Math.PI / 2);
              
              for (let i = 0; i < 4; i++) {
                const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
                wheelMesh.castShadow = true;
                this.scene.add(wheelMesh);
                this.wheels.push(wheelMesh);
              }
            }
            
            // Debug the wheels array
            console.log(`Final wheel count: ${this.wheels.length}`);
            
            // Create steering wheel in the correct position (front of car)
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
              
              // Position steering wheel in the vehicle's front interior (driver's position)
              this.steeringWheel.position.set(-0.4, 0.7, 0.5); // Repositioned to be inside the car on the left side
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
            this.createSimpleCarModel();
            resolve();
          }
        );
      });
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
    // Clamp steering input to ensure it's in the valid range
    steeringInput = Math.max(-1, Math.min(1, steeringInput));
    
    // Apply steering correction to counteract leftward drift when driving straight
    // Apply more correction at higher speeds where drift is more noticeable
    const driftCorrectionFactor = Math.min(1, this.speed / 50); // Gets stronger as speed increases up to 50 km/h
    if (Math.abs(steeringInput) < 0.1) {
      steeringInput += this.steeringCorrection * (1 + driftCorrectionFactor);
    }
    
    // Calculate the target steering angle (in radians)
    // Maximum angle is 45 degrees (PI/4) when steering input is at maximum
    const targetAngle = -steeringInput * this.maxSteeringAngle;
    
    // Smoothly interpolate toward the target angle for more natural steering response
    // Higher speeds should have reduced steering angle for stability
    const speedFactor = Math.max(0, 1 - (this.speed / 200)); // Reduces steering angle at high speeds
    const steeringSpeed = 5.0 * speedFactor; // How quickly steering responds
    
    // Apply smooth transition to the steering angle
    if (Math.abs(targetAngle - this.steeringAngle) > 0.001) {
      // Move current angle toward target angle at a rate proportional to deltaTime
      this.steeringAngle += (targetAngle - this.steeringAngle) * Math.min(steeringSpeed * deltaTime, 1);
    } else {
      // Snap to exact target if we're very close
      this.steeringAngle = targetAngle;
    }
    
    // Store steering input in userData for camera and other systems
    if (this.chassis) {
      if (!this.chassis.userData) this.chassis.userData = {};
      this.chassis.userData.steeringInput = steeringInput;
    }
    
    // IMPORTANT: Ensure only the front wheels steer by explicitly setting the wheel indices
    // Front wheels steer
    this.vehicle.setSteeringValue(this.steeringAngle, 0); // Front left
    this.vehicle.setSteeringValue(this.steeringAngle, 1); // Front right
    
    // Back wheels remain straight (no steering) - enforcing this explicitly
    this.vehicle.setSteeringValue(0, 2); // Back left
    this.vehicle.setSteeringValue(0, 3); // Back right
    
    // Rotate the steering wheel visual to match the steering angle
    // Apply more rotation to the visual wheel for better feedback (2.5x multiplier)
    if (this.steeringWheel) {
      this.steeringWheel.rotation.y = -this.steeringAngle * 2.5;
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
    
    // Get chassis velocity and determine direction
    const velocity = this.chassisBody.velocity;
    const chassisQuat = this.chassisBody.quaternion;
    const forwardDir = new CANNON.Vec3(0, 0, -1);
    chassisQuat.vmult(forwardDir, forwardDir);
    
    // Calculate velocity in the forward direction
    const velInForwardDir = 
      velocity.x * forwardDir.x + 
      velocity.y * forwardDir.y + 
      velocity.z * forwardDir.z;
    
    // Check if we're moving forward or backward
    const isMovingForward = velInForwardDir < 0; // Car faces -Z direction
    const actualSpeed = Math.abs(velInForwardDir) * 3.6; // km/h
    
    // Throttle speed logging to 5 times per second and only log when speed changes
    const currentTime = Date.now();
    const roundedSpeed = Math.round(this.speed); // Round to whole number
    if (currentTime - this.lastLogTime >= this.logInterval && 
        Math.abs(roundedSpeed - this.lastLoggedSpeed) >= 1) {
      console.log(`Speed: ${roundedSpeed} km/h, Direction: ${isMovingForward ? 'forward' : 'reverse'}`);
      this.lastLogTime = currentTime;
      this.lastLoggedSpeed = roundedSpeed;
    }
    
    // Maximum speeds for forward and reverse
    const MAX_FORWARD_SPEED = 140; // km/h (increased from 120 to 140)
    const MAX_REVERSE_SPEED = 30;  // km/h
    
    // Handle reverse
    if (reverse) {
      // Apply brakes when going forward and trying to reverse
      if (isMovingForward && actualSpeed > 1) {
        brakeForce = this.maxBrakeForce * 1.5;
        engineForce = 0;
      } 
      // Apply reverse force once we've slowed down enough
      else {
        engineForce = -this.maxForce * 0.5; // Less force for reverse
        
        // Limit reverse speed
        if (!isMovingForward && actualSpeed > MAX_REVERSE_SPEED) {
          engineForce = 0;
        }
      }
    }
    // Handle forward driving
    else {
      // Apply engine force for acceleration
      engineForce = throttle * this.maxForce;
      
      // Apply brakes when brake is pressed
      brakeForce = brake * this.maxBrakeForce;
      
      // Apply boost if requested
      if (boost && throttle > 0.1) {
        engineForce *= 1.3;
      }
      
      // Limit top speed
      if (isMovingForward && actualSpeed > MAX_FORWARD_SPEED) {
        engineForce = 0;
      }
    }
    
    // Apply engine force to all wheels with front-wheel drive bias
    for (let i = 0; i < 4; i++) {
      if (i === this.FRONT_LEFT || i === this.FRONT_RIGHT) {
        // Apply full engine force to front wheels (front-wheel drive)
        this.vehicle.applyEngineForce(engineForce, i);
      } else {
        // Apply no engine force to rear wheels in normal operation
        this.vehicle.applyEngineForce(0, i);
      }
      
      // Apply brakes to all wheels
      this.vehicle.setBrake(brakeForce, i);
    }
    
    // Apply downforce to keep car grounded as speed increases
    // This prevents the car from becoming unstable or flying at high speeds
    if (this.speed > 10) {
      const downforce = new CANNON.Vec3(0, -this.speed * 8, 0);
      this.chassisBody.applyLocalForce(downforce, new CANNON.Vec3(0, 0, 0));
    }
    
    // Apply anti-roll force to prevent tipping during sharp turns
    const rotation = new CANNON.Quaternion();
    this.chassisBody.quaternion.copy(rotation);
    
    // Get the vehicle's up vector (Y-axis)
    const vehicleUp = new CANNON.Vec3(0, 1, 0);
    rotation.vmult(vehicleUp, vehicleUp);
    
    // Calculate the tilt angle (angle between vehicle's up vector and world up)
    const worldUp = new CANNON.Vec3(0, 1, 0);
    const tiltAngle = Math.acos(vehicleUp.dot(worldUp));
    
    // Apply counter-torque if tilt is too extreme (prevents flipping)
    if (tiltAngle > Math.PI / 6) { // 30 degrees
      const correctionAxis = new CANNON.Vec3();
      vehicleUp.cross(worldUp, correctionAxis);
      correctionAxis.normalize();
      
      const correctionStrength = 3000 * (tiltAngle - Math.PI/6);
      const correctionTorque = correctionAxis.scale(correctionStrength);
      
      this.chassisBody.torque.vadd(correctionTorque, this.chassisBody.torque);
    }
  }
  
  /**
   * Update wheel positions and rotations from physics
   */
  updateWheelPositions() {
    // Update wheel positions from physics
    for (let i = 0; i < this.vehicle.wheelInfos.length && i < this.wheels.length; i++) {
      this.vehicle.updateWheelTransform(i);
      const wheelInfo = this.vehicle.wheelInfos[i];
      const wheelMesh = this.wheels[i];
      
      if (wheelMesh) {
        // Get the world position and rotation from the wheel physics
        wheelMesh.position.copy(wheelInfo.worldTransform.position);
        wheelMesh.quaternion.copy(wheelInfo.worldTransform.quaternion);
        
        // Debug wheel positions to ensure front/back alignment is correct
        const wheelType = i < 2 ? "Front" : "Back";
        const wheelSide = i % 2 === 0 ? "Left" : "Right";
        // Log wheel position every 100 frames to avoid spamming console
        if (Math.random() < 0.01) {
          console.log(`${wheelType} ${wheelSide} wheel position:`, wheelMesh.position);
        }
      }
    }
  }
  
  /**
   * Update chassis position and rotation from physics
   */
  updateChassisFromPhysics() {
    // Update chassis position directly from physics
    this.chassis.position.copy(this.chassisBody.position);
    
    // Get correct quaternion for visual orientation
    // The physics model and visual model need to be aligned
    const correctedQuaternion = this.chassisBody.quaternion.clone();
    
    // Apply 180-degree Y-axis correction to match the model orientation with physics
    const correctionQuat = new CANNON.Quaternion();
    correctionQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
    correctedQuaternion.mult(correctionQuat, correctedQuaternion);
    
    // Apply the rotation to the chassis mesh
    this.chassis.quaternion.copy(correctedQuaternion);
    
    // Store forward direction for camera system
    const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chassis.quaternion);
    if (!this.chassis.userData) this.chassis.userData = {};
    this.chassis.userData.forwardDirection = forwardDir;
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
  
  /**
   * Helper method to sort wheels in the correct order: FL, FR, BL, BR
   * This is important for matching wheels to the physics system
   * @param {Array} wheels - Array of wheel meshes to sort
   * @returns {Array} Sorted wheel meshes
   */
  sortWheels(wheels) {
    // Create a copy to avoid modifying the original array
    const wheelsCopy = [...wheels];
    
    // If we have exactly 4 wheels, force sorting by position
    if (wheels.length === 4) {
      console.log("Sorting 4 wheels by position to ensure correct front/back order");
      
      // Sort by Z position (front to back)
      const sortedByZ = [...wheelsCopy].sort((a, b) => a.position.z - b.position.z);
      
      // Front two wheels (smaller Z value - front of car)
      const frontWheels = sortedByZ.slice(0, 2);
      // Back two wheels (larger Z value - back of car)
      const backWheels = sortedByZ.slice(2, 4);
      
      // Sort front wheels by X (left to right)
      frontWheels.sort((a, b) => a.position.x - b.position.x);
      // Sort back wheels by X (left to right)
      backWheels.sort((a, b) => a.position.x - b.position.x);
      
      // Combine in proper order: FL, FR, BL, BR
      const properlyOrdered = [
        frontWheels[0], // Front Left
        frontWheels[1], // Front Right
        backWheels[0],  // Back Left
        backWheels[1]   // Back Right
      ];
      
      console.log("Wheel order ensured by position:", 
        properlyOrdered.map((w, i) => 
          `Wheel ${i}: ${i < 2 ? 'Front' : 'Back'} ${i % 2 === 0 ? 'Left' : 'Right'}`
        )
      );
      
      return properlyOrdered;
    }
    
    // Fallback to original method if not exactly 4 wheels
    // Define helper function to check if a name contains front/rear and left/right indicators
    const getWheelPosition = (name) => {
      name = name.toLowerCase();
      const isFront = name.includes('front') || name.includes('f');
      const isRear = name.includes('rear') || name.includes('back') || name.includes('r');
      const isLeft = name.includes('left') || name.includes('l');
      const isRight = name.includes('right') || name.includes('r');
      
      // If position can be determined by name
      if (isFront && isLeft) return 'FL';
      if (isFront && isRight) return 'FR';
      if (isRear && isLeft) return 'BL';
      if (isRear && isRight) return 'BR';
      
      // If position can't be determined by name, use position
      return '';
    };
    
    // Try to sort by name first
    const sortedWheels = [];
    const positions = ['FL', 'FR', 'BL', 'BR'];
    
    // Try to place wheels in their correct positions based on naming
    for (const position of positions) {
      const wheel = wheelsCopy.find(w => getWheelPosition(w.name) === position);
      if (wheel) {
        sortedWheels.push(wheel);
        wheelsCopy.splice(wheelsCopy.indexOf(wheel), 1);
      }
    }
    
    // If we couldn't sort all wheels by name, sort the remaining by position
    if (wheelsCopy.length > 0) {
      // If we don't have exactly 4 wheels, just add the remaining ones
      sortedWheels.push(...wheelsCopy);
    }
    
    console.log("Sorted wheels:", sortedWheels.map(w => w.name));
    return sortedWheels;
  }
} 