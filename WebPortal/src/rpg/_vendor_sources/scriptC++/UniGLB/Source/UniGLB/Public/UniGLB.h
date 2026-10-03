// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once
//#include "Engine.h"
#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

DECLARE_LOG_CATEGORY_EXTERN(LogUniGLB, Verbose, All);

#define SPRITER_IMPORT_ERROR(FormatString, ...) \
	if (!bSilent) { UE_LOG(LogUniGLB, Warning, FormatString, __VA_ARGS__); }
#define SPRITER_IMPORT_WARNING(FormatString, ...) \
	if (!bSilent) { UE_LOG(LogUniGLB, Warning, FormatString, __VA_ARGS__); }



class FUniGLBModule : public IModuleInterface
{
public:

	/** IModuleInterface implementation */
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;
};