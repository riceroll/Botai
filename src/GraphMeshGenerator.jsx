import React, { useEffect, useState, useMemo } from 'react';
import { useManifold } from './ManifoldProvider';
import * as THREE from 'three';
import { LoopSubdivision } from 'three-subdivide';

// Helper: Convert Manifold mesh to Three.js BufferGeometry
function manifoldToThreeGeometry(manifoldMesh) {
  const geometry = new THREE.BufferGeometry();
  
  // Get vertex positions
  const numVert = manifoldMesh.numVert;
  const vertProperties = manifoldMesh.vertProperties;
  const positions = new Float32Array(numVert * 3);
  
  for (let i = 0; i < numVert; i++) {
    positions[i * 3] = vertProperties[i * 3];
    positions[i * 3 + 1] = vertProperties[i * 3 + 1];
    positions[i * 3 + 2] = vertProperties[i * 3 + 2];
  }
  
  // Get triangle indices
  const numTri = manifoldMesh.numTri;
  const triVerts = manifoldMesh.triVerts;
  const indices = new Uint32Array(numTri * 3);
  
  for (let i = 0; i < numTri * 3; i++) {
    indices[i] = triVerts[i];
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  
  return geometry;
}

// Generate random graph (nodes + edges)
function generateRandomGraph(numNodes = 5) {
  const nodes = [];
  const edges = [];
  
  // Generate random node positions
  for (let i = 0; i < numNodes; i++) {
    nodes.push({
      id: i,
      position: [
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      ]
    });
  }
  
  // Generate edges (connect each node to 2-3 random other nodes)
  const edgesPerNode = 2;
  for (let i = 0; i < numNodes; i++) {
    for (let j = 0; j < edgesPerNode; j++) {
      let target = Math.floor(Math.random() * numNodes);
      if (target !== i) {
        // Avoid duplicate edges
        const edgeExists = edges.some(e => 
          (e.from === i && e.to === target) || 
          (e.from === target && e.to === i)
        );
        if (!edgeExists) {
          edges.push({ from: i, to: target });
        }
      }
    }
  }
  
  return { nodes, edges };
}

// Create cylinder between two points using Manifold
function createCylinderBetweenPoints(Manifold, start, end, radius = 0.1, segments = 12) {
  const [x1, y1, z1] = start;
  const [x2, y2, z2] = end;
  
  // Calculate length and direction
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  if (length < 0.001) return null; // Skip very short edges
  
  // Create cylinder along Y-axis first
  const cylinder = Manifold.cylinder(length, radius, radius, segments);
  
  // Calculate rotation to align with edge direction
  const direction = new THREE.Vector3(dx, dy, dz).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  
  // Create rotation matrix
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
  const matrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
  
  // Get midpoint
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const midZ = (z1 + z2) / 2;
  
  // Apply transformation
  const rotated = cylinder.transform([
    matrix.elements[0], matrix.elements[1], matrix.elements[2], 0,
    matrix.elements[4], matrix.elements[5], matrix.elements[6], 0,
    matrix.elements[8], matrix.elements[9], matrix.elements[10], 0,
    midX, midY, midZ, 1
  ]);
  
  return rotated;
}

const GraphMeshGenerator = ({ subdivisionLevel = 1 }) => {
  const { Manifold } = useManifold();
  const [geometry, setGeometry] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Generate graph once
  const graph = useMemo(() => generateRandomGraph(6), []);
  
  useEffect(() => {
    if (!Manifold) return;
    
    setLoading(true);
    
    // Use setTimeout to avoid blocking UI
    setTimeout(() => {
      try {
        console.log('🔨 Creating graph mesh with Manifold...');
        console.log(`   Nodes: ${graph.nodes.length}`);
        console.log(`   Edges: ${graph.edges.length}`);
        
        let result = null;
        
        // Create spheres at nodes
        graph.nodes.forEach(node => {
          const sphere = Manifold.sphere(0.2, 16);
          const translated = sphere.translate(node.position);
          
          if (result === null) {
            result = translated;
          } else {
            result = result.add(translated); // Boolean union
          }
        });
        
        // Create cylinders for edges
        graph.edges.forEach(edge => {
          const startPos = graph.nodes[edge.from].position;
          const endPos = graph.nodes[edge.to].position;
          
          const cylinder = createCylinderBetweenPoints(
            Manifold, 
            startPos, 
            endPos, 
            0.08, // radius
            12    // segments
          );
          
          if (cylinder && result) {
            result = result.add(cylinder);
          } else if (cylinder) {
            result = cylinder;
          }
        });
        
        if (!result) {
          console.error('❌ Failed to create mesh');
          setLoading(false);
          return;
        }
        
        // Get the mesh data
        const mesh = result.getMesh();
        
        // Convert to Three.js geometry
        let threeGeometry = manifoldToThreeGeometry(mesh);
        
        console.log('✅ Base geometry created');
        console.log(`   Vertices: ${threeGeometry.attributes.position.count}`);
        console.log(`   Triangles: ${threeGeometry.index.count / 3}`);
        
        // Apply subdivision
        if (subdivisionLevel > 0) {
          console.log(`🔄 Applying ${subdivisionLevel} level(s) of subdivision...`);
          
          for (let i = 0; i < subdivisionLevel; i++) {
            threeGeometry = LoopSubdivision.modify(threeGeometry, 1);
          }
          
          console.log('✅ Subdivision complete');
          console.log(`   Final Vertices: ${threeGeometry.attributes.position.count}`);
          console.log(`   Final Triangles: ${threeGeometry.index.count / 3}`);
        }
        
        threeGeometry.computeVertexNormals();
        setGeometry(threeGeometry);
        setLoading(false);
        
      } catch (err) {
        console.error('❌ Failed to create geometry:', err);
        setLoading(false);
      }
    }, 100);
    
  }, [Manifold, graph, subdivisionLevel]);
  
  if (loading || !geometry) {
    return (
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#cccccc" wireframe />
      </mesh>
    );
  }
  
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial 
        color="#4a9eff" 
        metalness={0.3}
        roughness={0.5}
      />
    </mesh>
  );
};

export default GraphMeshGenerator;