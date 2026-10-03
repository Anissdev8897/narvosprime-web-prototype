#pragma once
#include "core/Types.h"
#include <vector>
#include <cmath>

namespace nv
{

struct ChunkMeta
{
    u32 id = 0;
    f32 centerX = 0.f, centerY = 0.f, centerZ = 0.f;
    f32 radius = 50.f;
    f32 estimatedMB = 16.f;
    bool loaded = false;
};

enum class StreamCmd : u32
{
    Load   = 0,
    Unload = 1,
};

class ChunkStreamingManager
{
public:
    void Init(f32 budgetMB, u32 maxLoaded, f32 loadRadius, f32 unloadRadius);
    void RegisterChunk(u32 id, f32 cx, f32 cy, f32 cz, f32 radius, f32 estimatedMB);
    void MarkLoaded(u32 chunkId);
    void MarkUnloaded(u32 chunkId);
    /** Met à jour le rayon d'un chunk déjà enregistré. Utilisé par le runtime
     *  JS pour corriger la métadonnée initiale (qui inclut les coques
     *  enveloppantes → rayons jusqu'à 30k+ unités, rendant tout déchargement
     *  impossible) avec la vraie sphère englobante calculée après chargement. */
    void UpdateChunkRadius(u32 id, f32 newRadius);

    void Tick(f32 px, f32 py, f32 pz);

    u32 DrainCommands(uintptr_t outPtr, u32 maxCount);
    u32 PendingCount() const { return (u32)m_Pending.size(); }

    f32 BudgetUsedMB() const { return m_UsedMB; }
    u32 LoadedCount()  const;
    u32 ChunkCount()   const { return (u32)m_Chunks.size(); }

    /** Empreinte calculée sur les métadonnées enregistrées.
     *  Change quand les chunks sont re-générés (tailles différentes). */
    u32 CacheFingerprint() const;

    void SetRadii(f32 loadR, f32 unloadR) { m_LoadRadius = loadR; m_UnloadRadius = unloadR; }
    void Clear();

private:
    struct PendingEntry { StreamCmd cmd; u32 chunkId; };

    std::vector<ChunkMeta> m_Chunks;
    std::vector<PendingEntry> m_Pending;

    f32 m_BudgetMB    = 512.f;
    u32 m_MaxLoaded   = 6;
    f32 m_LoadRadius  = 200.f;
    f32 m_UnloadRadius = 300.f;
    f32 m_UsedMB      = 0.f;
};

extern ChunkStreamingManager g_ChunkStreaming;

} // namespace nv
