#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, String};

#[contracttype]
#[derive(Clone)]
pub struct Agent {
    pub addr: Address,
    pub role: Symbol,
    pub stake: i128,
    pub exit_requested: bool,
    pub exit_time: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Task {
    pub contractor: Address,
    pub reward_usdc: i128,
    pub bounty_hunter: Option<Address>,
    pub status: Symbol, 
}

#[contract]
pub struct AgentRegistry;

#[contractimpl]
impl AgentRegistry {
    
    // --- AGENT LIFECYCLE ---

    pub fn register(env: Env, agent_id: Symbol, addr: Address, role: Symbol, stake: i128) {
        addr.require_auth();
        if env.storage().persistent().has(&agent_id) { panic!("Role exists"); }
        
        let req = if role == Symbol::new(&env, "contractor") { 2000000000 } else { 5000000000 }; //2
        if stake < req { panic!("Stake too low"); }

        env.storage().persistent().set(&agent_id, &Agent { 
            addr: addr.clone(), role, stake, exit_requested: false, exit_time: 0 
        });
        env.events().publish((Symbol::new(&env, "reg"), agent_id), addr);
    }

    pub fn request_exit(env: Env, agent_id: Symbol) {
        let mut agent: Agent = env.storage().persistent().get(&agent_id).unwrap();
        agent.addr.require_auth();
        
        agent.exit_requested = true;
        agent.exit_time = env.ledger().timestamp();
        env.storage().persistent().set(&agent_id, &agent);
        env.events().publish((Symbol::new(&env, "exit_req"), agent_id), agent.addr);
    }

    pub fn admin_refund(env: Env, admin: Address, agent_id: Symbol) {
        admin.require_auth();
        let agent: Agent = env.storage().persistent().get(&agent_id).unwrap();
        
        if !agent.exit_requested || env.ledger().timestamp() < (agent.exit_time + 86400) {
            panic!("Refund not ready");
        }
        env.storage().persistent().remove(&agent_id);
        env.events().publish((Symbol::new(&env, "refund"), agent_id), agent.addr);
    }

    // --- TASK LIFECYCLE ---

    pub fn create_task(env: Env, task_id: Symbol, contractor: Address, reward: i128) {
        contractor.require_auth();
        let task = Task { contractor: contractor.clone(), reward_usdc: reward, bounty_hunter: None, status: Symbol::new(&env, "open") };
        env.storage().persistent().set(&task_id, &task);
        env.events().publish((Symbol::new(&env, "task_new"), task_id), (contractor, reward));
    }
pub fn request_task(env: Env, task_id: Symbol, hunter: Address) {
    hunter.require_auth();
    let task: Task = env.storage().persistent().get(&task_id).unwrap();
    if task.status != Symbol::new(&env, "open") { panic!("Task not open"); }
    // No state change — just signals intent via event
    env.events().publish((Symbol::new(&env, "task_apply"), task_id), hunter);
}
    pub fn allot_task(env: Env, task_id: Symbol, contractor: Address, bounty_hunter: Address) {
        contractor.require_auth();
        let mut task: Task = env.storage().persistent().get(&task_id).unwrap();
        
        task.bounty_hunter = Some(bounty_hunter.clone());
        task.status = Symbol::new(&env, "allotted");
        env.storage().persistent().set(&task_id, &task);
        env.events().publish((Symbol::new(&env, "task_allot"), task_id), bounty_hunter);
    }

    pub fn submit_task(env: Env, task_id: Symbol, bounty_hunter: Address) {
        bounty_hunter.require_auth();
        let mut task: Task = env.storage().persistent().get(&task_id).unwrap();
        
        if task.bounty_hunter != Some(bounty_hunter.clone()) { panic!("Not assigned"); }
        task.status = Symbol::new(&env, "submitted");
        env.storage().persistent().set(&task_id, &task);
        env.events().publish((Symbol::new(&env, "task_sub"), task_id), bounty_hunter);
    }

    // --- THE SETTLEMENT (WITH REPLAY PROTECTION) ---

    pub fn settle_task(env: Env, task_id: Symbol, contractor: Address, tx_hash: String) {
        contractor.require_auth();

        // 4-7 Words: Check if payment hash already used.
        if env.storage().persistent().has(&tx_hash) {
            panic!("Payment hash already consumed");
        }

        let mut task: Task = env.storage().persistent().get(&task_id).unwrap();
        if task.status == Symbol::new(&env, "paid") { panic!("Already settled"); }
        
        // 4-7 Words: Lock transaction hash to prevent reuse.
        env.storage().persistent().set(&tx_hash, &task_id);

        task.status = Symbol::new(&env, "paid");
        env.storage().persistent().set(&task_id, &task);
        
        // Publish Event with Hash for Hub verification
        env.events().publish((Symbol::new(&env, "task_paid"), task_id), tx_hash);
    }
}