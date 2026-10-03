// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "Components/PoseableMeshComponent.h"
#include "Misc/CoreDelegates.h"

#include "UniGLB_EditorEventComponent.generated.h"

UENUM(BlueprintType)
enum class EUniGLB_PIEEvent : uint8
{
	PreBeginPIE,
	BeginPIE,
	PrePIEEnded,
	PostPIEStarted,
	EndPIE,
	PausePIE,
	ResumePIE,
	SingleStepPIE,
	OnPreSwitchBeginPIEAndSIE,
	OnSwitchBeginPIEAndSIE,
};


/**
 * 
 */
UCLASS(meta=(BlueprintSpawnableComponent))
class UNIGLB_API UUniGLBEditorEventComponent : public UActorComponent
{
	GENERATED_UCLASS_BODY()
	
public:

	DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FUniGLBSelectionChangedEventDelegate, bool, dummy);
	DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FUniGLBSelectionObjectEventDelegate, bool, dummy);

	UPROPERTY(BlueprintAssignable)
	FUniGLBSelectionChangedEventDelegate OnSelectionChange;
	UPROPERTY(BlueprintAssignable)
	FUniGLBSelectionObjectEventDelegate OnSelectionObject;
	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetSelectCheck(bool bCheckOn);

	//
	DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FUniGLBPIEEventDelegate, EUniGLB_PIEEvent, dummy);

	UPROPERTY(BlueprintAssignable)
	FUniGLBPIEEventDelegate OnPIEEvent;

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetPIEEventCheck(bool bCheckOn);

	//

	DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FUniGLBGlobalTimeChangeEventDelegate, float, CurrentTime);

	UPROPERTY(BlueprintAssignable)
	FUniGLBGlobalTimeChangeEventDelegate OnGlobalTimeChange;

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetGlobalTimeCheck(bool bCheckOn);

public:
	void OnRegister() override;
	void OnUnregister() override;

private:

	void OnSelectionObjectFunc(UObject *obj);
	void OnSelectionChangeFunc(UObject *obj);

	void OnGlobalTimeChangeFunc();

	/*
	PreBeginPIE,
		BeginPIE,
		PrePIEEnded,
		PostPIEStarted,
		EndPIE,
		PausePIE,
		ResumePIE,
		SingleStepPIE,
		OnPreSwitchBeginPIEAndSIE,
		OnSwitchBeginPIEAndSIE,
*/		
	void OnBeginPIE(const bool bIsSimulating);
	void OnEndPIE(const bool bIsSimulating);
	void OnPIEEventFunc(EUniGLB_PIEEvent e);

	FDelegateHandle handle;
};
