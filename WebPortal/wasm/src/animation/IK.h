#pragma once
#include "core/Types.h"
#include "core/Math.h"
#include "animation/Skeleton.h"
#include <vector>
#include <functional>

namespace nv
{
    // ═══════════════════════════════════════════════════════════
    // TWO-BONE IK — solveur analytique (bras, jambes)
    // ═══════════════════════════════════════════════════════════

    struct TwoBoneIKInput
    {
        glm::vec3 rootPos;      // Position globale de l'os racine
        glm::vec3 midPos;       // Position globale de l'os milieu
        glm::vec3 effectorPos;  // Position globale de l'effecteur
        glm::vec3 targetPos;    // Position cible (world space)
        glm::vec3 poleVec;      // Direction du pôle (contrôle de la direction du coude/genou)

        f32 upperLength = 0.0f; // Longueur de root → mid (calculée si <= 0)
        f32 lowerLength = 0.0f; // Longueur de mid → effector (calculée si <= 0)

        bool enableStretching = false;
        f32 maxStretch = 1.15f;  // Ratio max d'étirement
    };

    struct TwoBoneIKResult
    {
        glm::quat rootRotation{1, 0, 0, 0};  // Rotation à appliquer à l'os root
        glm::quat midRotation{1, 0, 0, 0};   // Rotation à appliquer à l'os mid
        bool reached = true;
        f32 effectorDistToTarget = 0.0f;
    };

    TwoBoneIKResult SolveTwoBoneIK(const TwoBoneIKInput& input);

    // ═══════════════════════════════════════════════════════════
    // FABRIK — Forward And Backward Reaching IK (chaînes > 2)
    // ═══════════════════════════════════════════════════════════

    struct FABRIKInput
    {
        std::vector<glm::vec3> jointPositions;  // [0]=root, [N-1]=effector
        glm::vec3 targetPos;

        u32 maxIterations = 20;
        f32 tolerance = 0.01f;     // Distance cible → effecteur pour convergence
        f32 chainLength = 0.0f;    // Longueur totale (calculée si <= 0)

        bool constrainToChainLength = true;
        bool enableRootCorrection = true; // Corrige la position root après FABRIK
    };

    struct FABRIKResult
    {
        std::vector<glm::vec3> jointPositions;  // Positions mises à jour
        bool reached = false;
        u32 iterationsUsed = 0;
        f32 finalError = 0.0f;
    };

    FABRIKResult SolveFABRIK(const FABRIKInput& input);

    // ═══════════════════════════════════════════════════════════
    // LOOK-AT — Rotation d'une chaîne d'os vers une cible
    // ═══════════════════════════════════════════════════════════

    struct LookAtInput
    {
        glm::vec3 bonePos;       // Position de l'os à orienter
        glm::vec3 targetPos;     // Cible (world space)
        glm::vec3 forwardAxis;   // Axe avant local de l'os (dans l'espace parent)
        glm::vec3 upAxis;        // Axe haut local (défaut: Y)

        f32 weight = 1.0f;       // Mélange avec la rotation d'origine (0..1)
        f32 maxAngle = 180.0f;   // Angle max en degrés
    };

    struct LookAtResult
    {
        glm::quat rotation{1, 0, 0, 0};
    };

    LookAtResult SolveLookAt(const LookAtInput& input, const glm::quat& currentRotation);

    // ═══════════════════════════════════════════════════════════
    // CHAIN LOOK-AT — Plusieurs os qui regardent une cible
    // (cou + tête répartis)
    // ═══════════════════════════════════════════════════════════

    struct ChainLookAtInput
    {
        std::vector<glm::vec3> bonePositions;  // Positions globales des os (de la base vers l'extrémité)
        std::vector<glm::quat> boneRotations;  // Rotations globales actuelles
        glm::vec3 targetPos;
        glm::vec3 forwardAxis{0, 0, -1};       // Axe avant (défaut: -Z dans l'espace global)
        glm::vec3 upAxis{0, 1, 0};

        std::vector<f32> weights;              // Poids par os (1.0 = rotation complète, 0.0 = aucune)
        // Si vide, tous les os utilisent un poids 1.0 / N
    };

    struct ChainLookAtResult
    {
        std::vector<glm::quat> boneRotations;
    };

    ChainLookAtResult SolveChainLookAt(const ChainLookAtInput& input);

    // ═══════════════════════════════════════════════════════════
    // FOOT LOCK — Maintien des pieds au sol pendant la locomotion
    // ═══════════════════════════════════════════════════════════

