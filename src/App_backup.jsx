import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import ModelViewer from './ModelViewer';
import './App.css';

// 生成随机 GUID
const generateGUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// 计算价格 - ratio 越偏离 1，价格越高
const calculatePrice = (ratio) => {
  const basePrice = 100; // 基础价格 $100
  const deviation = Math.abs(ratio - 1); // 偏离 1 的程度
  const priceIncrease = deviation * 50; // 每偏离 1 增加 $50
  return (basePrice + priceIncrease).toFixed(2);
};

function App() {
  const [webglSupported, setWebglSupported] = useState(true);
  const [ratio, setRatio] = useState(1.0); // 默认比例 1:1
  const [isOrdering, setIsOrdering] = useState(false);
  const [objFile, setObjFile] = useState(null);
  const [email, setEmail] = useState(''); // 用户邮箱

  const price = calculatePrice(ratio);

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

  // 处理订单
  const handleOrder = async () => {
    if (!objFile) {
      alert('Please load a model first');
      return;
    }

    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    setIsOrdering(true);

    try {
      // 生成 GUID
      const guid = generateGUID();
      
      // 构建产品名称
      const productName = `Custom 3D Product-${guid.substring(0, 8)}`;
      
      console.log('Creating Order:', {
        guid,
        productName,
        ratio,
        price,
        email
      });

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
        <h1>Botai Store</h1>
        
        {/* 加载示例模型按钮 */}
        <div className="control-group">
          <button
            type="button"
            className="sample-button"
            onClick={() => setObjFile('/bow_tie_small.obj')}
          >
            Load Sample Model
          </button>
          {objFile && <p className="file-status">✓ Model Loaded</p>}
        </div>

        {/* 邮箱输入 */}
        <div className="control-group">
          <label>Email Address:</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="email-input"
          />
        </div>

        {/* Ratio 滑动条 */}
        <div className="control-group">
          <label>
            Width Ratio: <span className="value">{ratio.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.01"
            value={ratio}
            onChange={(e) => setRatio(parseFloat(e.target.value))}
            className="slider"
          />
          <div className="slider-labels">
            <span>0.5</span>
            <span>1.0</span>
            <span>2.0</span>
          </div>
        </div>

        {/* 价格显示 */}
        <div className="price-display">
          <h2>Price: ${price}</h2>
          <p className="price-note">
            {ratio === 1.0 
              ? 'Standard Ratio - Base Price' 
              : `Deviation ${Math.abs(ratio - 1).toFixed(2)} - Add $${(Math.abs(ratio - 1) * 50).toFixed(2)}`
            }
          </p>
        </div>

        {/* Order 按钮 */}
        <button
          className="order-button"
          onClick={handleOrder}
          disabled={isOrdering || !objFile || !email}
        >
          {isOrdering ? 'Processing...' : 'Order Now'}
        </button>

        {/* 使用说明 */}
        <div className="instructions">
          <h3>How to Use:</h3>
          <ul>
            <li>Click "Load Sample Model" to view the 3D model</li>
            <li>Enter your email address</li>
            <li>Adjust the width ratio using the slider</li>
            <li>Zoom, rotate, and pan the model on the right</li>
            <li>Click "Order Now" to proceed to payment</li>
          </ul>
        </div>
      </div>

      {/* 右侧 3D 查看器 */}
            <div className="canvas-container">
        {objFile ? (
          webglSupported ? (
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
              <OrbitControls 
                enableZoom={true}
                enablePan={true}
                enableRotate={true}
                minDistance={1}
                maxDistance={20}
              />
              <ambientLight intensity={0.6} />
              <directionalLight position={[10, 10, 5]} intensity={1} />
              <directionalLight position={[-10, -10, -5]} intensity={0.5} />
              <ModelViewer objUrl={objFile} ratio={ratio} />
              <gridHelper args={[10, 10]} />
            </Canvas>
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
          )
        ) : (
          <div className="placeholder">
            <p>Please load a model to preview</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
