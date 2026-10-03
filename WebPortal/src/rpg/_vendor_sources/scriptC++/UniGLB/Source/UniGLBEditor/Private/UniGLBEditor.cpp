// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications (c) hanibes. See LICENSE.

#include "UniGLBEditor.h"
#include "CoreMinimal.h"
#include "UniGLBEditorLog.h"
#include "Modules/ModuleManager.h"
#include "Internationalization/Internationalization.h"

#define LOCTEXT_NAMESPACE "UniGLBEditor"

DEFINE_LOG_CATEGORY(LogUniGLBEditor);

//////////////////////////////////////////////////////////////////////////
// FSpriterImporterModule

class FUniGLBEditorModule : public FDefaultModuleImpl
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

IMPLEMENT_MODULE(FUniGLBEditorModule, UniGLBEditor);

//////////////////////////////////////////////////////////////////////////

#undef LOCTEXT_NAMESPACE
