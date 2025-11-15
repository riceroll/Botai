// Helper: Convert Three.js geometry to OBJ format
export function geometryToOBJ(geometry) {
  let objContent = '# OBJ file generated from Three.js geometry\n';
  objContent += `# Generated at ${new Date().toISOString()}\n\n`;
  
  const positions = geometry.attributes.position.array;
  
  // Add vertices
  objContent += '# Vertices\n';
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    objContent += `v ${x} ${y} ${z}\n`;
  }
  
  objContent += '\n# Faces\n';
  
  // Handle indexed vs non-indexed geometry
  if (geometry.index) {
    // Indexed geometry
    const indices = geometry.index.array;
    for (let i = 0; i < indices.length; i += 3) {
      const v1 = indices[i] + 1;
      const v2 = indices[i + 1] + 1;
      const v3 = indices[i + 2] + 1;
      objContent += `f ${v1} ${v2} ${v3}\n`;
    }
  } else {
    // Non-indexed geometry - vertices are in triangle order
    const numVertices = positions.length / 3;
    for (let i = 0; i < numVertices; i += 3) {
      const v1 = i + 1;
      const v2 = i + 2;
      const v3 = i + 3;
      objContent += `f ${v1} ${v2} ${v3}\n`;
    }
  }
  
  return objContent;
}

// Helper: Upload OBJ file to Google Drive
export async function uploadOBJToGoogleDrive(objContent, filename) {
  const blob = new Blob([objContent], { type: 'text/plain' });
  
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
  
  console.log(`📤 Exporting ${filename}...`);
  const objContent = geometryToOBJ(geometry);
  
  console.log(`📤 Uploading to Google Drive...`);
  const result = await uploadOBJToGoogleDrive(objContent, filename);
  
  console.log('✅ Upload success!', result);
  console.log('📁 File URL:', result.fileUrl);
  
  return result;
}
