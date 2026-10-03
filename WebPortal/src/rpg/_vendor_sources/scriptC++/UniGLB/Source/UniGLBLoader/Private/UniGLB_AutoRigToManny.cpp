// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.
// Sub-project B2: auto-rig a mesh onto the Manny standard by building a Manny-topology skeleton whose joint
// POSITIONS come from the mesh's own SOURCE skeleton, then geodesic-voxel skin binding.
//
// Used by the universal auto-rig path. The SOURCE skeleton is the POSITION AUTHORITY: its joints already match
// the mesh in whatever pose it was authored (T or A). Manny supplies only topology + names + canonical rotations.
//   1. CopyMeshFromSkeletalMesh -> FDynamicMesh3 (geometry); pre-scale mesh to Manny height (capture PreScale).
//   2. Resolve canonical Manny ref-skeleton (topology + rest rotations).
//   3. SOURCE-DRIVEN FIT: map each Manny bone to a source joint by name (Manny->VRM via UniGLBUtil::table_ue4_vrm,
//      VRM->source via the meta humanoidBoneTable = inverse of renameToUE4Bone) and copy the source component-
//      space location * PreScale. Manny-only bones (twists, ik_*, gaps) are DERIVED from placed neighbours, never
//      from a Manny body-fraction (the old fraction fit fanned every uncorrected bone on a non-A-pose mesh). Rest
//      ROTATIONS are aim-corrected to point down each bone's ACTUAL fitted direction (self-consistent, no desaxe).
//   4. FSkinBindingOp (GeodesicVoxel) binds the mesh to the FITTED bare FReferenceSkeleton - never the
//      shared Manny USkeleton, never a hybrid skeleton (binding the 247-bone hybrid is what deformed before).
//   5. CreateSkeletalMeshAsset carrying the fitted ref skeleton (+ restored source materials); swap the import's mesh.
// Tier-1 self-abort (returns false) on non-upright / fused-legs / non-human proportions so a malformed rig
// is never shipped; the caller then shows the Mixamo re-rig dialog.
#include "UniGLB_Convert.h"
#include "UniGLB_AssetListObject.h"
#include "UniGLB_MetaObject.h"   // UUniGLBMetaObject::humanoidBoneTable (VRM-name -> source bone name)
#include "UniGLB_Util.h"         // UniGLBUtil::table_ue4_vrm (Manny <-> VRM name table)
#include "UniGLBLoaderLog.h"
#include "Engine/SkeletalMesh.h"
#include "Rendering/SkeletalMeshModel.h"

#if WITH_EDITOR
#include "Animation/Skeleton.h"        // USkeleton + EBoneTranslationRetargetingMode
#include "ReferenceSkeleton.h"
#include "UDynamicMesh.h"
#include "DynamicMesh/DynamicMesh3.h"
#include "DynamicMesh/MeshTransforms.h"   // MeshTransforms::Rotate (rigid yaw of positions + normals/tangents)
#include "GeometryScript/GeometryScriptTypes.h"
#include "GeometryScript/MeshAssetFunctions.h"
#include "SkinningOps/SkinBindingOp.h"
#include "AssetUtils/CreateSkeletalMeshUtil.h"
#endif

#include "UniGLBMannyResolver.h"

#if WITH_EDITOR
namespace {

// Compose every Manny bone's component-space (world) transform from its local ref pose.
static void ComputeWorld(const FReferenceSkeleton& Ref, TArray<FTransform>& OutWorld)
{
	const TArray<FTransform>& Local = Ref.GetRawRefBonePose();
	const int32 N = Ref.GetRawBoneNum();
	OutWorld.SetNum(N);
	for (int32 i = 0; i < N; ++i)
	{
		const int32 P = Ref.GetRawParentIndex(i);
		OutWorld[i] = (P == INDEX_NONE) ? Local[i] : (Local[i] * OutWorld[P]);
	}
}

// A right-handed orientation frame (right, forward, up) built from a forward vector + world up (+Z). Right
// is DERIVED (forward x up) so the frame is always proper (no mirror), regardless of forward's sign.
struct FFitFrame
{
	FVector Right, Fwd, Up;
	void Build(const FVector& InFwd)
	{
		Up = FVector::UpVector;
		FVector F = InFwd; F.Z = 0.0; // project onto ground plane
		if (!F.Normalize()) { F = FVector::ForwardVector; }
		Fwd = F;
		Right = FVector::CrossProduct(Fwd, Up).GetSafeNormal(); // right-handed, in ground plane
		if (Right.IsNearlyZero()) { Right = FVector::RightVector; }
	}
};

} // namespace
#endif // WITH_EDITOR

