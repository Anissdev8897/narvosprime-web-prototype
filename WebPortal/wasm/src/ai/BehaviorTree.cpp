#include "ai/BehaviorTree.h"

namespace nv
{

// ── Blackboard getter implementations ─────────────────────────────────────────

bool Blackboard::GetBool(const std::string& key, bool fallback) const
{
    auto it = m_Values.find(key);
    if (it == m_Values.end() || it->second.type != BlackboardValueType::Bool)
        return fallback;
    return it->second.boolVal;
}

i32 Blackboard::GetInt(const std::string& key, i32 fallback) const
{
    auto it = m_Values.find(key);
    if (it == m_Values.end() || it->second.type != BlackboardValueType::Int)
        return fallback;
    return it->second.intVal;
}

f32 Blackboard::GetFloat(const std::string& key, f32 fallback) const
{
    auto it = m_Values.find(key);
    if (it == m_Values.end() || it->second.type != BlackboardValueType::Float)
        return fallback;
    return it->second.floatVal;
}

glm::vec3 Blackboard::GetVec3(const std::string& key, const glm::vec3& fallback) const
{
    auto it = m_Values.find(key);
    if (it == m_Values.end() || it->second.type != BlackboardValueType::Vec3)
        return fallback;
    return it->second.vec3Val;
}

Entity Blackboard::GetEntity(const std::string& key, Entity fallback) const
{
    auto it = m_Values.find(key);
    if (it == m_Values.end() || it->second.type != BlackboardValueType::Entity)
        return fallback;
    return it->second.entityVal;
}

// ── BTSequence ───────────────────────────────────────────────────────────────

BTStatus BTSequence::Tick(BTTickContext& ctx)
{
    // Skip already-succeeded children and re-enter the active running child
    while (m_ActiveChild < m_Children.size())
    {
        auto* child = m_Children[m_ActiveChild].get();
        BTStatus status = child->Tick(ctx);

        if (status == BTStatus::Running)
        {
            return BTStatus::Running; // Wait for this child to finish
        }

        // Child finished
        child->OnTerminate(ctx, status);

        if (status == BTStatus::Failure)
        {
            m_ActiveChild = 0; // Reset for next tick invocation
            return BTStatus::Failure; // Sequence fails on first failure
        }

        // Success — move to next child
        m_ActiveChild++;
    }

    // All children succeeded
    m_ActiveChild = 0;
    return BTStatus::Success;
}

// ── BTSelector ───────────────────────────────────────────────────────────────

BTStatus BTSelector::Tick(BTTickContext& ctx)
{
    while (m_ActiveChild < m_Children.size())
    {
        auto* child = m_Children[m_ActiveChild].get();
        BTStatus status = child->Tick(ctx);

        if (status == BTStatus::Running)
        {
            return BTStatus::Running; // Wait for this child to finish
        }

        child->OnTerminate(ctx, status);

        if (status == BTStatus::Success)
        {
            m_ActiveChild = 0; // Reset for next tick
            return BTStatus::Success; // Selector succeeds on first success
        }

        // Failure — try next child
        m_ActiveChild++;
    }

    // All children failed
    m_ActiveChild = 0;
    return BTStatus::Failure;
}

// ── BTParallel ───────────────────────────────────────────────────────────────

void BTParallel::OnInitialize(BTTickContext& ctx)
{
    NV_UNUSED(ctx);
    m_ChildStatuses.assign(m_Children.size(), BTStatus::Running);
}

BTStatus BTParallel::Tick(BTTickContext& ctx)
{
    // Resize status array if children changed (shouldn't happen at runtime)
    if (m_ChildStatuses.size() != m_Children.size())
        m_ChildStatuses.assign(m_Children.size(), BTStatus::Running);

    u32 successCount = 0;
    u32 failureCount = 0;

    for (u32 i = 0; i < m_Children.size(); i++)
    {
        // Skip already-completed children
        if (m_ChildStatuses[i] == BTStatus::Success)
        {
            successCount++;
            continue;
        }
        if (m_ChildStatuses[i] == BTStatus::Failure)
        {
            failureCount++;
            continue;
        }

        // Tick this child
        auto* child = m_Children[i].get();
        BTStatus status = child->Tick(ctx);

        m_ChildStatuses[i] = status;

        if (status == BTStatus::Success)
        {
            child->OnTerminate(ctx, status);
            successCount++;
        }
        else if (status == BTStatus::Failure)
        {
            child->OnTerminate(ctx, status);
            failureCount++;
        }
    }

    // Check thresholds
    if (successCount >= m_SuccessThreshold)
    {
        std::fill(m_ChildStatuses.begin(), m_ChildStatuses.end(), BTStatus::Running);
        return BTStatus::Success;
    }
    if (failureCount >= m_FailureThreshold)
    {
        std::fill(m_ChildStatuses.begin(), m_ChildStatuses.end(), BTStatus::Running);
        return BTStatus::Failure;
    }

    return BTStatus::Running;
}

// ── BTDecoratorNode ──────────────────────────────────────────────────────────

BTStatus BTDecoratorNode::Tick(BTTickContext& ctx)
{
    if (!m_Child)
        return BTStatus::Failure;

    // Check condition
    if (m_Condition && !m_Condition(ctx))
        return BTStatus::Failure; // Condition not met → decorator fails

    // Condition met → execute child
    BTStatus status = m_Child->Tick(ctx);
    return status;
}

// ── BTServiceNode ────────────────────────────────────────────────────────────

BTStatus BTServiceNode::Tick(BTTickContext& ctx)
{
    if (!m_Child)
        return BTStatus::Failure;

    // Run service every tick
    if (m_Service)
        m_Service(ctx);

    // Execute child
    BTStatus status = m_Child->Tick(ctx);
    return status;
}

// ── BehaviorTree ─────────────────────────────────────────────────────────────

BTStatus BehaviorTree::Tick(Entity entity, f32 dt)
{
    if (!m_Root)
        return BTStatus::Failure;

    BTTickContext ctx;
    ctx.entity = entity;
    ctx.dt = dt;
    ctx.blackboard = &m_Blackboard;

    // If last tick returned Success/Failure, re-initialize from root
    if (m_LastStatus != BTStatus::Running)
    {
        m_Root->OnInitialize(ctx);
    }

    m_LastStatus = m_Root->Tick(ctx);

    return m_LastStatus;
}

void BehaviorTree::Reset()
{
    m_LastStatus = BTStatus::Success;
}

} // namespace nv
