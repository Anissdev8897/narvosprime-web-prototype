// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_NetworkBPFunctionLibrary.h"
#include "UniGLB.h"

#include "Engine/Engine.h"
#include "Logging/MessageLog.h"
#include "Misc/EngineVersionComparison.h"

#if PLATFORM_WINDOWS
#include "Windows/AllowWindowsPlatformTypes.h"
#include <windows.h>
#include <iphlpapi.h>
#include <winsock.h>

#include "Windows/HideWindowsPlatformTypes.h"
#endif

void UUniGLBNetworkBPFunctionLibrary::UniGLBGetIPAddressTable(TArray<FString> &AddressTable) {

	AddressTable.Empty();

#if PLATFORM_WINDOWS

	DWORD dwSize = 0;

	TArray<uint8> IPAddrTableBuffer;
	IPAddrTableBuffer.SetNum(sizeof(MIB_IPADDRTABLE));

	if (GetIpAddrTable(nullptr, &dwSize, 0) == ERROR_INSUFFICIENT_BUFFER) {
		IPAddrTableBuffer.SetNum(dwSize);
	}

	auto dwRetVal = GetIpAddrTable(reinterpret_cast<MIB_IPADDRTABLE*>(IPAddrTableBuffer.GetData()), &dwSize, 0);
	if ( dwRetVal != NO_ERROR ) { 
		UE_LOG(LogUniGLB, Warning, TEXT("GetIpAddrTable call failed with %d\n"), dwRetVal);
	}

	{
		// inet_ntoa() is deprecated (not thread-safe; returns a pointer into a per-process static
		// buffer that the next inet_ntoa() call overwrites). dwAddr is already a network-byte-order
		// uint32, so format its 4 octets directly instead of pulling in the Sockets/Networking module
		// just for FIPv4Address.
		MIB_IPADDRTABLE* pIPAddrTable = reinterpret_cast<MIB_IPADDRTABLE*>(IPAddrTableBuffer.GetData());
		for (DWORD i = 0; i < pIPAddrTable->dwNumEntries; ++i) {
			const uint8* Octets = reinterpret_cast<const uint8*>(&pIPAddrTable->table[i].dwAddr);
			AddressTable.Add(FString::Printf(TEXT("%d.%d.%d.%d"), Octets[0], Octets[1], Octets[2], Octets[3]));
		}
	}

#endif
}