bool UniGLBConverter::AutoRigToManny(UUniGLBAssetListObject* uniGLBAssetList)
{
#if WITH_EDITOR
	using namespace UE::Geometry;

	if (uniGLBAssetList == nullptr || uniGLBAssetList->SkeletalMesh == nullptr || uniGLBAssetList->Package == nullptr)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: no source mesh/package; abort."));
		return false;
	}
	USkeletalMesh* SrcMesh = uniGLBAssetList->SkeletalMesh;

	// 1. Source geometry -> UDynamicMesh -> FDynamicMesh3.
	UDynamicMesh* Dyn = NewObject<UDynamicMesh>();
	EGeometryScriptOutcomePins Outcome = EGeometryScriptOutcomePins::Failure;
	FGeometryScriptCopyMeshFromAssetOptions FromOpts;
	FGeometryScriptMeshReadLOD ReadLOD;
	UGeometryScriptLibrary_StaticMeshFunctions::CopyMeshFromSkeletalMesh(SrcMesh, Dyn, FromOpts, ReadLOD, Outcome);
	if (Outcome != EGeometryScriptOutcomePins::Success)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: CopyMeshFromSkeletalMesh failed; abort."));
		return false;
	}
	FDynamicMesh3 BareMesh;
	Dyn->ProcessMesh([&BareMesh](const FDynamicMesh3& M) { BareMesh = M; });
	if (BareMesh.VertexCount() == 0)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: empty source mesh; abort."));
		return false;
	}

	// 2. Manny mesh + skeleton (the conformance target: topology + rest rotations).
	USkeletalMesh* MannyMesh = UniGLB_ResolveMannySkeletalMesh();
	if (MannyMesh == nullptr)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: could not resolve a Manny SkeletalMesh; abort."));
		return false;
	}
	USkeleton* MannySkeleton = MannyMesh->GetSkeleton();
	if (MannySkeleton == nullptr)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: Manny mesh has no skeleton; abort."));
		return false;
	}
	const FReferenceSkeleton& MannyRef = MannyMesh->GetRefSkeleton();
	const int32 NumBones = MannyRef.GetRawBoneNum();
	if (NumBones < 10)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: Manny ref skeleton too small (%d); abort."), NumBones);
		return false;
	}
	TArray<FTransform> MannyWorld;
	ComputeWorld(MannyRef, MannyWorld);

	auto MIdx = [&](const TCHAR* N) -> int32 { return MannyRef.FindBoneIndex(FName(N)); };
	auto MPos = [&](const TCHAR* N) -> FVector {
		const int32 i = MIdx(N); return (i != INDEX_NONE) ? MannyWorld[i].GetLocation() : FVector::ZeroVector;
	};

	// 2b. SCALE-TO-MANNY (fallback equivalent of the convention path's GlobalScale). The fit below scales
	//     Manny TO the mesh, so a giant/tiny source (e.g. a 50x-oversize FBX, mesh 10000 tall) would yield a
	//     giant/tiny rig. Pre-scale the source mesh to Manny's full height (head - sole) about the origin so
	//     the fit + geodesic bind produce a Manny-SIZED character. Uniform -> proportions preserved. No-op
	//     within 2%. Manual per-vertex scale (no MeshTransforms dependency). PreScale is CAPTURED so the
	//     SOURCE-skeleton joint positions (which drive the fit below) are scaled by the SAME factor as the mesh.
	double PreScale = 1.0;
	{
		const FAxisAlignedBox3d B0 = BareMesh.GetBounds();
		const double MeshH = B0.Max.Z - B0.Min.Z;
		double MannyFootZ = (double)MannyWorld[0].GetLocation().Z;
		for (const TCHAR* B : { TEXT("foot_l"), TEXT("foot_r"), TEXT("ball_l"), TEXT("ball_r") })
		{ const int32 i = MIdx(B); if (i != INDEX_NONE) { MannyFootZ = FMath::Min(MannyFootZ, (double)MannyWorld[i].GetLocation().Z); } }
		const double MannyH = (double)MPos(TEXT("head")).Z - MannyFootZ;
		if (MeshH > (double)KINDA_SMALL_NUMBER && MannyH > (double)KINDA_SMALL_NUMBER)
		{
			const double Pre = MannyH / MeshH;
			if (!FMath::IsNearlyEqual((float)Pre, 1.f, 0.02f))
			{
				PreScale = Pre;
				for (int32 vid : BareMesh.VertexIndicesItr()) { BareMesh.SetVertex(vid, BareMesh.GetVertex(vid) * Pre); }
				UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: pre-scaled source mesh to Manny size (x%.4f, meshH=%.1f mannyH=%.1f)."), (float)Pre, (float)MeshH, (float)MannyH);
			}
		}
	}

	// --- 3a. Gather mesh vertices (mesh space) + bounds. -------------------------------------------------
	TArray<FVector> V; V.Reserve(BareMesh.VertexCount());
	for (int32 vid : BareMesh.VertexIndicesItr())
	{
		const FVector3d P = BareMesh.GetVertex(vid);
		V.Add(FVector(P.X, P.Y, P.Z));
	}
	const FAxisAlignedBox3d Box = BareMesh.GetBounds();
	const FVector BMin(Box.Min.X, Box.Min.Y, Box.Min.Z);
	const FVector BMax(Box.Max.X, Box.Max.Y, Box.Max.Z);
	const FVector Ext = BMax - BMin;

	// Up axis MUST be Z (UE convention; the importer already lands meshes Z-up). If the mesh is tallest on
	// X/Y it is non-upright (authored lying down) -> Tier-1 abort rather than ship a sideways rig.
	if (Ext.Z < Ext.X || Ext.Z < Ext.Y)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: mesh not upright (extent X=%.1f Y=%.1f Z=%.1f); abort to dialog."), Ext.X, Ext.Y, Ext.Z);
		return false;
	}
	const double Height = Ext.Z;
	const double SoleZ = BMin.Z;
	// Head top via the 99th-percentile Z (rejects thin hair/horn/hat spikes that the raw max would catch).
	double HeadTopZ = BMax.Z;
	{
		TArray<double> Zs; Zs.Reserve(V.Num());
		for (const FVector& p : V) { Zs.Add(p.Z); }
		Zs.Sort();
		HeadTopZ = Zs[FMath::Clamp((int32)(Zs.Num() * 0.99), 0, Zs.Num() - 1)];
	}
	const double FitHeight = FMath::Max(HeadTopZ - SoleZ, (double)KINDA_SMALL_NUMBER);

	// Lateral axis = the wider horizontal axis across the upper body (shoulders are the widest horizontal
	// span for both T- and A-pose); depth axis = the other. lat/dep are 0(X) or 1(Y).
	const int32 LatAxis = (Ext.X >= Ext.Y) ? 0 : 1;
	const int32 DepAxis = (LatAxis == 0) ? 1 : 0;
	auto Comp = [](const FVector& p, int32 ax) -> double { return (ax == 0) ? p.X : p.Y; };

	// Lateral symmetry plane = median lateral coord of the LOWER half (legs are reliably bilateral).
	double LatCenter = 0.0, DepCenter = 0.0;
	{
		TArray<double> Lat, Dep;
		for (const FVector& p : V)
		{
			Dep.Add(Comp(p, DepAxis));
			if (p.Z < SoleZ + 0.5 * Height) { Lat.Add(Comp(p, LatAxis)); }
		}
		if (Lat.Num() == 0) { for (const FVector& p : V) { Lat.Add(Comp(p, LatAxis)); } }
		Lat.Sort(); Dep.Sort();
		LatCenter = Lat[Lat.Num() / 2];
		DepCenter = Dep[Dep.Num() / 2];
	}

	// Mesh half-extents for the lateral/depth scale (use shoulder-band lateral width, torso depth).
	double MeshLatHalf = 0.0, MeshDepHalf = 0.0;
	{
		const double ShZ = SoleZ + 0.82 * FitHeight; // ~Manny shoulder height fraction
		double latMax = 0.0, depMax = 0.0;
		for (const FVector& p : V)
		{
			depMax = FMath::Max(depMax, FMath::Abs(Comp(p, DepAxis) - DepCenter));
			if (FMath::Abs(p.Z - ShZ) < 0.08 * FitHeight)
			{
				latMax = FMath::Max(latMax, FMath::Abs(Comp(p, LatAxis) - LatCenter));
			}
		}
		MeshLatHalf = (latMax > KINDA_SMALL_NUMBER) ? latMax : 0.25 * FitHeight;
		MeshDepHalf = (depMax > KINDA_SMALL_NUMBER) ? depMax : 0.12 * FitHeight;
	}

	// --- 3b/3c/3d. SOURCE-DRIVEN FIT (replaces the Manny-A-pose-fraction positioner that fanned). -------
	// The just-imported mesh STILL carries its SOURCE skeleton, whose component-space joint positions already
	// match the mesh in WHATEVER pose it was authored (T or A). Those positions ARE the authority. Map each
	// Manny bone to a source joint BY NAME (Manny->VRM via UniGLBUtil::table_ue4_vrm, VRM->source via the meta's
	// humanoidBoneTable - the exact inverse of renameToUE4Bone) and copy the source location * PreScale. Manny-
	// only bones (twists, ik_*, gaps) are DERIVED from already-placed neighbours, NEVER from a Manny fraction,
	// so no bone is ever far from its parent => NO fan. When the source IS Manny the source joints equal Manny's
	// own A-pose joints => identity fit (zero-config preserved).
	(void)MeshLatHalf; // (former fraction-fit input; positions now come from the source skeleton)

	const FReferenceSkeleton& SrcRef = SrcMesh->GetRefSkeleton();
	if (SrcRef.GetRawBoneNum() < 10)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: source skeleton has %d bone(s) (<10); cannot source-drive the fit; abort to dialog."), SrcRef.GetRawBoneNum());
		return false;
	}
	TArray<FTransform> SrcWorld; ComputeWorld(SrcRef, SrcWorld);

	UUniGLBMetaObject* Meta = uniGLBAssetList->UniGLBMetaObject;
	if (Meta == nullptr || Meta->humanoidBoneTable.Num() == 0)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: humanoid bone table empty (unrecognized source convention); abort to dialog."));
		return false;
	}

	// Manny bone name -> source bone index (inverse of renameToUE4Bone: Manny->VRM then VRM->source).
	auto MannyNameToSrcIdx = [&](const FString& MannyName) -> int32 {
		FString UniGLB;
		for (const UniGLBUtil::UniGLBBoneTable& T : UniGLBUtil::table_ue4_vrm)
		{ if (T.BoneUE4.Equals(MannyName, ESearchCase::IgnoreCase)) { UniGLB = T.BoneVRM; break; } }
		if (UniGLB.IsEmpty()) { return INDEX_NONE; }
		const FString* SrcName = Meta->humanoidBoneTable.Find(UniGLB);
		if (SrcName == nullptr) { return INDEX_NONE; }
		return SrcRef.FindBoneIndex(FName(**SrcName));
	};

	// Manny topology helpers: children list, twist/ik classification, primary (limb-continuation) child.
	TArray<TArray<int32>> Children; Children.SetNum(NumBones);
	for (int32 i = 0; i < NumBones; ++i)
	{ const int32 P = MannyRef.GetRawParentIndex(i); if (P != INDEX_NONE) { Children[P].Add(i); } }
	auto IsTwist = [&](int32 i) -> bool { return MannyRef.GetBoneName(i).ToString().Contains(TEXT("twist")); };
	auto IsIK    = [&](int32 i) -> bool { return MannyRef.GetBoneName(i).ToString().StartsWith(TEXT("ik_")); };
	auto PrimaryChild = [&](int32 i) -> int32 {
		int32 fb = INDEX_NONE;
		for (int32 c : Children[i]) { if (fb == INDEX_NONE) { fb = c; } if (!IsTwist(c) && !IsIK(c)) { return c; } }
		return fb;
	};

	// (1) Place every Manny bone that has a mapped source joint (= the mesh's real pose, no fan).
	TArray<FVector> Fit; Fit.SetNum(NumBones);
	TBitArray<> bSet(false, NumBones);
	int32 nMapped = 0;
	for (int32 i = 0; i < NumBones; ++i)
	{
		const int32 s = MannyNameToSrcIdx(MannyRef.GetBoneName(i).ToString());
		if (s != INDEX_NONE) { Fit[i] = SrcWorld[s].GetLocation() * PreScale; bSet[i] = true; ++nMapped; }
	}
	if (nMapped < 12)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: only %d Manny bones mapped from source (<12 core); abort to dialog."), nMapped);
		return false;
	}

	// (2) Derive unmapped Manny-only bones (twists, ik_*, gaps) from PLACED neighbours. Several passes so a gap
	//     whose anchors are themselves derived still resolves. Each lands adjacent to its anchor => no long bone.
	auto MannyRatioAlong = [&](int32 i, int32 a, int32 b) -> double {
		const FVector A = MannyWorld[a].GetLocation(), B = MannyWorld[b].GetLocation(), Pp = MannyWorld[i].GetLocation();
		const double den = (double)FVector::DistSquared(B, A);
		if (den < (double)KINDA_SMALL_NUMBER) { return 0.5; }
		return FMath::Clamp((double)FVector::DotProduct(Pp - A, B - A) / den, 0.0, 1.0);
	};
	for (int32 pass = 0; pass < 4; ++pass)
	{
		for (int32 i = 0; i < NumBones; ++i)
		{
			if (bSet[i]) { continue; }
			const FString Nm = MannyRef.GetBoneName(i).ToString();
			if (IsIK(i))
			{
				int32 src = INDEX_NONE;
				if      (Nm.Contains(TEXT("ik_foot_l"))) { src = MIdx(TEXT("foot_l")); }
				else if (Nm.Contains(TEXT("ik_foot_r"))) { src = MIdx(TEXT("foot_r")); }
				else if (Nm.Contains(TEXT("ik_hand_l"))) { src = MIdx(TEXT("hand_l")); }
				else if (Nm.Contains(TEXT("ik_hand_r")) || Nm.Contains(TEXT("ik_hand_gun"))) { src = MIdx(TEXT("hand_r")); }
				else { src = MIdx(TEXT("root")); } // ik_foot_root / ik_hand_root
				if (src != INDEX_NONE && bSet[src]) { Fit[i] = Fit[src]; bSet[i] = true; continue; }
			}
			const int32 P = MannyRef.GetRawParentIndex(i);
			if (P != INDEX_NONE && bSet[P])
			{
				const int32 C = PrimaryChild(P); // limb continuation of the parent
				if (C != INDEX_NONE && C != i && bSet[C])
				{
					Fit[i] = FMath::Lerp(Fit[P], Fit[C], MannyRatioAlong(i, P, C));
					bSet[i] = true; continue;
				}
				// No usable segment: keep Manny's own local offset from the placed parent. Fit[P] is
				// ALREADY in Manny-matching scale (source joints were pre-scaled at fit time, so is
				// every other Fit[] entry derived from it), and MannyWorld's own bone offset is
				// natively Manny-scale too -- so this must NOT be multiplied by PreScale again.
				// (Bug fix: the extra * PreScale here inflated every unmapped bone -- typically whole
				// distal limb chains whose names don't match the humanoid table -- by an extra factor
				// of PreScale, producing the giant shoulder/arm/finger "fan" seen on some characters.)
				Fit[i] = Fit[P] + (MannyWorld[i].GetLocation() - MannyWorld[P].GetLocation());
				bSet[i] = true; continue;
			}
		}
	}
	// (3) Anything still unset (e.g. the synthetic root, no source counterpart): ground it under the pelvis.
	{
		const int32 PelvisIdx = MIdx(TEXT("pelvis"));
		for (int32 i = 0; i < NumBones; ++i)
		{
			if (bSet[i]) { continue; }
			if (PelvisIdx != INDEX_NONE && bSet[PelvisIdx]) { Fit[i] = FVector(Fit[PelvisIdx].X, Fit[PelvisIdx].Y, SoleZ); }
			else { Fit[i] = MannyWorld[i].GetLocation(); } // MannyWorld is already Manny-scale; no PreScale here either.
			bSet[i] = true;
		}
	}

	// --- 3e. FUSED-LEG guard (gown/mermaid): the bottom band must split into two lateral clusters. -------
	{
		int32 nL = 0, nR = 0;
		for (const FVector& p : V)
		{
			if (p.Z > SoleZ + 0.06 * FitHeight) { continue; }
			if (Comp(p, LatAxis) - LatCenter >= 0) { ++nL; } else { ++nR; }
		}
		if (nL < 8 || nR < 8)
		{
			UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: lower body does not split into two legs (L=%d R=%d); abort to dialog."), nL, nR);
			return false;
		}
	}

	// --- 3f. Mesh facing frame, so rest rotations match the mesh (no sideways anims). -------------------
	// Forward = ball-of-foot ahead of pelvis, read from the ALREADY-FITTED source-driven joint positions
	// (Fit[], resolved above) -- the exact same derivation as MannyFrame below, just on the fitted rig
	// instead of Manny's own. This is an UNAMBIGUOUS anatomical signal (toe joint vs pelvis joint), unlike
	// the previous depth-median mesh-vertex split it replaces: that heuristic assumed "the side of the
	// foot band with the higher depth-axis coordinate is the toe", which has NO actual basis -- it is a
	// coin flip per character/export convention, and for roughly half of them yielded a MeshFwd rotated
	// 180 degrees from the true facing, so AlignRot below span the character to face AWAY from the camera
	// instead of towards it. Fall back to the old mesh-vertex heuristic only if ball/pelvis didn't map.
	FVector MeshFwd(0, 0, 0);
	{
		const int32 BallLIdx = MIdx(TEXT("ball_l"));
		const int32 BallRIdx = MIdx(TEXT("ball_r"));
		const int32 FwdPelvisIdx = MIdx(TEXT("pelvis"));
		const bool bBallLSet = (BallLIdx != INDEX_NONE) && bSet[BallLIdx];
		const bool bBallRSet = (BallRIdx != INDEX_NONE) && bSet[BallRIdx];
		const bool bPelvisSet = (FwdPelvisIdx != INDEX_NONE) && bSet[FwdPelvisIdx];
		if ((bBallLSet || bBallRSet) && bPelvisSet)
		{
			FVector Toe = bBallLSet && bBallRSet ? (Fit[BallLIdx] + Fit[BallRIdx]) * 0.5
				: (bBallLSet ? Fit[BallLIdx] : Fit[BallRIdx]);
			MeshFwd = Toe - Fit[FwdPelvisIdx]; MeshFwd.Z = 0;
		}
		if (MeshFwd.Size() < 0.05 * MeshDepHalf || !MeshFwd.Normalize())
		{
			// Fallback: depth-median mesh-vertex split (ambiguous sign, kept only for the rare case
			// where the source skeleton has no foot/pelvis mapping at all).
			TArray<double> footDep;
			for (const FVector& p : V) { if (p.Z <= SoleZ + 0.06 * FitHeight) { footDep.Add(Comp(p, DepAxis)); } }
			if (footDep.Num() >= 4)
			{
				footDep.Sort();
				const double depMed = footDep[footDep.Num() / 2];
				FVector toeC(0, 0, 0), heelC(0, 0, 0); int32 nt = 0, nh = 0;
				for (const FVector& p : V)
				{
					if (p.Z > SoleZ + 0.06 * FitHeight) { continue; }
					if (Comp(p, DepAxis) >= depMed) { toeC += p; ++nt; } else { heelC += p; ++nh; }
				}
				if (nt > 0 && nh > 0) { MeshFwd = (toeC / (double)nt) - (heelC / (double)nh); MeshFwd.Z = 0; }
			}
			if (MeshFwd.Size() < 0.05 * MeshDepHalf || !MeshFwd.Normalize())
			{
				MeshFwd = (DepAxis == 0) ? FVector(1, 0, 0) : FVector(0, 1, 0);
			}
		}
	}
	FFitFrame MeshFrame; MeshFrame.Build(MeshFwd);
	FFitFrame MannyFrame;
	{
		// Manny forward from its own toes vs pelvis (consistent derivation -> proper Qframe, no mirror).
		FVector mToe = (MPos(TEXT("ball_l")) + MPos(TEXT("ball_r"))) * 0.5;
		FVector mFwd = mToe - MPos(TEXT("pelvis")); mFwd.Z = 0;
		if (mFwd.IsNearlyZero()) { mFwd = FVector::ForwardVector; }
		MannyFrame.Build(mFwd);
	}
	// Both forwards are horizontal and up is shared (+Z), so the frame difference is a pure yaw about Z.
	// FindBetweenNormals(MannyFwd -> MeshFwd) gives exactly that yaw (convention-safe; no matrix basis).
	const FQuat Qframe = FQuat::FindBetweenNormals(MannyFrame.Fwd, MeshFrame.Fwd).GetNormalized();

	// --- 3f-align. FACE THE CHARACTER LIKE MANNY (user: "doit etre face a la camera"). The fit placed positions
	//     in the SOURCE facing; rigidly YAW the WHOLE character (skeleton positions + mesh geometry incl.
	//     normals/tangents) about its vertical pelvis axis so its forward matches Manny's OWN measured forward.
	//     A yaw is RIGID -> NO deformation: mesh + skeleton turn together => identical geodesic bind, just
	//     oriented. Fully automatic (no hardcoded per-model offset). Source already Manny-facing => ~identity.
	const FRotator AlignRot = Qframe.Inverse().Rotator(); // the yaw that turns MeshFwd -> MannyFwd
	{
		const int32 PivIdx = MIdx(TEXT("pelvis"));
		const FVector Piv = (PivIdx != INDEX_NONE && bSet[PivIdx]) ? FVector(Fit[PivIdx].X, Fit[PivIdx].Y, 0.0) : FVector::ZeroVector;
		for (int32 i = 0; i < NumBones; ++i) { Fit[i] = Piv + AlignRot.RotateVector(Fit[i] - Piv); }
		MeshTransforms::Rotate(BareMesh, AlignRot, Piv);
		UE_LOG(LogUniGLBLoader, Display, TEXT("AutoRigToManny: facing-aligned to Manny (yaw=%.1f deg about pelvis vertical axis)."), (float)AlignRot.Yaw);
	}

	// --- 3g. Author rest rotations FROM THE FITTED GEOMETRY so each bone points down its own (source-driven)
	//     bone direction => self-consistent rest pose (no rotation-side fan / desaxe). Positions are ALREADY
	//     aligned to Manny's facing (3f-align above), so start from Manny's canonical rotation (correct roll) and
	//     aim-correct its primary axis from the Manny direction onto the ACTUAL fitted direction. Leaf/twist bones
	//     (no usable child) inherit the parent's aim delta. Pure transform - no vertex motion. Stock Manny =>
	//     MannyDir==FitDir => Delta==Identity => stock rig.
	TArray<FQuat> AimDelta; AimDelta.SetNum(NumBones);
	TArray<FTransform> FitWorld; FitWorld.SetNum(NumBones);
	double MaxAimDeg = 0.0, MaxBoneLen = 0.0;
	for (int32 i = 0; i < NumBones; ++i)
	{
		const int32 C = PrimaryChild(i);
		FQuat Delta = FQuat::Identity;
		if (C != INDEX_NONE)
		{
			const FVector MannyDir = (MannyWorld[C].GetLocation() - MannyWorld[i].GetLocation()).GetSafeNormal();
			const FVector FitDir   = (Fit[C] - Fit[i]).GetSafeNormal();
			if (!MannyDir.IsNearlyZero() && !FitDir.IsNearlyZero())
			{ Delta = FQuat::FindBetweenNormals(MannyDir, FitDir).GetNormalized(); }
			MaxBoneLen = FMath::Max(MaxBoneLen, (double)FVector::Dist(Fit[C], Fit[i]));
		}
		else
		{
			const int32 P = MannyRef.GetRawParentIndex(i);
			Delta = (P != INDEX_NONE) ? AimDelta[P] : FQuat::Identity; // leaf inherits parent aim (parents precede children)
		}
		AimDelta[i] = Delta;
		MaxAimDeg = FMath::Max(MaxAimDeg, (double)FMath::RadiansToDegrees(Delta.GetAngle()));
		const FQuat R = (Delta * MannyWorld[i].GetRotation()).GetNormalized();
		FitWorld[i] = FTransform(R, Fit[i], FVector::OneVector);
	}
	UE_LOG(LogUniGLBLoader, Display, TEXT("AutoRigToManny: source-driven fit: %d/%d bones mapped, maxAim=%.1f deg, maxBoneLen=%.1f (stock Manny => maxAim~0, segment-sized bones; a fan would show a huge maxBoneLen)."),
		nMapped, NumBones, (float)MaxAimDeg, (float)MaxBoneLen);
	FReferenceSkeleton FittedRef = MannyRef; // clone topology + names + parenting
	{
		FReferenceSkeletonModifier Mod(FittedRef, MannySkeleton);
		for (int32 i = 0; i < NumBones; ++i)
		{
			const int32 P = MannyRef.GetRawParentIndex(i);
			const FTransform Local = (P == INDEX_NONE) ? FitWorld[i] : FitWorld[i].GetRelativeTransform(FitWorld[P]);
			Mod.UpdateRefPoseTransform(i, Local);
		}
	}

	// 4a. PRE-READ source skin weights + positions. CreateSkeletalMeshAsset (step 6) overwrites
	//     the source mesh in place, destroying its imported model. Capture everything we need
	//     for position-based weight transfer NOW, before it is gone.
	struct FAutoRigSrcVert { FVector3f Pos; int32 Cnt; int32 Bones[MAX_TOTAL_INFLUENCES]; float Wts[MAX_TOTAL_INFLUENCES]; };
	TArray<FAutoRigSrcVert> SrcVerts;
	{
		// Source bone index → fitted Manny bone index.
		TArray<int32> SrcBoneToManny; SrcBoneToManny.SetNum(SrcRef.GetRawBoneNum());
		for (int32 s = 0; s < SrcRef.GetRawBoneNum(); ++s) { SrcBoneToManny[s] = INDEX_NONE; }
		for (int32 m = 0; m < NumBones; ++m)
		{
			const int32 s = MannyNameToSrcIdx(MannyRef.GetBoneName(m).ToString());
			if (s != INDEX_NONE && s < SrcBoneToManny.Num()) { SrcBoneToManny[s] = m; }
		}
		// Unmapped source bones → collapse weight to nearest mapped ancestor.
		for (int32 s = 0; s < SrcRef.GetRawBoneNum(); ++s)
		{
			if (SrcBoneToManny[s] != INDEX_NONE) continue;
			int32 Anc = SrcRef.GetParentIndex(s);
			while (Anc != INDEX_NONE && SrcBoneToManny[Anc] == INDEX_NONE) { Anc = SrcRef.GetParentIndex(Anc); }
			if (Anc != INDEX_NONE) { SrcBoneToManny[s] = SrcBoneToManny[Anc]; }
		}

		// Transform source vertex positions to output space (PreScale + AlignRot about pelvis).
		const int32 WtPivIdx = MIdx(TEXT("pelvis"));
		const FVector WtPiv = (WtPivIdx != INDEX_NONE) ? FVector(Fit[WtPivIdx].X, Fit[WtPivIdx].Y, 0.0) : FVector::ZeroVector;

		FSkeletalMeshModel* SrcModel = SrcMesh->GetImportedModel();
		if (SrcModel && SrcModel->LODModels.Num() > 0)
		{
			int32 TotalSrcVerts = 0;
			for (const FSkelMeshSection& Sec : SrcModel->LODModels[0].Sections) { TotalSrcVerts += Sec.SoftVertices.Num(); }
			SrcVerts.Reserve(TotalSrcVerts);

			for (const FSkelMeshSection& Sec : SrcModel->LODModels[0].Sections)
			{
				for (const FSoftSkinVertex& Sv : Sec.SoftVertices)
				{
					FAutoRigSrcVert Entry;
					FMemory::Memzero(&Entry, sizeof(Entry));

					FVector Pos = FVector(Sv.Position) * PreScale;
					Pos = WtPiv + AlignRot.RotateVector(Pos - WtPiv);
					Entry.Pos = FVector3f(Pos);

					float WtSum = 0.f;
					int32 N = 0;
					for (int32 k = 0; k < MAX_TOTAL_INFLUENCES; ++k)
					{
						const uint8 RawW = Sv.InfluenceWeights[k];
						if (RawW == 0) continue;
						const int32 LB = (int32)Sv.InfluenceBones[k];
						const int32 SB = Sec.BoneMap.IsValidIndex(LB) ? (int32)Sec.BoneMap[LB] : INDEX_NONE;
						if (SB == INDEX_NONE || SB >= SrcBoneToManny.Num()) continue;
						const int32 MB = SrcBoneToManny[SB];
						if (MB == INDEX_NONE) continue;
						const float Wf = (float)RawW / 255.f;
						bool bMerged = false;
						for (int32 j = 0; j < N; ++j)
						{ if (Entry.Bones[j] == MB) { Entry.Wts[j] += Wf; bMerged = true; break; } }
						if (!bMerged && N < MAX_TOTAL_INFLUENCES) { Entry.Bones[N] = MB; Entry.Wts[N] = Wf; ++N; }
						WtSum += Wf;
					}
					Entry.Cnt = N;
					if (WtSum > 0.01f) { for (int32 j = 0; j < N; ++j) { Entry.Wts[j] /= WtSum; } }
					SrcVerts.Add(Entry);
				}
			}
		}
	}
	// X-sorted index for O(n log n) nearest-neighbor lookup.
	TArray<int32> SrcSortX; SrcSortX.SetNum(SrcVerts.Num());
	for (int32 i = 0; i < SrcSortX.Num(); ++i) { SrcSortX[i] = i; }
	SrcSortX.Sort([&](int32 A, int32 B) { return SrcVerts[A].Pos.X < SrcVerts[B].Pos.X; });

	// 4b. Geodesic-voxel skin bind (fallback for vertices without a close source match).
	// Parameters from import options (user-configurable), with auto-heuristic for VoxelResolution.
	int32 EffectiveVoxelRes = UniGLBConverter::Options::Get().GetVoxelResolution();
	if (EffectiveVoxelRes <= 0)
	{
		// Auto: scale with mesh bounding box diagonal. Small chars (bbox<200) -> 128, large (bbox>500) -> 512.
		const double Diag = FVector::Dist(BMin, BMax);
		if (Diag < 200.0) EffectiveVoxelRes = 128;
		else if (Diag < 500.0) EffectiveVoxelRes = 256;
		else EffectiveVoxelRes = 512;
	}
	const int32 EffectiveMaxInfl = FMath::Clamp(UniGLBConverter::Options::Get().GetGeodesicMaxInfluences(), 1, 12);
	const float EffectiveStiffness = FMath::Clamp(UniGLBConverter::Options::Get().GetBindStiffness(), 0.01f, 1.0f);

	FSkinBindingOp Op;
	Op.OriginalMesh = MakeShared<FDynamicMesh3, ESPMode::ThreadSafe>(BareMesh);
	Op.SetTransformHierarchyFromReferenceSkeleton(FittedRef);
	Op.BindType = ESkinBindingType::GeodesicVoxel;
	Op.Stiffness = EffectiveStiffness;
	Op.MaxInfluences = EffectiveMaxInfl;
	Op.VoxelResolution = EffectiveVoxelRes;
	Op.CalculateResult(nullptr);
	TUniquePtr<FDynamicMesh3> Bound = Op.ExtractResult();
	if (!Bound.IsValid() || Bound->VertexCount() != BareMesh.VertexCount())
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: skin bind produced no/mismatched mesh; abort."));
		return false;
	}
	UE_LOG(LogUniGLBLoader, Display, TEXT("AutoRigToManny: geodesic voxel bind (fallback) done (voxel=%d, maxInfl=%d, stiffness=%.2f, srcVerts=%d)."),
		EffectiveVoxelRes, EffectiveMaxInfl, EffectiveStiffness, SrcVerts.Num());

	// 5. Dedicated USkeleton for the auto-rigged character. We do NOT share the engine Manny USkeleton:
	//    sharing leaves retargeting at the mercy of Manny's stock per-bone modes and any finalize call would
	//    mutate the shared engine asset for every other character. Own skeleton == the proven convention path.
	UPackage* OutPkg = SrcMesh->GetOutermost();
	USkeleton* CharSkel = NewObject<USkeleton>(OutPkg, *(SrcMesh->GetName() + TEXT("_AutoRig_Skeleton")), RF_Public | RF_Standalone);

	// Snapshot the source materials BEFORE CreateSkeletalMeshAsset: the engine create path installs a single
	// default (null) material slot, so without restoring these the character imports as a grey blob.
	const auto SavedMaterials = SrcMesh->GetMaterials();

	// 6. Build/overwrite the skeletal mesh IN PLACE: reuse the imported asset's name + package so
	//    CreateSkeletalMeshAsset's existing-asset update branch overwrites it (Res.SkeletalMesh == SrcMesh)
	//    -> no second '_AutoRig' asset, no pointer swap, no orphaned original.
	UE::AssetUtils::FSkeletalMeshAssetOptions AO;
	AO.UsePackage = OutPkg;
	AO.NewAssetPath = SrcMesh->GetName();
	AO.Skeleton = CharSkel;            // own skeleton (empty BoneTree -> built from FittedRef)
	AO.RefSkeleton = &FittedRef;       // source-driven positions, Manny-facing-aligned, geometry-derived rotations
	AO.NumSourceModels = 1;
	AO.SourceMeshes.DynamicMeshes.Add(Bound.Get());

	UE::AssetUtils::FSkeletalMeshResults Res;
	const UE::AssetUtils::ECreateSkeletalMeshResult R = UE::AssetUtils::CreateSkeletalMeshAsset(AO, Res);
	if (R != UE::AssetUtils::ECreateSkeletalMeshResult::Ok || Res.SkeletalMesh == nullptr)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoRigToManny: CreateSkeletalMeshAsset failed (code %d); abort."), (int32)R);
		return false;
	}

	// Restore the source materials (CreateSkeletalMeshAsset left a single null slot). Skin sections still map by
	// material index, so the original material assignment is preserved.
	if (SavedMaterials.Num() > 0)
	{
		Res.SkeletalMesh->GetMaterials() = SavedMaterials;
	}

	// 6b. POSITION-BASED WEIGHT TRANSFER. For each output vertex, find the nearest source
	//     vertex by spatial position and overwrite with the artist's original (remapped) weights.
	//     Geodesic bind (already on the output from step 4b) is kept for orphan vertices that
	//     have no close source match (e.g. vertices generated by mesh-builder splits at edges).
	if (SrcVerts.Num() > 0)
	{
		FSkeletalMeshModel* OutModel = Res.SkeletalMesh->GetImportedModel();
		if (OutModel && OutModel->LODModels.Num() > 0)
		{
			int32 nTransferred = 0, nFallback = 0;
			const float Thresh = 0.5f;
			const float ThreshSq = Thresh * Thresh;
			auto LowerX = [&](float Val) -> int32 {
				int32 Lo = 0, Hi = SrcSortX.Num();
				while (Lo < Hi) { int32 M = (Lo + Hi) / 2; if (SrcVerts[SrcSortX[M]].Pos.X < Val) Lo = M + 1; else Hi = M; }
				return Lo;
			};

			for (FSkelMeshSection& OutSec : OutModel->LODModels[0].Sections)
			{
				TMap<int32, int32> SkelToLocal;
				for (int32 j = 0; j < OutSec.BoneMap.Num(); ++j) { SkelToLocal.Add((int32)OutSec.BoneMap[j], j); }
				auto GetLocal = [&](int32 SkelIdx) -> int32 {
					if (const int32* F = SkelToLocal.Find(SkelIdx)) return *F;
					int32 Loc = OutSec.BoneMap.Num();
					OutSec.BoneMap.Add((FBoneIndexType)SkelIdx);
					SkelToLocal.Add(SkelIdx, Loc);
					return Loc;
				};

				for (FSoftSkinVertex& Ov : OutSec.SoftVertices)
				{
					const float Ox = Ov.Position.X;
					const int32 Start = LowerX(Ox - Thresh);
					float BestSq = ThreshSq;
					int32 BestIdx = INDEX_NONE;
					for (int32 r = Start; r < SrcSortX.Num(); ++r)
					{
						const FAutoRigSrcVert& Sv = SrcVerts[SrcSortX[r]];
						if (Sv.Pos.X > Ox + Thresh) break;
						const float Dx = Ox - Sv.Pos.X;
						const float Dy = Ov.Position.Y - Sv.Pos.Y;
						const float Dz = Ov.Position.Z - Sv.Pos.Z;
						const float Sq = Dx * Dx + Dy * Dy + Dz * Dz;
						if (Sq < BestSq) { BestSq = Sq; BestIdx = SrcSortX[r]; }
					}

					if (BestIdx != INDEX_NONE && SrcVerts[BestIdx].Cnt > 0)
					{
						const FAutoRigSrcVert& Best = SrcVerts[BestIdx];
						FMemory::Memset(Ov.InfluenceWeights, 0, sizeof(Ov.InfluenceWeights));
						FMemory::Memset(Ov.InfluenceBones, 0, sizeof(Ov.InfluenceBones));
						int32 WtTotal = 0;
						for (int32 j = 0; j < Best.Cnt && j < MAX_TOTAL_INFLUENCES; ++j)
						{
							Ov.InfluenceBones[j] = (FBoneIndexType)GetLocal(Best.Bones[j]);
							const int32 Wi = FMath::Clamp(FMath::RoundToInt(Best.Wts[j] * 255.f), 0, 255);
							Ov.InfluenceWeights[j] = (uint8)Wi;
							WtTotal += Wi;
						}
						if (WtTotal > 0 && WtTotal != 255)
						{ Ov.InfluenceWeights[0] = (uint8)FMath::Clamp((int32)Ov.InfluenceWeights[0] + (255 - WtTotal), 1, 255); }
						++nTransferred;
					}
					else { ++nFallback; }
				}
			}
			UE_LOG(LogUniGLBLoader, Display, TEXT("AutoRigToManny: weight transfer: %d artist-skinned, %d geodesic fallback."),
				nTransferred, nFallback);
		}
	}

	// 7. Per-bone translation-retargeting modes on CharSkel. CreateReferenceSkeletonFromMesh builds the
	//    BoneTree with DEFAULT (Animation) nodes, so WITHOUT this every limb would snap to Manny proportions.
	//    Verbatim from the convention path: limbs = Skeleton, root = Animation, pelvis = AnimationScaled,
	//    IK bones = Animation.
	{
		const FReferenceSkeleton& BoneRef = CharSkel->GetReferenceSkeleton();
		for (int32 i = 0; i < BoneRef.GetRawBoneNum(); ++i)
		{
			CharSkel->SetBoneTranslationRetargetingMode(i, EBoneTranslationRetargetingMode::Skeleton);
		}
		const int32 RootIdx = BoneRef.FindBoneIndex(TEXT("root"));
		const int32 PelvisIdx = BoneRef.FindBoneIndex(TEXT("pelvis"));
		if (RootIdx != INDEX_NONE)   { CharSkel->SetBoneTranslationRetargetingMode(RootIdx, EBoneTranslationRetargetingMode::Animation); }
		if (PelvisIdx != INDEX_NONE) { CharSkel->SetBoneTranslationRetargetingMode(PelvisIdx, EBoneTranslationRetargetingMode::AnimationScaled); }
		static const TCHAR* IKBones[] = {
			TEXT("ik_foot_root"), TEXT("ik_foot_l"), TEXT("ik_foot_r"),
			TEXT("ik_hand_root"), TEXT("ik_hand_gun"), TEXT("ik_hand_l"), TEXT("ik_hand_r"),
		};
		for (const TCHAR* B : IKBones)
		{
			const int32 Idx = BoneRef.FindBoneIndex(B);
			if (Idx != INDEX_NONE) { CharSkel->SetBoneTranslationRetargetingMode(Idx, EBoneTranslationRetargetingMode::Animation); }
		}
	}

	// 8. Register every Manny-family skeleton as compatible ON THE CHARACTER skeleton so the whole
	//    Manny/GASP anim library plays (same helper the Native pipeline uses -> identical compat lists).
	//    Direction is load-bearing: the helper only ever mutates the character skeleton, never the shared Manny.
	UniGLB_RegisterCompatibleMannySkeletons(CharSkel, MannySkeleton);

	// 9. Inverse-bind + bounds for the fitted rest pose. The Empty() is the documented Num()-guard fix:
	//    CalculateInvRefMatrices() no-ops if the count already matches, leaving a stale bind that DEFORMS.
	//    Do NOT call RecreateBoneTree here: CreateSkeletalMeshAsset already built CharSkel's BoneTree from
	//    FittedRef, and RecreateBoneTree would REBUILD it -> reset every per-bone retarget mode set in step 7
	//    back to default (Animation) -> limbs snap to Manny proportions. We never mutate the ref pose after
	//    the create, so the tree is already correct.
	Res.SkeletalMesh->GetRefBasesInvMatrix().Empty();
	Res.SkeletalMesh->CalculateInvRefMatrices();
	Res.SkeletalMesh->CalculateExtendedBounds();
	Res.SkeletalMesh->MarkPackageDirty();

	// 10. Point the import at the (in-place overwritten) mesh. Res.SkeletalMesh == SrcMesh here, so this is
	//     an identity assignment, kept for clarity.
	uniGLBAssetList->SkeletalMesh = Res.SkeletalMesh;

	// 11. Clear the ABP_Post_ post-process AnimBlueprint (VRM spring bones). The source skeleton this
	//     ABP was compiled against no longer exists (replaced by CharSkel). Recompiling it risks spring
	//     bone nodes referencing pruned bones → visible deformation in the viewport even without animation.
	//     Matches the Native path (SetPostProcessAnimBlueprint(nullptr)). If a user needs spring bones,
	//     they can re-assign a compatible ABP manually after import.
	Res.SkeletalMesh->SetPostProcessAnimBlueprint(nullptr);

	UE_LOG(LogUniGLBLoader, Display, TEXT("AutoRigToManny: fitted Manny onto '%s' (H=%.1f lat=%.1f dep=%.1f), own skeleton + Manny-compatible."),
		*SrcMesh->GetName(), FitHeight, MeshLatHalf, MeshDepHalf);
	return true;
#else
	return false;
#endif
}
