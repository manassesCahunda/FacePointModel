import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min';

export default function Home() {
  const containerRef = useRef(null);
  const [fonemaExpressions, setFonemaExpressions] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    const fetchFaceData = async () => {
      try {
        const response = await fetch('http://localhost:4000/faceData');
        const faceData = await response.json();
        const transformedData = faceData.map(face => {
          const blendShapesObj = face.blendShapes.reduce((acc, shape) => {
            acc[shape.displayName] = shape.score;
            return acc;
          }, {});
          return {
            id: face.id,
            blendShapes: blendShapesObj,
            duration: face.duration || 1 // Ensure each expression has a duration
          };
        });
        setFonemaExpressions(transformedData);
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to fetch face data:', error);
      }
    };

    fetchFaceData();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    let camera, scene, renderer, mixer, clock, controls, head;
    let talking = true;
    let currentFonema = 0;
    let transitionTime = 0;
    const transitionDuration = 0.06;
    let blinkInterval = 2;
    let lastBlinkTime = 0;
    let phonemeStartTimes = [];

    init();

    function init() {
      clock = new THREE.Clock();

      camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 20);
      camera.position.set(-1.8, 0.8, 3);

      scene = new THREE.Scene();

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      containerRef.current.appendChild(renderer.domElement);

      const ktx2Loader = new KTX2Loader()
        .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.154.0/examples/jsm/libs/basis/')
        .detectSupport(renderer);

      new GLTFLoader()
        .setKTX2Loader(ktx2Loader)
        .setMeshoptDecoder(MeshoptDecoder)
        .load('/models/facecap.glb', (gltf) => {
          const mesh = gltf.scene.children[0];
          scene.add(mesh);

          mixer = new THREE.AnimationMixer(mesh);
          mixer.clipAction(gltf.animations[0]).play();

          head = mesh.getObjectByName('mesh_2');
          if (head && head.morphTargetInfluences) {
            const influences = head.morphTargetInfluences;

            const gui = new GUI();
            gui.close();
            for (const [key, value] of Object.entries(head.morphTargetDictionary)) {
              gui.add(influences, value, 0, 1)
                .name(key.replace('blendShape1.', ''))
                .listen();   
            }
          } else {
            console.error('No morph targets found in the model.');
          }
        }, undefined, (error) => {
          console.error('Error loading model:', error);
        });

      const environment = new RoomEnvironment(renderer);
      const pmremGenerator = new THREE.PMREMGenerator(renderer);

      scene.background = new THREE.Color(0x666666);
      scene.environment = pmremGenerator.fromScene(environment).texture;

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.minDistance = 2.5;
      controls.maxDistance = 5;
      controls.minAzimuthAngle = -Math.PI / 2;
      controls.maxAzimuthAngle = Math.PI / 2;
      controls.maxPolarAngle = Math.PI / 1.8;
      controls.target.set(0, 0.15, -0.2);

      window.addEventListener('resize', onWindowResize);
      animate();
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
      const delta = clock.getDelta();
      renderer.render(scene, camera);
      controls.update();

      if (talking) {
        simulateTalkingAnimation(delta);
      }

      if (head && head.morphTargetInfluences) {
        blinkEyes(delta);
      }

      requestAnimationFrame(animate);
    }

    function simulateTalkingAnimation(delta) {
      if (head && head.morphTargetInfluences) {
        const influences = head.morphTargetInfluences;
        const elapsedTime = clock.getElapsedTime() - (startTime || 0);

        // Calculate the total duration of phoneme expressions
        const totalDuration = fonemaExpressions.reduce((sum, expression) => sum + expression.duration, 0);

        // Identify the current phoneme based on elapsed time
        let normalizedTime = elapsedTime % totalDuration;
        let nextFonema = 0;
        let accumulatedTime = 0;

        for (let i = 0; i < fonemaExpressions.length; i++) {
          accumulatedTime += fonemaExpressions[i].duration;
          if (normalizedTime < accumulatedTime) {
            nextFonema = i;
            break;
          }
        }

        // Interpolate between the current expression and the next one
        const currentExpressions = fonemaExpressions[currentFonema].blendShapes;
        const nextExpressions = fonemaExpressions[nextFonema].blendShapes;

        // Update influences with interpolation
        for (const [key, value] of Object.entries(nextExpressions)) {
          let transformedKey = key;

          if (key === "mouthRight" || key === "mouthLeft") {
            transformedKey = key; // Use the key as-is
          } else if (key.includes("Right")) {
            transformedKey = key.replace("Right", "_R");
          } else if (key.includes("Left")) {
            transformedKey = key.replace("Left", "_L");
          }

          const index = head.morphTargetDictionary[transformedKey];
          
          if (index !== undefined) {
            // Update influences with transformed key
            influences[index] = THREE.MathUtils.lerp(influences[index] || 0, value, delta / transitionDuration);
          } else {
            console.warn(`BlendShape ${key} depois ${transformedKey} not found in the model.`);
          }
        }

        transitionTime += delta;
        if (transitionTime >= transitionDuration) {
          transitionTime = 0;
          currentFonema = nextFonema;
        }
      }
    }
    
    function blinkEyes(delta) {
      const currentTime = clock.getElapsedTime();

      if (currentTime - lastBlinkTime >= blinkInterval) {
        const blinkLeft = head.morphTargetDictionary["eyeBlink_L"];
        const blinkRight = head.morphTargetDictionary["eyeBlink_R"];

        if (blinkLeft !== undefined) {
          head.morphTargetInfluences[blinkLeft] = 1;
        }
        if (blinkRight !== undefined) {
          head.morphTargetInfluences[blinkRight] = 1;
        }

        setTimeout(() => {
          if (blinkLeft !== undefined) {
            head.morphTargetInfluences[blinkLeft] = 0;
          }
          if (blinkRight !== undefined) {
            head.morphTargetInfluences[blinkRight] = 0;
          }
        }, 80); // Blink for 80ms

        lastBlinkTime = currentTime;
        blinkInterval = Math.random() * 1.5 + 1; // Random interval between 1 and 2.5 seconds
      }
    }

    function handleSpeech(text) {
      if (window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => {
          console.log('Speech started');
          setStartTime(clock.getElapsedTime());
          // Sync phoneme expressions with speech
          phonemeStartTimes = [];
          let accumulatedTime = 0;
          for (const expression of fonemaExpressions) {
            phonemeStartTimes.push(accumulatedTime);
            accumulatedTime += expression.duration;
          }
        };
        utterance.onend = () => {
          console.log('Speech ended');
        };
        console.log('Starting speech synthesis');
        window.speechSynthesis.speak(utterance);
      } else {
        console.error('Speech synthesis not supported in this browser.');
      }
    }

    function startSpeechRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          console.log('Speech recognition started');
        };

        recognition.onresult = (event) => {
          const results = event.results;
          const transcript = results[results.length - 1][0].transcript;
          console.log('Transcript:', transcript);

          // Handle the recognized speech
          handleSpeech(transcript);
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
        };

        recognition.onend = () => {
          console.log('Speech recognition ended');
        };

        recognition.start();
        setRecognition(recognition);
      } else {
        console.error('Speech recognition not supported in this browser.');
      }
    }

    // Start speech recognition when the component is mounted
    startSpeechRecognition();

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [fonemaExpressions, isLoaded]);

  return (
    <>
      <div id="info">
        <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> webgl - morph targets - face<br/>
        model by <a href="https://www.bannaflak.com/face-cap" target="_blank" rel="noopener">Face Cap</a>
      </div>
      <div ref={containerRef} style={{ backgroundColor: '#666666', margin: 0, overflow: 'hidden', height: '100vh', width: '100%' }} />
    </>
  );
}
