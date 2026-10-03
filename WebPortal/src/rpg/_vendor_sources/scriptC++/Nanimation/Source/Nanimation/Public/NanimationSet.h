// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimationSet.h
// ===============
// UNanimationSet is the data-driven payload the scanner WRITES and the runtime
// READS. It is a UPrimaryDataAsset so the AssetManager can discover, bundle and
// (for the big GASP volume) async-stream it by FPrimaryAssetId.
//
// It maps each normalized category to its FNanimAction (variant group + policy +
// net mode). Per the LOCKED decision the variant animation refs are TSoftObjectPtr
// inside FNanimVariant, so assigning a 1828-seq GASP set here does NOT pull every
// sequence resident -- only picked variants are resolved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "NanimationTypes.h"

#include "NanimationSet.generated.h"

UCLASS(BlueprintType)
class NANIMATION_API UNanimationSet : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	/** Public constant for the PrimaryAssetType name, shared with AssetManager config. */
	static const FName PrimaryAssetTypeName;

	/** The core data table. One action group per category. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Nanimation|Set")
	TMap<ENanimCategory, FNanimAction> Actions;

	/**
	 * Optional human label / config name used purely for tooling & logging.
	 * NOTE: this is set by the scanner to match the asset name. It is not read
	 * at runtime; the UObject's GetFName() is the canonical name.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Nanimation|Set")
	FName SetName = NAME_None;

	// --- Helper accessors -------------------------------------------------

	/** True if a (non-empty) action group exists for the category. */
	UFUNCTION(BlueprintCallable, Category = "Nanimation|Set")
	bool HasAction(ENanimCategory Category) const;

	/**
	 * Returns the action group for a category. bOutFound distinguishes
	 * "missing" from "present but empty". NOTE: HasAction requires IsValid()
	 * (non-empty), while GetAction's bOutFound only tests presence in the map.
	 * They can differ: HasAction=false && bOutFound=true means the entry exists
	 * but its Variants array is empty.
	 */
	UFUNCTION(BlueprintCallable, Category = "Nanimation|Set")
	FNanimAction GetAction(ENanimCategory Category, bool& bOutFound) const;

	/** Const pointer accessor for C++ hot paths (no copy). */
	const FNanimAction* FindAction(ENanimCategory Category) const;

	// --- PrimaryAsset plumbing -------------------------------------------

	virtual FPrimaryAssetId GetPrimaryAssetId() const override;
};
