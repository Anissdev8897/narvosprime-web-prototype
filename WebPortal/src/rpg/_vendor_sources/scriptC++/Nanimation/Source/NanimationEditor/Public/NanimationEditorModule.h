// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimationEditorModule.h

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

class FNanimationEditorModule : public IModuleInterface
{
public:
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;

private:
	void RegisterMenus();
	void GenerateNanimationSet();
};
