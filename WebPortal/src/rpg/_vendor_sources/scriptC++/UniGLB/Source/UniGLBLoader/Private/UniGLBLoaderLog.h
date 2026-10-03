// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
//#include "UniGLBImporterModule.h"

DECLARE_LOG_CATEGORY_EXTERN(LogUniGLBLoader, Verbose, All);

#define SPRITER_IMPORT_ERROR(FormatString, ...) \
	if (!bSilent) { UE_LOG(LogUniGLBLoader, Warning, FormatString, __VA_ARGS__); }
#define SPRITER_IMPORT_WARNING(FormatString, ...) \
	if (!bSilent) { UE_LOG(LogUniGLBLoader, Warning, FormatString, __VA_ARGS__); }

