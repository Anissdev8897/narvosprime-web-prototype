#include "ai/EQS.h"
#include "physics/CollisionSystem.h"
#include <algorithm>

namespace nv
{
    std::vector<EQSResult> EQS::RunQuery(const EQSQuery& query)
    {
        std::vector<EQSResult> results;
        f32 step = query.radius * 2.0f / (f32)query.gridSize;

        for (u32 x = 0; x < query.gridSize; ++x)
        {
            for (u32 z = 0; z < query.gridSize; ++z)
            {
                glm::vec3 pos = query.querier + glm::vec3(
                    (x - query.gridSize * 0.5f) * step,
                    0.0f,
                    (z - query.gridSize * 0.5f) * step
                );
                EQSResult res;
                res.position = pos;
                res.valid = true;
                res.score = 0.0f;
                for (auto& test : query.tests)
                    res.score += test.scorer(pos) * test.weight;
                results.push_back(res);
            }
        }
        std::sort(results.begin(), results.end(), [](const EQSResult& a, const EQSResult& b) {
            return a.score > b.score;
        });
        return results;
    }

    bool EQS::TraceTest(const glm::vec3& from, const glm::vec3& to)
    {
        return g_CollisionSystem.SegmentBlocked(from, to);
    }
}
