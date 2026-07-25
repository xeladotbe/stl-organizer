import * as THREE from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js'
import { modelFileUrl } from '@shared/modelFileUrl'
import type { ThumbnailJob } from '@shared/types'

const SIZE = 320

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true
})
renderer.setSize(SIZE, SIZE)
renderer.setClearColor(0x000000, 0)
document.body.appendChild(renderer.domElement)

// Allow the context to come back after a loss instead of staying dead for the rest of the session.
renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault()
  console.error('[thumbnail-renderer] WebGL context lost')
})

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100000)

// Indices 0 and 1 are the permanent lights — everything from index 2 on is the loaded model, cleared between jobs.
scene.add(new THREE.AmbientLight(0xffffff, 0.7))
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9)
keyLight.position.set(1, 1.4, 1)
scene.add(keyLight)

const stlLoader = new STLLoader()
const mfLoader = new ThreeMFLoader()

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value && typeof value === 'object' && 'isTexture' in value) {
      ;(value as THREE.Texture).dispose()
    }
  }
  material.dispose()
}

/** Rendering hundreds of models in one long-lived hidden window leaks GPU memory unless every geometry/material/texture is explicitly disposed — removing from the scene alone doesn't free them. */
function clearModel(): void {
  while (scene.children.length > 2) {
    const object = scene.children[2]
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.geometry.dispose()
      const material = child.material
      if (Array.isArray(material)) material.forEach(disposeMaterial)
      else disposeMaterial(material)
    })
    scene.remove(object)
  }
}

function frame(object: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  object.position.sub(center)
  const distance = maxDim * 1.8
  camera.position.set(distance, distance * 0.85, distance)
  camera.near = maxDim / 100
  camera.far = maxDim * 20
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
}

async function loadObject(job: ThumbnailJob): Promise<THREE.Object3D> {
  const url = modelFileUrl(job.fileId, `model.${job.ext}`)
  if (job.ext === 'stl') {
    const geometry = await stlLoader.loadAsync(url)
    geometry.computeVertexNormals()
    const material = new THREE.MeshStandardMaterial({
      color: 0x9c9c9c,
      metalness: 0.1,
      roughness: 0.65
    })
    return new THREE.Mesh(geometry, material)
  }
  return mfLoader.loadAsync(url)
}

async function handleJob(job: ThumbnailJob): Promise<void> {
  try {
    const object = await loadObject(job)
    scene.add(object)
    frame(object)
    renderer.render(scene, camera)
    const dataUrl = renderer.domElement.toDataURL('image/png')
    window.thumbnailApi.sendResult(job.jobId, dataUrl.split(',')[1] ?? null)
  } catch (err) {
    console.error('[thumbnail-renderer] failed', job, err)
    window.thumbnailApi.sendResult(job.jobId, null)
  } finally {
    clearModel()
  }
}

window.thumbnailApi.onJob((job) => {
  void handleJob(job)
})
