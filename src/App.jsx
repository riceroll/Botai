import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, N8AO, BrightnessContrast, ToneMapping } from '@react-three/postprocessing';
import ModelViewer from './ModelViewer';
import CatmullClarkCube from './CatmullClarkCube';
import RandomGraphMesh from './RandomGraphMesh';
import { exportAndUploadGeometry } from './utils/objExporter';
import './App.css';

// Component to update camera position based on twist
function CameraController({ twist }) {
  const { camera } = useThree();
  
  useEffect(() => {
    // Flat (twist = 0): Front view [0, 0, 5]
    // Botai (twist = 90): Top view [0, 5, 0]
    // Interpolate between positions based on twist angle
    const normalizedTwist = Math.abs(twist) / 90; // 0 to 1+ range
    const factor = Math.min(normalizedTwist, 1); // Clamp to 1
    
    if (twist == 90) {
      // Stay at top view for twist > 90
      camera.position.set(0, 3, 0);
    } 
    if (twist == 0) {
      // For negative twist, stay at front view
      camera.position.set(0, 0, 3);
    }
    
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [twist, camera]);
  
  return null;
}

// 生成随机 GUID
const generateGUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// 计算价格 - 基于bounding box体积
const calculatePrice = (scaleX, scaleY, scaleZ) => {
  const basePrice = 60; // 基础价格 $60 (对应默认体积 1.0)
  const volume = scaleX * scaleY * scaleZ; // 计算bounding box体积
  const price = basePrice * volume; // 价格与体积成正比
  return price.toFixed(2);
};

function App() {
  // Check for debug parameter in URL
  const [debugMode, setDebugMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === 'true';
  });
  
  const [webglSupported, setWebglSupported] = useState(true);
  const [scaleX, setScaleX] = useState(1.0); // X scale
  const [scaleY, setScaleY] = useState(1.0); // Y scale
  const [scaleZ, setScaleZ] = useState(1.0); // Z scale
  const [twist, setTwist] = useState(0); // 扭曲角度 (degrees)
  const [booleanSubtract, setBooleanSubtract] = useState(false); // Inscription toggle
  const [subtractText, setSubtractText] = useState('Botai.'); // Inscription text
  const [textFont, setTextFont] = useState('helvetiker'); // Font selection
  const [textScale, setTextScale] = useState(0.09); // Text scale (0.1 to 0.5)
  const [textSpacing, setTextSpacing] = useState(0.3); // Text spacing multiplier (0.5 to 2.0)
  const [textOffsetX, setTextOffsetX] = useState(-0.3); // Text X offset (-1.0 to 1.0)
  const [textOffsetY, setTextOffsetY] = useState(-0.4); // Text Y offset (-1.0 to 1.0)
  const [textDepth, setTextDepth] = useState(-0.32); // Text depth - Y-axis offset (-1.0 to 1.0)
  const [textRotation, setTextRotation] = useState(24); // Text rotation in degrees (0 to 360)
  const [showText, setShowText] = useState(false); // Toggle inscription preview (off by default)
  const [isOrdering, setIsOrdering] = useState(false);
  const [objFile, setObjFile] = useState('./Morpheus.obj');
  const [email, setEmail] = useState(''); // 用户邮箱
  const [mode, setMode] = useState('original'); // 'original', 'manifold', or 'graph'
  const [subdivisionLevel, setSubdivisionLevel] = useState(0);
  const [subdivisionType, setSubdivisionType] = useState('loop'); // 'loop' or 'catmull'
  const [currentGeometry, setCurrentGeometry] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [useAdvancedRendering, setUseAdvancedRendering] = useState(true); // Advanced rendering toggle
  const [useN8AO, setUseN8AO] = useState(true); // Enable N8AO ambient occlusion
  const [useToneMapping, setUseToneMapping] = useState(true); // Enable tone mapping

  const price = calculatePrice(scaleX, scaleY, scaleZ);

  // 检测浏览器是否支持 WebGL（在 mount 时运行一次）
  useEffect(() => {
    const isWebGLAvailable = () => {
      try {
        const canvas = document.createElement('canvas');
        return !!(
          canvas.getContext('webgl2') ||
          canvas.getContext('webgl') ||
          canvas.getContext('experimental-webgl')
        );
      } catch (e) {
        return false;
      }
    };

    setWebglSupported(isWebGLAvailable());
  }, []);

  // 处理导出到 Google Drive
  const handleExport = async () => {
    if (!currentGeometry) {
      alert('No geometry available to export. Please wait for the mesh to load.');
      return;
    }

    setIsExporting(true);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${mode}_mesh_${timestamp}.obj`;
      
      const result = await exportAndUploadGeometry(currentGeometry, filename);
      
      alert(`✅ Export successful!\n\nFile: ${filename}\nURL: ${result.fileUrl}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert(`❌ Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // 处理订单
  const handleOrder = async () => {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    setIsOrdering(true);

    try {
      // 生成 GUID
      const guid = generateGUID();
      const confirmationNumber = guid.substring(0, 8);
      
      // 构建产品名称
      const productName = `Custom 3D Product-${confirmationNumber}`;
      
      console.log('Creating Order:', {
        guid,
        productName,
        scaleX,
        scaleY,
        scaleZ,
        price,
        email
      });

      // Export to Google Drive with confirmation number in filename (if geometry available)
      if (currentGeometry) {
        console.log('📤 Exporting to Google Drive...');
        const filename = `order_${confirmationNumber}_${mode}_mesh.obj`;
        
        try {
          await exportAndUploadGeometry(currentGeometry, filename);
          console.log('✅ Export to Google Drive successful');
        } catch (exportError) {
          console.error('⚠️ Export failed but continuing with order:', exportError);
        }
      } else {
        console.log('⚠️ No geometry available to export, skipping...');
      }

      // 调用你的 Vercel API
      const apiUrl = new URL('https://shopify-draft-order-io3s5gd2e-ricerolls-projects.vercel.app/api/create-order');
      apiUrl.searchParams.append('productName', productName);
      apiUrl.searchParams.append('price', price);
      apiUrl.searchParams.append('email', email);
      
      console.log('API URL:', apiUrl.toString());

      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API Request Failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data);
      
      // 获取 Shopify URL 并跳转
      if (data.checkoutUrl) {
        console.log('Redirecting to Shopify:', data.checkoutUrl);
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('Failed to get Shopify URL');
      }

    } catch (error) {
      console.error('Order Creation Failed:', error);
      alert('Order creation failed: ' + error.message);
      setIsOrdering(false);
    }
  };

  return (
    <div className="app-container">
      {/* 左侧控制面板 */}
      <div className="control-panel">
        <img src="./Botai_Logo.svg" alt="Botai" style={{ width: '100px', marginBottom: '16px' }} />
        
        {/* 选择模式按钮 */}
        <div className="control-group">
          <label style={{ fontSize: '13px', fontWeight: '600' }}>Select Mode:</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            {debugMode && (
              <>
                <button
                  type="button"
                  className="sample-button"
                  onClick={() => setMode('graph')}
                  style={{
                    background: mode === 'graph' ? '#000' : '#f5f5f5',
                    color: mode === 'graph' ? '#fff' : '#000',
                    flex: '1 1 45%'
                  }}
                >
                  Random Graph
                </button>
                <button
                  type="button"
                  className="sample-button"
                  onClick={() => setMode('manifold')}
                  style={{
                    background: mode === 'manifold' ? '#000' : '#f5f5f5',
                    color: mode === 'manifold' ? '#fff' : '#000',
                    flex: '1 1 45%'
                  }}
                >
                  Cube
                </button>
              </>
            )}
            <button
              type="button"
              className="sample-button"
              onClick={() => { setObjFile('./bow_tie_small.obj'); setMode('original'); }}
              style={{
                background: mode === 'original' && objFile === './bow_tie_small.obj' ? '#000' : '#f5f5f5',
                color: mode === 'original' && objFile === './bow_tie_small.obj' ? '#fff' : '#000',
                flex: '1 1 45%'
              }}
            >
              Bow Tie
            </button>
            <button
              type="button"
              className="sample-button"
              onClick={() => { setObjFile('./trinity.obj'); setMode('original'); }}
              style={{
                background: mode === 'original' && objFile === './trinity.obj' ? '#000' : '#f5f5f5',
                color: mode === 'original' && objFile === './trinity.obj' ? '#fff' : '#000',
                flex: '1 1 45%'
              }}
            >
              Trinity
            </button>
            <button
              type="button"
              className="sample-button"
              onClick={() => { setObjFile('./Morpheus.obj'); setMode('original'); }}
              style={{
                background: mode === 'original' && objFile === './Morpheus.obj' ? '#000' : '#f5f5f5',
                color: mode === 'original' && objFile === './Morpheus.obj' ? '#fff' : '#000',
                flex: '1 1 45%'
              }}
            >
              Morpheus
            </button>
            <button
              type="button"
              className="sample-button"
              onClick={() => { setObjFile('./Webber Edge.obj'); setMode('original'); }}
              style={{
                background: mode === 'original' && objFile === './Webber Edge.obj' ? '#000' : '#f5f5f5',
                color: mode === 'original' && objFile === './Webber Edge.obj' ? '#fff' : '#000',
                flex: '1 1 45%'
              }}
            >
              Webber Edge
            </button>
          </div>
          {mode === 'original' && objFile && <p className="file-status">✓ {objFile.split('/').pop()}</p>}
        </div>

        {mode === 'original' ? (
          <>
            {/* Subdivision Level - Only show for Trinity or in debug mode */}
            {(debugMode || objFile === './trinity.obj') && (
              <div className="control-group" style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>
                  Subdivision Level: <span className="value">{subdivisionLevel}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  value={subdivisionLevel}
                  onChange={(e) => setSubdivisionLevel(parseInt(e.target.value))}
                  className="slider"
                />
                <div className="slider-labels">
                  <span>0</span>
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                </div>
              </div>
            )}

            {/* Scale X Slider */}
            <div className="control-group">
              <label>
                Scale X: <span className="value">{scaleX.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.01"
                value={scaleX}
                onChange={(e) => setScaleX(parseFloat(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>0.5</span>
                <span>1.0</span>
                <span>1.5</span>
              </div>
            </div>

            {/* Scale Y Slider */}
            <div className="control-group">
              <label>
                Scale Y: <span className="value">{scaleY.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.01"
                value={scaleY}
                onChange={(e) => setScaleY(parseFloat(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>0.5</span>
                <span>1.0</span>
                <span>1.5</span>
              </div>
            </div>

            {/* Scale Z Slider */}
            <div className="control-group">
              <label>
                Scale Z: <span className="value">{scaleZ.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.01"
                value={scaleZ}
                onChange={(e) => setScaleZ(parseFloat(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>0.5</span>
                <span>1.0</span>
                <span>1.5</span>
              </div>
            </div>

            {/* Flat/Botai Toggle - Only show for Morpheus in non-debug mode */}
            {!debugMode && objFile === './Morpheus.obj' && (
              <div className="control-group" style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Style:</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="sample-button"
                    onClick={() => setTwist(0)}
                    style={{
                      background: twist === 0 ? '#000' : '#f5f5f5',
                      color: twist === 0 ? '#fff' : '#000',
                      flex: '1 1 45%'
                    }}
                  >
                    Flat
                  </button>
                  <button
                    type="button"
                    className="sample-button"
                    onClick={() => setTwist(90)}
                    style={{
                      background: twist === 90 ? '#000' : '#f5f5f5',
                      color: twist === 90 ? '#fff' : '#000',
                      flex: '1 1 45%'
                    }}
                  >
                    Botai
                  </button>
                </div>
              </div>
            )}

            {/* Twist Slider - Always visible */}
            <div className="control-group">
              <label>
                Twist: <span className="value">{twist}°</span>
              </label>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={twist}
                onChange={(e) => setTwist(parseInt(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>-180°</span>
                <span>0°</span>
                <span>180°</span>
              </div>
            </div>

            {/* Inscription - Only show for Morpheus or in debug mode */}
            {(debugMode || objFile === './Morpheus.obj') && (
              <>
                <div className="control-group" style={{ marginTop: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={booleanSubtract}
                      onChange={(e) => setBooleanSubtract(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>Inscription</span>
                  </label>
                </div>

            {/* Text Input for Inscription */}
            {booleanSubtract && (
              <>
                <div className="control-group">
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>
                    Inscription Text:
                  </label>
                  <input
                    type="text"
                    value={subtractText}
                    onChange={(e) => setSubtractText(e.target.value)}
                    placeholder="Enter text (e.g., Botai)"
                    maxLength="10"
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '13px',
                      border: '2px solid #ddd',
                      borderRadius: '4px',
                      marginTop: '4px',
                    }}
                  />
                </div>

                {/* Font Selection */}
                <div className="control-group">
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>
                    Font:
                  </label>
                  <select
                    value={textFont}
                    onChange={(e) => setTextFont(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '13px',
                      border: '2px solid #ddd',
                      borderRadius: '4px',
                      marginTop: '4px',
                    }}
                  >
                    <option value="helvetiker">Helvetiker Bold</option>
                    <option value="helvetiker_regular">Helvetiker Regular</option>
                    <option value="optimer">Optimer Bold</option>
                    <option value="optimer_regular">Optimer Regular</option>
                    <option value="gentilis">Gentilis Bold</option>
                    <option value="gentilis_regular">Gentilis Regular</option>
                    <option value="droid_sans">Droid Sans Bold</option>
                    <option value="droid_sans_regular">Droid Sans Regular</option>
                    <option value="droid_serif">Droid Serif Bold</option>
                    <option value="droid_serif_regular">Droid Serif Regular</option>
                  </select>
                </div>

                {/* Text Scale Slider */}
                <div className="control-group">
                  <label>
                    Text Scale: <span className="value">{textScale.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min="0.01"
                    max="0.6"
                    step="0.01"
                    value={textScale}
                    onChange={(e) => setTextScale(parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>0.01</span>
                    <span>0.3</span>
                    <span>0.6</span>
                  </div>
                </div>

                {/* Text Spacing Slider */}
                <div className="control-group">
                  <label>
                    Text Spacing: <span className="value">{textSpacing.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={textSpacing}
                    onChange={(e) => setTextSpacing(parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>0.1</span>
                    <span>0.55</span>
                    <span>1.0</span>
                  </div>
                </div>

                {/* Text X Offset Slider */}
                <div className="control-group">
                  <label>
                    Text X Offset: <span className="value">{textOffsetX.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.05"
                    value={textOffsetX}
                    onChange={(e) => setTextOffsetX(parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>-1.0</span>
                    <span>0</span>
                    <span>1.0</span>
                  </div>
                </div>

                {/* Text Y Offset Slider */}
                <div className="control-group">
                  <label>
                    Text Y Offset: <span className="value">{textOffsetY.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min="-0.45"
                    max="0.45"
                    step="0.05"
                    value={textOffsetY}
                    onChange={(e) => setTextOffsetY(parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>-1.0</span>
                    <span>0</span>
                    <span>1.0</span>
                  </div>
                </div>

                {/* Text Depth Slider */}
                <div className="control-group">
                  <label>
                    Text Depth: <span className="value">{textDepth.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min="-1.0"
                    max="1.0"
                    step="0.02"
                    value={textDepth}
                    onChange={(e) => setTextDepth(parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>-1.0</span>
                    <span>0</span>
                    <span>1.0</span>
                  </div>
                </div>

                {/* Text Rotation Slider */}
                <div className="control-group">
                  <label>
                    Text Rotation: <span className="value">{textRotation.toFixed(0)}°</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={textRotation}
                    onChange={(e) => setTextRotation(parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>0°</span>
                    <span>180°</span>
                    <span>360°</span>
                  </div>
                </div>

                {/* Show Inscription Preview - Only show in debug mode */}
                {debugMode && (
                  <div className="control-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showText}
                        onChange={(e) => setShowText(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: '600' }}>Show Inscription Preview</span>
                    </label>
                  </div>
                )}
              </>
            )}
              </>
            )}

            {/* Advanced Rendering Toggle */}
            <div className="control-group" style={{ marginTop: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useAdvancedRendering}
                  onChange={(e) => setUseAdvancedRendering(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '12px', fontWeight: '600' }}>Advanced Rendering</span>
              </label>
            </div>
          </>
        ) : (
          <>
            {/* Subdivision Level */}
            <div className="control-group" style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600' }}>
                Subdivision Level: <span className="value">{subdivisionLevel}</span>
              </label>
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={subdivisionLevel}
                onChange={(e) => setSubdivisionLevel(parseInt(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>0</span>
                <span>1</span>
                <span>2</span>
                <span>3</span>
              </div>
            </div>
          </>
        )}

        {/* Spacer to push bottom content down */}
        <div style={{ flex: 1 }}></div>

        {/* 邮箱输入 */}
        <div className="control-group" style={{ marginTop: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600' }}>Email Address:</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="email-input"
          />
        </div>

        {/* 价格显示 */}
        <div className="price-display">
          <h2>Price: ${price}</h2>
          <p className="price-note">
            {scaleX === 1.0 && scaleY === 1.0 && scaleZ === 1.0
              ? 'Standard Size (1.0×1.0×1.0) - Base Price' 
              : `Volume: ${(scaleX * scaleY * scaleZ).toFixed(2)} (${scaleX.toFixed(2)}×${scaleY.toFixed(2)}×${scaleZ.toFixed(2)})`
            }
          </p>
        </div>

        {/* Order 按钮 */}
        <button
          className="order-button"
          onClick={handleOrder}
          disabled={isOrdering || !email}
        >
          {isOrdering ? 'Processing & Uploading...' : 'Order Now & Save to Drive'}
        </button>
      </div>

      {/* 右侧 3D 查看器 */}
      <div className="canvas-container" style={{ position: 'relative' }}>
        {webglSupported ? (
          <>
            <Canvas
              gl={{
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
              failIfMajorPerformanceCaveat: false,
            }}
            onCreated={({ gl }) => {
              gl.setClearColor('#eee');
            }}
          >
            <PerspectiveCamera makeDefault position={[0, 0, 5]} />
            <CameraController twist={twist} />
            <OrbitControls 
              enableZoom={true}
              enablePan={true}
              enableRotate={true}
              minDistance={1}
              maxDistance={20}
              enableDamping={true}
              dampingFactor={0.9}
            />
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <directionalLight position={[-10, -10, -5]} intensity={0.5} />
            
            {mode === 'original' ? (
              objFile ? (
                <ModelViewer 
                  objUrl={objFile} 
                  scaleX={scaleX}
                  scaleY={scaleY}
                  scaleZ={scaleZ}
                  twist={twist}
                  booleanSubtract={debugMode || objFile === './Morpheus.obj' ? booleanSubtract : false}
                  subtractText={subtractText}
                  textFont={textFont}
                  textScale={textScale}
                  textSpacing={textSpacing}
                  textOffsetX={textOffsetX}
                  textOffsetY={textOffsetY}
                  textDepth={textDepth}
                  textRotation={textRotation}
                  showText={showText}
                  subdivisionLevel={debugMode || objFile === './trinity.obj' ? subdivisionLevel : 0}
                  onGeometryReady={(geometry) => setCurrentGeometry(geometry)}
                />
              ) : (
                <mesh>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color="#cccccc" wireframe />
                </mesh>
              )
            ) : mode === 'manifold' ? (
              <CatmullClarkCube 
                subdivisionLevel={subdivisionLevel} 
                onGeometryReady={(geometry) => setCurrentGeometry(geometry)}
              />
            ) : (
              <RandomGraphMesh 
                subdivisionLevel={subdivisionLevel}
                subdivisionType={subdivisionType}
                onGeometryReady={(geometry) => setCurrentGeometry(geometry)}
              />
            )}
            
            {debugMode && <gridHelper args={[10, 10]} />}
            
            {useAdvancedRendering && (
              <EffectComposer>
                {useN8AO && (
                  <>
                    <N8AO aoRadius={0.15} intensity={4} distanceFalloff={2} />
                    {/* <BrightnessContrast brightness={0.1} contrast={0.25} /> */}
                  </>
                )}
                {/* {useToneMapping && <ToneMapping />} */}
              </EffectComposer>
            )}
          </Canvas>
          </>
        ) : (
          <div className="placeholder">
            <p>WebGL is not supported in your current browser or environment.</p>
            <p>Suggestions:</p>
            <ul>
              <li>Open in Chrome or Firefox with hardware acceleration enabled.</li>
              <li>Check <code>chrome://gpu</code> or your browser's GPU support page for more info.</li>
              <li>If in a restricted environment, try opening in a standard browser.</li>
            </ul>
            <button className="sample-button" onClick={() => window.location.reload()}>
              Retry (Refresh Page)
            </button>
          </div>
        )}
        
        {/* Upload overlay */}
        {isOrdering && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white',
            zIndex: 1000,
            gap: '20px'
          }}>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              📤 Uploading Model to Google Drive...
            </div>
            <div style={{
              fontSize: '16px',
              opacity: 0.8
            }}>
              Please wait while we save your model
            </div>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid rgba(255, 255, 255, 0.3)',
              borderTop: '4px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;