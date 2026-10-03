// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_OptionWindow.h"
#include "Modules/ModuleManager.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SUniformGridPanel.h"
#include "Widgets/Input/SButton.h"
#include "EditorStyleSet.h"
//#include "Factories/FbxAnimSequenceImportData.h"
#include "IDocumentation.h"
#include "PropertyEditorModule.h"
#include "IDetailsView.h"

#define LOCTEXT_NAMESPACE "UniGLBOption"

void SUniGLBOptionWindow::Construct(const FArguments& InArgs)
{
	ImportUI = InArgs._ImportUI;
	WidgetWindow = InArgs._WidgetWindow;
	//bIsObjFormat = InArgs._IsObjFormat;

	check (ImportUI);
	
	TSharedPtr<SBox> ImportTypeDisplay;
	TSharedPtr<SHorizontalBox> FbxHeaderButtons;
	TSharedPtr<SBox> InspectorBox;
	this->ChildSlot
	[
		SNew(SBox)
		.MaxDesiredHeight(InArgs._MaxWindowHeight)
		.MaxDesiredWidth(InArgs._MaxWindowWidth)
		[
			SNew(SVerticalBox)
			+ SVerticalBox::Slot()
			.AutoHeight()
			.Padding(2)
			[
				SAssignNew(ImportTypeDisplay, SBox)
			]
			+SVerticalBox::Slot()
			.AutoHeight()
			.Padding(2)
			[
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
				SNew(SBorder)
				.Padding(FMargin(3))
				.BorderImage(FAppStyle::GetBrush("ToolPanel.GroupBorder"))
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot()
				.AutoWidth()
				[
					SNew(STextBlock)
					.Font(FAppStyle::GetFontStyle("CurveEd.LabelFont"))
				.Text(LOCTEXT("Import_CurrentFileTitle", "Current File: "))
				]
			+ SHorizontalBox::Slot()
				.Padding(5, 0, 0, 0)
				.AutoWidth()
				.VAlign(VAlign_Center)
				[
					SNew(STextBlock)
					.Font(FAppStyle::GetFontStyle("CurveEd.InfoFont"))
				.Text(InArgs._FullPath)
				]
				]
			]
			+ SVerticalBox::Slot()
			.AutoHeight()
			.Padding(2)
			[
				SAssignNew(InspectorBox, SBox)
				.MaxDesiredHeight(650.0f)
				.WidthOverride(400.0f*2.f)
			]
			+ SVerticalBox::Slot()
			.AutoHeight()
			.HAlign(HAlign_Right)
			.Padding(2)
			[
				SNew(SUniformGridPanel)
				.SlotPadding(2)
				/*
				+ SUniformGridPanel::Slot(0, 0)
				[
					IDocumentation::Get()->CreateAnchor(FString("Engine/Content/FBX/ImportOptions"))
				]
				*/
			/*
				+ SUniformGridPanel::Slot(1, 0)
				[
					SNew(SButton)
					.HAlign(HAlign_Center)
					.Text(LOCTEXT("FbxOptionWindow_ImportAll", "Import All"))
					.ToolTipText(LOCTEXT("FbxOptionWindow_ImportAll_ToolTip", "Import all files with these same settings"))
					.IsEnabled(this, &SUniGLBOptionWindow::CanImport)
					.OnClicked(this, &SUniGLBOptionWindow::OnImportAll)
				]
			*/
				+ SUniformGridPanel::Slot(2, 0)
				[
					SAssignNew(ImportButton, SButton)
					.HAlign(HAlign_Center)
					.Text(LOCTEXT("UniGLBOptionWindow_Import", "Import"))
					.IsEnabled(this, &SUniGLBOptionWindow::CanImport)
					.OnClicked(this, &SUniGLBOptionWindow::OnImport)
				]
				+ SUniformGridPanel::Slot(3, 0)
				[
					SNew(SButton)
					.HAlign(HAlign_Center)
					.Text(LOCTEXT("UniGLBOptionWindow_Cancel", "Cancel"))
					.ToolTipText(LOCTEXT("UniGLBOptionWindow_Cancel_ToolTip", "Cancels importing this file"))
					.OnClicked(this, &SUniGLBOptionWindow::OnCancel)
				]
			]
		]
	];

	FPropertyEditorModule& PropertyEditorModule = FModuleManager::GetModuleChecked<FPropertyEditorModule>("PropertyEditor");
	FDetailsViewArgs DetailsViewArgs;
	DetailsViewArgs.bAllowSearch = false;
	DetailsViewArgs.NameAreaSettings = FDetailsViewArgs::HideNameArea;
	DetailsView = PropertyEditorModule.CreateDetailView(DetailsViewArgs);

	InspectorBox->SetContent(DetailsView->AsShared());

	/*
	ImportTypeDisplay->SetContent(
		SNew(SBorder)
		.Padding(FMargin(3))
		.BorderImage(FEditorStyle::GetBrush("ToolPanel.GroupBorder"))
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot()
			.VAlign(VAlign_Center)
			[
				SNew(STextBlock)
				.Text(this, &SUniGLBOptionWindow::GetImportTypeDisplayText)
			]
			+ SHorizontalBox::Slot()
			[
				SNew(SBox)
				.HAlign(HAlign_Right)
				[
					SAssignNew(FbxHeaderButtons, SHorizontalBox)
					+ SHorizontalBox::Slot()
					.AutoWidth()
					.Padding(FMargin(2.0f, 0.0f))
					[
						SNew(SButton)
						.Text(LOCTEXT("FbxOptionWindow_ResetOptions", "Reset to Default"))
						.OnClicked(this, &SUniGLBOptionWindow::OnResetToDefaultClick)
					]
				]
			]
		]
	);
	*/

	DetailsView->SetObject(ImportUI);
}

FReply SUniGLBOptionWindow::OnResetToDefaultClick() const
{
	ImportUI->ResetToDefault();
	//Refresh the view to make sure the custom UI are updating correctly
	DetailsView->SetObject(ImportUI, true);
	return FReply::Handled();
}

FText SUniGLBOptionWindow::GetImportTypeDisplayText() const
{
	return FText::GetEmpty();
}

bool SUniGLBOptionWindow::CanImport()  const
{
	/*
	// do test to see if we are ready to import
	if (ImportUI->MeshTypeToImport == FBXIT_Animation)
	{
		if (ImportUI->Skeleton == NULL || !ImportUI->bImportAnimations)
		{
			return false;
		}
	}

	if (ImportUI->AnimSequenceImportData->AnimationLength == FBXALIT_SetRange)
	{
		if (ImportUI->AnimSequenceImportData->FrameImportRange.Min > ImportUI->AnimSequenceImportData->FrameImportRange.Max)
		{
			return false;
		}
	}
*/
	return true;
}

#undef LOCTEXT_NAMESPACE
