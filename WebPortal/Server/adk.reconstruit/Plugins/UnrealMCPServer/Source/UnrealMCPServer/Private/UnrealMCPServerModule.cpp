// Copyright StraySpark 2026 All Rights Reserved.

#include "UnrealMCPServerModule.h"
#include "MCPHttpServer.h"
#include "MCPToolRegistry.h"
#include "MCPResourceProvider.h"
#include "MCPPromptProvider.h"
#include "MCPSettings.h"
#include "MCPProtocol.h"

// Tools
#include "Tools/MCPActorTools.h"
#include "Tools/MCPBlueprintTools.h"
#include "Tools/MCPEditorTools.h"
#include "Tools/MCPAssetTools.h"
#include "Tools/MCPMaterialTools.h"
#include "Tools/MCPLevelTools.h"
#include "Tools/MCPPythonBridge.h"
#include "Tools/MCPStaticMeshTools.h"
#include "Tools/MCPBatchTools.h"
#include "Tools/MCPSpatialTools.h"
#include "Tools/MCPEnvironmentTools.h"
#include "Tools/MCPLandscapeTools.h"
#include "Tools/MCPSequencerTools.h"
#include "Tools/MCPFoliageTools.h"
#include "Tools/MCPNiagaraTools.h"
#include "Tools/MCPDataTools.h"
#include "Tools/MCPNavigationTools.h"
#include "Tools/MCPAudioTools.h"
#include "Tools/MCPPhysicsTools.h"
#include "Tools/MCPAnimationTools.h"
#include "Tools/MCPWidgetTools.h"
#include "Tools/MCPUIImageTools.h"
#include "Tools/MCP3DModelTools.h"
#include "Tools/MCPPCGTools.h"
#include "Tools/MCPWorldPartitionTools.h"
#include "Tools/MCPSplineTools.h"
#include "Tools/MCPGASTools.h"
#include "Tools/MCPEnhancedInputTools.h"
#include "Tools/MCPAITools.h"
#include "Tools/MCPGameFrameworkTools.h"
#include "Tools/MCPMacroTools.h"
#include "Tools/MCPBuildTools.h"
#include "Tools/MCPAnimGraphTools.h"
#include "Tools/MCPMaterialGraphTools.h"
#include "Tools/MCPMetaSoundTools.h"
#include "Tools/MCPNetworkingTools.h"
#include "Tools/MCPEngineAPITools.h"
#include "Tools/MCPSearchTools.h"
#include "Tools/MCPGameplayTagTools.h"
#include "Tools/MCPControlRigTools.h"
#include "Tools/MCPAssetManagementTools.h"
#include "Tools/MCPStateTreeTools.h"
#include "Tools/MCPCommonUITools.h"
#include "Tools/MCPPerformanceTools.h"
#include "MCPSearchIndex.h"

// UI
#include "UI/SMCPStatusBarWidget.h"
#include "ToolMenus.h"

// Resources & Prompts
#include "Resources/MCPBuiltInResources.h"
#include "Prompts/MCPBuiltInPrompts.h"

DEFINE_LOG_CATEGORY(LogUnrealMCP);

IMPLEMENT_MODULE(FUnrealMCPServerModule, UnrealMCPServer)

void FUnrealMCPServerModule::StartupModule()
{
	UE_LOG(LogUnrealMCP, Log, TEXT("=== Unreal MCP Server starting up ==="));

	// Register tools, resources, and prompts
	RegisterAllTools();
	RegisterAllResources();
	RegisterAllPrompts();

	// Start HTTP server if auto-start enabled
	const UMCPSettings* Settings = UMCPSettings::Get();
	if (Settings->bAutoStartServer)
	{
		FMCPHttpServer& Server = FMCPHttpServer::Get();
		if (Server.Start(Settings->ServerPort))
		{
			int32 ToolCount = FMCPToolRegistry::Get().GetToolCount();
			UE_LOG(LogUnrealMCP, Log, TEXT("MCP server ready with %d tools on port %d"), ToolCount, Settings->ServerPort);
			UE_LOG(LogUnrealMCP, Log, TEXT("Connect your AI client to: http://localhost:%d/mcp"), Settings->ServerPort);
		}
		else
		{
			UE_LOG(LogUnrealMCP, Error, TEXT("Failed to start MCP server on port %d"), Settings->ServerPort);
		}
	}
	else
	{
		UE_LOG(LogUnrealMCP, Log, TEXT("MCP server auto-start disabled. Enable in Project Settings > Plugins > Unreal MCP Server."));
	}

	// Build search index (deferred to allow assets to finish loading)
	FMCPSearchIndex::Get().Build();

	// Register status bar widget
	RegisterStatusBarWidget();

	UE_LOG(LogUnrealMCP, Log, TEXT("=== Unreal MCP Server startup complete ==="));
}

void FUnrealMCPServerModule::ShutdownModule()
{
	UE_LOG(LogUnrealMCP, Log, TEXT("Unreal MCP Server shutting down"));

	// Stop server
	FMCPHttpServer::Get().Stop();

	// Clear registries
	FMCPToolRegistry::Get().UnregisterAllTools();
	FMCPResourceProvider::Get().UnregisterAllResources();
	FMCPPromptProvider::Get().UnregisterAllPrompts();
}

void FUnrealMCPServerModule::RegisterAllTools()
{
	FMCPToolRegistry& Registry = FMCPToolRegistry::Get();
	const UMCPSettings* Settings = UMCPSettings::Get();

	UE_LOG(LogUnrealMCP, Log, TEXT("Tool preset: %s"),
		Settings->ToolPreset == EMCPToolPreset::Full ? TEXT("Full") :
		Settings->ToolPreset == EMCPToolPreset::SceneBuilding ? TEXT("Scene Building") :
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]