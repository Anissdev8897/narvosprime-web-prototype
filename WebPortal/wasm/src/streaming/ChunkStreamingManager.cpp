#include "streaming/ChunkStreamingManager.h"
#include <algorithm>
#include <cstring>

namespace nv
{

ChunkStreamingManager g_ChunkStreaming;

void ChunkStreamingManager::Init(f32 budgetMB, u32 maxLoaded, f32 loadRadius, f32 unloadRadius)
{
    m_BudgetMB     = budgetMB;
    m_MaxLoaded    = maxLoaded;
    m_LoadRadius   = loadRadius;
    m_UnloadRadius = unloadRadius;
    m_UsedMB       = 0.f;
    m_Chunks.clear();
    m_Pending.clear();
}

void ChunkStreamingManager::RegisterChunk(u32 id, f32 cx, f32 cy, f32 cz, f32 radius, f32 estimatedMB)
{
    ChunkMeta c;
    c.id = id;
    c.centerX = cx;
    c.centerY = cy;
    c.centerZ = cz;
    c.radius = radius;
    c.estimatedMB = estimatedMB;
    c.loaded = false;
    m_Chunks.push_back(c);
}

void ChunkStreamingManager::MarkLoaded(u32 chunkId)
{
    for (auto& c : m_Chunks)
    {
        if (c.id == chunkId && !c.loaded)
        {
            c.loaded = true;
            m_UsedMB += c.estimatedMB;
            return;
        }
    }
}

void ChunkStreamingManager::UpdateChunkRadius(u32 id, f32 newRadius)
{
    for (auto& c : m_Chunks)
    {
        if (c.id == id)
        {
            c.radius = newRadius;
            return;
        }
    }
}

void ChunkStreamingManager::MarkUnloaded(u32 chunkId)
{
    for (auto& c : m_Chunks)
    {
        if (c.id == chunkId && c.loaded)
        {
            c.loaded = false;
            m_UsedMB -= c.estimatedMB;
            if (m_UsedMB < 0.f) m_UsedMB = 0.f;
            return;
        }
    }
}

void ChunkStreamingManager::Tick(f32 px, f32 py, f32 pz)
{
    m_Pending.clear();

    if (m_Chunks.empty()) return;

    // Distance au joueur par chunk
    struct DistEntry { u32 idx; f32 dist; };
    std::vector<DistEntry> sorted;
    sorted.reserve(m_Chunks.size());

    for (u32 i = 0; i < (u32)m_Chunks.size(); ++i)
    {
        const auto& c = m_Chunks[i];
        f32 dx = c.centerX - px;
        f32 dy = c.centerY - py;
        f32 dz = c.centerZ - pz;
        // Distance à la SPHÈRE du chunk, pas au centre : un chunk étendu
        // (radius 200-1600m sur forge) contient le joueur bien avant que son
        // centre soit à portée. dist brute → aucun chunk chargé au spawn.
        f32 distCenter = std::sqrt(dx * dx + dy * dy + dz * dz);
        f32 dist = distCenter - c.radius;
        if (dist < 0.f) dist = 0.f;
        sorted.push_back({i, dist});
    }

    std::sort(sorted.begin(), sorted.end(),
              [](const DistEntry& a, const DistEntry& b) { return a.dist < b.dist; });

    // Phase 1 : décharger les chunks trop loin (du plus loin au plus proche)
    for (int i = (int)sorted.size() - 1; i >= 0; --i)
    {
        const auto& e = sorted[(u32)i];
        auto& c = m_Chunks[e.idx];
        if (c.loaded && e.dist > m_UnloadRadius)
        {
            m_Pending.push_back({StreamCmd::Unload, c.id});
            c.loaded = false;
            m_UsedMB -= c.estimatedMB;
            if (m_UsedMB < 0.f) m_UsedMB = 0.f;
        }
    }

    // Phase 2 : charger les chunks proches (du plus proche au plus loin)
    u32 loadedCount = LoadedCount();
    for (const auto& e : sorted)
    {
        auto& c = m_Chunks[e.idx];
        if (c.loaded) continue;
        if (e.dist > m_LoadRadius) break;
        if (loadedCount >= m_MaxLoaded) break;
        if (m_UsedMB + c.estimatedMB > m_BudgetMB) continue;

        m_Pending.push_back({StreamCmd::Load, c.id});
        c.loaded = true;
        m_UsedMB += c.estimatedMB;
        ++loadedCount;
    }
}

u32 ChunkStreamingManager::DrainCommands(uintptr_t outPtr, u32 maxCount)
{
    u32 count = std::min((u32)m_Pending.size(), maxCount);
    uint32_t* out = reinterpret_cast<uint32_t*>(outPtr);
    for (u32 i = 0; i < count; ++i)
    {
        out[i * 2 + 0] = (uint32_t)m_Pending[i].cmd;
        out[i * 2 + 1] = m_Pending[i].chunkId;
    }
    m_Pending.erase(m_Pending.begin(), m_Pending.begin() + count);
    return count;
}

u32 ChunkStreamingManager::LoadedCount() const
{
    u32 n = 0;
    for (const auto& c : m_Chunks)
        if (c.loaded) ++n;
    return n;
}

u32 ChunkStreamingManager::CacheFingerprint() const
{
    // Hash simple : somme des (id * estimatedMB_int) avec rotation.
    // Toute modification de chunk (re-génération, ajout, suppression)
    // produit un fingerprint différent.
    u32 h = 0x4E415256; // 'NARV'
    for (const auto& c : m_Chunks)
    {
        u32 mb = (u32)(c.estimatedMB * 100.f);
        h ^= (c.id + 1) * mb;
        h = (h << 7) | (h >> 25); // rotate left 7
    }
    return h;
}

void ChunkStreamingManager::Clear()
{
    m_Chunks.clear();
    m_Pending.clear();
    m_UsedMB = 0.f;
}

} // namespace nv
