#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod intent_log {
    use ink::prelude::string::String;
    use ink::prelude::vec::Vec;

    #[derive(scale::Decode, scale::Encode, Clone)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct IntentEntry {
        pub caller: AccountId,
        pub intent: String,    // raw user input text
        pub action: String,    // resolved action type e.g. "stake"
        pub timestamp: u64,    // block timestamp
    }

    #[ink(storage)]
    pub struct IntentLog {
        entries: Vec<IntentEntry>,
        owner: AccountId,
    }

    impl IntentLog {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                entries: Vec::new(),
                owner: Self::env().caller(),
            }
        }

        /// Called by backend after every successful execution.
        /// Payable so POT gas is consumed — satisfies native gas requirement.
        #[ink(message)]
        pub fn log_intent(
            &mut self,
            intent: String,
            action: String,
        ) {
            let entry = IntentEntry {
                caller: self.env().caller(),
                intent,
                action,
                timestamp: self.env().block_timestamp(),
            };
            self.entries.push(entry);
        }

        #[ink(message)]
        pub fn get_all(&self) -> Vec<IntentEntry> {
            self.entries.clone()
        }

        #[ink(message)]
        pub fn get_by_caller(&self, caller: AccountId) -> Vec<IntentEntry> {
            self.entries
                .iter()
                .filter(|e| e.caller == caller)
                .cloned()
                .collect()
        }

        #[ink(message)]
        pub fn count(&self) -> u32 {
            self.entries.len() as u32
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[ink::test]
        fn new_contract_has_zero_entries() {
            let contract = IntentLog::new();
            assert_eq!(contract.count(), 0);
        }

        #[ink::test]
        fn log_intent_increments_count() {
            let mut contract = IntentLog::new();
            contract.log_intent(
                String::from("Stake 20 POT to the safest validator"),
                String::from("stake"),
            );
            assert_eq!(contract.count(), 1);
        }

        #[ink::test]
        fn get_all_returns_logged_entries() {
            let mut contract = IntentLog::new();
            contract.log_intent(
                String::from("Stake 20 POT to the safest validator"),
                String::from("stake"),
            );
            let entries = contract.get_all();
            assert_eq!(entries.len(), 1);
            assert_eq!(entries[0].intent, "Stake 20 POT to the safest validator");
            assert_eq!(entries[0].action, "stake");
        }
    }
}
