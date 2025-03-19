import * as THREE from 'three';
import * as CANNON from 'cannon-es';
// Replace the SimplexNoise import with a custom implementation
// import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

/**
 * Simple noise generator for terrain
 */
class SimpleNoise {
  constructor(seed = 1) {
    this.seed = seed;
  }
  
  noise(x, y) {
    // Very simple noise function for testing
    return Math.sin(x * this.seed) * Math.cos(y * this.seed) * 0.5 + 0.5;
  }
}

/**
 * TerrainGenerator creates procedural winter terrain
 */
export class TerrainGenerator {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    
    // Terrain settings
    this.size = 200;           // Doubled terrain size from 100 to 200
    this.resolution = 128;     // Doubled resolution to match larger terrain
    this.maxHeight = 6;        // Maximum terrain height
    
    // Road settings
    this.roadWidth = this.resolution / 5;  // Make road wider
    this.roadY = this.resolution / 2;      // Road position in the middle
    this.roadHeight = 0.5;                 // Fixed road height
    
    // Generation objects
    this.terrain = null;       // Main terrain mesh
    this.heightData = null;    // Height data for physics
    this.snowCovering = null;  // Snow covering mesh
    this.road = null;          // Road mesh
    
    // Simplified noise generators 
    this.terrainNoise = new SimpleNoise(1);
  }
  
  /**
   * Generate the terrain and add it to the scene
   */
  generate() {
    console.log("Generating terrain...");
    
    // Create heightmap data
    this.generateHeightData();
    
    // Create terrain mesh
    this.createTerrainMesh();
    
    // Add snow covering
    this.createSnowCovering();
    
    // Add physics terrain
    this.createTerrainPhysics();
    
    console.log("Terrain generation complete");
  }
  
  /**
   * Generate height data for the terrain
   */
  generateHeightData() {
    // Create height data array
    this.heightData = new Array(this.resolution);
    for (let i = 0; i < this.resolution; i++) {
      this.heightData[i] = new Array(this.resolution);
    }
    
    // Fill height data using simple noise
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        // Convert grid positions to noise coordinates
        const nx = i / this.resolution * 5;
        const nz = j / this.resolution * 5;
        
        // Get base terrain height from noise
        let height = this.terrainNoise.noise(nx, nz) * this.maxHeight;
        
        // Flatten area for road
        const distanceToRoad = Math.abs(j - this.roadY);
        if (distanceToRoad < this.roadWidth) {
          // Set fixed road height
          height = this.roadHeight;
        } else if (distanceToRoad < this.roadWidth * 1.5) {
          // Create smooth transition from road to terrain
          const transitionWidth = this.roadWidth * 0.5;
          const factor = (distanceToRoad - this.roadWidth) / transitionWidth;
          height = this.roadHeight + (height - this.roadHeight) * factor * factor;
        }
        
        // Add edge falloff
        const edgeDistance = Math.min(
          i, this.resolution - i,
          j, this.resolution - j
        ) / (this.resolution * 0.1);
        
        const edgeFactor = Math.min(1, edgeDistance);
        height *= edgeFactor;
        
        // Store height in grid
        this.heightData[i][j] = height;
      }
    }
  }
  
  /**
   * Create terrain mesh from height data
   */
  createTerrainMesh() {
    // Create terrain geometry
    const geometry = new THREE.PlaneGeometry(
      this.size,
      this.size,
      this.resolution - 1,
      this.resolution - 1
    );
    
    // Rotate to XZ plane
    geometry.rotateX(-Math.PI / 2);
    
    // Apply height data to vertices
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        const index = (i * this.resolution + j) * 3;
        vertices[index + 1] = this.heightData[i][j]; // Y component
      }
    }
    
    // Update normals
    geometry.computeVertexNormals();
    
    // Create terrain material
    const material = new THREE.MeshStandardMaterial({
      color: 0x7b6d64,
      roughness: 0.95,
      metalness: 0
    });
    
    // Create terrain mesh
    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = true;
    
    // Center terrain
    this.terrain.position.set(-this.size / 2, 0, -this.size / 2);
    
    // Add to scene
    this.scene.add(this.terrain);
    
    // Create a separate road mesh
    this.createRoadMesh();
  }
  
  /**
   * Create snow covering mesh on top of terrain
   */
  createSnowCovering() {
    // Create snow geometry (identical to terrain but slightly elevated)
    const geometry = new THREE.PlaneGeometry(
      this.size,
      this.size,
      this.resolution - 1,
      this.resolution - 1
    );
    
    // Rotate to XZ plane
    geometry.rotateX(-Math.PI / 2);
    
    // Apply height data to vertices with snow height variation
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        const index = (i * this.resolution + j) * 3;
        
        // Apply height with snow on top (fixed snow height)
        vertices[index + 1] = this.heightData[i][j] + 0.2;
      }
    }
    
    // Update normals
    geometry.computeVertexNormals();
    
    // Create snow material
    const snowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.1
    });
    
    // Create snow mesh
    this.snowCovering = new THREE.Mesh(geometry, snowMaterial);
    this.snowCovering.receiveShadow = true;
    
    // Center snow
    this.snowCovering.position.set(-this.size / 2, 0, -this.size / 2);
    
    // Add to scene
    this.scene.add(this.snowCovering);
  }
  
  /**
   * Create physics body for terrain collision
   */
  createTerrainPhysics() {
    // Convert height data to format needed by physics
    this.physics.createTerrainBody(this.heightData, {
      elementSize: this.size / this.resolution,
      maxHeight: this.maxHeight,
      minHeight: 0
    });
    
    // Create a specific collision body for the road
    this.createRoadPhysics();
  }
  
  /**
   * Create a dedicated physics body for the road to ensure solid collision
   */
  createRoadPhysics() {
    // Road dimensions (match with visual road)
    const roadLength = this.size;
    const roadWidth = (this.roadWidth * 2) * (this.size / this.resolution);
    
    // Create a box shape for the road
    const roadShape = new CANNON.Box(new CANNON.Vec3(
      roadWidth / 2,    // half width 
      0.1,              // half height (thickness)
      roadLength / 2    // half length
    ));
    
    // Create road body
    const roadBody = new CANNON.Body({
      mass: 0,  // Static body
      material: this.physics.snowMaterial,
      type: CANNON.Body.STATIC
    });
    
    // Add shape to body
    roadBody.addShape(roadShape);
    
    // Position the road at the same place as the visual road
    roadBody.position.set(0, this.roadHeight - 0.05, 0); // Lower slightly to ensure good contact
    
    // Create a special road material with better friction
    const roadMaterial = new CANNON.Material('road');
    roadBody.material = roadMaterial;
    
    // Create contact between road and tires
    const roadTireContactMaterial = new CANNON.ContactMaterial(
      roadMaterial,
      this.physics.tireMaterial,
      {
        friction: 1.2,             // Increased from 0.8 for more grip
        restitution: 0.01,         // Almost no bounce
        contactEquationStiffness: 1500, // Increased for better road contact
        contactEquationRelaxation: 4,
        frictionEquationStiffness: 1000 // Added to improve traction
      }
    );
    
    // Add the contact material to the world
    this.physics.world.addContactMaterial(roadTireContactMaterial);
    
    // Set collision groups
    roadBody.collisionFilterGroup = 1;
    roadBody.collisionFilterMask = 1;
    
    // Add body to physics world
    this.physics.addBody(roadBody);
    
    // Create a duplicate road ahead
    this.createExtendedRoadPhysics(roadMaterial);
  }
  
  /**
   * Create an extended road section ahead of the main road
   * @param {CANNON.Material} roadMaterial - Road material to use
   */
  createExtendedRoadPhysics(roadMaterial) {
    // Road dimensions for extended section
    const roadLength = this.size;
    const roadWidth = (this.roadWidth * 2) * (this.size / this.resolution);
    
    // Create a box shape for the extended road
    const extRoadShape = new CANNON.Box(new CANNON.Vec3(
      roadWidth / 2,    // half width 
      0.1,              // half height (thickness)
      roadLength / 2    // half length
    ));
    
    // Create extended road body
    const extRoadBody = new CANNON.Body({
      mass: 0,  // Static body
      material: roadMaterial,
      type: CANNON.Body.STATIC
    });
    
    // Add shape to body
    extRoadBody.addShape(extRoadShape);
    
    // Position the extended road in front of the main road
    extRoadBody.position.set(0, this.roadHeight - 0.05, -roadLength); 
    
    // Add body to physics world
    this.physics.addBody(extRoadBody);
  }
  
  /**
   * Create a visible road mesh on top of the terrain
   */
  createRoadMesh() {
    // Road dimensions
    const roadLength = this.size;
    const roadWidth = (this.roadWidth * 2) * (this.size / this.resolution);
    
    // Create road geometry
    const roadGeometry = new THREE.PlaneGeometry(roadWidth, roadLength);
    roadGeometry.rotateX(-Math.PI / 2);
    
    // Create road material with asphalt texture
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.1
    });
    
    // Create road mesh
    this.road = new THREE.Mesh(roadGeometry, roadMaterial);
    
    // Position road slightly above terrain to prevent z-fighting
    this.road.position.set(0, this.roadHeight + 0.02, 0);
    
    // Add road markings
    this.addRoadMarkings(this.road, roadWidth, roadLength);
    
    // Add to scene
    this.scene.add(this.road);
    
    // Create extended road ahead
    this.createExtendedRoadMesh(roadMaterial, roadWidth, roadLength);
  }
  
  /**
   * Create an extended road mesh ahead of the main road
   * @param {THREE.Material} roadMaterial - Road material to use
   * @param {number} roadWidth - Width of the road
   * @param {number} roadLength - Length of the road
   */
  createExtendedRoadMesh(roadMaterial, roadWidth, roadLength) {
    // Create extended road geometry
    const extRoadGeometry = new THREE.PlaneGeometry(roadWidth, roadLength);
    extRoadGeometry.rotateX(-Math.PI / 2);
    
    // Create extended road mesh
    const extRoad = new THREE.Mesh(extRoadGeometry, roadMaterial);
    
    // Position extended road ahead of the main road
    extRoad.position.set(0, this.roadHeight + 0.02, -roadLength);
    
    // Add road markings
    this.addRoadMarkings(extRoad, roadWidth, roadLength);
    
    // Add to scene
    this.scene.add(extRoad);
  }
  
  /**
   * Add road markings to the road mesh
   */
  addRoadMarkings(roadMesh, roadWidth, roadLength) {
    // Create center line
    const centerLineGeometry = new THREE.PlaneGeometry(0.2, roadLength);
    centerLineGeometry.rotateX(-Math.PI / 2);
    
    const linesMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF
    });
    
    const centerLine = new THREE.Mesh(centerLineGeometry, linesMaterial);
    centerLine.position.y = 0.01; // Slightly above road
    roadMesh.add(centerLine);
    
    // Create dashed side lines
    const dashLength = 2;
    const dashGap = 2;
    const numDashes = Math.floor(roadLength / (dashLength + dashGap));
    
    for (let i = 0; i < numDashes; i++) {
      // Left side dash
      const leftDashGeometry = new THREE.PlaneGeometry(0.2, dashLength);
      leftDashGeometry.rotateX(-Math.PI / 2);
      const leftDash = new THREE.Mesh(leftDashGeometry, linesMaterial);
      leftDash.position.set(-roadWidth/2 + 1, 0.01, -roadLength/2 + i * (dashLength + dashGap) + dashLength/2);
      roadMesh.add(leftDash);
      
      // Right side dash
      const rightDashGeometry = new THREE.PlaneGeometry(0.2, dashLength);
      rightDashGeometry.rotateX(-Math.PI / 2);
      const rightDash = new THREE.Mesh(rightDashGeometry, linesMaterial);
      rightDash.position.set(roadWidth/2 - 1, 0.01, -roadLength/2 + i * (dashLength + dashGap) + dashLength/2);
      roadMesh.add(rightDash);
    }
  }
  
  /**
   * Get the road height for vehicle spawning
   * @returns {number} Road height in world coordinates
   */
  getRoadHeight() {
    return this.roadHeight;
  }
} 