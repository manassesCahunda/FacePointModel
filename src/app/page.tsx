'use client';

import Head from 'next/head';
import FaceMeshClient from '@/components/index';
import ThreeScene from '@/components/three/index';
import styles from './Home.module.css'; // Assuming you have a CSS module for styling

const Home: React.FC = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Face Mesh with MediaPipe</title>
        <meta name="description" content="Face Mesh with MediaPipe in Next.js" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <h1 className={styles.title}>Face Mesh Detection</h1>
        <div className={styles.FaceMeshContainer}>  
          <FaceMeshClient />
        </div>
        <div className={styles.threeSceneContainer}>
          <ThreeScene />
        </div>
      </main>
    </div>
  );
};

export default Home;
