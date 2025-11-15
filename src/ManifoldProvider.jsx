import React, { createContext, useContext, useEffect, useState } from 'react';
import Module from 'manifold-3d';

// Create context
const ManifoldContext = createContext(null);

// Custom hook to use Manifold
export const useManifold = () => {
  const context = useContext(ManifoldContext);
  if (!context) {
    throw new Error('useManifold must be used within ManifoldProvider');
  }
  return context;
};

// Provider component
export const ManifoldProvider = ({ children }) => {
  const [manifold, setManifold] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const initManifold = async () => {
      try {
        console.log('🔄 Initializing Manifold WASM...');
        
        // Initialize the WASM module
        const wasm = await Module();
        
        // CRITICAL: Must call setup() before using
        wasm.setup();
        
        if (!mounted) return;

        console.log('✅ Manifold WASM initialized successfully');
        
        // Extract the classes/functions we need
        const { Manifold, Mesh, CrossSection } = wasm;
        
        setManifold({
          Manifold,
          Mesh,
          CrossSection,
          wasm // Keep reference to full module if needed
        });
        setLoading(false);
      } catch (err) {
        console.error('❌ Failed to initialize Manifold:', err);
        if (mounted) {
          setError(err);
          setLoading(false);
        }
      }
    };

    initManifold();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading Manifold WASM...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '16px',
        color: '#d32f2f'
      }}>
        <p>Failed to load Manifold</p>
        <p style={{ fontSize: '14px', color: '#666' }}>{error.message}</p>
      </div>
    );
  }

  return (
    <ManifoldContext.Provider value={manifold}>
      {children}
    </ManifoldContext.Provider>
  );
};