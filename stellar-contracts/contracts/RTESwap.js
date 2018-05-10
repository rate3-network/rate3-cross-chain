import Crypto from 'crypto';

import { stellar, Stellar } from '../stellar';

const WITHDRAW_REFUND_DELAY = 60 * 60;
const BASE_RESERVE;
const RTE_ASSET;

export function makeHashlock() {
  const preimage = Crypto.randomBytes(32);
  const h = Crypto.createHash('sha256');
  h.update(preimage);
  const hashlock = h.digest();
  return { preimage, hashlock };
}

export function makeHoldingKeys() {
  const holdingKeys = Stellar.Keypair.random();
  return { holdingKeys };
}

export async function buildHoldingAccountTransaction({
  hashlock,
  swapSize,
  holdingAccount,
  depositorAccount,
  withdrawerAccount,
}) {
  let withdrawer = await stellar.loadAccount(withdrawerAccount);

  withdrawer.incrementSequenceNumber();
  const minTime = Math.round(new Date().getTime() / 1000) + WITHDRAW_REFUND_DELAY;
  const refundTx = new Stellar.TransactionBuilder(withdrawer, {
    timebounds: {
      minTime,
      maxTime: 0,
    },
  })
  .addOperation(Stellar.Operation.accountMerge({
    destination: withdrawerAccount,
    source: holdingAccount,
  }))
  .build();

  withdrawer = await stellar.loadAccount(withdrawerAccount);
  const holdingTx = new Stellar.TransactionBuilder(withdrawer)
    .addOperation(Stellar.Operation.createAccount({
      destination: holdingAccount,
      startingBalance: 5 * BASE_RESERVE,    // 5 = 2 + signer hashx + signer bob + asset trustline
      source: withdrawerAccount,
    }))
    .addOperation(Stellar.Operation.changeTrust({
      asset: RTE_ASSET,
      limit: swapSize,
      source: holdingAccount,
    }))
    .addOperation(Stellar.Operation.setOptions({
      signer: {
        ed25519PublicKey: depositorAccount,
        weight: 1,
      },
      source: holdingAccount,
    }))
    .addOperation(Stellar.Operation.setOptions({
      signer: {
        sha256Hash: hashlock,
        weight: 1,
      },
      source: holdingAccount,
    }))
    .addOperation(Stellar.Operation.setOptions({
      signer: {
        preAuthTx: refundTx.hash(),
        weight: 2,
      },
      source: holdingAccount,
    }))
    .addOperation(Stellar.Operation.setOptions({
      masterWeight: 0,
      lowThreshold: 2,
      medThreshold: 2,
      highThreshold: 2,
      source: holdingAccount,
    }))
    .build();

  return { refundTx, holdingTx };
}

export async function buildMoveAssetToHoldingAccountTransaction({
  withdrawerAccount,
  holdingAccount,
  swapSize,
}) {
  const withdrawer = await stellar.loadAccount(withdrawerAccount);
  const moveTx = new Stellar.TransactionBuilder(withdrawer)
    .addOperation(Stellar.Operation.payment({
      asset: RTE_ASSET,
      amount: swapSize,
      destination: holdingAccount,
      source: withdrawerAccount,
    }))
    .build();
  return { moveTx };
}

export async function buildClaimTransaction({ preimage, depositorAccount, holdingAccount }) {
  const holding = await stellar.loadAccount(holdingAccount);
  const claimTx = new Stellar.TransactionBuilder(holding)
    .addOperation(Stellar.Operation.accountMerge({
      destination: depositorAccount,
      source: holdingAccount,
    }))
    .build();
  claimTx.signHashX(preimage);
  return { claimTx };
}
