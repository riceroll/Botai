import React, { useMemo } from 'react';
import * as THREE from 'three';
import { LoopSubdivision } from 'three-subdivide';

const CatmullClarkCube = ({ subdivisionLevel = 0, onGeometryReady = null }) => {
  const geometry = useMemo(() => {
    console.log(`🔨 Creating cube...`);
    
    // Use Three.js BoxGeometry as starting point
    let geo = new THREE.BoxGeometry(2, 2, 2);
    
    console.log(`   Before: ${geo.attributes.position.count} vertices`);
    
    // Apply Loop subdivision if requested
    // (Loop subdivision on a cube gives similar smooth results to Catmull-Clark)
    if (subdivisionLevel > 0) {
      console.log(`🔄 Applying Loop subdivision (${subdivisionLevel} levels)...`);
      
      for (let i = 0; i < subdivisionLevel; i++) {
        geo = LoopSubdivision.modify(geo, 1);
      }
      
      console.log(`   After: ${geo.attributes.position.count} vertices`);
    }
    
    geo.computeVertexNormals();
    
    return geo;
  }, [subdivisionLevel]);

  // Notify parent when geometry is ready
  React.useEffect(() => {
    if (geometry && onGeometryReady) {
      onGeometryReady(geometry);
    }
  }, [geometry, onGeometryReady]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial 
        color="#d0d0d0" 
        metalness={0.1}
        roughness={0.8}
        side={THREE.DoubleSide}
        flatShading={subdivisionLevel === 0}
      />
    </mesh>
  );
};

export default CatmullClarkCube;