// Copyrighted by Kreshnik Halili - Hoax Games - 2024

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "uAimLockOn.generated.h"

UENUM(BlueprintType)
enum class EURotationInterpolationMethod : uint8
{
	SLERP,
	CONSTANT_SLERP
};



UCLASS( ClassGroup=(Custom), meta=(BlueprintSpawnableComponent) )
class UAIM_API UuAimLockOn : public UActorComponent
{
	GENERATED_BODY()

public:	
	// Sets default values for this component's properties
	UuAimLockOn();

protected:
	// Called when the game starts
	virtual void BeginPlay() override;

public:	
	// Called every frame
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;



public:


	// main functions

	/**
	* compute a rotation based on a target position.
	* targetPosition is the position to look at.
	* raycastCollisionIterations only works for characters with SpringArmComponent!
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	FRotator computeLockOnRotation(FVector targetPosition, int32 raycastCollisionIterations = 1);

	/**
	* starts the auto-lock-on-behaviour.
	* lookTarget is the actor to look at.
	* fadeDuration is used for a smooth transition from "no target" to a "look at target".
	* offsetRotation is used to apply a local rotation offset from the computed look at rotation.
	* raycastCollisionIterations only works for characters with SpringArmComponent!
	* interpolateTowardsFactor is to have a smooth transition from one rotation to another when the target moves. -1 means it is instant. 5 is slow, 10 ist fast and 20 is super fast transition.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	void startAutoLockOnUsingActorAsTarget(AActor* lookTarget, float fadeInDuration = 0.0f, FVector offsetRotation = FVector::ZeroVector, int32 raycastCollisionIterations = 1, float interpolaeTowardsFactor = -1);

	/**
	* starts the auto-lock-on-behaviour.
	* lookTarget is the scene component to look at.
	* fadeDuration is used for a smooth transition from "no target" to a "look at target".
	* offsetRotation is used to apply a local rotation offset from the computed look at rotation.
	* raycastCollisionIterations only works for characters with SpringArmComponent!
	* interpolateTowardsFactor is to have a smooth transition from one rotation to another when the target moves. -1 means it is instant. 5 is slow, 10 ist fast and 20 is super fast transition.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	void startAutoLockOnUsingSceneComponentAsTarget(USceneComponent* lookTarget, float fadeInDuration = 0.0f, FVector offsetRotation = FVector::ZeroVector, int32 raycastCollisionIterations = 1, float interpolaeTowardsFactor = -1);

	/**
	* starts the auto-lock-on-behaviour.
	* lookTarget is the skeletal mesh component to look at.
	* socket is the socket name or bone name to specifically look at.
	* fadeDuration is used for a smooth transition from "no target" to a "look at target".
	* offsetRotation is used to apply a local rotation offset from the computed look at rotation.
	* raycastCollisionIterations only works for characters with SpringArmComponent!
	* interpolateTowardsFactor is to have a smooth transition from one rotation to another when the target moves. -1 means it is instant. 5 is slow, 10 ist fast and 20 is super fast transition.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	void startAutoLockOnUsingSkeletalMeshComponentAsTarget(USkeletalMeshComponent* lookTarget, FName socket, float fadeInDuration = 0.0f, FVector offsetRotation = FVector::ZeroVector, int32 raycastCollisionIterations = 1, float interpolaeTowardsFactor = -1);

	/**
	* stops the auto-lock-on-behaviour.
	* fadeOutDuration is the duration used for a smooth transition.
	* usually 0.0 is absolutely fine.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	void stopAutoLockOn(float fadeOutDuration = 0.0f);

	UFUNCTION(BlueprintCallable, Category = "uAim")
	void setPitchClamping(double minPitch = -85, double maxPitch = 85);

	UFUNCTION(BlueprintCallable, Category = "uAim")
	void setYawClamping(double minYaw = -90, double maxYaw = 90);

	/**
	* interpolateTowardsFactor is to have a smooth transition from one rotation to another when the target moves. -1 means it is instant. 5 is slow, 10 ist fast and 20 is super fast transition.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	void setInterpolateTowardsFactor(float interpolateTowardsFactor = -1);

	/**
	* returns true if a lock-on target has been specified and false otherwise.
	*/
	UFUNCTION(BlueprintCallable, BlueprintPure, Category = "uAim")
	bool hasLockOn();

