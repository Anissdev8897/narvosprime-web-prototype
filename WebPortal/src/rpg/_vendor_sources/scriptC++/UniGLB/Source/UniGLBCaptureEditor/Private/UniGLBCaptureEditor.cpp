// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLBCaptureEditor.h"
#include "CoreMinimal.h"
#include "UniGLBCaptureEditorLog.h"
#include "Modules/ModuleManager.h"
#include "Internationalization/Internationalization.h"

#define LOCTEXT_NAMESPACE "UniGLBCaptureEditor"

DEFINE_LOG_CATEGORY(LogUniGLBCaptureEditor);

//////////////////////////////////////////////////////////////////////////
// FSpriterImporterModule

class FUniGLBCaptureEditorModule : public FDefaultModuleImpl
{
public:
	virtual void StartupModule() override
	{
	}

	virtual void ShutdownModule() override
	{
	}
};

//////////////////////////////////////////////////////////////////////////

IMPLEMENT_MODULE(FUniGLBCaptureEditorModule, UniGLBCaptureEditor);

//////////////////////////////////////////////////////////////////////////

#undef LOCTEXT_NAMESPACE
