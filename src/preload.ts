// Warming the model cache, without dragging three.js into the entry.
//
// searoom did this with a module-scope `useGLTF.preload(MODEL_URL)` in
// BenchyModel. Neither half of that survives here: the URL is a prop now,
// and BenchyModel sits behind BenchyView's lazy() boundary, so a
// re-export would load three.js for everyone who imports the entry and
// undo the split. The dynamic import keeps the cost with the caller.

/**
 * Fetch and parse a model ahead of mounting, so opening the view does not
 * start from a cold fetch. Entirely optional — `BenchyView` loads the
 * model on its own either way.
 */
export async function preloadBenchyModel(modelUrl: string): Promise<void> {
  const { useGLTF } = await import('@react-three/drei');
  useGLTF.preload(modelUrl);
}
