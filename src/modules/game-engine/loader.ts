// Vendored from mrdoob/Starter-Kit-Racing (js/Loader.js, MIT license).
// Ported to TypeScript -- see public/models/THIRD_PARTY_NOTICES.md.
//
// Every track-piece/vehicle/decoration GLB shares one baked colormap
// texture; this plugin intercepts GLTFLoader's own texture-loading step and
// substitutes one shared, pre-loaded THREE.Texture instead of re-decoding
// the same PNG once per model.
import * as THREE from "three";
import { GLTFLoader, type GLTFParser, type GLTFLoaderPlugin } from "three/examples/jsm/loaders/GLTFLoader.js";

const sharedColormap = new THREE.TextureLoader().load("/models/Textures/colormap.png");
sharedColormap.colorSpace = THREE.SRGBColorSpace;
sharedColormap.flipY = false;

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
      return Promise.resolve(sharedColormap);
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
