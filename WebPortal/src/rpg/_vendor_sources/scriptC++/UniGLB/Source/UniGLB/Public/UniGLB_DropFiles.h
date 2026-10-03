// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.
// ApplicationLifecycleComponent.:  See FCoreDelegates for details

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "UObject/WeakObjectPtrTemplates.h"
#include "Components/ActorComponent.h"
#include "Misc/CoreDelegates.h"
#include "UniGLB_DropFiles.generated.h"

// A parallel enum to the temperature change severity enum in CoreDelegates
// Note if you change this, then you must change the one in CoreDelegates
/*
UENUM(BlueprintType)
enum class ETemperatureSeverityType : uint8
{
	Unknown,
	Good,
	Bad,
	Serious,
	Critical,

	NumSeverities,
};
*/
//static_assert((int)ETemperatureSeverityType::NumSeverities == (int)FCoreDelegates::ETemperatureSeverity::NumSeverities, "TemperatureSeverity enums are out of sync");

/** Component to handle receiving notifications from the OS about application state (activated, suspended, termination, etc). */
UCLASS(ClassGroup=Utility, HideCategories=(Activation, "Components|Activation", Collision), meta=(BlueprintSpawnableComponent))
class UNIGLB_API UUniGLBDropFilesComponent : public UActorComponent
{
	GENERATED_UCLASS_BODY()

	//DECLARE_DYNAMIC_MULTICAST_DELEGATE(FApplicationLifetimeDelegate);
	//DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTemperatureChangeDelegate , ETemperatureSeverityType, Severity);
	//DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLowPowerModeDelegate, bool, bInLowPowerMode);

	DECLARE_MULTICAST_DELEGATE_OneParam(FStaticOnDropFiles, FString);
	static FStaticOnDropFiles	StaticOnDropFilesDelegate;

	DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDropFiles, FString, FileName);

	UPROPERTY(BlueprintAssignable)
	FOnDropFiles	OnDropFiles;

	// Weak, not raw: the GC does not track raw UObject* statics, so a raw pointer would dangle once the
	// component is destroyed (level GC, actor kill) without going through OnUnregister -> crash on read.
	static TWeakObjectPtr<UUniGLBDropFilesComponent> s_LatestActiveComponent;

public:
	void OnRegister() override;
	void OnUnregister() override;

	static const UUniGLBDropFilesComponent* getLatestActiveComponent() {
		return s_LatestActiveComponent.Get();
	};

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	bool UniGLBGetOpenFileName(FString &Filename);

private:
	/** Native handlers that get registered with the actual FCoreDelegates, and then proceed to broadcast to the delegates above */
	/*
	void ApplicationWillDeactivateDelegate_Handler() { ApplicationWillDeactivateDelegate.Broadcast(); }
	void ApplicationHasReactivatedDelegate_Handler() { ApplicationHasReactivatedDelegate.Broadcast(); }
	void ApplicationWillEnterBackgroundDelegate_Handler() { ApplicationWillEnterBackgroundDelegate.Broadcast(); }
	void ApplicationHasEnteredForegroundDelegate_Handler() { ApplicationHasEnteredForegroundDelegate.Broadcast(); }
	void ApplicationWillTerminateDelegate_Handler() { ApplicationWillTerminateDelegate.Broadcast(); }
	void ApplicationShouldUnloadResourcesDelegate_Handler() { ApplicationShouldUnloadResourcesDelegate.Broadcast(); }
	void ApplicationReceivedStartupArgumentsDelegate_Handler(const TArray<FString>& StartupArguments) { ApplicationReceivedStartupArgumentsDelegate.Broadcast(StartupArguments); }
	void OnTemperatureChangeDelegate_Handler(FCoreDelegates::ETemperatureSeverity Severity) { OnTemperatureChangeDelegate.Broadcast((ETemperatureSeverityType)Severity); }
	void OnLowPowerModeDelegate_Handler(bool bInLowerPowerMode) { OnLowPowerModeDelegate.Broadcast(bInLowerPowerMode); }
	*/
	void OnDropFilesDelegate_Handler(FString FileName) { OnDropFiles.Broadcast(FileName); }
};



