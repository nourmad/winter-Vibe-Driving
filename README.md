# Winter Driving Simulator

A 3D driving simulator built with Three.js featuring realistic vehicle physics, animated steering wheel with hands, and a procedurally generated winter environment.

## Features

- Realistic vehicle physics using cannon-es
- Detailed steering wheel with animated hands that follow your steering input
- Procedurally generated winter terrain with snow, trees, and rocks
- Dynamic snowfall with adjustable intensity
- Multiple camera modes (first-person, third-person, and orbit)
- Responsive controls for smooth driving experience

## Controls

- **W / Up Arrow**: Accelerate
- **S / Down Arrow**: Brake/Reverse
- **A / Left Arrow**: Steer left
- **D / Right Arrow**: Steer right
- **Space**: Handbrake
- **Shift**: Boost
- **Camera Toggle Button**: Switch between camera views

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm start
   ```
4. Open your browser and navigate to `http://localhost:1234`

## Requirements

- Node.js 14+
- Modern browser with WebGL support

## Technologies Used

- Three.js for 3D rendering
- cannon-es for physics simulation
- Parcel for bundling and development server

## Customization

You can customize various aspects of the simulator by modifying the values in the respective classes:

- `TerrainGenerator.js`: Adjust terrain size, detail, and snow properties
- `SnowEffect.js`: Change snow intensity, particle count, and wind effects
- `Vehicle.js`: Modify vehicle properties such as size, mass, and handling
- `CameraManager.js`: Adjust camera positions and behavior

## License

MIT 