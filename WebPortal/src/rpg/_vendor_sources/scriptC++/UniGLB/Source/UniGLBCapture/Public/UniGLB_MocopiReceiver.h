// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "Misc/CoreDelegates.h"
#include "UObject/NoExportTypes.h"
#include "Interfaces/IPv4/IPv4Address.h"
#include "Interfaces/IPv4/IPv4Endpoint.h"
#include "Common/UdpSocketReceiver.h"
#include "Sockets.h"
#include "Common/UdpSocketBuilder.h"
#include "Misc/EngineVersionComparison.h"
#include "Tickable.h"


// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "Containers/RingBuffer.h"

#include "UniGLB_MocopiReceiver.generated.h"

/**
 * 
 */

enum MocopiData{
	BoneNum = 27,
};


USTRUCT(BlueprintType)
struct FUniGLBStructMocopiData{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	int FrameNo = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	int Time = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, EditFixedSize, Category = "UniGLB")
	TArray<FTransform> MocopiTransformWorld;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, EditFixedSize, Category = "UniGLB")
	TArray<FTransform> MocopiTransformLocal;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, EditFixedSize, Category = "UniGLB")
	TArray<FTransform> UniGLBTransformLocal;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	TMap<FString, FTransform> UniGLBTransformBoneList;

	FUniGLBStructMocopiData() {
		MocopiTransformWorld.SetNum(MocopiData::BoneNum);
		MocopiTransformLocal.SetNum(MocopiData::BoneNum);
		UniGLBTransformLocal.SetNum(MocopiData::BoneNum);
	}
};

class UNIGLBCAPTURE_API FMocopiReceiverProxy : public FTickableGameObject
{
	UUniGLBMocopiReceiver* Receiver;
	FSocket* Socket = nullptr;
	FUdpSocketReceiver* SocketReceiver = nullptr;

	FIPv4Address ReceiveIPAddress;
	int32 Port = 8888;

	TArray<uint8> RecvDataSet;

public:
	FMocopiReceiverProxy(UUniGLBMocopiReceiver *InReceiver);
	//FMocopiReceiverProxy(UUniGLBMocopiReceiver& InServer);
	virtual ~FMocopiReceiverProxy();

#if WITH_EDITOR
	virtual bool IsTickableInEditor() const override {
		return true;
	}
#endif // WITH_EDITOR

	void Listen();

	void Stop();

	bool SetAddress(const FString& ReceiveIPAddress, int32 Port);

	virtual void Tick(float InDeltaTime) override;
	virtual TStatId GetStatId() const override;

	void OnPacketReceived(const FArrayReaderPtr& InData, const FIPv4Endpoint& InEndpoint);
};


UCLASS(BlueprintType)
class UNIGLBCAPTURE_API UUniGLBMocopiReceiver : public UObject
{
	GENERATED_UCLASS_BODY()

	int BufferNum = 10;
	int currentFrameNo = 0;
	int currentTime = 0;

	mutable FCriticalSection BufferCS;

	TUniquePtr<FMocopiReceiverProxy> ReceiverProxy;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
	TRingBuffer<FUniGLBStructMocopiData> MocopiReceiveBuffer;

public:

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void Listen();

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void Stop();

	void OnPacketReceived(const FArrayReaderPtr& InData, const FIPv4Endpoint& InEndpoint);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	bool SetAddress(const FString& ReceiveIPAddress, int32 Port);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetBufferNum(int32 Num = 10);

	void OnPacketReceived(FUniGLBStructMocopiData data);

	void PacketBroadcast();

	DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FUniGLBMocopiReceiverDelegate, FUniGLBStructMocopiData, data);

	UPROPERTY(BlueprintAssignable, Category = "UniGLB")
	FUniGLBMocopiReceiverDelegate OnReceived;

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void GetNextFrameData(FUniGLBStructMocopiData &data, bool &bEnable, bool &bUpdate);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void GetLatestFrameData(FUniGLBStructMocopiData &data, bool &bEnable, bool &bUpdate);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void GetCurrentTime(int& FrameNo, int& Time) {
		FrameNo = currentFrameNo;
		Time = currentTime;
	}

protected:
	virtual void BeginDestroy() override;


};
