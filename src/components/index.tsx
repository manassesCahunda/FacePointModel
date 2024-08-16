import dynamic from 'next/dynamic';

// Importação dinâmica para garantir que o componente só seja carregado no lado do cliente
const FaceMeshComponent = dynamic(() => import('./FaceMeshClient'), {
  ssr: false, // Desativar a renderização no lado do servidor
});

export default FaceMeshComponent;
