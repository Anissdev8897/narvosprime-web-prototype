// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLBDetailCustomize.h"
#include "UniGLB_CustomStruct.h"

#include "AssetToolsModule.h"
#include "Modules/ModuleManager.h"
#include "Internationalization/Internationalization.h"
#include "ThumbnailRendering/ThumbnailManager.h"
#include "Editor/PropertyEditor/Public/PropertyEditorModule.h"
#include "Misc/EngineVersionComparison.h"

#include "IDetailChildrenBuilder.h"
#include "IDetailPropertyRow.h"

#include "DetailLayoutBuilder.h"
#include "DetailWidgetRow.h"

#include "Animation/AnimSequenceBase.h"


FUniGLBRetargetSrcAnimSequenceCustomization::FUniGLBRetargetSrcAnimSequenceCustomization()
{
}

bool FUniGLBRetargetSrcAnimSequenceCustomization::ShouldFilterAsset(const FAssetData& AssetData)
{
	// This is the "source AnimSequence to retarget" picker. The old keyword filter (inherited from the
	// VRM4U days, then blindly rebranded "vrm"->"uniglb") required the asset's Skeleton value to contain
	// ALL of {skel_, uniglb, simple} at once -- no real skeleton ever matches, so the picker was always
	// empty. UniGLB is a universal importer, so we don't restrict the source AnimSequence by skeleton
	// name: show every AnimSequence and let the user pick. (return false == do not filter out)
	return false;
}

void FUniGLBRetargetSrcAnimSequenceCustomization::CustomizeChildren(TSharedRef<class IPropertyHandle> StructPropertyHandle, class IDetailChildrenBuilder& StructBuilder, IPropertyTypeCustomizationUtils& StructCustomizationUtils) {

	{
		uint32 TotalChildren = 0;
		StructPropertyHandle->GetNumChildren(TotalChildren);
		for (uint32 ChildIndex = 0; ChildIndex < TotalChildren; ++ChildIndex)
		{
			TSharedPtr<IPropertyHandle> ChildHandle = StructPropertyHandle->GetChildHandle(ChildIndex);

			if (ChildHandle->GetProperty()->GetFName() == GET_MEMBER_NAME_CHECKED(FUniGLBRetargetSrcAnimSequence, AnimSequence)) {
				StructBuilder.AddCustomRow(ChildHandle->GetPropertyDisplayName())
					.NameContent()
					[
						StructPropertyHandle->CreatePropertyNameWidget()
					]
					.ValueContent()
					.MaxDesiredWidth(250.0f)
					.MinDesiredWidth(250.0f)
					[
						SNew(SObjectPropertyEntryBox)
						.AllowedClass(UAnimSequenceBase::StaticClass())
						.OnShouldFilterAsset(this, &FUniGLBRetargetSrcAnimSequenceCustomization::ShouldFilterAsset)
						.PropertyHandle(ChildHandle)
						.ThumbnailPool(StructCustomizationUtils.GetThumbnailPool())
					];
			}
		}
	}
}
void FUniGLBRetargetSrcAnimSequenceCustomization::CustomizeHeader(TSharedRef<IPropertyHandle> StructPropertyHandle, class FDetailWidgetRow& HeaderRow, IPropertyTypeCustomizationUtils& StructCustomizationUtils) {
}

///