	/**
	* required to be called to initialize a custom system like a turret system - not required to be called for a normal Character with a SpringArmComponent.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	void initCustomAutoLockOn(USceneComponent* yaw, USceneComponent* pitch, USceneComponent* arm);

	/**
	* if enabled (enabled by default) there will be transitions between algorithms when very close to the target for best behaviour.
	* when disabled these algos will be disabled and only the raw algo will be used (not really recommended).
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	void setEnableSafetyEdgeCaseBehaviour(bool isSafetyEdgeCaseBehaviourEnabled = true);

	/**
	* enables/disables movement prediction.
	* if isTargetMovementPredictionEnabled is true prediction will be enabled, otherwise it will be disabled.
	* projectileVelocity is the velocity of the projectile that needs to reach the target.
	* projectileGravityInfluence is the amount of gravity applied. A value of 1.0 applies a gravity of 980 cm/s� (default unreal gravity). A value of 0.0 applies a gravity of 0 cm/s�. A value of 2.0 applies a gravity of 1960 cm/s� and so on.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	void setEnablePredictTargetMovement(bool isTargetMovementPredictionEnabled, float projectileVelocity, float projectileGravityInfluence);

	/**
	* applies imprecision offset-effects on moving targets CONTINOUSLY.
	* coneAngle specifies the cone distribution of the random imprecission.
	* offsetStepPercentage specifies the max amount of the change in offset in relation to the coneAngle - usually a value of 0.5 is fine.
	* doDebugDraw is just a debugging feature and should be false by default.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	void setRandomOffsetFromTargetContinuousBehaviour(double coneAngle, double offsetStepPercentage, bool doDebugDraw = false);

	/**
	* applies imprecision offset-effects on moving targets as ONE SHOTS (very useful for turrets).
	* coneAngle specifies the cone distribution of the random imprecission.
	* offsetStepPercentage specifies the max amount of the change in offset in relation to the coneAngle - usually a value of 0.5 is fine.
	* applyDuration is the duration it will claim to apply the computed offset.
	* returnDuration is the duration it will claim to return back to the original target rotation.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	void setRandomOffsetFromTargetOneShot(double coneAngle, double offsetStepPercentage, double applyDuration, double returnDuration);

	/**
	* select rotation interpolation method.
	* you can choose between a slerp and a constant slerp.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	void setRotationInterpolationMethod(EURotationInterpolationMethod interpolationMethod);

	UFUNCTION(BlueprintCallable, Category = "uAim")
	void setDeltaMovementPredictionAdaptionSpeed(double speed = 20);

	UFUNCTION(BlueprintCallable, Category = "uAim")
	void setMovementPredictionVelocityAdaptionSpeed(double speed = 30);

	UFUNCTION(BlueprintCallable, Category = "uAim")
	void setUseMortarPredictionAlgorithm(bool useMortarPredictionAlgorithm = false);


	// useful getters
	UFUNCTION(BlueprintCallable, BlueprintPure, Category = "uAim")
	FVector getPredictedTargetPosition();

	UFUNCTION(BlueprintCallable, BlueprintPure, Category = "uAim")
	AActor* getLockOnTarget();

	UFUNCTION(BlueprintCallable, BlueprintPure, Category = "uAim")
	USceneComponent* getLockOnSceneComponent();

	UFUNCTION(BlueprintCallable, BlueprintPure, Category = "uAim")
	USkeletalMeshComponent* getLockOnSkeletalMeshComponent();

	UFUNCTION(BlueprintCallable, BlueprintPure, Category = "uAim")
	FName getLockOnSkeletalMeshSocketName();


	// functions for general purpose

	UFUNCTION(BlueprintCallable, Category = "uAim")
	AActor* findBestLookAtTarget(TSubclassOf<AActor> actorClassToSearch, FVector sourceLocation, FVector sourceLookDirection, bool doLineTraceCheck, ECollisionChannel traceChannel, const TArray<TEnumAsByte<ECollisionChannel>>& blockerChannels, bool traceComplex, const TArray<AActor*>& actorsToIgnore);

	/**
	* compute your lock-on rotations directly with the this raw function.
	* targetPosition is the position to look at.
	* originPosition is the position of the rotator - like for example the arm start origin location.
	* armPosition is the end position of the arm itself.
	* currentLookDirectionInOrigin is the current forward vector of the specific system.
	* rightAxis is the right vector of the specific system.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	FRotator computeGeneralisticLockOnRotationHorizontalVertical(FVector targetPosition, FVector originPosition, FVector armPosition, FVector currentLookDirectionInOrigin, FVector rightAxis);

	/**
	* compute your lock-on rotations directly with the this raw function.
	* targetPosition is the position to look at.
	* originPositionInYaw is the position of the yaw-rotator.
	* originPositionPitch is the position of the pitch-rotator.
	* armPosition is the end position of the arm itself.
	* currentLookDirectionInYaw is the current forward vector of the specific system - in general you should provide the same vector as you provide for the pitch.
	* currentLookDirectionInPitch is the current forward vector of the specific system.
	* rightAxis is the right vector of the specific system.
	* upAxis is the up vector of the specific system.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	FRotator computeGeneralisticLockOnRotationHorizontalVerticalWithUpAxis(FVector targetPosition, FVector originPositionYaw, FVector originPositionPitch, FVector armPosition, FVector currentLookDirectionInYaw, FVector currentLookDirectionInPitch, FVector rightAxis, FVector upAxis);

	/**
	* compute your lock-on rotations directly with the this raw function.
	* targetPosition is the position to look at.
	* originPosition is the position of the rotator - like for example the arm start origin location.
	* armPosition is the end position of the arm itself.
	* currentLookDirectionInOrigin is the current forward vector of the specific system.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	FRotator computeGeneralisticLockOnRotationSimple(FVector targetPosition, FVector originPosition, FVector armPosition, FVector currentLookDirectionInOrigin);

	/**
	* given a current direction and a rotation that would be applied to that direction, you can clamp the relative min and max pitch and yaw angles.
	* this function returns a new "final" rotation - if you want the "new" direction vector, you have to call .Vector on the returned Rotator object.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	FRotator clampRotation(FVector referenceDirection, FRotator rotationToClamp, double minPitch = -90, double maxPitch = 90, double minYaw = -180, double maxYaw = 180);

	/**
	* a raw function to compute a random offset given a source position, target position, cone angle, offset step percentage, a previous computed offset from the target and a delta time.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	FVector computeRandomOffsetFromTarget(FVector sourcePosition, FVector targetPosition, double coneAngle, double offsetStepPercentage, FVector previousOffsetFromTarget, float deltaTime, bool debugDraw);

	/**
	* a raw function to compute a random offset and the specific delta rotation given a source position, target position, cone angle, offset step percentage and a previous computed offset from the target.
	*/
	UFUNCTION(BlueprintCallable, Category = "uAim")
	void computeRandomOneShotOffsetFromTargetQuaternion(FVector sourcePosition, FVector targetPosition, double coneAngle, double offsetStepPercentage, FVector previousOffsetFromTarget, FVector& nextOffsetFromTarget, FQuat& randomDeltaRotation);


protected:

