// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimationSet.cpp

#include "NanimationSet.h"

const FName UNanimationSet::PrimaryAssetTypeName(TEXT("NanimationSet"));

bool UNanimationSet::HasAction(ENanimCategory Category) const
{
	const FNanimAction* Found = Actions.Find(Category);
	return Found != nullptr && Found->IsValid();
}

FNanimAction UNanimationSet::GetAction(ENanimCategory Category, bool& bOutFound) const
{
	if (const FNanimAction* Found = Actions.Find(Category))
	{
		bOutFound = true;
		return *Found;
	}

	bOutFound = false;
	return FNanimAction();
}

const FNanimAction* UNanimationSet::FindAction(ENanimCategory Category) const
{
	return Actions.Find(Category);
}

FPrimaryAssetId UNanimationSet::GetPrimaryAssetId() const
{
	return FPrimaryAssetId(FPrimaryAssetType(PrimaryAssetTypeName), GetFName());
}
