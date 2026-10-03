#pragma once
#include "core/Types.h"
#include "components/AITactical.h"
#include "ecs/Registry.h"
#include "components/Transform.h"
#include <glm/vec3.hpp>
#include <vector>
#include <string>
#include <unordered_map>
#include <memory>
#include <functional>
#include <algorithm>
#include <cstring>

namespace nv
{

// ── Blackboard ───────────────────────────────────────────────────────────────
// Type-safe key-value store partagé par tous les nœuds du Behavior Tree.

enum class BlackboardValueType : u8 { Invalid, Bool, Int, Float, Vec3, Entity };

struct BlackboardValue
{
    BlackboardValueType type = BlackboardValueType::Invalid;
    union {
        bool   boolVal;
        i32    intVal;
        f32    floatVal;
        u32    entityVal;
    };
    glm::vec3 vec3Val{0.0f};

    BlackboardValue() : type(BlackboardValueType::Invalid), intVal(0) {}
    explicit BlackboardValue(bool v)        : type(BlackboardValueType::Bool),   boolVal(v) {}
    explicit BlackboardValue(i32 v)         : type(BlackboardValueType::Int),    intVal(v) {}
    explicit BlackboardValue(f32 v)         : type(BlackboardValueType::Float),  floatVal(v) {}
    explicit BlackboardValue(const glm::vec3& v) : type(BlackboardValueType::Vec3), vec3Val(v) {}
    explicit BlackboardValue(Entity v)      : type(BlackboardValueType::Entity), entityVal(v) {}
};

class Blackboard
{
public:
    void SetBool(const std::string& key, bool v)        { m_Values[key] = BlackboardValue(v); }
    void SetInt(const std::string& key, i32 v)          { m_Values[key] = BlackboardValue(v); }
    void SetFloat(const std::string& key, f32 v)        { m_Values[key] = BlackboardValue(v); }
    void SetVec3(const std::string& key, const glm::vec3& v) { m_Values[key] = BlackboardValue(v); }
    void SetEntity(const std::string& key, Entity v)    { m_Values[key] = BlackboardValue(v); }

    bool  GetBool(const std::string& key, bool fallback = false)   const;
    i32   GetInt(const std::string& key, i32 fallback = 0)         const;
    f32   GetFloat(const std::string& key, f32 fallback = 0.0f)    const;
    glm::vec3 GetVec3(const std::string& key, const glm::vec3& fallback = {}) const;
    Entity GetEntity(const std::string& key, Entity fallback = INVALID_ENTITY) const;

    bool Has(const std::string& key) const { return m_Values.find(key) != m_Values.end(); }
    void Remove(const std::string& key)    { m_Values.erase(key); }
    void Clear()                           { m_Values.clear(); }

private:
    std::unordered_map<std::string, BlackboardValue> m_Values;
};

// ── BT Node Status ───────────────────────────────────────────────────────────
enum class BTStatus : u8
{
    Success,
    Failure,
    Running
};

// ── Forward declarations ─────────────────────────────────────────────────────
class BTNode;
class BTCompositeNode;
class BTTaskNode;
class BTDecoratorNode;
class BTServiceNode;

// ── Tick context ─────────────────────────────────────────────────────────────
// Passed through the tree each tick. Carries entity, blackboard, world reference, dt.
struct BTTickContext
{
    Entity      entity = INVALID_ENTITY;
    f32         dt = 0.0f;
    Blackboard* blackboard = nullptr;
};

// ── BTNode (base) ────────────────────────────────────────────────────────────
class BTNode
{
public:
    virtual ~BTNode() = default;

    virtual BTStatus Tick(BTTickContext& ctx) = 0;

    void SetName(const std::string& name) { m_Name = name; }
    const std::string& GetName() const { return m_Name; }

    // Tree lifecycle
    virtual void OnInitialize(BTTickContext& ctx) { NV_UNUSED(ctx); }
    virtual void OnTerminate(BTTickContext& ctx, BTStatus status) { NV_UNUSED(ctx); NV_UNUSED(status); }

protected:
    std::string m_Name = "BTNode";
};

// ── BTTaskNode (action leaf) ─────────────────────────────────────────────────
// Execute an action and return Success/Failure/Running.
class BTTaskNode : public BTNode
{
public:
    using TaskFunc = std::function<BTStatus(BTTickContext&)>;

    explicit BTTaskNode(TaskFunc func) : m_TaskFunc(std::move(func)) {}

