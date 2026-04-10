#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, String};

#[contracttype]
#[derive(Clone)]
pub struct Task {
    pub client: Address,
    pub hunter: Option<Address>, // The allotted worker
    pub reward: i128,
    pub status: Symbol, // 'open', 'requested', 'allotted', 'submitted', 'paid'
}

#[contract]
pub struct AgentRegistry;

#[contractimpl]
impl AgentRegistry {
    // 1. Post Task (Status: OPEN)
    pub fn post_task(env: Env, task_id: Symbol, client: Address, reward: i128) {
        client.require_auth();
        let task = Task { client, hunter: None, reward, status: Symbol::new(&env, "open") };
        env.storage().persistent().set(&task_id, &task);
    }

    // 2. Request Task (Hunter applies - Status: REQUESTED)
    pub fn request_task(env: Env, task_id: Symbol, hunter: Address) {
        hunter.require_auth();
        let mut task: Task = env.storage().persistent().get(&task_id).unwrap();
        task.status = Symbol::new(&env, "requested");
        // We don't allot yet, just mark as requested
        env.storage().persistent().set(&task_id, &task);
    }

    // 3. Allot Task (Poster accepts - Status: ALLOTTED)
    pub fn allot_task(env: Env, task_id: Symbol, hunter: Address) {
        let mut task: Task = env.storage().persistent().get(&task_id).unwrap();
        task.client.require_auth(); 
        task.hunter = Some(hunter);
        task.status = Symbol::new(&env, "allotted");
        env.storage().persistent().set(&task_id, &task);
    }

    // 4. Log Payment (Status: PAID/COMPLETED)
    pub fn log_payment(env: Env, task_id: Symbol, tx_hash: String) {
        let mut task: Task = env.storage().persistent().get(&task_id).unwrap();
        task.status = Symbol::new(&env, "paid");
        env.storage().persistent().set(&task_id, &task);
        env.storage().persistent().set(&tx_hash, &task_id);
    }
}