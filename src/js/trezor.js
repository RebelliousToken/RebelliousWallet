import {getTransactionFields} from './helpers';
import HwWallet from './hwWallet';
import BN from 'bn.js';
import EthTx from 'ethereumjs-tx';
import {addHexPrefix} from 'ethereumjs-util';
import trezorConnect from './trezor-connect';
import mapValues from 'lodash/mapValues';

export const TREZOR_MINIMUM_FIRMWARE = '1.5.2';

export class TrezorWallet extends HwWallet {

  constructor(address, dPath, index) {
    super(address, dPath, index);
  }

  signRawTransaction(tx) {
    return new Promise((resolve, reject) => {
      const info = getTransactionFields(tx);
      let strTx = {};
      strTx.value = info.value;
      strTx.data = info.data;
      strTx.to = info.to;
      strTx.nonce = info.nonce;
      strTx.gasPrice = info.gasPrice;
      strTx.gasLimit = info.gasLimit;
      let chainId = info.chainId;

      // stripHexPrefixAndLower identical to ethFuncs.getNakedAddress
      const cleanedTx = mapValues(mapValues(strTx, stripHexPrefix), padLeftEven);
      trezorConnect.ethereumSignTx(
        // Args
        this.getPath(),
        cleanedTx.nonce,
        cleanedTx.gasPrice,
        cleanedTx.gasLimit,
        cleanedTx.to,
        cleanedTx.value,
        cleanedTx.data,
        chainId,
        // Callback
        result => {
          if (!result.success) {
            return reject(Error(result.error));
          }
          // https://github.com/kvhnuke/etherwallet/blob/v3.10.2.6/app/scripts/uiFuncs.js#L24
          const txToSerialize = {
            value: strTx.value,
            data: strTx.data,
            to: strTx.to,
            nonce: strTx.nonce,
            gasPrice: strTx.gasPrice,
            gasLimit: strTx.gasLimit,
            v: addHexPrefix(new BN(result.v).toString(16)),
            r: addHexPrefix(result.r),
            s: addHexPrefix(result.s)
          };
          const eTx = new EthTx(txToSerialize);
          const serializedTx = eTx.serialize();
          resolve(serializedTx);
        },
        TREZOR_MINIMUM_FIRMWARE
      );
    });
  }

  displayAddress(dPath, index) {
    if (!dPath) {
      dPath = this.dPath;
    }
    if (!index) {
      index = this.index;
    }

    return new Promise((resolve, reject) => {
      trezorConnect.ethereumGetAddress(
        dPath + '/' + index,
        res => {
          if (res.error) {
            reject(res.error);
          } else {
            resolve(res);
          }
        },
        TREZOR_MINIMUM_FIRMWARE
      );
    });
  }
}

function stripHexPrefix(value) {
  return value.replace('0x', '');
}

function padLeftEven(hex) {
  return hex.length % 2 !== 0 ? `0${hex}` : hex;
}

export default TrezorWallet;