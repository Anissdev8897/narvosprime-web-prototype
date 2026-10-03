#include "streaming/AssetBudgetManager.h"
#include <algorithm>
#include <cstring>

namespace nv
{

AssetBudgetManager g_AssetBudget;

// ── Init ────────────────────────────────────────────────────────────────────────

void AssetBudgetManager::Init(f32 totalBudgetMB)
{
    m_TotalBudgetMB = totalBudgetMB;
    m_UsedMB = 0.f;
    m_Assets.clear();
    m_Pending.clear();
    for (u32 i = 0; i < (u32)AssetCategory::COUNT; ++i)
        m_CategoryBudget[i] = totalBudgetMB; // par défaut : pas de limite par catégorie
}

void AssetBudgetManager::SetCategoryBudget(AssetCategory cat, f32 budgetMB)
{
    m_CategoryBudget[(u32)cat] = budgetMB;
}

// ── Registration ────────────────────────────────────────────────────────────────

void AssetBudgetManager::RegisterAsset(u32 id, AssetCategory cat, bool spatial,
                                        f32 px, f32 py, f32 pz,
                                        f32 sizeLow, f32 sizeMed, f32 sizeHigh,
                                        bool essential)
{
    // Évite les doublons
    if (Find(id)) return;

    AssetEntry a;
    a.id = id;
    a.category = cat;
    a.spatial = spatial;
    a.posX = px; a.posY = py; a.posZ = pz;
    a.sizeMB[0] = sizeLow;
    a.sizeMB[1] = sizeMed;
    a.sizeMB[2] = sizeHigh;
    a.essential = essential;
    a.loaded = false;
    a.currentTier = QualityTier::High;

    // Priorité statique par catégorie (plus bas = plus prioritaire)
    switch (cat)
    {
    case AssetCategory::Player:    a.priority = 0; break;
    case AssetCategory::Weapon:    a.priority = 1; break;
    case AssetCategory::Vehicle:   a.priority = 2; break;
    case AssetCategory::Chunk:     a.priority = 3; break;
    case AssetCategory::Npc:       a.priority = 4; break;
    case AssetCategory::Animation: a.priority = 5; break;
    case AssetCategory::Ui:        a.priority = 6; break;
    default: a.priority = 10; break;
    }

    m_Assets.push_back(a);
}

void AssetBudgetManager::SetAssetPosition(u32 id, f32 px, f32 py, f32 pz)
{
    auto* a = Find(id);
    if (a) { a->posX = px; a->posY = py; a->posZ = pz; }
}

void AssetBudgetManager::MarkLoaded(u32 id, QualityTier tier)
{
    auto* a = Find(id);
    if (!a) return;

    if (a->loaded)
    {
        // Changement de tier : ajuster le delta VRAM
        f32 oldSize = SizeForTier(*a, a->currentTier);
        f32 newSize = SizeForTier(*a, tier);
        m_UsedMB += (newSize - oldSize);
    }
    else
    {
        m_UsedMB += SizeForTier(*a, tier);
    }
    a->loaded = true;
    a->currentTier = tier;
    if (m_UsedMB < 0.f) m_UsedMB = 0.f;
}

void AssetBudgetManager::MarkUnloaded(u32 id)
{
    auto* a = Find(id);
    if (!a || !a->loaded) return;
    m_UsedMB -= SizeForTier(*a, a->currentTier);
    if (m_UsedMB < 0.f) m_UsedMB = 0.f;
    a->loaded = false;
}

// ── Tick ─────────────────────────────────────────────────────────────────────────

void AssetBudgetManager::Tick(f32 px, f32 py, f32 pz,
                               f32 loadRadius, f32 unloadRadius)
{
    m_Pending.clear();
    if (m_Assets.empty()) return;

    // Score = priority * 100 + distance (pour les spatiaux)
    struct Scored { u32 idx; f32 score; f32 dist; };
    std::vector<Scored> scored;
    scored.reserve(m_Assets.size());

    for (u32 i = 0; i < (u32)m_Assets.size(); ++i)
    {
        const auto& a = m_Assets[i];
        f32 dist = a.spatial ? DistToPlayer(a, px, py, pz) : 0.f;
        f32 score = (f32)a.priority * 1000.f + dist;
        scored.push_back({i, score, dist});
    }

    std::sort(scored.begin(), scored.end(),
              [](const Scored& a, const Scored& b) { return a.score < b.score; });

    // Phase 1 : Éviction — décharger les assets spatiaux trop loin (non essentiels)
    for (int i = (int)scored.size() - 1; i >= 0; --i)
    {
        const auto& s = scored[(u32)i];
        auto& a = m_Assets[s.idx];
        if (!a.loaded || a.essential || !a.spatial) continue;
        if (s.dist > unloadRadius)
        {
            m_Pending.push_back({AssetCmd::Evict, a.id, a.currentTier});
        }
    }

    // Phase 2 : Downgrade — si budget dépassé, downgrade les assets lointains non essentiels
    if (m_UsedMB > m_TotalBudgetMB * 0.9f)
    {
        for (int i = (int)scored.size() - 1; i >= 0; --i)
        {
            if (m_UsedMB <= m_TotalBudgetMB * 0.8f) break;
            const auto& s = scored[(u32)i];
            auto& a = m_Assets[s.idx];
            if (!a.loaded || a.essential) continue;
            if (a.currentTier == QualityTier::Low) continue;

            QualityTier newTier = (a.currentTier == QualityTier::High)
                                     ? QualityTier::Medium
                                     : QualityTier::Low;
            f32 savings = SizeForTier(a, a.currentTier) - SizeForTier(a, newTier);
            if (savings > 0.f)
            {
                m_Pending.push_back({AssetCmd::Downgrade, a.id, newTier});
                // Projection optimiste du budget (le JS confirmera via MarkLoaded)
                m_UsedMB -= savings;
            }
        }
    }

    // Phase 3 : Preload — charger les assets non chargés proches / essentiels
    for (const auto& s : scored)
    {
        auto& a = m_Assets[s.idx];
        if (a.loaded) continue;

        bool shouldLoad = a.essential || !a.spatial || s.dist <= loadRadius;
        if (!shouldLoad) continue;

        // Vérifier le budget
        QualityTier tier = RecommendedTier(a.id, px, py, pz);
        f32 cost = SizeForTier(a, tier);
        if (m_UsedMB + cost > m_TotalBudgetMB && !a.essential) continue;

        m_Pending.push_back({AssetCmd::Preload, a.id, tier});
    }

    // Phase 4 : Upgrade — les assets proches chargés en low/med méritent un upgrade
    for (const auto& s : scored)
    {
        auto& a = m_Assets[s.idx];
        if (!a.loaded) continue;

        QualityTier recommended = RecommendedTier(a.id, px, py, pz);
        if ((u32)recommended <= (u32)a.currentTier) continue;

        f32 delta = SizeForTier(a, recommended) - SizeForTier(a, a.currentTier);
        if (m_UsedMB + delta > m_TotalBudgetMB * 0.95f && !a.essential) continue;

        m_Pending.push_back({AssetCmd::Upgrade, a.id, recommended});
    }
}

// ── Drain commands ──────────────────────────────────────────────────────────────

u32 AssetBudgetManager::DrainCommands(uintptr_t outPtr, u32 maxCount)
{
    // Layout par commande : [cmd(u32), assetId(u32), tier(u32)] = 3 u32
    u32 count = std::min((u32)m_Pending.size(), maxCount);
    uint32_t* out = reinterpret_cast<uint32_t*>(outPtr);
    for (u32 i = 0; i < count; ++i)
    {
        out[i * 3 + 0] = (uint32_t)m_Pending[i].cmd;
        out[i * 3 + 1] = m_Pending[i].assetId;
        out[i * 3 + 2] = (uint32_t)m_Pending[i].tier;
    }
    m_Pending.erase(m_Pending.begin(), m_Pending.begin() + count);
    return count;
}

// ── Stats ───────────────────────────────────────────────────────────────────────

f32 AssetBudgetManager::CategoryUsedMB(AssetCategory cat) const
{
    f32 total = 0.f;
    for (const auto& a : m_Assets)
        if (a.loaded && a.category == cat)
            total += SizeForTier(a, a.currentTier);
    return total;
}

u32 AssetBudgetManager::LoadedCount() const
{
    u32 n = 0;
    for (const auto& a : m_Assets)
        if (a.loaded) ++n;
    return n;
}

QualityTier AssetBudgetManager::RecommendedTier(u32 id, f32 px, f32 py, f32 pz) const
{
    const auto* a = Find(id);
    if (!a) return QualityTier::High;

    // Essentiels toujours en high
    if (a->essential) return QualityTier::High;

    // Non spatiaux : basé sur le budget restant
    if (!a->spatial)
    {
        f32 remaining = m_TotalBudgetMB - m_UsedMB;
        if (remaining < m_TotalBudgetMB * 0.15f) return QualityTier::Low;
        if (remaining < m_TotalBudgetMB * 0.30f) return QualityTier::Medium;
        return QualityTier::High;
    }

    // Spatiaux : basé sur la distance
    f32 dist = DistToPlayer(*a, px, py, pz);
    if (dist < 30.f)  return QualityTier::High;
    if (dist < 100.f) return QualityTier::Medium;
    return QualityTier::Low;
}

u32 AssetBudgetManager::CacheFingerprint() const
{
    u32 h = 0x41535345; // 'ASSE'
    for (const auto& a : m_Assets)
    {
        u32 sLow  = (u32)(a.sizeMB[0] * 100.f);
        u32 sMed  = (u32)(a.sizeMB[1] * 100.f);
        u32 sHigh = (u32)(a.sizeMB[2] * 100.f);
        h ^= (a.id + 1) * (sLow + sMed * 37 + sHigh * 1301);
        h = (h << 7) | (h >> 25);
    }
    return h;
}

void AssetBudgetManager::Clear()
{
    m_Assets.clear();
    m_Pending.clear();
    m_UsedMB = 0.f;
}

// ── Private ─────────────────────────────────────────────────────────────────────

AssetEntry* AssetBudgetManager::Find(u32 id)
{
    for (auto& a : m_Assets)
        if (a.id == id) return &a;
    return nullptr;
}

const AssetEntry* AssetBudgetManager::Find(u32 id) const
{
    for (const auto& a : m_Assets)
        if (a.id == id) return &a;
    return nullptr;
}

f32 AssetBudgetManager::DistToPlayer(const AssetEntry& a, f32 px, f32 py, f32 pz) const
{
    f32 dx = a.posX - px;
    f32 dy = a.posY - py;
    f32 dz = a.posZ - pz;
    return std::sqrt(dx * dx + dy * dy + dz * dz);
}

f32 AssetBudgetManager::SizeForTier(const AssetEntry& a, QualityTier t) const
{
    return a.sizeMB[(u32)t];
}

} // namespace nv
