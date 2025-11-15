import React, { useMemo } from 'react';
import * as THREE from 'three';
import { LoopSubdivision } from 'three-subdivide';

const SimpleTetrahedron = ({ subdivisionLevel = 0 }) => {
  const geometry = useMemo(() => {
    // Create a simple tetrahedron manually
    let geo = new THREE.BufferGeometry();
    
    // 4 vertices of a tetrahedron
    const vertices = new Float32Array([
      0, 1, 0,        // top
      -1, -0.5, 1,    // front left
      1, -0.5, 1,     // front right
      0, -0.5, -1     // back
    ]);
    
    // 4 triangular faces (12 indices)
    const indices = new Uint32Array([
      0, 1, 2,  // front face
      0, 2, 3,  // right face
      0, 3, 1,  // left face
      1, 3, 2   // bottom face
    ]);
    
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    
    // Apply Loop subdivision if requested
    if (subdivisionLevel > 0) {
      console.log(`🔄 Applying ${subdivisionLevel} level(s) of subdivision...`);
      console.log(`   Before: ${geo.attributes.position.count} vertices`);
      
      for (let i = 0; i < subdivisionLevel; i++) {
        geo = LoopSubdivision.modify(geo, 1);
      }
      
      console.log(`   After: ${geo.attributes.position.count} vertices`);
    }
    
    return geo;
  }, [subdivisionLevel]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial 
        color="#4a9eff" 
        metalness={0.3}
        roughness={0.5}
        side={THREE.DoubleSide}
        flatShading={subdivisionLevel === 0}
      />
    </mesh>
  );
};

export default SimpleTetrahedron;