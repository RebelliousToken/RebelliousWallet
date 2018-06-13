import trimStart from 'lodash/trimStart';
import {
  addHexPrefix,
  bufferToHex,
  toBuffer,
  publicToAddress,
  toChecksumAddress
} from 'ethereumjs-util';
import HDKey from 'hdkey';
import config from '../config';

function hexEncodeQuantity(value) {
  const trimmedValue = trimStart((value).toString('hex'), '0'); //TODO: fix typing
  return addHexPrefix(trimmedValue === '' ? '0' : trimmedValue);
}

function hexEncodeData(value) {
  return bufferToHex(toBuffer(value));
}

function getTransactionFields(t) {
  // For some crazy reason, toJSON spits out an array, not keyed values.
  const {data, gasLimit, gasPrice, to, nonce, value} = t;

  const chainId = config.chainId;

  return {
    value: hexEncodeQuantity(value),
    data: hexEncodeData(data),
    // To address is unchecksummed, which could cause mismatches in comparisons
    to: hexEncodeData(to),
    // Everything else is as-is
    nonce: hexEncodeQuantity(nonce),
    gasPrice: hexEncodeQuantity(gasPrice),
    gasLimit: hexEncodeQuantity(gasLimit),
    chainId
  };
}

function deriveWallets(keys, offset = 0) {
  let hdk;
  let wallets = [];
  let pathBase;
  if (keys.publicKey && keys.chainCode) {
    hdk = new HDKey();
    hdk.publicKey = new Buffer(keys.publicKey, 'hex');
    hdk.chainCode = new Buffer(keys.chainCode, 'hex');
    pathBase = 'm';
  } else {
    return;
  }
  for (let i = 0; i < 5; i++) {
    const index = i + offset;
    const dkey = hdk.derive(`${pathBase}/${index}`);
    const address = publicToAddress(dkey.publicKey, true).toString('hex');
    wallets.push({
      index,
      address: toChecksumAddress(address),
      tokenValues: {}
    });
  }
  return wallets;
}

function deriveTrezorWallets(keys, offset = 0) {
  let hdk;
  let wallets = [];
  let pathBase;
  if (keys.publicKey && keys.chainCode) {
    hdk = new HDKey();
    hdk.publicKey = new Buffer(keys.publicKey, 'hex');
    hdk.chainCode = new Buffer(keys.chainCode, 'hex');
    pathBase = 'm';
  } else {
    return;
  }
  for (let i = 0; i < 5; i++) {
    const index = i + offset;
    const dkey = hdk.derive(`${pathBase}/${index}`);
    const address = publicToAddress(dkey.publicKey, true).toString('hex');
    wallets.push({
      index,
      address: toChecksumAddress(address),
      tokenValues: {}
    });
  }
  return wallets;
}

export {
  getTransactionFields,
  deriveWallets,
  deriveTrezorWallets
}