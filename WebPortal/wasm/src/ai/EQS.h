#pragma once
#include <glm/vec3.hpp>
#include <vector>
#include <functional>
#include "core/Types.h"

namespace nv
{
    struct EQSTest
    {
        enum Type { Distance, Dot, Trace, Overlap, PathFind } type;
        std::function<f32(const glm::vec3&)> scorer;
        f32 weight = 1.0f;
    };

    struct EQSQuery
    {
        glm::vec3 querier{0.0f};
        f32 radius = 10.0f;
        u32 gridSize = 8;
        std::vector<EQSTest> tests;
    };

    struct EQSResult
    {
        glm::vec3 position{0.0f};
        f32 score = 0.0f;
        bool valid = false;
    };

    class EQS
    {
    public:
        static std::vector<EQSResult> RunQuery(const EQSQuery& query);
        static bool TraceTest(const glm::vec3& from, const glm::vec3& to);
    };
}
