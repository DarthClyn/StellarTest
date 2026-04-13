#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token,
    Address, Env, String, Symbol, Vec,
};

// ── Native XLM token contract address on Stellar ─────────────────────────────
// This is the Stellar Asset Contract (SAC) for native XLM
const NATIVE_TOKEN: &str = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

// ── Stake requirements in stroops (1 XLM = 10_000_000 stroops) ───────────────
const CONTRACTOR_STAKE: i128 = 200 * 10_000_000;  // 200 XLM
const HUNTER_STAKE:     i128 = 500 * 10_000_000;  // 500 XLM

#[contracttype]
#[derive(Clone)]
pub struct Agent {
    pub addr:           Address,
    pub role:           Symbol,
    pub stake:          i128,   // in stroops
    pub exit_requested: bool,
    pub exit_time:      u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Task {
    pub contractor:    Address,
    pub reward_usdc:   i128,
    pub bounty_hunter: Option<Address>,
    pub applicants:    Vec<Address>,
    pub status:        Symbol,
}

// ── Storage keys ──────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,
    Agent(Symbol),
    Task(Symbol),
    TxHash(String),
}

#[contract]
pub struct AgentRegistry;

#[contractimpl]
impl AgentRegistry {

    // ── INIT: set admin on deploy ─────────────────────────────────────────────
    pub fn init(env: Env, admin: Address) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
    }

    // ── Helper: get admin ─────────────────────────────────────────────────────
    fn get_admin(env: &Env) -> Address {
        env.storage().persistent().get(&DataKey::Admin).unwrap()
    }

    // ── Helper: native XLM token client ──────────────────────────────────────
    fn xlm_token(env: &Env) -> token::Client {
        let addr = Address::from_string(&String::from_str(&env, NATIVE_TOKEN));
        token::Client::new(&env, &addr)
    }

    // =========================================================================
    // AGENT LIFECYCLE
    // =========================================================================

    /// Register as contractor (200 XLM) or bounty_hunter (500 XLM).
    /// Transfers XLM from agent wallet → contract. Real on-chain stake.
    pub fn register(env: Env, agent_id: Symbol, addr: Address, role: Symbol, stake: i128) {
        addr.require_auth();

        if env.storage().persistent().has(&DataKey::Agent(agent_id.clone())) {
            panic!("Agent already registered");
        }

        // ── Enforce exact stake amounts ───────────────────────────────────────
        let required = if role == Symbol::new(&env, "contractor") {
            CONTRACTOR_STAKE  // 200 XLM
        } else if role == Symbol::new(&env, "bounty_hunter") {
            HUNTER_STAKE      // 500 XLM
        } else {
            panic!("Invalid role");
        };

        if stake != required {
            panic!("Stake must be exactly {} stroops", required);
        }

        // ── Transfer XLM from agent to contract ───────────────────────────────
        let xlm = Self::xlm_token(&env);
        xlm.transfer(&addr, &env.current_contract_address(), &stake);

        env.storage().persistent().set(&DataKey::Agent(agent_id.clone()), &Agent {
            addr: addr.clone(),
            role,
            stake,
            exit_requested: false,
            exit_time: 0,
        });

        env.events().publish((Symbol::new(&env, "reg"), agent_id), (addr, stake));
    }

    /// Start 24h cooldown before stake can be refunded.
    pub fn request_exit(env: Env, agent_id: Symbol) {
        let mut agent: Agent = env.storage().persistent()
            .get(&DataKey::Agent(agent_id.clone())).unwrap();
        agent.addr.require_auth();

        agent.exit_requested = true;
        agent.exit_time = env.ledger().timestamp();
        env.storage().persistent().set(&DataKey::Agent(agent_id.clone()), &agent);
        env.events().publish((Symbol::new(&env, "exit_req"), agent_id), agent.addr);
    }

    /// After 24h cooldown: refund remaining stake (post any slashes) to agent.
    pub fn admin_refund(env: Env, agent_id: Symbol) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        let agent: Agent = env.storage().persistent()
            .get(&DataKey::Agent(agent_id.clone())).unwrap();

        if !agent.exit_requested || env.ledger().timestamp() < (agent.exit_time + 86400) {
            panic!("Refund not ready — 24h cooldown not complete");
        }

        // ── Transfer remaining stake back to agent ────────────────────────────
        if agent.stake > 0 {
            let xlm = Self::xlm_token(&env);
            xlm.transfer(&env.current_contract_address(), &agent.addr, &agent.stake);
        }

        env.storage().persistent().remove(&DataKey::Agent(agent_id.clone()));
        env.events().publish((Symbol::new(&env, "refund"), agent_id), (agent.addr, agent.stake));
    }

    // =========================================================================
    // ADMIN: SLASH & STAKE MANAGEMENT
    // =========================================================================

    /// Slash (subtract) XLM from an agent's stake.
    /// Slashed XLM is transferred to admin wallet.
    pub fn slash_stake(env: Env, agent_id: Symbol, amount: i128, reason: Symbol) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        if amount <= 0 { panic!("Slash amount must be positive"); }

        let mut agent: Agent = env.storage().persistent()
            .get(&DataKey::Agent(agent_id.clone())).unwrap();

        if amount > agent.stake { panic!("Slash exceeds agent stake"); }

        // ── Transfer slashed XLM to admin ─────────────────────────────────────
        let xlm = Self::xlm_token(&env);
        xlm.transfer(&env.current_contract_address(), &admin, &amount);

        agent.stake -= amount;
        env.storage().persistent().set(&DataKey::Agent(agent_id.clone()), &agent);

        env.events().publish(
            (Symbol::new(&env, "slashed"), agent_id),
            (agent.addr, amount, reason)
        );
    }

    /// Top up (add) XLM to an agent's stake.
    /// Agent sends XLM → contract to restore slashed stake.
    pub fn top_up_stake(env: Env, agent_id: Symbol, amount: i128) {
        let mut agent: Agent = env.storage().persistent()
            .get(&DataKey::Agent(agent_id.clone())).unwrap();
        agent.addr.require_auth();

        if amount <= 0 { panic!("Top-up amount must be positive"); }

        // ── Transfer XLM from agent to contract ───────────────────────────────
        let xlm = Self::xlm_token(&env);
        xlm.transfer(&agent.addr, &env.current_contract_address(), &amount);

        agent.stake += amount;
        env.storage().persistent().set(&DataKey::Agent(agent_id.clone()), &agent);

        env.events().publish(
            (Symbol::new(&env, "top_up"), agent_id),
            (agent.addr, amount, agent.stake)
        );
    }

    /// Update admin address. Current admin must authorize.
    pub fn update_admin(env: Env, new_admin: Address) {
        let admin = Self::get_admin(&env);
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        env.events().publish((Symbol::new(&env, "admin_update"),), new_admin);
    }

    /// View an agent's current stake balance (in stroops).
    pub fn get_stake(env: Env, agent_id: Symbol) -> i128 {
        let agent: Agent = env.storage().persistent()
            .get(&DataKey::Agent(agent_id)).unwrap();
        agent.stake
    }

    // =========================================================================
    // TASK LIFECYCLE
    // =========================================================================

    pub fn create_task(env: Env, task_id: Symbol, contractor: Address, reward: i128) {
        contractor.require_auth();
        let task = Task {
            contractor: contractor.clone(),
            reward_usdc: reward,
            bounty_hunter: None,
            applicants: Vec::new(&env),
            status: Symbol::new(&env, "open"),
        };
        env.storage().persistent().set(&DataKey::Task(task_id.clone()), &task);
        env.events().publish((Symbol::new(&env, "task_new"), task_id), (contractor, reward));
    }

    pub fn request_task(env: Env, task_id: Symbol, bounty_hunter: Address) {
        bounty_hunter.require_auth();
        let mut task: Task = env.storage().persistent()
            .get(&DataKey::Task(task_id.clone())).unwrap();

        if task.status != Symbol::new(&env, "open") { panic!("Task not open"); }
        if task.applicants.contains(&bounty_hunter) { panic!("Already applied"); }

        task.applicants.push_back(bounty_hunter.clone());
        env.storage().persistent().set(&DataKey::Task(task_id.clone()), &task);
        env.events().publish((Symbol::new(&env, "task_apply"), task_id), bounty_hunter);
    }

    pub fn allot_task(env: Env, task_id: Symbol, contractor: Address, bounty_hunter: Address) {
        contractor.require_auth();
        let mut task: Task = env.storage().persistent()
            .get(&DataKey::Task(task_id.clone())).unwrap();

        if task.status != Symbol::new(&env, "open") { panic!("Task not open"); }
        if !task.applicants.contains(&bounty_hunter) { panic!("Hunter did not apply"); }

        task.bounty_hunter = Some(bounty_hunter.clone());
        task.status = Symbol::new(&env, "allotted");
        env.storage().persistent().set(&DataKey::Task(task_id.clone()), &task);
        env.events().publish((Symbol::new(&env, "task_allot"), task_id), bounty_hunter);
    }

    pub fn submit_task(env: Env, task_id: Symbol, bounty_hunter: Address) {
        bounty_hunter.require_auth();
        let mut task: Task = env.storage().persistent()
            .get(&DataKey::Task(task_id.clone())).unwrap();

        if task.bounty_hunter != Some(bounty_hunter.clone()) { panic!("Not assigned"); }
        if task.status != Symbol::new(&env, "allotted") { panic!("Task not allotted"); }

        task.status = Symbol::new(&env, "submitted");
        env.storage().persistent().set(&DataKey::Task(task_id.clone()), &task);
        env.events().publish((Symbol::new(&env, "task_sub"), task_id), bounty_hunter);
    }

    pub fn settle_task(env: Env, task_id: Symbol, contractor: Address, tx_hash: String) {
        contractor.require_auth();

        if env.storage().persistent().has(&DataKey::TxHash(tx_hash.clone())) {
            panic!("Payment hash already consumed");
        }

        let mut task: Task = env.storage().persistent()
            .get(&DataKey::Task(task_id.clone())).unwrap();

        if task.contractor != contractor { panic!("Not the contractor"); }
        if task.status != Symbol::new(&env, "submitted") { panic!("Task not submitted"); }

        env.storage().persistent().set(&DataKey::TxHash(tx_hash.clone()), &task_id);

        task.status = Symbol::new(&env, "paid");
        env.storage().persistent().set(&DataKey::Task(task_id.clone()), &task);

        env.events().publish((Symbol::new(&env, "task_paid"), task_id), tx_hash);
    }
}