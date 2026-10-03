// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0), (5, 2, 0), (5, 3, 0), (5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.

#include "UObject/UnrealTypePrivate.h"
#include "Rig/IKRigDefinition.h"
#include "Rig/Solvers/IKRigFullBodyIK.h"
#include "Retargeter/IKRetargeter.h"
#if WITH_EDITOR
#include "RigEditor/IKRigController.h"
#include "RetargetEditor/IKRetargeterController.h"
#endif

