#include "animation/IK.h"
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtx/vector_angle.hpp>
#include <glm/gtx/quaternion.hpp>
#include <cmath>
#include <algorithm>
#include <chrono>

namespace nv
{
    // ═══════════════════════════════════════════════════════════════
    // TWO-BONE IK
    // ═══════════════════════════════════════════════════════════════

    TwoBoneIKResult SolveTwoBoneIK(const TwoBoneIKInput& input)
    {
        TwoBoneIKResult result;

        glm::vec3 root = input.rootPos;
        glm::vec3 mid = input.midPos;
        glm::vec3 effector = input.effectorPos;
        glm::vec3 target = input.targetPos;
        glm::vec3 pole = glm::normalize(input.poleVec);

        // Calcule les longueurs des segments
        f32 upperLen = input.upperLength > 0.0f
            ? input.upperLength
            : glm::distance(root, mid);
        f32 lowerLen = input.lowerLength > 0.0f
            ? input.lowerLength
            : glm::distance(mid, effector);

        f32 chainLen = upperLen + lowerLen;
        f32 targetDist = glm::distance(root, target);

        // Si la cible est trop loin, on s'aligne dessus (étirement)
        if (targetDist >= chainLen)
        {
            result.reached = false;
            targetDist = chainLen * (input.enableStretching ? input.maxStretch : 0.999f);
        }

        // Si la cible est trop proche (en dessous du root), on s'aligne verticalement
        if (targetDist < glm::abs(upperLen - lowerLen) + 0.001f)
        {
            targetDist = glm::abs(upperLen - lowerLen) + 0.001f;
        }

        // === Loi des cosinus pour l'angle du milieu ===
        f32 cosAngleMid = (upperLen * upperLen + targetDist * targetDist - lowerLen * lowerLen)
                          / (2.0f * upperLen * targetDist);
        cosAngleMid = glm::clamp(cosAngleMid, -1.0f, 1.0f);
        f32 angleMid = acosf(cosAngleMid);

        // Vecteurs normalisés dans le plan du triangle
        glm::vec3 dirRootTarget = glm::normalize(target - root);
        glm::vec3 dirRootMid = glm::normalize(mid - root);

        // Normale du plan du triangle (root → mid → effector)
        glm::vec3 triNormal = glm::normalize(glm::cross(dirRootMid, glm::normalize(effector - mid)));
        if (glm::length(triNormal) < 0.001f)
        {
            // Chaîne droite : utiliser le pole vector comme normale de référence
            triNormal = glm::normalize(glm::cross(dirRootTarget, pole));
            if (glm::length(triNormal) < 0.001f)
            {
                // Fallback si le pole est parallèle au target
                triNormal = glm::vec3(0, 1, 0);
            }
        }

        // Rotation pour amener le vecteur root→mid vers root→target avec l'angle du milieu
        glm::quat rootRot = glm::angleAxis(angleMid, triNormal);

        // La rotation root place mid sur l'arc du triangle. On calcule la nouvelle position de mid.
        glm::vec3 newMid = root + glm::rotate(rootRot, mid - root);

        // Deuxième loi des cosinus pour l'angle du coude
        f32 cosAngleElbow = (upperLen * upperLen + lowerLen * lowerLen - targetDist * targetDist)
                            / (2.0f * upperLen * lowerLen);
        cosAngleElbow = glm::clamp(cosAngleElbow, -1.0f, 1.0f);
        f32 angleElbow = acosf(cosAngleElbow);

        // Calcul de l'axe de rotation du coude (perpendiculaire au plan du triangle)
        glm::vec3 elbowAxis = glm::normalize(glm::cross(newMid - root, target - newMid));
        if (glm::length(elbowAxis) < 0.001f)
            elbowAxis = triNormal;

        // Rotation du milieu pour plier le coude/genou
        glm::quat midRot = glm::angleAxis(angleElbow - glm::pi<f32>(), elbowAxis);

        // Contrôle du pôle : on projette sur le plan défini par root→target et le pole vector
        // pour éviter le flip du coude
        glm::vec3 poleProj = glm::normalize(glm::cross(
            glm::cross(dirRootTarget, pole),
            dirRootTarget
        ));
        if (glm::length(poleProj) > 0.001f)
        {
            // Rotation supplémentaire autour de l'axe root→target pour aligner le coude sur le pôle
            glm::vec3 currentElbow = glm::normalize(newMid - root);
            glm::vec3 desiredElbow = poleProj;

            f32 poleAngle = glm::orientedAngle(
                glm::normalize(glm::cross(currentElbow, dirRootTarget)),
                glm::normalize(glm::cross(desiredElbow, dirRootTarget)),
                dirRootTarget
            );
            glm::quat poleRot = glm::angleAxis(poleAngle, dirRootTarget);
            rootRot = poleRot * rootRot;
        }

        result.rootRotation = rootRot;
        result.midRotation = midRot;

        // Vérifie la distance finale
        glm::vec3 finalEffector = root + glm::rotate(rootRot, newMid - root)
                                         + glm::rotate(rootRot * midRot, effector - mid);
        result.effectorDistToTarget = glm::distance(finalEffector, target);

        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    // FABRIK
    // ═══════════════════════════════════════════════════════════════

    FABRIKResult SolveFABRIK(const FABRIKInput& input)
    {
        FABRIKResult result;
        result.jointPositions = input.jointPositions;
        u32 n = (u32)result.jointPositions.size();
        if (n < 2)
        {
            result.reached = (n == 1) && glm::distance(result.jointPositions[0], input.targetPos) < input.tolerance;
            return result;
        }

        // Calcule la longueur totale de la chaîne si nécessaire
        f32 totalChainLen = input.chainLength;
        if (totalChainLen <= 0.0f)
        {
            totalChainLen = 0.0f;
            for (u32 i = 0; i < n - 1; ++i)
                totalChainLen += glm::distance(result.jointPositions[i], result.jointPositions[i + 1]);
        }

        u32 rootIdx = 0;
        u32 effectorIdx = n - 1;
        glm::vec3 originalRootPos = result.jointPositions[rootIdx];

        f32 targetDist = glm::distance(result.jointPositions[rootIdx], input.targetPos);

        // Si la cible est hors de portée, aligner toute la chaîne
        if (targetDist > totalChainLen && input.constrainToChainLength)
        {
            glm::vec3 dir = glm::normalize(input.targetPos - result.jointPositions[rootIdx]);
            for (u32 i = 1; i < n; ++i)
            {
                f32 segLen = glm::distance(result.jointPositions[i - 1], result.jointPositions[i]);
                result.jointPositions[i] = result.jointPositions[i - 1] + dir * segLen;
            }
            result.reached = false;
            result.iterationsUsed = 1;
            result.finalError = glm::distance(result.jointPositions[effectorIdx], input.targetPos);
            return result;
        }

        // Itérations FABRIK
        u32 iter = 0;
        for (; iter < input.maxIterations; ++iter)
        {
            // ── BACKWARD PASS (effector → root) ──
            // Place l'effecteur sur la cible
            result.jointPositions[effectorIdx] = input.targetPos;
            for (i32 i = (i32)effectorIdx - 1; i >= (i32)rootIdx; --i)
            {
                f32 segLen = glm::distance(result.jointPositions[i], result.jointPositions[i + 1]);
                if (segLen < 0.0001f) continue;
                glm::vec3 dir = glm::normalize(result.jointPositions[i] - result.jointPositions[i + 1]);
                result.jointPositions[i] = result.jointPositions[i + 1] + dir * segLen;
            }

            // ── FORWARD PASS (root → effector) ──
            if (input.enableRootCorrection)
                result.jointPositions[rootIdx] = originalRootPos;
            for (u32 i = rootIdx + 1; i < n; ++i)
            {
                f32 segLen = glm::distance(result.jointPositions[i - 1], result.jointPositions[i]);
                if (segLen < 0.0001f) continue;
                glm::vec3 dir = glm::normalize(result.jointPositions[i] - result.jointPositions[i - 1]);
                result.jointPositions[i] = result.jointPositions[i - 1] + dir * segLen;
            }

            // Vérifie la convergence
            result.finalError = glm::distance(result.jointPositions[effectorIdx], input.targetPos);
            if (result.finalError < input.tolerance)
            {
                result.reached = true;
                break;
            }
        }

        result.iterationsUsed = iter + 1;
        result.finalError = glm::distance(result.jointPositions[effectorIdx], input.targetPos);
        if (result.finalError < input.tolerance)
            result.reached = true;

        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    // LOOK-AT
    // ═══════════════════════════════════════════════════════════════

    LookAtResult SolveLookAt(const LookAtInput& input, const glm::quat& currentRotation)
    {
        LookAtResult result;

        glm::vec3 toTarget = input.targetPos - input.bonePos;
        f32 dist = glm::length(toTarget);
        if (dist < 0.0001f)
        {
            result.rotation = currentRotation;
            return result;
        }

        glm::vec3 targetDir = toTarget / dist;

        // Axe avant dans l'espace global après rotation courante
        glm::vec3 currentForward = glm::rotate(currentRotation, input.forwardAxis);
        glm::vec3 currentUp = glm::rotate(currentRotation, input.upAxis);

        // Angle entre l'axe avant actuel et la cible
        f32 angle = glm::angle(currentForward, targetDir);
        f32 maxAngleRad = glm::radians(input.maxAngle);

        if (angle < 0.001f)
        {
            result.rotation = currentRotation;
            return result;
        }

        // Limite l'angle si nécessaire
        if (input.maxAngle < 180.0f && angle > maxAngleRad)
        {
            // Interpolation partielle vers la cible
            f32 t = maxAngleRad / angle;
            targetDir = glm::slerp(currentForward, targetDir, t);
        }

        // Calcule la rotation pour aligner forward sur targetDir, avec up comme repère
        glm::quat deltaRot = glm::rotation(currentForward, targetDir);

        // Mélange avec le poids
        if (input.weight < 1.0f)
        {
            deltaRot = glm::slerp(glm::quat(1, 0, 0, 0), deltaRot, input.weight);
        }

        result.rotation = deltaRot * currentRotation;

        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    // CHAIN LOOK-AT
    // ═══════════════════════════════════════════════════════════════

    ChainLookAtResult SolveChainLookAt(const ChainLookAtInput& input)
    {
        ChainLookAtResult result;
        u32 n = (u32)input.bonePositions.size();
        result.boneRotations.resize(n);

        if (n == 0) return result;

        // Initialise les rotations
        for (u32 i = 0; i < n; ++i)
            result.boneRotations[i] = i < input.boneRotations.size() ? input.boneRotations[i] : glm::quat(1, 0, 0, 0);

        if (n == 1)
        {
            // Un seul os : LookAt simple
            LookAtInput laInput;
            laInput.bonePos = input.bonePositions[0];
            laInput.targetPos = input.targetPos;
            laInput.forwardAxis = input.forwardAxis;
            laInput.upAxis = input.upAxis;
            laInput.weight = input.weights.empty() ? 1.0f : input.weights[0];
            laInput.maxAngle = 180.0f;

            LookAtResult laResult = SolveLookAt(laInput, result.boneRotations[0]);
            result.boneRotations[0] = laResult.rotation;
            return result;
        }

        // Distribue la rotation sur tous les os de la chaîne
        // Les os de base tournent moins que les os distaux
        glm::vec3 basePos = input.bonePositions[0];
        glm::vec3 tipPos = input.bonePositions[n - 1];
        glm::vec3 baseToTarget = input.targetPos - basePos;
        glm::vec3 baseToTip = tipPos - basePos;

        f32 totalDist = glm::length(baseToTip);
        if (totalDist < 0.0001f) return result;

        glm::vec3 currentDir = baseToTip / totalDist;
        glm::vec3 targetDir = glm::normalize(baseToTarget);

        f32 totalAngle = glm::angle(currentDir, targetDir);
        if (totalAngle < 0.001f) return result;

        // Limite l'angle max par os (cou: 45°, tête: 60°)
        f32 maxAnglePerBone = glm::radians(45.0f);
        f32 clampedAngle = glm::min(totalAngle, maxAnglePerBone * (f32)n);

        // Distribue la rotation proportionnellement
        for (u32 i = 0; i < n; ++i)
        {
            f32 weight = 1.0f;
            if (!input.weights.empty() && i < (u32)input.weights.size())
                weight = input.weights[i];
            else
                weight = (f32)(i + 1) / (f32)n;  // Les os distaux tournent plus

            f32 boneAngle = clampedAngle * weight / (f32)n;
            if (boneAngle < 0.001f) continue;

            glm::vec3 axis = glm::normalize(glm::cross(currentDir, targetDir));
            if (glm::length(axis) < 0.001f)
                axis = input.upAxis;

            glm::quat boneRot = glm::angleAxis(boneAngle, axis);
            result.boneRotations[i] = boneRot * result.boneRotations[i];
        }

        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    // FOOT LOCK
    // ═══════════════════════════════════════════════════════════════

    f32 DetectFootPlant(const FootPlantDetectInput& input)
    {
        // Vélocité verticale du pied
        f32 vertVelocity = (input.footPos.y - input.footPrevPos.y) / glm::max(input.dt, 0.0001f);

        // Hauteur du pied par rapport à la cheville
        f32 footHeightRel = input.footPos.y - input.anklePos.y;

        // Critères de plant
        bool belowHeight = footHeightRel < input.footHeightThreshold;
        bool lowVelocity = glm::abs(vertVelocity) < input.footSpeedThreshold;
        bool lowAbsHeight = footHeightRel < 0.1f;  // Près du sol

        // Transition fluide
        f32 plantFactor = 0.0f;

        if (lowAbsHeight)
        {
            // Pied près du sol : combinaison hauteur + vélocité
            f32 h = glm::clamp(1.0f - footHeightRel / input.footHeightThreshold, 0.0f, 1.0f);
            f32 v = glm::clamp(1.0f - glm::abs(vertVelocity) / input.footSpeedThreshold, 0.0f, 1.0f);
            plantFactor = h * v;
        }

        // Hystérésis : rester planté si on l'était déjà
        if (input.previousPlanted)
            plantFactor = glm::max(plantFactor, 0.5f);

        return glm::clamp(plantFactor, 0.0f, 1.0f);
    }

    FootLockResult SolveFootLock(const FootLockInput& input)
    {
        FootLockResult result;
        result.updatedBones = input.bones;

        for (auto& bone : result.updatedBones)
        {
            // Récupère les positions
            glm::vec3 footPos = input.jointPositionsWorld[bone.boneIndex];
            glm::vec3 anklePos = input.jointPositionsWorld[bone.parentIndex];
            glm::vec3 prevFootPos = footPos;
            glm::vec3 prevAnklePos = anklePos;

            // Détection du plant
            FootPlantDetectInput detectIn;
            detectIn.footPos = footPos;
            detectIn.footPrevPos = footPos;  // Simplification
            detectIn.anklePos = anklePos;
            detectIn.footHeightThreshold = 0.15f;
            detectIn.footSpeedThreshold = 2.0f;
            detectIn.previousPlanted = (bone.phase == FootPhase::Planted);
            detectIn.dt = input.dt;

            f32 plantFactor = DetectFootPlant(detectIn);

            // Transition de phase
            switch (bone.phase)
            {
            case FootPhase::Free:
                if (plantFactor > 0.7f)
                {
                    // Transition vers planté
                    bone.phase = FootPhase::Transition;
                    bone.phaseTime = 0.0f;
                    bone.lockedPosition = footPos;
                    bone.lockedRotation = input.jointRotationsWorld[bone.boneIndex];
                }
                break;

            case FootPhase::Transition:
                bone.phaseTime += input.dt;
                if (bone.phaseTime > 0.1f)
                {
                    bone.phase = FootPhase::Planted;
                    bone.lockBlend = 1.0f;
                }
                break;

            case FootPhase::Planted:
                if (plantFactor < 0.3f)
                {
                    // Transition vers libre
                    bone.phase = FootPhase::Transition;
                    bone.phaseTime = 0.0f;
                }
                else
                {
                    // Maintient la position verrouillée
                    bone.lockBlend = 1.0f;
                }
                break;
            }

            // Calcule le blend
            if (bone.phase == FootPhase::Free)
            {
                bone.lockBlend = glm::max(0.0f, bone.lockBlend - input.dt * 5.0f);
            }
            else if (bone.phase == FootPhase::Planted)
            {
                bone.lockBlend = glm::min(1.0f, bone.lockBlend + input.dt * 10.0f);
            }
        }

        return result;
    }

    void ApplyFootLock(FootLockResult& result,
                       std::vector<JointPose>& outPoses,
                       const Skeleton& skeleton,
                       const std::vector<glm::vec3>& jointPositionsWorld)
    {
        NV_UNUSED(skeleton);

        for (auto& bone : result.updatedBones)
        {
            if (bone.lockBlend < 0.01f) continue;

            // Applique la rotation verrouillée au pied
            // On mélange entre la rotation animée et la rotation verrouillée
            glm::quat animRot = outPoses[bone.boneIndex].rotation;
            glm::quat lockedRot = bone.lockedRotation;

            // Slerp entre les deux
            outPoses[bone.boneIndex].rotation = glm::slerp(animRot, lockedRot, bone.lockBlend);

            // Correction de position : verrouille la position world-space
            // En pratique, on ajuste le root de la chaîne IK (cuisse) pour
            // que le pied reste à sa position verrouillée
            if (bone.phase == FootPhase::Planted && bone.lockBlend > 0.9f)
            {
                glm::vec3 currentFootPos = jointPositionsWorld[bone.boneIndex];
                glm::vec3 offset = bone.lockedPosition - currentFootPos;

                // Répartit l'offset sur la chaîne IK (root, mid, effector)
                outPoses[bone.ikChainRoot].translation += offset * 0.5f;
                outPoses[bone.parentIndex].translation += offset * 0.3f;
                outPoses[bone.boneIndex].translation += offset * 0.2f;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILITAIRES
    // ═══════════════════════════════════════════════════════════════

    void CalculateJointWorldPositions(
        const Skeleton& skeleton,
        const std::vector<JointPose>& poses,
        std::vector<glm::vec3>& outPositions,
        std::vector<glm::quat>& outRotations)
    {
        u32 count = (u32)skeleton.bones.size();
        outPositions.resize(count);
        outRotations.resize(count);

        for (u32 i = 0; i < count; ++i)
        {
            glm::mat4 local = poses[i].ToMatrix();

            if (skeleton.bones[i].parentIndex >= 0)
            {
                u32 parent = (u32)skeleton.bones[i].parentIndex;
                glm::mat4 parentGlobal = glm::translate(glm::mat4(1.0f), outPositions[parent])
                                       * glm::mat4_cast(outRotations[parent]);
                glm::mat4 global = parentGlobal * local;
                outPositions[i] = glm::vec3(global[3]);
                outRotations[i] = glm::quat_cast(global);
            }
            else
            {
                outPositions[i] = poses[i].translation;
                outRotations[i] = poses[i].rotation;
            }
        }
    }

    void LocalToGlobalRotations(
        const Skeleton& skeleton,
        const std::vector<JointPose>& poses,
        std::vector<glm::quat>& outGlobalRots)
    {
        u32 count = (u32)skeleton.bones.size();
        outGlobalRots.resize(count);

        for (u32 i = 0; i < count; ++i)
        {
            if (skeleton.bones[i].parentIndex >= 0)
            {
                u32 parent = (u32)skeleton.bones[i].parentIndex;
                outGlobalRots[i] = outGlobalRots[parent] * poses[i].rotation;
            }
            else
            {
                outGlobalRots[i] = poses[i].rotation;
            }
        }
    }

    void ApplyGlobalRotations(
        Skeleton& skeleton,
        std::vector<JointPose>& poses,
        const std::vector<glm::quat>& globalRotations)
    {
        u32 count = (u32)skeleton.bones.size();
        for (u32 i = 0; i < count; ++i)
        {
            if (skeleton.bones[i].parentIndex >= 0)
            {
                u32 parent = (u32)skeleton.bones[i].parentIndex;
                poses[i].rotation = glm::inverse(globalRotations[parent]) * globalRotations[i];
            }
            else
            {
                poses[i].rotation = globalRotations[i];
            }
        }
    }

    void SetBoneLocalRotation(
        Skeleton& skeleton,
        std::vector<JointPose>& poses,
        u32 boneIndex,
        const glm::quat& newLocalRotation)
    {
        NV_UNUSED(skeleton);
        if (boneIndex >= (u32)poses.size()) return;
        poses[boneIndex].rotation = newLocalRotation;
    }

    // ═══════════════════════════════════════════════════════════════
    // BENCHMARK
    // ═══════════════════════════════════════════════════════════════

    IKBenchmarkResult RunIKBenchmark(u32 chainLength, u32 iterations)
    {
        IKBenchmarkResult result;
        result.bonesProcessed = chainLength;
        result.iterations = iterations;

        // ── Données synthétiques ──
        glm::vec3 rootPos(0, 10, 0);
        glm::vec3 midPos(0, 5, 5);
        glm::vec3 effectorPos(0, 0, 10);
        glm::vec3 targetPos(3, 1, 12);
        glm::vec3 poleVec(0, 10, 5);

        // FABRIK: génère une chaîne de N os
        std::vector<glm::vec3> fabrikChain;
        for (u32 i = 0; i < chainLength; ++i)
        {
            f32 t = (f32)i / (f32)(chainLength - 1);
            fabrikChain.push_back(glm::mix(rootPos, effectorPos, t));
        }

        // LookAt
        glm::vec3 bonePos(0, 8, 3);
        glm::vec3 lookTarget(2, 9, 10);

        // FootLock
        std::vector<FootLockBone> footBones;
        FootLockBone fb;
        fb.boneIndex = 0;
        fb.parentIndex = 1;
        fb.ikChainRoot = 2;
        footBones.push_back(fb);

        // ── Benchmark TwoBoneIK ──
        {
            auto start = std::chrono::high_resolution_clock::now();
            for (u32 i = 0; i < iterations; ++i)
            {
                TwoBoneIKInput in;
                in.rootPos = rootPos + glm::vec3(0, sinf((f32)i * 0.1f) * 0.5f, 0);
                in.midPos = midPos;
                in.effectorPos = effectorPos;
                in.targetPos = targetPos + glm::vec3(cosf((f32)i * 0.1f) * 0.5f, 0, 0);
                in.poleVec = poleVec;
                SolveTwoBoneIK(in);
            }
            auto end = std::chrono::high_resolution_clock::now();
            result.twoBoneIK_us = (f64)std::chrono::duration_cast<std::chrono::microseconds>(end - start).count()
                                  / (f64)iterations;
        }

        // ── Benchmark FABRIK ──
        {
            auto start = std::chrono::high_resolution_clock::now();
            for (u32 i = 0; i < iterations; ++i)
            {
                FABRIKInput in;
                in.jointPositions = fabrikChain;
                for (auto& p : in.jointPositions)
                    p += glm::vec3(sinf((f32)i * 0.1f) * 0.3f, 0, 0);
                in.targetPos = targetPos;
                in.maxIterations = 20;
                SolveFABRIK(in);
            }
            auto end = std::chrono::high_resolution_clock::now();
            result.fabrik_us = (f64)std::chrono::duration_cast<std::chrono::microseconds>(end - start).count()
                               / (f64)iterations;
        }

        // ── Benchmark LookAt ──
        {
            auto start = std::chrono::high_resolution_clock::now();
            for (u32 i = 0; i < iterations; ++i)
            {
                LookAtInput in;
                in.bonePos = bonePos;
                in.targetPos = lookTarget + glm::vec3(sinf((f32)i * 0.1f) * 0.5f, 0, 0);
                in.forwardAxis = glm::vec3(0, 0, -1);
                in.weight = 1.0f;
                SolveLookAt(in, glm::quat(1, 0, 0, 0));
            }
            auto end = std::chrono::high_resolution_clock::now();
            result.lookAt_us = (f64)std::chrono::duration_cast<std::chrono::microseconds>(end - start).count()
                               / (f64)iterations;
        }

        // ── Benchmark ChainLookAt ──
        {
            ChainLookAtInput in;
            for (u32 i = 0; i < chainLength; ++i)
            {
                f32 t = (f32)i / (f32)(chainLength - 1);
                in.bonePositions.push_back(glm::mix(glm::vec3(0, 8, 3), glm::vec3(0, 9, 5), t));
                in.boneRotations.push_back(glm::quat(1, 0, 0, 0));
            }
            in.targetPos = lookTarget;

            auto start = std::chrono::high_resolution_clock::now();
            for (u32 i = 0; i < iterations; ++i)
            {
                in.targetPos = lookTarget + glm::vec3(sinf((f32)i * 0.1f) * 0.5f, 0, 0);
                SolveChainLookAt(in);
            }
            auto end = std::chrono::high_resolution_clock::now();
            result.chainLookAt_us = (f64)std::chrono::duration_cast<std::chrono::microseconds>(end - start).count()
                                    / (f64)iterations;
        }

        // ── Benchmark FootLock ──
        {
            FootLockInput in;
            in.bones = footBones;
            in.dt = 1.0f / 60.0f;
            std::vector<glm::vec3> positions(5, glm::vec3(0));
            std::vector<glm::quat> rotations(5, glm::quat(1, 0, 0, 0));
            in.jointPositionsWorld = positions;
            in.jointRotationsWorld = rotations;

            auto start = std::chrono::high_resolution_clock::now();
            for (u32 i = 0; i < iterations; ++i)
            {
                in.forcePlant = (i % 2 == 0);
                SolveFootLock(in);
            }
            auto end = std::chrono::high_resolution_clock::now();
            result.footLock_us = (f64)std::chrono::duration_cast<std::chrono::microseconds>(end - start).count()
                                 / (f64)iterations;
        }

        return result;
    }

} // namespace nv
