#pragma once
#include "core/Types.h"
#include <vector>
#include <cmath>

namespace nv
{

enum class AssetCategory : u32
{
    Chunk     = 0,
    Player    = 1,
    Npc       = 2,
    Weapon    = 3,
    Vehicle   = 4,
    Animation = 5,
    Ui        = 6,
    COUNT     = 7,
};

enum class QualityTier : u32
{
    Low    = 0,
    Medium = 1,
    High   = 2,
};

enum class AssetCmd : u32
{
    Preload   = 0,  // charge l'asset (pas encore chargé)
    Upgrade   = 1,  // remplace par qualité supérieure
    Downgrade = 2,  // remplace par qualité inférieure (budget serré)
    Evict     = 3,  // décharge complètement
};

struct AssetEntry
{
    u32 id = 0;
    AssetCategory category = AssetCategory::Chunk;
    QualityTier currentTier = QualityTier::High;
    f32 sizeMB[3] = {0.f, 0.f, 0.f}; // [low, med, high]
    f32 posX = 0.f, posY = 0.f, posZ = 0.f;
    bool spatial = false;   // true = distance-based priority (chunks, NPCs)
    bool loaded = false;
    bool essential = false; // true = never evict (player, equipped weapon)
    u32 priority = 0;       // 0 = highest
};

class AssetBudgetManager
{
public:
    void Init(f32 totalBudgetMB);
    void SetCategoryBudget(AssetCategory cat, f32 budgetMB);

    void RegisterAsset(u32 id, AssetCategory cat, bool spatial,
                       f32 px, f32 py, f32 pz,
                       f32 sizeLow, f32 sizeMed, f32 sizeHigh,
                       bool essential);
    void SetAssetPosition(u32 id, f32 px, f32 py, f32 pz);
    void MarkLoaded(u32 id, QualityTier tier);
    void MarkUnloaded(u32 id);

    void Tick(f32 playerX, f32 playerY, f32 playerZ,
              f32 loadRadius, f32 unloadRadius);

    u32 DrainCommands(uintptr_t outPtr, u32 maxCount);
    u32 PendingCount() const { return (u32)m_Pending.size(); }

    // Stats
    f32 TotalUsedMB() const { return m_UsedMB; }
    f32 TotalBudgetMB() const { return m_TotalBudgetMB; }
    f32 CategoryUsedMB(AssetCategory cat) const;
    u32 LoadedCount() const;
    u32 AssetCount() const { return (u32)m_Assets.size(); }

    // Requête : qualité recommandée pour un asset (basée sur distance + budget restant)
    QualityTier RecommendedTier(u32 id, f32 playerX, f32 playerY, f32 playerZ) const;

    /** Empreinte calculée sur les assets enregistrés (id + tailles).
     *  Change si les assets sont re-exportés (tailles différentes). */
    u32 CacheFingerprint() const;

    void Clear();

private:
    struct PendingEntry { AssetCmd cmd; u32 assetId; QualityTier tier; };

    AssetEntry* Find(u32 id);
    const AssetEntry* Find(u32 id) const;
    f32 DistToPlayer(const AssetEntry& a, f32 px, f32 py, f32 pz) const;
    f32 SizeForTier(const AssetEntry& a, QualityTier t) const;

    std::vector<AssetEntry> m_Assets;
    std::vector<PendingEntry> m_Pending;

    f32 m_TotalBudgetMB = 2048.f;
    f32 m_CategoryBudget[(u32)AssetCategory::COUNT] = {};
    f32 m_UsedMB = 0.f;
};

extern AssetBudgetManager g_AssetBudget;

} // namespace nv