    BTStatus Tick(BTTickContext& ctx) override
    {
        if (m_TaskFunc) return m_TaskFunc(ctx);
        return BTStatus::Failure;
    }

private:
    TaskFunc m_TaskFunc;
};

// ── BTCompositeNode (base for Selector, Sequence) ────────────────────────────
class BTCompositeNode : public BTNode
{
public:
    void AddChild(std::unique_ptr<BTNode> child) { m_Children.push_back(std::move(child)); }
    BTNode* GetChild(u32 index) const { return (index < m_Children.size()) ? m_Children[index].get() : nullptr; }
    u32 GetChildCount() const { return (u32)m_Children.size(); }

protected:
    std::vector<std::unique_ptr<BTNode>> m_Children;
};

// ── BTSequence ───────────────────────────────────────────────────────────────
// Runs children in order. Returns:
//   - Success if ALL children succeed
//   - Running if a child is still running (continues same child next tick)
//   - Failure if ANY child fails
class BTSequence : public BTCompositeNode
{
public:
    BTStatus Tick(BTTickContext& ctx) override;

private:
    u32 m_ActiveChild = 0;
};

// ── BTSelector ───────────────────────────────────────────────────────────────
// Runs children in order. Returns:
//   - Success if ANY child succeeds
//   - Running if a child is still running
//   - Failure if ALL children fail
class BTSelector : public BTCompositeNode
{
public:
    BTStatus Tick(BTTickContext& ctx) override;

private:
    u32 m_ActiveChild = 0;
};

// ── BTParallel ───────────────────────────────────────────────────────────────
// Runs ALL children each tick. Succeeds when N children succeed, fails when M fail.
class BTParallel : public BTCompositeNode
{
public:
    BTParallel(u32 successThreshold, u32 failureThreshold)
        : m_SuccessThreshold(successThreshold)
        , m_FailureThreshold(failureThreshold)
    {}

    BTStatus Tick(BTTickContext& ctx) override;
    void OnInitialize(BTTickContext& ctx) override;

private:
    u32 m_SuccessThreshold;
    u32 m_FailureThreshold;
    std::vector<BTStatus> m_ChildStatuses;
};

// ── BTDecoratorNode (condition wrapper) ──────────────────────────────────────
// Wraps a single child. The decorator function decides whether to execute
// the child (return Success/Failure) or can also invert/modify the result.
class BTDecoratorNode : public BTNode
{
public:
    using DecoratorFunc = std::function<bool(BTTickContext&)>;

    explicit BTDecoratorNode(DecoratorFunc condition)
        : m_Condition(std::move(condition)) {}

    void SetChild(std::unique_ptr<BTNode> child) { m_Child = std::move(child); }
    BTNode* GetChild() const { return m_Child.get(); }

    BTStatus Tick(BTTickContext& ctx) override;

private:
    DecoratorFunc m_Condition;
    std::unique_ptr<BTNode> m_Child;
};

// ── BTServiceNode (per-frame updates) ────────────────────────────────────────
// Wraps a single child. The service function is called EVERY tick
// while the child is running (useful for updating blackboard values).
class BTServiceNode : public BTNode
{
public:
    using ServiceFunc = std::function<void(BTTickContext&)>;

    explicit BTServiceNode(ServiceFunc service)
        : m_Service(std::move(service)) {}

    void SetChild(std::unique_ptr<BTNode> child) { m_Child = std::move(child); }
    BTNode* GetChild() const { return m_Child.get(); }

    BTStatus Tick(BTTickContext& ctx) override;

private:
    ServiceFunc m_Service;
    std::unique_ptr<BTNode> m_Child;
};

// ── BehaviorTree (root) ──────────────────────────────────────────────────────
// Owns the root node + blackboard. Main tick interface.
class BehaviorTree
{
public:
    BehaviorTree() = default;
    ~BehaviorTree() = default;

    void SetRoot(std::unique_ptr<BTNode> root) { m_Root = std::move(root); }
    BTNode* GetRoot() const { return m_Root.get(); }

    Blackboard& GetBlackboard() { return m_Blackboard; }
    const Blackboard& GetBlackboard() const { return m_Blackboard; }

    // Main tick: returns status for the whole tree
    BTStatus Tick(Entity entity, f32 dt);

    // Reset tree state (restarts from root)
    void Reset();

    bool IsValid() const { return m_Root != nullptr; }

private:
    std::unique_ptr<BTNode> m_Root;
    Blackboard m_Blackboard;
    BTStatus m_LastStatus = BTStatus::Success;
};

// ── BTNode factory helper ────────────────────────────────────────────────────
// Creates task nodes from lambdas without boilerplate.
inline std::unique_ptr<BTTaskNode> MakeTask(BTTaskNode::TaskFunc func, const std::string& name = "Task")
{
    auto node = std::make_unique<BTTaskNode>(std::move(func));
    node->SetName(name);
    return node;
}

inline std::unique_ptr<BTSequence> MakeSequence(const std::string& name = "Sequence")
{
    auto node = std::make_unique<BTSequence>();
    node->SetName(name);
    return node;
}

inline std::unique_ptr<BTSelector> MakeSelector(const std::string& name = "Selector")
{
    auto node = std::make_unique<BTSelector>();
    node->SetName(name);
    return node;
}

inline std::unique_ptr<BTParallel> MakeParallel(u32 successThresh, u32 failureThresh, const std::string& name = "Parallel")
{
    auto node = std::make_unique<BTParallel>(successThresh, failureThresh);
    node->SetName(name);
    return node;
}

inline std::unique_ptr<BTDecoratorNode> MakeDecorator(BTDecoratorNode::DecoratorFunc condition, const std::string& name = "Decorator")
{
    auto node = std::make_unique<BTDecoratorNode>(std::move(condition));
    node->SetName(name);
    return node;
}

inline std::unique_ptr<BTServiceNode> MakeService(BTServiceNode::ServiceFunc service, const std::string& name = "Service")
{
    auto node = std::make_unique<BTServiceNode>(std::move(service));
    node->SetName(name);
    return node;
}

} // namespace nv
