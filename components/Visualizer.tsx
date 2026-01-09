
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  active: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let offset = 0;

    const render = () => {
      // Auto-resize canvas logic
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect && (canvas.width !== rect.width || canvas.height !== rect.height)) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const scale = canvas.width / 500; // Reference scale
      
      const pulseFactor = active ? Math.sin(offset * 0.1) * 8 * scale : 0;
      const rotationFactor = offset * (active ? 0.02 : 0.005);

      // Layer 1: Outer Rotating Tech HUD
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationFactor);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([15 * scale, 25 * scale]);
      ctx.arc(0, 0, 180 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Layer 2: Main Dynamic Energy Ring
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = (active ? 5 : 3) * scale;
      ctx.shadowBlur = (active ? 25 : 8) * scale;
      ctx.shadowColor = '#f97316';

      for (let i = 0; i < 360; i += 2) {
        const freq = active ? 0.2 : 0.05;
        const amp = (active ? 18 : 4) * scale;
        const radius = (140 * scale) + Math.sin((i + offset * 4) * freq) * amp + pulseFactor;
        const x = centerX + radius * Math.cos(i * Math.PI / 180);
        const y = centerY + radius * Math.sin(i * Math.PI / 180);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Layer 3: Reactive HUD Arcs (Cyan)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-rotationFactor * 1.5);
      ctx.lineWidth = 4 * scale;
      ctx.strokeStyle = '#22d3ee';
      ctx.shadowBlur = 20 * scale;
      ctx.shadowColor = '#22d3ee';
      
      for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, 160 * scale, 0, Math.PI / 4);
          ctx.stroke();
          ctx.rotate((Math.PI * 2) / 3);
      }
      ctx.restore();

      // Layer 4: Central "Energy Core"
      ctx.save();
      const coreSize = (80 * scale) + pulseFactor;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreSize);
      gradient.addColorStop(0, active ? 'rgba(34, 211, 238, 0.9)' : 'rgba(255, 255, 255, 0.2)');
      gradient.addColorStop(0.5, active ? 'rgba(34, 211, 238, 0.4)' : 'rgba(255, 255, 255, 0.05)');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreSize, 0, Math.PI * 2);
      ctx.fill();
      
      if (active) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.arc(centerX, centerY, coreSize * 0.75, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      offset += 1;
      animationFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [active]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <canvas 
        ref={canvasRef} 
        className={`${active ? 'opacity-100 scale-100' : 'opacity-60 scale-95'} transition-all duration-1000 w-full h-full`}
      />
    </div>
  );
};

export default Visualizer;
