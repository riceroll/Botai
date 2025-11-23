// Helper: Convert Three.js geometry to STL format (ASCII)
export function geometryToSTL(geometry) {
  let stlContent = 'solid exported\n';
  
  const positions = geometry.attributes.position.array;
  
  // Helper to get vertex
  const getVertex = (index) => {
    return {
      x: positions[index * 3],
      y: positions[index * 3 + 1],
      z: positions[index * 3 + 2]
    };
  };

  // Helper to calculate normal
  const calculateNormal = (v1, v2, v3) => {
    const u = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
    const v = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };
    const n = {
      x: u.y * v.z - u.z * v.y,
      y: u.z * v.x - u.x * v.z,
      z: u.x * v.y - u.y * v.x
    };
    const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
    if (len === 0) return { x: 0, y: 0, z: 0 };
    return { x: n.x / len, y: n.y / len, z: n.z / len };
  };

  const processFace = (a, b, c) => {
    const v1 = getVertex(a);
    const v2 = getVertex(b);
    const v3 = getVertex(c);
    const n = calculateNormal(v1, v2, v3);
    
    stlContent += `facet normal ${n.x} ${n.y} ${n.z}\n`;
    stlContent += '  outer loop\n';
    stlContent += `    vertex ${v1.x} ${v1.y} ${v1.z}\n`;
    stlContent += `    vertex ${v2.x} ${v2.y} ${v2.z}\n`;
    stlContent += `    vertex ${v3.x} ${v3.y} ${v3.z}\n`;
    stlContent += '  endloop\n';
    stlContent += 'endfacet\n';
  };
  
  // Handle indexed vs non-indexed geometry
  if (geometry.index) {
    // Indexed geometry
    const indices = geometry.index.array;
    for (let i = 0; i < indices.length; i += 3) {
      processFace(indices[i], indices[i+1], indices[i+2]);
    }
  } else {
    // Non-indexed geometry - vertices are in triangle order
    const numVertices = positions.length / 3;
    for (let i = 0; i < numVertices; i += 3) {
      processFace(i, i+1, i+2);
    }
  }
  
  stlContent += 'endsolid exported\n';
  return stlContent;
}

// Helper: Upload file to Google Drive
export async function uploadToGoogleDrive(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  
  const url = `https://script.google.com/macros/s/AKfycbwYO_YrcxyV8lcPSbGhpBwKRIA2StRQDaZa2xWawsPwKsf_51IvnBDrg9oyyrc147WlNw/exec?filename=${encodeURIComponent(filename)}`;
  
  const response = await fetch(url, {
    method: 'POST',
    body: blob
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
}

// Helper: Export and upload geometry in one call
export async function exportAndUploadGeometry(geometry, filename) {
  if (!geometry) {
    throw new Error('No geometry provided');
  }
  
  // Ensure filename ends with .stl
  if (!filename.toLowerCase().endsWith('.stl')) {
    filename = filename.replace(/\.[^/.]+$/, "") + ".stl";
  }

  console.log(`📤 Exporting ${filename}...`);
  const stlContent = geometryToSTL(geometry);
  
  console.log(`📤 Uploading to Google Drive...`);
  const result = await uploadToGoogleDrive(stlContent, filename);
  
  console.log('✅ Upload success!', result);
  console.log('📁 File URL:', result.fileUrl);
  
  return result;
}
