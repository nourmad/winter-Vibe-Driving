import * as CANNON from 'cannon-es';

/**
 * Physics simulation using cannon-es
 */
export class Physics {
  constructor() {
    this.world = new CANNON.World();
    this.bodies = [];
    this.vehicleBodies = [];
  }
  
  /**
   * Initialize the physics world
   */
  init() {
    // Set gravity for a realistic world
    this.world.gravity.set(0, -9.82, 0);
    
    // Configure solver with better settings for vehicle physics
    this.world.solver.iterations = 30; // Increased from 20 for more accurate physics
    this.world.broadphase = new CANNON.SAPBroadphase(this.world); // Use Sweep-and-Prune for better performance
    this.world.defaultContactMaterial.friction = 0.2; // Increased from 0.05 for better traction
    
    // Create material for snow/ice surfaces
    this.snowMaterial = new CANNON.Material('snow');
    this.tireMaterial = new CANNON.Material('tire');
    
    // Create contact between snow and tires (slippery)
    const snowTireContactMaterial = new CANNON.ContactMaterial(
      this.snowMaterial,
      this.tireMaterial,
      {
        friction: 0.3,          // Increased from 0.15 for better traction
        restitution: 0.1,        // Low bounce
        contactEquationStiffness: 1000,
        contactEquationRelaxation: 3
      }
    );
    
    // Add the contact material to the world
    this.world.addContactMaterial(snowTireContactMaterial);
  }
  
  /**
   * Add a body to the physics world
   * @param {CANNON.Body} body - Physics body to add
   * @param {boolean} isVehicle - Whether this body is part of a vehicle
   * @returns {CANNON.Body} The added body
   */
  addBody(body, isVehicle = false) {
    this.world.addBody(body);
    this.bodies.push(body);
    
    if (isVehicle) {
      this.vehicleBodies.push(body);
      
      // Set collision groups for vehicle
      body.collisionFilterGroup = 1;
      body.collisionFilterMask = 1;
    }
    
    return body;
  }
  
  /**
   * Remove a body from the physics world
   * @param {CANNON.Body} body - Physics body to remove
   */
  removeBody(body) {
    const index = this.bodies.indexOf(body);
    if (index !== -1) {
      this.bodies.splice(index, 1);
      
      const vehicleIndex = this.vehicleBodies.indexOf(body);
      if (vehicleIndex !== -1) {
        this.vehicleBodies.splice(vehicleIndex, 1);
      }
      
      this.world.removeBody(body);
    }
  }
  
  /**
   * Create a vehicle constraint
   * @param {CANNON.Body} chassisBody - The vehicle chassis body
   * @param {Object} options - Vehicle options
   * @returns {CANNON.RaycastVehicle} Vehicle constraint
   */
  createVehicle(chassisBody, options = {}) {
    // Set up vehicle with default options
    const vehicleOptions = {
      chassisBody,
      ...options
    };
    
    const vehicle = new CANNON.RaycastVehicle({
      chassisBody,
      indexRightAxis: 0,     // X-axis is right
      indexForwardAxis: 2,   // Z-axis is forward
      indexUpAxis: 1         // Y-axis is up
    });
    
    // Add the vehicle to the world
    vehicle.addToWorld(this.world);
    
    return vehicle;
  }
  
  /**
   * Update physics simulation
   * @param {number} deltaTime - Time since last update in seconds
   */
  update(deltaTime) {
    // Step the physics world
    this.world.step(1/60, deltaTime, 3);
  }
  
  /**
   * Create a heightfield body from an array of height values
   * @param {Array} heightData - 2D array of height values
   * @param {Object} options - Options for the heightfield
   * @returns {CANNON.Body} Heightfield body
   */
  createTerrainBody(heightData, options = {}) {
    const { elementSize = 1, maxHeight = 10, minHeight = 0 } = options;
    
    // Create heightfield shape
    const heightfieldShape = new CANNON.Heightfield(heightData, {
      elementSize
    });
    
    // Create body
    const heightfieldBody = new CANNON.Body({
      mass: 0, // Static body
      material: this.snowMaterial
    });
    
    // Calculate position to center the heightfield
    const sizeX = (heightData.length - 1) * elementSize;
    const sizeZ = (heightData[0].length - 1) * elementSize;
    
    // Add heightfield shape and position it correctly
    heightfieldBody.addShape(heightfieldShape, new CANNON.Vec3(
      -sizeX / 2, 
      (minHeight + maxHeight) / 2 - maxHeight, 
      -sizeZ / 2
    ));
    
    // Rotate to match Three.js coordinate system
    heightfieldBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    
    // Ensure terrain has proper collision detection
    heightfieldBody.collisionFilterGroup = 1;
    heightfieldBody.collisionFilterMask = 1;
    
    // Add body to world
    this.addBody(heightfieldBody);
    
    return heightfieldBody;
  }
} 