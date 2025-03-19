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
    
    // Engine properties
    this.maxForce = 1000;
    this.maxBrakeForce = 50;
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
   * @returns {Promise} Promise that resolves when the vehicle is loaded
   */
  async init() {
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
      material: this.physics.tireMaterial
    });
    this.chassisBody.addShape(chassisShape);
    this.chassisBody.position.set(0, 2, 0);
    
    // Add chassis to the physics world
    this.physics.addBody(this.chassisBody, true);
    
    // Create vehicle
    this.vehicle = this.physics.createVehicle(this.chassisBody);
    
    // Configure suspension and wheel properties
    const suspensionStiffness = 30;
    const suspensionRestLength = 0.3;
    const suspensionDamping = 4.4;
    const suspensionCompression = 4.4;
    const rollInfluence = 0.01;
    
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
    return new Promise((resolve) => {
      // Simple vehicle mesh for now
      // In a real application, you would load a GLTF model
      
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
      
      resolve();
    });
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
    const targetAngle = steeringInput * this.maxSteeringAngle;
    
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
    
    // Apply engine force based on throttle and direction
    if (reverse && this.speed < 5) {
      // Reverse
      engineForce = -throttle * this.maxForce * 0.7; // Less force for reverse
    } else if (!reverse) {
      // Forward
      engineForce = throttle * this.maxForce;
      
      // Apply boost if requested
      if (boost) {
        engineForce *= 1.5;
      }
    }
    
    // Apply brake force
    brakeForce = brake * this.maxBrakeForce;
    
    // Apply forces to wheels
    for (let i = 0; i < 4; i++) {
      // Applying more force to rear wheels for rear-wheel drive
      if (i === this.BACK_LEFT || i === this.BACK_RIGHT) {
        this.vehicle.applyEngineForce(engineForce, i);
      } else {
        // Front wheels get less engine force for a more realistic feel
        this.vehicle.applyEngineForce(engineForce * 0.1, i);
      }
      
      // Apply brakes to all wheels
      this.vehicle.setBrake(brakeForce, i);
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