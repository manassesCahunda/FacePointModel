'use client';

import {
  DrawingUtils,
  FaceLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';

export default function FaceLandmarks() {
  const [faceData, setFaceData] = useState([]);
  const [blendShapes, setBlendShapes] = useState([]);
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const drawingUtilsRef = useRef(null);

  useEffect(() => {
    const createFaceLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `./models/face_landmarker.task`,
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        landmarkerRef.current = faceLandmarker;
        console.log('Face landmarker is created!');
        startCapturing(); // Start capturing after the landmarker is ready
      } catch (error) {
        console.error('Error creating face landmarker', error);
      }
    };
    createFaceLandmarker();
  }, []);

  const startCapturing = async () => {
    if (webcamRef.current && landmarkerRef.current && webcamRef.current.video) {
      const video = webcamRef.current.video;
      if (video.readyState === 4) { // Check if the video is ready
        await processVideo();
        requestAnimationFrame(startCapturing); // Continue capturing
      } else {
        setTimeout(startCapturing, 100); // Retry after a short delay if video is not ready
      }
    } else {
      console.error('Webcam or Landmarker Ref is not available');
    }
  };

  const processVideo = async () => {
    if (webcamRef.current && landmarkerRef.current && webcamRef.current.video) {
      const video = webcamRef.current.video;
      try {
        const result = await landmarkerRef.current.detectForVideo(video, performance.now());
        if (result.faceLandmarks) {
          setFaceData(result.faceLandmarks);
        }
        if (result.faceBlendshapes) {
          setBlendShapes(result.faceBlendshapes);
        } else {
          console.log('No blend shapes detected');
        }
      } catch (error) {
        console.error('Error during face detection', error);
      }
    } else {
      console.error('Webcam or Landmarker Ref is not available');
    }
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      drawingUtilsRef.current = new DrawingUtils(ctx);
    } else {
      console.error('Canvas context is not available');
    }
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && drawingUtilsRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      faceData.forEach(face => {
        drawingUtilsRef.current.drawConnectors(
          face,
          FaceLandmarker.FACE_LANDMARKS_TESSELATION,
          { color: '#C0C0C070', lineWidth: 1 }
        );
        drawingUtilsRef.current.drawConnectors(
          face,
          FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
          { color: '#FF3030', lineWidth: 3 }
        );
        drawingUtilsRef.current.drawConnectors(
          face,
          FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
          { color: '#FF3030', lineWidth: 3 }
        );
        drawingUtilsRef.current.drawConnectors(
          face,
          FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
          { color: '#30FF30', lineWidth: 3 }
        );
        drawingUtilsRef.current.drawConnectors(
          face,
          FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
          { color: '#30FF30', lineWidth: 3 }
        );
        drawingUtilsRef.current.drawConnectors(
          face,
          FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
          { color: '#E0E0E0', lineWidth: 3 }
        );
        drawingUtilsRef.current.drawConnectors(
          face,
          FaceLandmarker.FACE_LANDMARKS_LIPS,
          { color: '#E0E0E0', lineWidth: 2 }
        );
        drawingUtilsRef.current.drawConnectors(
          face,
          FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
          { color: '#FF3030', lineWidth: 3 }
        );
        drawingUtilsRef.current.drawConnectors(
          face,
          FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
          { color: '#30FF30', lineWidth: 3 }
        );
      });
    }
  }, [faceData]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (blendShapes.length > 0) {
        const formattedBlendShapes = blendShapes.flatMap(blendShapeSet =>
          blendShapeSet.categories.map(shape => ({
            displayName: shape.displayName || shape.categoryName,
            score: shape.score.toFixed(4),
          }))
        );

        const data = { blendShapes: formattedBlendShapes };

        try {
          await fetch('http://localhost:4000/faceData', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });
          console.log('Data saved to server');
        } catch (error) {
          console.error('Error saving data to server', error);
        }
      }
    }, 1000);

    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, [blendShapes]);

  return (
    <section className='container mx-auto'>
      <div className='relative w-full pt-[56.25%]'>
        <Webcam
          width='1280'
          height='720'
          mirrored
          id='webcam'
          audio={false}
          videoConstraints={{
            width: 1280,
            height: 720,
            facingMode: 'user',
          }}
          ref={webcamRef}
          className='absolute top-0 left-0 w-full h-full'
        />
        <canvas
          ref={canvasRef}
          width='1280'
          height='720'
          style={{ transform: 'rotateY(180deg)' }}
          className='absolute top-0 left-0 w-full h-full'
        ></canvas>
      </div>
    </section>
  );
}
