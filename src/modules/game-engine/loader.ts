// Vendored from mrdoob/Starter-Kit-Racing (js/Loader.js, MIT license).
// Ported to TypeScript -- see public/models/THIRD_PARTY_NOTICES.md.
//
// Every track-piece/vehicle/decoration GLB shares one baked colormap
// texture; this plugin intercepts GLTFLoader's own texture-loading step and
// substitutes one shared, pre-loaded THREE.Texture instead of re-decoding
// the same PNG once per model.
import * as THREE from "three";
import { GLTFLoader, type GLTFParser, type GLTFLoaderPlugin } from "three/examples/jsm/loaders/GLTFLoader.js";

// Lazily created on first use, not at module load -- this module is
// transitively imported by a page that Next.js prerenders on the server for
// static generation, and a top-level TextureLoader().load() call touches
// `document` immediately, which doesn't exist there. Deferring construction
// until a GLTFLoader actually parses a model (browser-only, inside
// engine-core.ts's client-side effect) avoids that entirely.
let sharedColormap: THREE.Texture | null = null;
function getSharedColormap(): THREE.Texture {
  if (!sharedColormap) {
    sharedColormap = new THREE.TextureLoader().load("/models/Textures/colormap.png");
    sharedColormap.colorSpace = THREE.SRGBColorSpace;
    sharedColormap.flipY = false;
  }
  return sharedColormap;
}

class SharedColorMapPlugin implements GLTFLoaderPlugin {
  name = "SHARED_COLORMAP";
  private parser: GLTFParser;

  constructor(parser: GLTFParser) {
    this.parser = parser;
  }

  loadTexture(textureIndex: number): Promise<THREE.Texture> | null {
    const json = this.parser.json;
    const textureDef = json.textures[textureIndex];
    const sourceDef = json.images[textureDef.source];

    if (sourceDef.uri === "Textures/colormap.png") {
      return Promise.resolve(getSharedColormap());
    }

    return null;
  }
}

export class ColorMapGLTFLoader extends GLTFLoader {
  constructor(manager?: THREE.LoadingManager) {
    super(manager);
    this.register((parser) => new SharedColorMapPlugin(parser));
  }
}
