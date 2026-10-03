// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimGenerateSetCommandlet.h
// =============================
// Headless entry point to the scanner. Generates a UNanimationSet from the
// command line. Defaults come from UNanimationEditorSettings.
//
//   UnrealEditor-Cmd.exe <project> -run=NanimGenerateSet
//       [-Source=/Game/Animations] [-Out=/Game/Nanimation] [-Name=DA_MySet] [-Overwrite]
//

#pragma once

#include "CoreMinimal.h"
#include "Commandlets/Commandlet.h"
#include "NanimGenerateSetCommandlet.generated.h"

UCLASS()
class UNanimGenerateSetCommandlet : public UCommandlet
{
	GENERATED_BODY()

public:
	virtual int32 Main(const FString& Params) override;
};
