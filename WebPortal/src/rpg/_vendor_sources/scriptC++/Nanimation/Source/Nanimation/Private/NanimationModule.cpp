// Copyright (c) 2026 hanibes. All Rights Reserved.

#include "Modules/ModuleManager.h"
#include "NanimationLog.h"

// Runtime module startup: LogNanimation category is defined in NanimationLog.cpp.
// We use a custom module class here so the log category initialises cleanly.
class FNanimationModule : public FDefaultModuleImpl
{
public:
	virtual void StartupModule() override {}
	virtual void ShutdownModule() override {}
};

IMPLEMENT_MODULE(FNanimationModule, Nanimation)
