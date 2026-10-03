// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLBCapture.h"
#include "CoreMinimal.h"
#include "UniGLBCaptureLog.h"
#include "Modules/ModuleManager.h"
#include "Internationalization/Internationalization.h"

#define LOCTEXT_NAMESPACE "UniGLBCapture"

DEFINE_LOG_CATEGORY(LogUniGLBCapture);

//////////////////////////////////////////////////////////////////////////
// FSpriterImporterModule

class FUniGLBCaptureModule : public FDefaultModuleImpl
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

IMPLEMENT_MODULE(FUniGLBCaptureModule, UniGLBCapture);

//////////////////////////////////////////////////////////////////////////

#undef LOCTEXT_NAMESPACE
