// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_CaptureManager.h"
#include "UniGLB_MocopiReceiver.h"
#include "UniGLBCaptureLog.h"

UUniGLBMocopiReceiver* UUniGLBCaptureManager::CreateUniGLBMocopiReceiver(FString InReceiveIPAddress, int32 InPort, bool bInMulticastLoopback, bool bInStartListening, FString ServerName, UObject* Outer)
{
	{
		FString InAddress = InReceiveIPAddress;
		if (!InAddress.IsEmpty() && InAddress != TEXT("0"))
		{
		}

		bool bCanBind = false;
		bool bAppendPort = false;
		if (ISocketSubsystem* SocketSys = ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM))
		{
			const TSharedPtr<FInternetAddr> Addr = SocketSys->GetLocalHostAddr(*GLog, bCanBind);
			if (Addr.IsValid())
			{
				InAddress = Addr->ToString(bAppendPort);
			}
		}
		UE_LOG(LogUniGLBCapture, Display, TEXT("MocopiReceiver ReceiveAddress not specified. Using LocalHost IP: '%s'"), *InAddress);
	}

	if (ServerName.IsEmpty())
	{
		ServerName = FString::Printf(TEXT("MocopiReceiver_%s"), *FGuid::NewGuid().ToString(EGuidFormats::Digits));
	}

	UUniGLBMocopiReceiver* NewMocopiServer = nullptr;
	if (Outer)
	{
		NewMocopiServer = NewObject<UUniGLBMocopiReceiver>(Outer, *ServerName, RF_StrongRefOnFrame);
	}
	else
	{
		UE_LOG(LogUniGLBCapture, Warning, TEXT("Outer object not set.  MocopiReceiver may be garbage collected if not referenced."));
		NewMocopiServer = NewObject<UUniGLBMocopiReceiver>(GetTransientPackage(), *ServerName);
	}

	if (NewMocopiServer)
	{
		//NewMocopiServer->SetMulticastLoopback(bInMulticastLoopback);
		if (NewMocopiServer->SetAddress(InReceiveIPAddress, InPort))
		{
			if (bInStartListening)
			{
				NewMocopiServer->Listen();
			}
		}
		else
		{
			UE_LOG(LogUniGLBCapture, Warning, TEXT("Failed to parse ReceiveAddress '%s' for MocopiReceiver."), *InReceiveIPAddress);
		}

		return NewMocopiServer;
	}

	return nullptr;
}

