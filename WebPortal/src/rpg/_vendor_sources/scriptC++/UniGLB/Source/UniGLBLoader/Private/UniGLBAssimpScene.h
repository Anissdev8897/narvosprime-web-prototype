// UniGLB — derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications (c) hanibes. See LICENSE.
//
// Private facade: all assimp includes are centralised here so the public headers stay
// dependency-clean. Every .cpp that needs aiScene / aiMesh / Assimp::Importer / VRMMaterial
// includes this file instead of reaching into ThirdParty directly.

#pragma once

#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/mesh.h>
#include <assimp/postprocess.h>
#include <assimp/material.h>
#include <assimp/GltfMaterial.h>
#include <assimp/vrm/vrmmeta.h>
