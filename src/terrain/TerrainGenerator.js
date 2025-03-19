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
    this.size = 100;           // Size of the terrain
    this.resolution = 64;      // Resolution of the heightmap (reduced for performance)
    this.maxHeight = 6;        // Maximum terrain height
    
    // Generation objects
    this.terrain = null;       // Main terrain mesh
    this.heightData = null;    // Height data for physics
    this.snowCovering = null;  // Snow covering mesh
    
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
    
    // Define a simple road path in the middle
    const roadY = this.resolution / 2;
    const roadWidth = this.resolution / 10;
    
    // Fill height data using simple noise
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        // Convert grid positions to noise coordinates
        const nx = i / this.resolution * 5;
        const nz = j / this.resolution * 5;
        
        // Get base terrain height from noise
        let height = this.terrainNoise.noise(nx, nz) * this.maxHeight;
        
        // Flatten area for a simple road
        const distanceToRoad = Math.abs(j - roadY);
        if (distanceToRoad < roadWidth) {
          // Create smooth transition to road
          const factor = distanceToRoad / roadWidth;
          height = height * factor * factor;
          
          // Ensure road has some minimum height
          height = Math.max(0.2, height);
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
  }
} 