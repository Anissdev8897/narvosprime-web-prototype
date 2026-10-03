// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "PropertyCustomizationHelpers.h"

class FUniGLBRetargetSrcAnimSequenceCustomization : public IPropertyTypeCustomization
{
public:
	FUniGLBRetargetSrcAnimSequenceCustomization();

	static TSharedRef<IPropertyTypeCustomization> MakeInstance()
	{
		return MakeShareable(new FUniGLBRetargetSrcAnimSequenceCustomization);
	}

	/** IPropertyTypeCustomization interface */
	virtual void CustomizeHeader(TSharedRef<IPropertyHandle> StructPropertyHandle, class FDetailWidgetRow& HeaderRow, IPropertyTypeCustomizationUtils& StructCustomizationUtils) override;
	virtual void CustomizeChildren(TSharedRef<class IPropertyHandle> StructPropertyHandle, class IDetailChildrenBuilder& StructBuilder, IPropertyTypeCustomizationUtils& StructCustomizationUtils) override;

private:

	bool ShouldFilterAsset(const FAssetData& AssetData);
};