    enum class FootPhase : u8
    {
        Planted = 0,   // Pied en contact avec le sol
        Transition,    // Transition entrante/sortante
        Free           // Pied en l'air (swing)
    };

    struct FootLockBone
    {
        u32 boneIndex = 0;          // Index de l'os du pied
        u32 parentIndex = 0;        // Index de l'os parent (cheville/mollet)
        u32 ikChainRoot = 0;        // Index de l'os racine de la chaîne IK (cuisse)
        glm::vec3 boneLengthAxis{0, 1, 0};  // Axe de longueur du pied

        // État
        FootPhase phase = FootPhase::Free;
        f32 phaseTime = 0.0f;               // Temps dans la phase actuelle
        glm::vec3 lockedPosition{0, 0, 0};  // Position verrouillée du pied en world space
        glm::quat lockedRotation{1, 0, 0, 0}; // Rotation verrouillée
        f32 lockBlend = 0.0f;               // Poids de blend actuel
    };

    struct FootLockInput
    {
        std::vector<FootLockBone> bones;     // Os à verrouiller (généralement leftFoot et rightFoot)
        std::vector<glm::vec3> jointPositionsWorld; // Positions globales des os du squelette
        std::vector<glm::quat> jointRotationsWorld; // Rotations globales des os du squelette
        f32 dt = 0.0f;
        bool forcePlant = false;             // Forcer le plant (pour test)
    };

    struct FootLockResult
    {
        std::vector<FootLockBone> updatedBones;
        // Les positions/rotations verrouillées sont stockées dans updatedBones
    };

    // Détection du plant : basée sur la vélocité verticale du pied et la hauteur
    struct FootPlantDetectInput
    {
        glm::vec3 footPos;          // Position actuelle du pied
        glm::vec3 footPrevPos;      // Position précédente du pied
        glm::vec3 anklePos;         // Position de la cheville
        f32 footHeightThreshold;    // Hauteur maximale pour considérer le pied planté
        f32 footSpeedThreshold;     // Vitesse verticale maximale pour le plant
        bool previousPlanted;       // État planté précédent
        f32 dt;                     // Delta time
    };

    // 0.0 = free, 1.0 = planted
    f32 DetectFootPlant(const FootPlantDetectInput& input);

    // Applique le FootLock à une pose
    void ApplyFootLock(FootLockResult& result,
                       std::vector<JointPose>& outPoses,
                       const Skeleton& skeleton,
                       const std::vector<glm::vec3>& jointPositionsWorld);

    // Solveur FootLock complet : détection plant → verrouillage → blending
    FootLockResult SolveFootLock(const FootLockInput& input);

    // ═══════════════════════════════════════════════════════════
    // UTILITAIRES IK
    // ═══════════════════════════════════════════════════════════

    // Calcule les positions globales des os à partir des poses locales
    void CalculateJointWorldPositions(
        const Skeleton& skeleton,
        const std::vector<JointPose>& poses,
        std::vector<glm::vec3>& outPositions,
        std::vector<glm::quat>& outRotations);

    // Convertit des rotations locales en rotations globales
    void LocalToGlobalRotations(
        const Skeleton& skeleton,
        const std::vector<JointPose>& poses,
        std::vector<glm::quat>& outGlobalRots);

    // Applique des rotations locales à des poses depuis des rotations globales
    void ApplyGlobalRotations(
        Skeleton& skeleton,
        std::vector<JointPose>& poses,
        const std::vector<glm::quat>& globalRotations);

    // Applique une rotation à un os et met à jour le transform local
    void SetBoneLocalRotation(
        Skeleton& skeleton,
        std::vector<JointPose>& poses,
        u32 boneIndex,
        const glm::quat& newLocalRotation);

    // ═══════════════════════════════════════════════════════════
    // BENCHMARK
    // ═══════════════════════════════════════════════════════════

    struct IKBenchmarkResult
    {
        double twoBoneIK_us = 0.0;
        double fabrik_us = 0.0;
        double lookAt_us = 0.0;
        double chainLookAt_us = 0.0;
        double footLock_us = 0.0;
        u32 bonesProcessed = 0;
        u32 iterations = 0;
    };

    // Exécute un benchmark de tous les solveurs IK avec des données synthétiques
    IKBenchmarkResult RunIKBenchmark(u32 chainLength, u32 iterations);

} // namespace nv
