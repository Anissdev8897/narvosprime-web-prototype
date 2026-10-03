// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.


#include "UniGLB.h"
#include "Modules/ModuleManager.h"
#include "UniGLB_RuntimeSettings.h"
#include "Developer/Settings/Public/ISettingsModule.h"

//#include "ISettingsModule.h"


#define LOCTEXT_NAMESPACE "FUniGLBModule"

DEFINE_LOG_CATEGORY(LogUniGLB);


void FUniGLBModule::StartupModule()
{
	// This code will execute after your module is loaded into memory; the exact timing is specified in the .uplugin file per-module
	{
	
	}
	if (ISettingsModule* SettingsModule = FModuleManager::GetModulePtr<ISettingsModule>("Settings"))
	{
		SettingsModule->RegisterSettings("Project", "Plugins", "UniGLB",
			LOCTEXT("RuntimeSettingsName", "UniGLB"),
			LOCTEXT("RuntimeSettingsDescription", "Configure the UniGLB plugin"),
			GetMutableDefault<UUniGLBRuntimeSettings>());
	}

}

void FUniGLBModule::ShutdownModule()
{
	// This function may be called during shutdown to clean up your module.  For modules that support dynamic reloading,
	// we call this function before unloading the module.

	if (ISettingsModule* SettingsModule = FModuleManager::GetModulePtr<ISettingsModule>("Settings"))
	{
		SettingsModule->UnregisterSettings("Project", "Plugins", "UniGLB");
	}
}

#undef LOCTEXT_NAMESPACE
	
IMPLEMENT_MODULE(FUniGLBModule, UniGLB)