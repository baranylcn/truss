import React, { useEffect, useRef, useState } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number[];
  pulse: number;
  targetX?: number;
  targetY?: number;
}

interface NeuralNetworkProps {
  className?: string;
}

export const NeuralNetwork: React.FC<NeuralNetworkProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const mouseRef = useRef({ x: 0, y: 0, isMoving: false });
  const [nodes, setNodes] = useState<Node[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Initialize nodes
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Create initial nodes
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    const nodeCount = Math.floor((dimensions.width * dimensions.height) / 8000);
    const newNodes: Node[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const node: Node = {
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        connections: [],
        pulse: Math.random() * Math.PI * 2
      };

      // Find nearby nodes for connections
      for (let j = 0; j < newNodes.length; j++) {
        const distance = Math.sqrt(
          Math.pow(node.x - newNodes[j].x, 2) + Math.pow(node.y - newNodes[j].y, 2)
        );
        if (distance < 150 && node.connections.length < 3 && newNodes[j].connections.length < 3) {
          node.connections.push(j);
          newNodes[j].connections.push(i);
        }
      }

      newNodes.push(node);
    }

    setNodes(newNodes);
  }, [dimensions]);

  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        mouseRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          isMoving: true
        };

        // Clear the moving timeout
        setTimeout(() => {
          mouseRef.current.isMoving = false;
        }, 100);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [dimensions]);

  // Animation loop
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentTime = Date.now() * 0.001;
      const mouse = mouseRef.current;

      // Update and draw nodes
      nodes.forEach((node, index) => {
        // Mouse attraction
        if (mouse.isMoving) {
          const mouseDistance = Math.sqrt(
            Math.pow(node.x - mouse.x, 2) + Math.pow(node.y - mouse.y, 2)
          );
          
          if (mouseDistance < 200) {
            const attraction = Math.max(0, 1 - mouseDistance / 200);
            const angle = Math.atan2(mouse.y - node.y, mouse.x - node.x);
            node.vx += Math.cos(angle) * attraction * 0.02;
            node.vy += Math.sin(angle) * attraction * 0.02;
          }
        }

        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Boundary bounce
        if (node.x < 0 || node.x > canvas.width) node.vx *= -0.8;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -0.8;
        
        node.x = Math.max(0, Math.min(canvas.width, node.x));
        node.y = Math.max(0, Math.min(canvas.height, node.y));

        // Apply friction
        node.vx *= 0.99;
        node.vy *= 0.99;

        // Update pulse
        node.pulse += 0.02;

        // Draw connections
        node.connections.forEach(connectionIndex => {
          if (connectionIndex < nodes.length) {
            const connectedNode = nodes[connectionIndex];
            const distance = Math.sqrt(
              Math.pow(node.x - connectedNode.x, 2) + Math.pow(node.y - connectedNode.y, 2)
            );

            if (distance < 200) {
              const opacity = Math.max(0, 1 - distance / 200);
              const pulseIntensity = (Math.sin(node.pulse) + Math.sin(connectedNode.pulse)) * 0.5 + 0.5;
              
              // Mouse proximity glow
              let mouseGlow = 0;
              if (mouse.isMoving) {
                const midX = (node.x + connectedNode.x) / 2;
                const midY = (node.y + connectedNode.y) / 2;
                const mouseDistance = Math.sqrt(
                  Math.pow(midX - mouse.x, 2) + Math.pow(midY - mouse.y, 2)
                );
                mouseGlow = Math.max(0, 1 - mouseDistance / 150);
              }

              const finalOpacity = opacity * (0.1 + pulseIntensity * 0.3 + mouseGlow * 0.6);
              const lineWidth = 0.5 + mouseGlow * 1.5 + pulseIntensity * 0.5;

              ctx.beginPath();
              ctx.moveTo(node.x, node.y);
              ctx.lineTo(connectedNode.x, connectedNode.y);
              ctx.strokeStyle = `rgba(251, 146, 60, ${finalOpacity})`;
              ctx.lineWidth = lineWidth;
              ctx.stroke();

              // Add glow effect for mouse proximity
              if (mouseGlow > 0.3) {
                ctx.beginPath();
                ctx.moveTo(node.x, node.y);
                ctx.lineTo(connectedNode.x, connectedNode.y);
                ctx.strokeStyle = `rgba(251, 146, 60, ${mouseGlow * 0.3})`;
                ctx.lineWidth = lineWidth + 2;
                ctx.filter = 'blur(2px)';
                ctx.stroke();
                ctx.filter = 'none';
              }
            }
          }
        });

        // Draw node
        const pulseSize = 1 + Math.sin(node.pulse) * 0.3;
        let nodeSize = 1.5 * pulseSize;
        let nodeOpacity = 0.4;

        // Mouse proximity effect
        if (mouse.isMoving) {
          const mouseDistance = Math.sqrt(
            Math.pow(node.x - mouse.x, 2) + Math.pow(node.y - mouse.y, 2)
          );
          if (mouseDistance < 100) {
            const proximity = 1 - mouseDistance / 100;
            nodeSize += proximity * 2;
            nodeOpacity += proximity * 0.6;
          }
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251, 146, 60, ${nodeOpacity})`;
        ctx.fill();

        // Add glow for larger nodes
        if (nodeSize > 2) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeSize + 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 146, 60, ${nodeOpacity * 0.3})`;
          ctx.filter = 'blur(3px)';
          ctx.fill();
          ctx.filter = 'none';
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes, dimensions]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  );
};