// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// AnimGraphNode_NanimSelect.h
// ===========================
// EDITOR wrapper that makes the runtime FAnimNode_NanimSelect placeable in an
// Animation Blueprint's AnimGraph. Without this UAnimGraphNode_Base subclass the
// runtime node exists but cannot be added to any graph.

#pragma once

#include "CoreMinimal.h"
#include "AnimGraphNode_Base.h"
#include "AnimNode_NanimSelect.h"

#include "AnimGraphNode_NanimSelect.generated.h"

UCLASS()
class UAnimGraphNode_NanimSelect : public UAnimGraphNode_Base
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, Category = "Settings")
	FAnimNode_NanimSelect Node;

	//~ Begin UAnimGraphNode_Base / UEdGraphNode interface
	virtual FText GetNodeTitle(ENodeTitleType::Type TitleType) const override;
	virtual FText GetTooltipText() const override;
	virtual FString GetNodeCategory() const override;
	virtual FLinearColor GetNodeTitleColor() const override;
	//~ End interface
};