	UPROPERTY()
	class AController* mmController;

	UPROPERTY()
	class USpringArmComponent* mmSpringArm;

	UPROPERTY()
	AActor* mmLockOnActor;

	UPROPERTY()
	USceneComponent* mmLockOnSceneComponent;

	UPROPERTY()
	USkeletalMeshComponent* mmLockOnSkeletalMeshComponent;
	FName mmLockOnSkeletalMeshSocketName;


	UPROPERTY()
	USceneComponent* mmYawComponent;

	UPROPERTY()
	USceneComponent* mmPitchComponent;

	UPROPERTY()
	USceneComponent* mmArmComponent;


	float mmCurrentLockOnFade;
	float mmTargetLockOnFade;

	double mmFadeStartTime;
	double mmFadeDuration;
	FRotator mmFadeStartRotation;
	int32 mmRaycastCollisionIterations;

	double mmPitchMin = -360.0;
	double mmPitchMax = 360.0;

	double mmYawMin = -360.0;
	double mmYawMax = 360.0;

	FVector mmOffsetRotation;

	double mmInterpolateTowardsFactor;

	bool mmIsSafetyEdgeCaseBehaviourEnabled = true;

	bool mmIsTargetMovmentPredictionEnabled = false;

	FVector mmPrevTargetPosition;
	FVector mmCurrentVelocity;
	FVector mmDelayedVelocity;
	FVector mmCurrentAccelerationVelocity;
	FVector mmDeltaMovementCorrection;
	double mmDeltaMovementPredictionAdaptionSpeed = 20.0;
	double mmMovementPredictionVelocityAdaptionSpeed = 30.0;
	float mmMovmentPredictionVelocity;
	float mmGravityPredictionStrength;

	float mmDeltaTime;

	EURotationInterpolationMethod mmRotationInterpolationMethod = EURotationInterpolationMethod::SLERP;

	double mmRandomOffsetConeAngle = 0;
	double mmOffsetStepPercentage = 0;
	bool mmDoDebugDrawRandomOffsetData = false;
	FVector mmPreviousRandomOffsetFromTarget = FVector::ZeroVector;

	bool mmIsOneShot = false;
	bool mmApplyOneShot = false;
	bool mmUseMortarPredictionAlgorithm = false;
	double mmOffsetReturnDuration;
	double mmOffsetApplyDuration;
	double mmCurrentOffsetApplyElapsedTime;
	double mmCurrentOffsetReturnElapsedTime;
	FVector mmCurrentAddedOffset = FVector::ZeroVector;
	FVector mmStartAddedOffset = FVector::ZeroVector;

	FVector mmPredictedFinalPosition;


	inline double signedAngleBetween(FVector from, FVector to, FVector axis);
	inline double angleBetween(FVector from, FVector to);
	bool hasValidPawnInitialization();
	bool hasCustomAutoLockOn();
	FVector getLocationFromSkeletalMeshComponent(USkeletalMeshComponent* skeletalMesh, FName socket);
	FVector computePositionWithMovementPrediction(FVector currentTargetPosition, FVector originPosition, float deltaTime, float movementPredictionStrength, float gravityPredictionStrength);
	TArray<float> solveBallisticAngles(float Distance, float HeightDifference, float Speed, float Gravity = 980.0f);
};
