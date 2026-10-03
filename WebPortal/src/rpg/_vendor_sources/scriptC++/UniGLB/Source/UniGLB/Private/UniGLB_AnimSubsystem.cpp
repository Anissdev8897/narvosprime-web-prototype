// Fill out your copyright notice in the Description page of Project Settings.


#include "UniGLB_AnimSubsystem.h"


void UUniGLB_AnimSubsystem::Clear() {
	FScopeLock Lock(&cs);
	baseData.Empty();
}

void UUniGLB_AnimSubsystem::GetBoneByIndex(int index, TMap<FString, FTransform>& trans) {
	FScopeLock Lock(&cs);
	if (baseData.IsValidIndex(index)) {
		trans = baseData[index].BoneTransform;
	}
}

void UUniGLB_AnimSubsystem::GetBoneByPort(int port, TMap<FString, FTransform>& trans) {
	FScopeLock Lock(&cs);
	for (auto& a : baseData) {
		if (a.port == port) {
			trans = a.BoneTransform;
			return;
		}
	}
	FUniGLBTransformData a;
	a.port = port;
	baseData.Add(a);
	trans = baseData.Last(0).BoneTransform;
}

void UUniGLB_AnimSubsystem::GetRawdataByIndex(int index, TMap<FString, FTransform>& trans) {
	FScopeLock Lock(&cs);
	if (baseData.IsValidIndex(index)) {
		trans = baseData[index].RawData;
	}
}

void UUniGLB_AnimSubsystem::GetRawdataByPort(int port, TMap<FString, FTransform>& trans) {
	FScopeLock Lock(&cs);
	for (auto& a : baseData) {
		if (a.port == port) {
			trans = a.RawData;
			return;
		}
	}
	FUniGLBTransformData a;
	a.port = port;
	baseData.Add(a);
	trans = baseData.Last(0).RawData;
}

void UUniGLB_AnimSubsystem::SetBoneTransform(int port, const TMap<FString, FTransform>& trans) {
	FScopeLock Lock(&cs);
	for (auto& a : baseData) {
		if (a.port == port) {
			a.BoneTransform = trans;
			return;
		}
	}
	FUniGLBTransformData a;
	a.port = port;
	a.BoneTransform = trans;
	baseData.Add(a);
}

void UUniGLB_AnimSubsystem::SetRawData(int port, const TMap<FString, FTransform>& trans) {
	FScopeLock Lock(&cs);
	for (auto& a : baseData) {
		if (a.port == port) {
			a.RawData = trans;
			return;
		}
	}
	FUniGLBTransformData a;
	a.port = port;
	a.RawData = trans;
	baseData.Add(a);
}
