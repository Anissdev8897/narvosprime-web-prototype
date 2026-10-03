// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// AnimGraphNode_NanimSelect.cpp

#include "AnimGraphNode_NanimSelect.h"

#define LOCTEXT_NAMESPACE "NanimAnimGraphNode"

FText UAnimGraphNode_NanimSelect::GetNodeTitle(ENodeTitleType::Type TitleType) const
{
	return LOCTEXT("NanimSelectTitle", "Nanim Select");
}

FText UAnimGraphNode_NanimSelect::GetTooltipText() const
{
	return LOCTEXT("NanimSelectTooltip",
		"Nanimation: plays one of several interchangeable animation variants, "
		"picked (weighted ShuffleBag) on state-entry / cycle boundary. Shares one "
		"sync group across variants to avoid phase pop. Optional Direction/Stance "
		"pins filter the variant pool (e.g. Fwd only for forward locomotion).");
}

FString UAnimGraphNode_NanimSelect::GetNodeCategory() const
{
	return TEXT("Nanimation");
}

FLinearColor UAnimGraphNode_NanimSelect::GetNodeTitleColor() const
{
	return FLinearColor(0.2f, 0.5f, 0.9f);
}

#undef LOCTEXT_NAMESPACE
