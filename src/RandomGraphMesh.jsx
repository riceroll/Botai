import React, { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useManifold } from './ManifoldProvider';
import { LoopSubdivision } from 'three-subdivide';

// Helper: Convert Manifold mesh to Three.js BufferGeometry
function manifoldToThreeGeometry(manifoldMesh) {
  const geometry = new THREE.BufferGeometry();
  
  const numVert = manifoldMesh.numVert;
  const vertProperties = manifoldMesh.vertProperties;
  const positions = new Float32Array(numVert * 3);
  
  for (let i = 0; i < numVert; i++) {
    positions[i * 3] = vertProperties[i * 3];
    positions[i * 3 + 1] = vertProperties[i * 3 + 1];
    positions[i * 3 + 2] = vertProperties[i * 3 + 2];
  }
  
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

// Helper functions for remeshing
function distance(p0, p1) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const dz = p1[2] - p0[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function makeEdgeKey(v0, v1) {
  return v0 < v1 ? `${v0}-${v1}` : `${v1}-${v0}`;
}

function addEdge(edges, v0, v1, triIndex) {
  const key = makeEdgeKey(v0, v1);
  if (!edges.has(key)) {
    edges.set(key, { triangles: [] });
  }
  edges.get(key).triangles.push(triIndex);
}

// Remesh the geometry to create more uniform triangles
function remeshGeometry(geometry, targetEdgeLength = 0.1, iterations = 3) {
  console.log(`🔄 Starting remeshing (target edge length: ${targetEdgeLength}, iterations: ${iterations})...`);
  
  const minLength = targetEdgeLength * 0.8;
  const maxLength = targetEdgeLength * 1.33;
  
  let positions = Array.from(geometry.attributes.position.array);
  let indices = Array.from(geometry.index.array);
  
  for (let iter = 0; iter < iterations; iter++) {
    const numVert = positions.length / 3;
    const numTri = indices.length / 3;
    
    // Build vertex positions array
    const vertexPositions = [];
    for (let i = 0; i < numVert; i++) {
      vertexPositions.push([
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      ]);
    }
    
    // Build edges from triangles
    const edges = new Map();
    for (let i = 0; i < numTri; i++) {
      const v0 = indices[i * 3];
      const v1 = indices[i * 3 + 1];
      const v2 = indices[i * 3 + 2];
      
      addEdge(edges, v0, v1, i);
      addEdge(edges, v1, v2, i);
      addEdge(edges, v2, v0, i);
    }
    
    // Split long edges
    const newVertices = [];
    const splitMap = new Map();
    
    edges.forEach((edgeData, edgeKey) => {
      const [v0, v1] = edgeKey.split('-').map(Number);
      const p0 = vertexPositions[v0];
      const p1 = vertexPositions[v1];
      const length = distance(p0, p1);
      
      if (length > maxLength) {
        const midpoint = [
          (p0[0] + p1[0]) / 2,
          (p0[1] + p1[1]) / 2,
          (p0[2] + p1[2]) / 2
        ];
        const newVertexIndex = vertexPositions.length + newVertices.length;
        newVertices.push(midpoint);
        splitMap.set(edgeKey, newVertexIndex);
      }
    });
    
    // If we split edges, rebuild triangles
    if (newVertices.length > 0) {
      const allVertices = [...vertexPositions, ...newVertices];
      const newTriangles = [];
      
      for (let i = 0; i < numTri; i++) {
        const v0 = indices[i * 3];
        const v1 = indices[i * 3 + 1];
        const v2 = indices[i * 3 + 2];
        
        const split01 = splitMap.get(makeEdgeKey(v0, v1));
        const split12 = splitMap.get(makeEdgeKey(v1, v2));
        const split20 = splitMap.get(makeEdgeKey(v2, v0));
        
        // Subdivide triangle based on which edges are split
        if (split01 !== undefined && split12 !== undefined && split20 !== undefined) {
          // All three edges split - create 4 triangles
          newTriangles.push(v0, split01, split20);
          newTriangles.push(v1, split12, split01);
          newTriangles.push(v2, split20, split12);
          newTriangles.push(split01, split12, split20);
        } else if (split01 !== undefined && split12 !== undefined) {
          // Two edges split
          newTriangles.push(v0, split01, v2);
          newTriangles.push(split01, v1, split12);
          newTriangles.push(split01, split12, v2);
        } else if (split12 !== undefined && split20 !== undefined) {
          newTriangles.push(v1, split12, v0);
          newTriangles.push(split12, v2, split20);
          newTriangles.push(split12, split20, v0);
        } else if (split20 !== undefined && split01 !== undefined) {
          newTriangles.push(v2, split20, v1);
          newTriangles.push(split20, v0, split01);
          newTriangles.push(split20, split01, v1);
        } else if (split01 !== undefined) {
          // One edge split
          newTriangles.push(v0, split01, v2);
          newTriangles.push(split01, v1, v2);
        } else if (split12 !== undefined) {
          newTriangles.push(v1, split12, v0);
          newTriangles.push(split12, v2, v0);
        } else if (split20 !== undefined) {
          newTriangles.push(v2, split20, v1);
          newTriangles.push(split20, v0, v1);
        } else {
          // No split
          newTriangles.push(v0, v1, v2);
        }
      }
      
      // Update positions and indices
      positions = allVertices.flatMap(v => v);
      indices = newTriangles;
      
      console.log(`   Iteration ${iter + 1}: Split ${newVertices.length} edges, now ${allVertices.length} vertices, ${newTriangles.length / 3} triangles`);
    } else {
      console.log(`   Iteration ${iter + 1}: No edges to split`);
    }
    
    // Laplacian smoothing
    const numVertSmooth = positions.length / 3;
    const neighbors = Array.from({ length: numVertSmooth }, () => new Set());
    
    for (let i = 0; i < indices.length / 3; i++) {
      const v0 = indices[i * 3];
      const v1 = indices[i * 3 + 1];
      const v2 = indices[i * 3 + 2];
      
      neighbors[v0].add(v1);
      neighbors[v0].add(v2);
      neighbors[v1].add(v0);
      neighbors[v1].add(v2);
      neighbors[v2].add(v0);
      neighbors[v2].add(v1);
    }
    
    const smoothedPositions = [...positions];
    const smoothFactor = 0.5;
    
    for (let i = 0; i < numVertSmooth; i++) {
      if (neighbors[i].size === 0) continue;
      
      let avgX = 0, avgY = 0, avgZ = 0;
      neighbors[i].forEach(ni => {
        avgX += positions[ni * 3];
        avgY += positions[ni * 3 + 1];
        avgZ += positions[ni * 3 + 2];
      });
      
      const count = neighbors[i].size;
      avgX /= count;
      avgY /= count;
      avgZ /= count;
      
      smoothedPositions[i * 3] = positions[i * 3] * (1 - smoothFactor) + avgX * smoothFactor;
      smoothedPositions[i * 3 + 1] = positions[i * 3 + 1] * (1 - smoothFactor) + avgY * smoothFactor;
      smoothedPositions[i * 3 + 2] = positions[i * 3 + 2] * (1 - smoothFactor) + avgZ * smoothFactor;
    }
    
    positions = smoothedPositions;
  }
  
  // Create new geometry with remeshed data
  const newGeometry = new THREE.BufferGeometry();
  newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  newGeometry.setIndex(indices);
  newGeometry.computeVertexNormals();
  
  console.log(`✅ Remeshing complete! Final: ${positions.length / 3} vertices, ${indices.length / 3} triangles`);
  
  return newGeometry;
}

// Generate random graph with vertices and edges
function generateRandomGraph(numVertices = 5, numEdges = 10) {
  const vertices = [];
  const edges = [];
  
  // Generate random vertex positions
  for (let i = 0; i < numVertices; i++) {
    vertices.push({
      id: i,
      position: [
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      ]
    });
  }
  
  // Generate random edges (avoid duplicates)
  const edgeSet = new Set();
  let attempts = 0;
  while (edges.length < numEdges && attempts < numEdges * 3) {
    const from = Math.floor(Math.random() * numVertices);
    const to = Math.floor(Math.random() * numVertices);
    
    if (from !== to) {
      const edgeKey = from < to ? `${from}-${to}` : `${to}-${from}`;
      
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edges.push({ from, to });
      }
    }
    attempts++;
  }
  
  console.log(`📊 Generated graph: ${numVertices} vertices, ${edges.length} edges`);
  
  return { vertices, edges };
}

const RandomGraphMesh = ({ 
  showDebug = false, 
  showWireframe = false,
  enableRemesh = false,
  targetEdgeLength = 0.1,
  remeshIterations = 3,
  subdivisionLevel = 0,
  subdivisionType = 'loop',
  onGeometryReady = null
}) => {
  const manifoldContext = useManifold();
  const [geometry, setGeometry] = useState(null);
  const onGeometryReadyRef = React.useRef(onGeometryReady);
  
  // Update ref when callback changes
  React.useEffect(() => {
    onGeometryReadyRef.current = onGeometryReady;
  }, [onGeometryReady]);
  
  // Generate graph once on mount
  const graph = useMemo(() => generateRandomGraph(5, 10), []);
  
  useEffect(() => {
    if (!manifoldContext || !manifoldContext.Manifold) return;
    
    const { Manifold } = manifoldContext;
    const { sphere, cylinder } = Manifold;
    
    console.log('🔨 Creating graph mesh with boolean union...');
    
    try {
      let result = null;
      
      // Create spheres at vertices
      graph.vertices.forEach((vertex, index) => {
        const s = sphere(0.051, 16);
        const translated = s.translate(vertex.position);
        
        if (result === null) {
          result = translated;
        } else {
          result = result.add(translated); // Boolean union
        }
        
        console.log(`   Added vertex ${index + 1}/${graph.vertices.length}`);
      });
      
      // Create cylinders for edges
      graph.edges.forEach((edge, index) => {
        const startPos = graph.vertices[edge.from].position;
        const endPos = graph.vertices[edge.to].position;
        
        const [x1, y1, z1] = startPos;
        const [x2, y2, z2] = endPos;
        
        // Calculate direction and length
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dz = z2 - z1;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (length < 0.001) return; // Skip very short edges
        
        // Create cylinder along Z-axis (from 0 to length)
        // Note: Manifold cylinder is along Z-axis by default, from 0 to height
        const cyl = cylinder(length, 0.05, 0.05, 12);
        
        // Calculate rotation to align Z-axis with edge direction
        const direction = new THREE.Vector3(dx, dy, dz).normalize();
        const zAxis = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(zAxis, direction);
        const rotMatrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
        
        // Create translation matrix to move cylinder start to startPos
        const translationMatrix = new THREE.Matrix4().makeTranslation(x1, y1, z1);
        
        // Create combined transformation matrix: first rotate, then translate
        const finalMatrix = new THREE.Matrix4().multiplyMatrices(translationMatrix, rotMatrix);
        
        // Convert Three.js Matrix4 to Manifold's format (column-major 4x4)
        const m = finalMatrix.elements;
        const transform = [
          m[0], m[1], m[2], m[3],
          m[4], m[5], m[6], m[7],
          m[8], m[9], m[10], m[11],
          m[12], m[13], m[14], m[15]
        ];
        
        const transformed = cyl.transform(transform);
        
        if (result === null) {
          result = transformed;
        } else {
          result = result.add(transformed); // Boolean union
        }
        
        console.log(`   Added edge ${index + 1}/${graph.edges.length}`);
      });
      
      if (!result) {
        console.error('❌ Failed to create mesh');
        return;
      }
      
      // Get the mesh data
      const mesh = result.getMesh();
      
      // Get number of meshes (connected components)
      const numMeshes = result.decompose().length;
      
      // Convert to Three.js geometry
      let threeGeometry = manifoldToThreeGeometry(mesh);
      
      if (!threeGeometry) {
        console.error('❌ Failed to convert Manifold mesh to Three.js geometry');
        return;
      }
      
      console.log('✅ Boolean union complete!');
      console.log(`   Number of meshes: ${numMeshes}`);
      console.log(`   Final vertices: ${threeGeometry.attributes.position.count}`);
      if (threeGeometry.index) {
        console.log(`   Final triangles: ${threeGeometry.index.count / 3}`);
      }
      
      // Apply remeshing if enabled
      if (enableRemesh) {
        threeGeometry = remeshGeometry(threeGeometry, targetEdgeLength, remeshIterations);
      }
      
      // Apply Loop subdivision if requested
      if (subdivisionLevel > 0) {
        console.log(`🔄 Applying Loop subdivision (${subdivisionLevel} levels)...`);
        
        try {
          for (let i = 0; i < subdivisionLevel; i++) {
            const subdivided = LoopSubdivision.modify(threeGeometry, 1);
            if (!subdivided) {
              console.error('❌ Subdivision failed at level', i + 1);
              break;
            }
            threeGeometry = subdivided;
          }
          
          if (threeGeometry) {
            console.log(`✅ Subdivision complete!`);
            console.log(`   Final vertices after subdivision: ${threeGeometry.attributes.position.count}`);
            if (threeGeometry.index) {
              console.log(`   Final triangles after subdivision: ${threeGeometry.index.count / 3}`);
            }
            
            threeGeometry.computeVertexNormals();
          }
        } catch (subdivError) {
          console.error('❌ Error during subdivision:', subdivError);
        }
      }
      
      if (threeGeometry) {
        setGeometry(threeGeometry);
        
        // Notify parent component that geometry is ready
        if (onGeometryReadyRef.current) {
          onGeometryReadyRef.current(threeGeometry);
        }
      }
      
      // Clean up Manifold objects
      result.delete();
      
    } catch (error) {
      console.error('❌ Error creating graph mesh:', error);
    }
    
  }, [manifoldContext, graph, enableRemesh, targetEdgeLength, remeshIterations, subdivisionLevel]);
  
  if (!geometry) {
    return (
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#cccccc" wireframe />
      </mesh>
    );
  }
  
  return (
    <>
      {/* Unified mesh */}
      <mesh geometry={geometry}>
        <meshStandardMaterial 
          color="#d0d0d0" 
          metalness={0.1}
          roughness={0.8}
          wireframe={showWireframe}
          flatShading={subdivisionLevel === 0}
        />
      </mesh>
      
      {/* Show edges when wireframe is enabled */}
      {showWireframe && (
        <lineSegments geometry={geometry}>
          <lineBasicMaterial color="#000000" linewidth={1} />
        </lineSegments>
      )}
      
      {/* Debug: show original graph structure in wireframe */}
      {showDebug && (
        <group>
          {graph.vertices.map((vertex) => (
            <mesh key={`debug-vertex-${vertex.id}`} position={vertex.position}>
              <sphereGeometry args={[0.16, 8, 8]} />
              <meshBasicMaterial color="#ff0000" wireframe />
            </mesh>
          ))}
        </group>
      )}
    </>
  );
};

export default RandomGraphMesh;