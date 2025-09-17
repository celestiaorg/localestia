use crate::types::GENESIS_HEIGHT;
use celestia_types::block::CommitExt;
use celestia_types::hash::{Hash, HashExt};
use celestia_types::{DataAvailabilityHeader, ExtendedDataSquare, ExtendedHeader, ValidatorSet};
use ed25519_consensus::SigningKey;
use tendermint::block::header::Version;
use tendermint::block::{parts, Commit, CommitSig, Header};
use tendermint::{chain, PublicKey, Signature, Time};

/// Utility function to generate a new header
pub fn generate_new(
    height: u64,
    time: Time,
    dah: Option<DataAvailabilityHeader>,
) -> ExtendedHeader {
    let chain_id: chain::Id = "private".try_into().unwrap();
    let signing_key = SigningKey::new(rand::thread_rng());

    assert!(height >= GENESIS_HEIGHT);
    let pub_key_bytes = signing_key.verification_key().to_bytes();
    let pub_key = PublicKey::from_raw_ed25519(&pub_key_bytes).unwrap();
    let validator_address = tendermint::account::Id::from(pub_key);

    let last_block_id = if height == GENESIS_HEIGHT {
        None
    } else {
        Some(tendermint::block::Id {
            hash: Hash::Sha256(rand::random()),
            part_set_header: parts::Header::new(1, Hash::Sha256(rand::random()))
                .expect("invalid PartSetHeader"),
        })
    };

    let mut header = ExtendedHeader {
        header: Header {
            version: Version {
                block: celestia_types::consts::version::BLOCK_PROTOCOL,
                app: 1,
            },
            chain_id: chain_id.clone(),
            height: height.try_into().unwrap(),
            time,
            last_block_id,
            last_commit_hash: Some(Hash::default_sha256()),
            data_hash: Some(Hash::None),
            validators_hash: Hash::None,
            next_validators_hash: Hash::None,
            consensus_hash: Hash::Sha256(rand::random()),
            app_hash: Hash::default_sha256()
                .as_bytes()
                .to_vec()
                .try_into()
                .unwrap(),
            last_results_hash: Some(Hash::default_sha256()),
            evidence_hash: Some(Hash::default_sha256()),
            proposer_address: validator_address,
        },
        commit: Commit {
            height: height.try_into().unwrap(),
            round: 0_u16.into(),
            block_id: tendermint::block::Id {
                hash: Hash::None,
                part_set_header: parts::Header::new(1, Hash::Sha256(rand::random()))
                    .expect("invalid PartSetHeader"),
            },
            signatures: vec![CommitSig::BlockIdFlagCommit {
                validator_address,
                timestamp: time,
                signature: None,
            }],
        },
        validator_set: ValidatorSet::new(
            vec![tendermint::validator::Info {
                address: validator_address,
                pub_key,
                power: 5000_u32.into(),
                name: None,
                proposer_priority: 0_i64.into(),
            }],
            Some(tendermint::validator::Info {
                address: validator_address,
                pub_key,
                power: 5000_u32.into(),
                name: None,
                proposer_priority: 0_i64.into(),
            }),
        ),
        dah: dah.unwrap_or_else(|| DataAvailabilityHeader::from_eds(&ExtendedDataSquare::empty())),
    };

    hash_and_sign(&mut header, &signing_key);
    // Remove validation due to rng values creating invalid validator addresses and what not
    // TODO: Revisit
    header.validate().expect("invalid header generated");

    header
}

pub fn hash_and_sign(header: &mut ExtendedHeader, signing_key: &SigningKey) {
    header.header.validators_hash = header.validator_set.hash();
    header.header.next_validators_hash = header.validator_set.hash();
    header.header.data_hash = Some(header.dah.hash());
    header.commit.block_id.hash = header.header.hash();

    let vote_sign = header
        .commit
        .vote_sign_bytes(&header.header.chain_id, 0)
        .unwrap();
    let sig = signing_key.sign(&vote_sign).to_bytes();

    match header.commit.signatures[0] {
        CommitSig::BlockIdFlagAbsent => {}
        CommitSig::BlockIdFlagNil {
            ref mut signature, ..
        }
        | CommitSig::BlockIdFlagCommit {
            ref mut signature, ..
        } => {
            *signature = Some(Signature::new(sig).unwrap().unwrap());
        }
    }
}
