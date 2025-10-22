import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

export default function WaveformPlayer({ audioUrl }) {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);

  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return;

    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#ccc',
      progressColor: '#2196f3',
      height: 64,
      responsive: true, 
      barWidth: 2,
      cursorWidth: 1,
      normalize: true, 
    });

    wavesurferRef.current = wavesurfer;

    fetch(audioUrl)
      .then(res => res.blob())
      .then(blob => {
        wavesurfer.loadBlob(blob);

        
        wavesurfer.on('ready', () => {
          const canvas = waveformRef.current?.querySelector('canvas');
          if (canvas) {
            
            canvas.style.maxWidth = '100%';
            canvas.style.display = 'block';
            canvas.style.boxSizing = 'border-box'; 
          }
          
          
          const container = waveformRef.current;
          if (container) {
            container.style.minWidth = '0'; 
            container.style.overflow = 'hidden'; 
          }
        });
      })
      .catch(err => {
        console.warn("WaveSurfer load failed:", err);
      });

    return () => {
      try {
        wavesurferRef.current?.destroy();
      } catch (e) {
        console.warn("WaveSurfer destroy error:", e);
      }
    };
  }, [audioUrl]);

  const togglePlay = () => {
    wavesurferRef.current?.playPause();
  };

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: '100%', 
      overflowX: 'hidden',
      flexShrink: 0, 
      minWidth: 0,   
      boxSizing: 'border-box' 
    }}>
      <div
        ref={waveformRef}
        style={{
          width: '100%',
          height: '80px',
          overflowX: 'hidden',
          minWidth: 0, 
          boxSizing: 'border-box', 
        }}
      />
      <button onClick={togglePlay} style={{
        marginTop: '-4px',
        flexShrink: 0 
      }}>
        Play/Pause
      </button>
    </div>
  );
}